package com.streamless.nativemodules

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbEndpoint
import android.hardware.usb.UsbManager
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * USBIRBlasterModule
 *
 * Detects external USB IR blasters connected via OTG / USB Type-C and transmits IR signals
 * through them. Works in parallel with the built-in ConsumerIrManager (IRBlasterModule).
 *
 * Exposed as NativeModules.USBIRBlaster in JavaScript.
 *
 * Supported events (subscribe via NativeEventEmitter in JS):
 *   USB_IR_BLASTER_CONNECTED    — fired when a recognised IR device is plugged in
 *                                 payload: { name: string, vendorId: string, productId: string }
 *   USB_IR_BLASTER_DISCONNECTED — fired when the device is removed
 *   USB_IR_PERMISSION_GRANTED   — fired after the user taps "OK" on the system permission dialog
 *   USB_IR_PERMISSION_DENIED    — fired when the user taps "Cancel"
 *
 * Transmit protocol:
 *   Uses the USB IR Toy v2 raw transmit packet format which is broadly compatible with most
 *   CDC-ACM/bulk USB IR transceivers sold in the Asian market (Irdroid clones, USB IR Toy,
 *   generic CP210x-based dongles, etc.).
 *   Packet: [0x03] + pairs of big-endian uint16 in 21.333 µs units + [0xFF, 0xFF] (EOT)
 */
class USBIRBlasterModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "USBIRBlaster"
        private const val ACTION_USB_PERMISSION = "com.streamless.USB_IR_PERMISSION"

        // ── Event names ────────────────────────────────────────────────────────
        const val EVENT_CONNECTED     = "USB_IR_BLASTER_CONNECTED"
        const val EVENT_DISCONNECTED  = "USB_IR_BLASTER_DISCONNECTED"
        const val EVENT_PERM_GRANTED  = "USB_IR_PERMISSION_GRANTED"
        const val EVENT_PERM_DENIED   = "USB_IR_PERMISSION_DENIED"

        // ── USB IR Toy v2 raw transmit constants ───────────────────────────────
        // One "tick" in the USB IR Toy protocol = 21.333 µs
        private const val TICK_US = 21.333

        /**
         * Transmit protocol for each connected device.
         *
         * USB_IR_TOY_V2 — standard USB IR Toy v2 handshake:
         *   flush(5×0x00) → 0x03 → wait 'S'(0x53) → send timing pairs in 21.333µs ticks + 0xFF 0xFF
         *
         * RAW_BULK — vendor-specific devices (e.g. ELKSMART) that accept timing pairs
         *   directly without any command/handshake prefix. Same 21.333µs tick unit.
         */
        private enum class IRProtocol { USB_IR_TOY_V2, RAW_BULK }

        /** VID/PID pairs that use RAW_BULK instead of USB IR Toy v2. */
        private val RAW_BULK_DEVICES: Set<Pair<Int, Int>> = setOf(
            Pair(0x045C, 0x0195), // ELKSMART Smart IR Blaster
        )

        // ── Known USB IR blaster VID/PID → friendly name ──────────────────────
        // VendorId and ProductId are decimal in Android's UsbDevice API, so we
        // convert hex literals at declaration time.
        private val KNOWN_IR_DEVICES: Map<Pair<Int, Int>, String> = mapOf(
            // USB-UIRT
            Pair(0x1781, 0x0938) to "USB-UIRT",
            // USB IR Toy (Dangerous Prototypes)
            Pair(0x04d8, 0x003f) to "USB IR Toy v2",
            Pair(0x04d8, 0xfd08) to "USB IR Toy v1",
            // FLIRC USB
            Pair(0x20a0, 0x0006) to "FLIRC USB",
            Pair(0x20a0, 0x4153) to "FLIRC Gen 2",
            // IRTrans USB
            Pair(0x0403, 0xf850) to "IRTrans USB",
            // Irdroid USB
            Pair(0x1e52, 0x0002) to "Irdroid USB",
            // Common CP210x-based generic USB IR dongles (Silicon Labs)
            Pair(0x10c4, 0xea60) to "CP210x USB IR",
            // Common Prolific PL2303-based generic USB IR dongles
            Pair(0x067b, 0x2303) to "PL2303 USB IR",
            // STM32 Virtual COM (many DIY IR sticks)
            Pair(0x0483, 0x5740) to "STM32 USB IR",
            Pair(0x0483, 0x5750) to "STM32 USB IR",
            // ELKSMART Smart IR Blaster
            Pair(0x045C, 0x0195) to "ELKSMART Smart IR Blaster",
        )
    }

    override fun getName(): String = "USBIRBlaster"

    private val usbManager: UsbManager by lazy {
        reactContext.getSystemService(Context.USB_SERVICE) as UsbManager
    }

    @Volatile private var currentDevice: UsbDevice? = null
    @Volatile private var deviceConnection: UsbDeviceConnection? = null
    @Volatile private var bulkOutEndpoint: UsbEndpoint? = null
    @Volatile private var bulkInEndpoint: UsbEndpoint? = null
    private val isTransmitting = java.util.concurrent.atomic.AtomicBoolean(false)

    private enum class ElkSmartSubtype { D552, D226, UNKNOWN }
    @Volatile private var elkSmartSubtype = ElkSmartSubtype.UNKNOWN

    // ─── Event helpers ────────────────────────────────────────────────────────

    private fun emitEvent(name: String, params: com.facebook.react.bridge.WritableMap?) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(name, params)
    }

    /** Required by React Native's NativeEventEmitter — no-op, subscription managed in JS. */
    @ReactMethod fun addListener(@Suppress("UNUSED_PARAMETER") eventName: String) {}
    @ReactMethod fun removeListeners(@Suppress("UNUSED_PARAMETER") count: Int) {}

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    override fun initialize() {
        super.initialize()
        val filter = IntentFilter().apply {
            addAction(UsbManager.ACTION_USB_DEVICE_ATTACHED)
            addAction(UsbManager.ACTION_USB_DEVICE_DETACHED)
            addAction(ACTION_USB_PERMISSION)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            reactContext.registerReceiver(usbReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            reactContext.registerReceiver(usbReceiver, filter)
        }
        // Scan devices already connected before the app started
        scanAlreadyConnectedDevices()
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        try { reactContext.unregisterReceiver(usbReceiver) } catch (_: Exception) {}
        closeConnection()
    }

    // ─── BroadcastReceiver ────────────────────────────────────────────────────

    private val usbReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val device: UsbDevice? = extractDevice(intent)
            when (intent.action) {
                UsbManager.ACTION_USB_DEVICE_ATTACHED -> {
                    if (device != null) onDeviceAttached(device)
                }
                UsbManager.ACTION_USB_DEVICE_DETACHED -> {
                    if (device != null && device.deviceId == currentDevice?.deviceId) {
                        onDeviceDetached()
                    }
                }
                ACTION_USB_PERMISSION -> {
                    val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
                    if (granted && device != null) {
                        openConnection(device)
                        emitEvent(EVENT_PERM_GRANTED, null)
                    } else {
                        emitEvent(EVENT_PERM_DENIED, null)
                    }
                }
            }
        }
    }

    @Suppress("DEPRECATION")
    private fun extractDevice(intent: Intent): UsbDevice? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
            intent.getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice::class.java)
        else
            intent.getParcelableExtra(UsbManager.EXTRA_DEVICE)

    // ─── Device classification ────────────────────────────────────────────────

    /**
     * Returns true if the device is likely an IR blaster.
     * Priority order:
     *   1. Exact VID+PID match in KNOWN_IR_DEVICES
     *   2. Device product name contains "IR" (case-insensitive)
     *   3. Has a CDC Data / CDC Communication / HID interface (broad fallback)
     */
    private fun isLikelyIRDevice(device: UsbDevice): Boolean {
        if (KNOWN_IR_DEVICES.containsKey(Pair(device.vendorId, device.productId))) return true
        val name = (device.productName ?: "").uppercase()
        if (name.contains("IR") && (name.contains("BLAST") || name.contains("REMOTE") ||
                name.contains("INFRA") || name.contains("EMITTER"))) return true
        for (i in 0 until device.interfaceCount) {
            val cls = device.getInterface(i).interfaceClass
            if (cls == UsbConstants.USB_CLASS_CDC_DATA ||
                cls == UsbConstants.USB_CLASS_COMM ||
                cls == UsbConstants.USB_CLASS_HID) return true
        }
        return false
    }

    private fun friendlyName(device: UsbDevice): String =
        KNOWN_IR_DEVICES[Pair(device.vendorId, device.productId)]
            ?: device.productName
            ?: "USB IR Blaster (${device.vendorId.toString(16)}:${device.productId.toString(16)})"

    // ─── Device management ────────────────────────────────────────────────────

    private fun scanAlreadyConnectedDevices() {
        val all = usbManager.deviceList.values
        Log.d(TAG, "scanAlreadyConnected: ${all.size} USB device(s) present")
        for (device in all) {
            Log.d(TAG, "  checking: ${device.productName} vid=0x${device.vendorId.toString(16)} pid=0x${device.productId.toString(16)} isIR=${isLikelyIRDevice(device)}")
            if (isLikelyIRDevice(device)) {
                onDeviceAttached(device)
                break // manage one IR device at a time
            }
        }
    }

    private fun onDeviceAttached(device: UsbDevice) {
        if (!isLikelyIRDevice(device)) return
        Log.d(TAG, "onDeviceAttached: ${friendlyName(device)} vid=0x${device.vendorId.toString(16)} pid=0x${device.productId.toString(16)}")
        currentDevice = device
        val params = Arguments.createMap().apply {
            putString("name", friendlyName(device))
            putString("vendorId", device.vendorId.toString(16))
            putString("productId", device.productId.toString(16))
        }
        emitEvent(EVENT_CONNECTED, params)

        if (usbManager.hasPermission(device)) {
            Log.d(TAG, "onDeviceAttached: permission already granted, opening connection")
            openConnection(device)
            // Notify JS that the device is immediately ready (no dialog needed)
            emitEvent(EVENT_PERM_GRANTED, null)
        } else {
            Log.d(TAG, "onDeviceAttached: no permission yet, requesting…")
            val intent = PendingIntent.getBroadcast(
                reactContext, 0,
                Intent(ACTION_USB_PERMISSION).apply { setPackage(reactContext.packageName) },
                PendingIntent.FLAG_UPDATE_CURRENT or permissionFlags()
            )
            usbManager.requestPermission(device, intent)
        }
    }

    private fun onDeviceDetached() {
        closeConnection()
        currentDevice = null
        elkSmartSubtype = ElkSmartSubtype.UNKNOWN
        emitEvent(EVENT_DISCONNECTED, null)
    }

    private fun openConnection(device: UsbDevice) {
        closeConnection()
        Log.d(TAG, "openConnection: opening device ${friendlyName(device)}")
        val conn = usbManager.openDevice(device) ?: run {
            Log.e(TAG, "openConnection: usbManager.openDevice returned null")
            return
        }
        deviceConnection = conn
        // Locate bulk-out AND bulk-in endpoints for transmit + handshake reads.
        // Iterate all interfaces; stop early once both endpoints are found.
        for (i in 0 until device.interfaceCount) {
            val iface = device.getInterface(i)
            Log.d(TAG, "openConnection: interface[$i] class=${iface.interfaceClass} claimResult=${conn.claimInterface(iface, true)}")
            if (!conn.claimInterface(iface, true)) continue
            for (j in 0 until iface.endpointCount) {
                val ep = iface.getEndpoint(j)
                val dir = if (ep.direction == UsbConstants.USB_DIR_OUT) "OUT" else "IN"
                val type = when (ep.type) {
                    UsbConstants.USB_ENDPOINT_XFER_BULK -> "BULK"
                    UsbConstants.USB_ENDPOINT_XFER_INT  -> "INT"
                    else -> "OTHER"
                }
                Log.d(TAG, "openConnection:   ep[$j] $dir $type addr=0x${ep.address.toString(16)}")
                val isDataEp = ep.type == UsbConstants.USB_ENDPOINT_XFER_BULK ||
                               ep.type == UsbConstants.USB_ENDPOINT_XFER_INT
                if (!isDataEp) continue
                if (ep.direction == UsbConstants.USB_DIR_OUT && bulkOutEndpoint == null) {
                    bulkOutEndpoint = ep
                    Log.d(TAG, "openConnection:   → selected as bulkOut")
                } else if (ep.direction == UsbConstants.USB_DIR_IN && bulkInEndpoint == null) {
                    bulkInEndpoint = ep
                    Log.d(TAG, "openConnection:   → selected as bulkIn")
                }
            }
            if (bulkOutEndpoint != null && bulkInEndpoint != null) break
        }
        Log.d(TAG, "openConnection done: bulkOut=${bulkOutEndpoint != null} bulkIn=${bulkInEndpoint != null}")

        // If this is an ElkSmart device, perform the proprietary handshake to identify subtype.
        val eConn = deviceConnection
        val eOut  = bulkOutEndpoint
        val eIn   = bulkInEndpoint
        if (eConn != null && eOut != null && eIn != null && isElkSmart(device)) {
            elkSmartSubtype = ElkSmartSubtype.UNKNOWN
            val ok = elkSmartHandshake(eConn, eIn, eOut)
            if (!ok) Log.w(TAG, "openConnection: ElkSmart handshake failed — will retry on transmit")
        }
    }

    private fun isElkSmart(device: UsbDevice): Boolean {
        val elkSmartVid = 0x045C
        val elkSmartPids = setOf(0x0131, 0x0132, 0x014A, 0x0184, 0x0195, 0x02AA)
        return device.vendorId == elkSmartVid && device.productId in elkSmartPids
    }

    private fun closeConnection() {
        bulkInEndpoint = null
        bulkOutEndpoint = null
        deviceConnection?.close()
        deviceConnection = null
    }

    private fun permissionFlags(): Int =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0

    // ─── React Methods ────────────────────────────────────────────────────────

    /**
     * Returns true when a USB IR blaster is plugged in, the app has USB permission,
     * and a bulk/interrupt-out endpoint has been successfully opened.
     */
    @ReactMethod
    fun isConnected(promise: Promise) {
        val device = currentDevice
        // bulkInEndpoint is optional — some devices have only a bulk-out endpoint.
        promise.resolve(
            device != null &&
            usbManager.hasPermission(device) &&
            deviceConnection != null &&
            bulkOutEndpoint != null
        )
    }

    /**
     * Returns the friendly name of the currently connected USB IR device,
     * or null if no device is connected.
     */
    @ReactMethod
    fun getDeviceName(promise: Promise) {
        val device = currentDevice
        promise.resolve(if (device != null) friendlyName(device) else null)
    }

    /**
     * Requests USB permission for the currently connected device.
     * Permission result is delivered via USB_IR_PERMISSION_GRANTED or
     * USB_IR_PERMISSION_DENIED events.
     */
    @ReactMethod
    fun requestPermission(promise: Promise) {
        val device = currentDevice ?: run {
            promise.reject("USB_IR_NOT_FOUND", "No USB IR blaster detected")
            return
        }
        if (usbManager.hasPermission(device)) {
            if (deviceConnection == null) openConnection(device)
            emitEvent(EVENT_PERM_GRANTED, null)
            promise.resolve(true)
            return
        }
        val intent = PendingIntent.getBroadcast(
            reactContext, 0,
            Intent(ACTION_USB_PERMISSION).apply { setPackage(reactContext.packageName) },
            PendingIntent.FLAG_UPDATE_CURRENT or permissionFlags()
        )
        usbManager.requestPermission(device, intent)
        // Resolution happens via the BroadcastReceiver + PERMISSION_GRANTED/DENIED events
        promise.resolve(false)
    }

    /**
     * Transmits an IR signal via the connected USB IR blaster.
     *
     * Uses USB IR Toy v2 raw transmit packet format:
     *   [0x03]  (enter raw transmit mode)
     *   repeating uint16 big-endian mark/space pairs in 21.333 µs units
     *   [0xFF, 0xFF]  (end of transmission)
     *
     * @param carrierFrequency  Carrier frequency in Hz (e.g. 38000)
     * @param pattern           Alternating mark/space durations in microseconds
     */
    @ReactMethod
    fun transmit(carrierFrequency: Int, pattern: ReadableArray, promise: Promise) {
        // Deduplicate concurrent calls (e.g. React StrictMode double-invoke in dev builds).
        // compareAndSet(false, true) is atomic: only the first caller proceeds.
        if (!isTransmitting.compareAndSet(false, true)) {
            Log.w(TAG, "transmit: duplicate call skipped (already transmitting)")
            promise.resolve(null)
            return
        }

        Log.d(TAG, "transmit: freq=${carrierFrequency}Hz pattern.size=${pattern.size()} conn=${deviceConnection != null} bulkOut=${bulkOutEndpoint != null} device=${currentDevice?.productName}")

        // If the connection dropped but the device is still present and permitted, reconnect.
        if ((deviceConnection == null || bulkOutEndpoint == null) && currentDevice != null) {
            val d = currentDevice!!
            Log.w(TAG, "transmit: connection lost, attempting reconnect for ${friendlyName(d)}")
            if (usbManager.hasPermission(d)) openConnection(d)
        }

        val conn = deviceConnection
        val ep   = bulkOutEndpoint

        if (conn == null || ep == null) {
            Log.e(TAG, "transmit: no connection or endpoint — conn=$conn ep=$ep")
            isTransmitting.set(false)
            promise.reject(
                "USB_IR_NOT_CONNECTED",
                "USB IR blaster not connected or permission not granted"
            )
            return
        }

        val protocol = currentDevice
            ?.let { if (RAW_BULK_DEVICES.contains(Pair(it.vendorId, it.productId))) IRProtocol.RAW_BULK else IRProtocol.USB_IR_TOY_V2 }
            ?: IRProtocol.USB_IR_TOY_V2
        Log.d(TAG, "transmit: protocol=$protocol")

        // Run on a background thread — USB bulk transfer blocks
        Thread {
            try {
                val bulkIn = bulkInEndpoint

                if (protocol == IRProtocol.USB_IR_TOY_V2) {
                    // ── USB IR Toy v2 strict handshake ────────────────────────────────
                    // flush → 0x03 → wait 'S'(0x53) → data + 0xFF 0xFF
                    val flush = ByteArray(5) { 0x00 }
                    conn.bulkTransfer(ep, flush, flush.size, 200)
                    if (bulkIn != null) {
                        val drain = ByteArray(64)
                        repeat(3) { conn.bulkTransfer(bulkIn, drain, drain.size, 30) }
                    }
                    val modeRes = conn.bulkTransfer(ep, byteArrayOf(0x03), 1, 500)
                    Log.d(TAG, "transmit: [TOY_V2] send 0x03 result=$modeRes")
                    if (modeRes < 0) {
                        promise.reject("USB_IR_TRANSMIT_FAILED", "Failed to send 0x03")
                        return@Thread
                    }
                    if (bulkIn != null) {
                        val resp = ByteArray(1)
                        val n = conn.bulkTransfer(bulkIn, resp, 1, 1000)
                        val gotHex = if (n > 0) "0x${resp[0].toInt().and(0xFF).toString(16)}" else "timeout"
                        Log.d(TAG, "transmit: [TOY_V2] handshake response: $gotHex")
                        if (n < 0 || resp[0] != 0x53.toByte()) {
                            promise.reject("USB_IR_HANDSHAKE_FAILED", "Expected 'S'(0x53), got $gotHex")
                            return@Thread
                        }
                    }
                } else {
                    // ── RAW_BULK: ElkSmart proprietary protocol ──────────────────────
                    // Protocol reverse-engineered from github.com/iodn/android-ir-blaster
                    // Handshake: send 0xFC*4, read 6-byte subtype response
                    // Encode: RLE pulse compression + mangled freq/len header + 63-byte frames

                    // Reopen connection and re-run handshake
                    val dev2 = currentDevice
                    if (dev2 != null && usbManager.hasPermission(dev2)) openConnection(dev2)
                    val xConn = deviceConnection
                    val xEp   = bulkOutEndpoint
                    val xIn   = bulkInEndpoint
                    if (xConn == null || xEp == null || xIn == null) {
                        promise.reject("USB_IR_NOT_CONNECTED", "Failed to reopen ElkSmart connection")
                        return@Thread
                    }

                    // If handshake failed during openConnection(), retry now
                    if (elkSmartSubtype == ElkSmartSubtype.UNKNOWN) {
                        val ok = elkSmartHandshake(xConn, xIn, xEp)
                        if (!ok) {
                            Log.w(TAG, "transmit: [ELKSMART] handshake failed — aborting")
                            promise.reject("USB_IR_HANDSHAKE_FAILED", "ElkSmart handshake failed")
                            return@Thread
                        }
                    }

                    // Build pattern array from ReadableArray for encoding
                    val patternUs = IntArray(pattern.size()) { i -> pattern.getInt(i) }
                    val frames = elkSmartEncode(carrierFrequency, patternUs)

                    Log.d(TAG, "transmit: [ELKSMART] subtype=$elkSmartSubtype frames=${frames.size} totalBytes=${frames.sumOf { it.size }}")

                    var frameFailed = false
                    for ((idx2, frame) in frames.withIndex()) {
                        val rc = xConn.bulkTransfer(xEp, frame, frame.size, 400)
                        if (rc <= 0) {
                            Log.w(TAG, "transmit: frame $idx2/${frames.size} failed rc=$rc")
                            frameFailed = true
                            break
                        }
                        if (frames.size > 1) android.os.SystemClock.sleep(2) // 2ms inter-frame
                    }

                    if (frameFailed) {
                        promise.reject("USB_IR_TRANSMIT_FAILED", "ElkSmart frame bulkTransfer failed")
                        return@Thread
                    }

                    // Post-transmit delay
                    val totalUs = patternUs.fold(0L) { acc, v -> acc + v.toLong().coerceAtLeast(0L) }
                    val postMs = ((totalUs / 1000.0).toLong() + 25L).coerceAtLeast(80L)
                    android.os.SystemClock.sleep(postMs)

                    // Drain IN endpoint
                    val drain = ByteArray(maxOf(xIn.maxPacketSize, 64))
                    val deadline2 = android.os.SystemClock.uptimeMillis() + 120L
                    while (android.os.SystemClock.uptimeMillis() < deadline2) {
                        val r = xConn.bulkTransfer(xIn, drain, drain.size, 20)
                        if (r <= 0) break
                    }

                    Log.d(TAG, "transmit: [ELKSMART] SUCCESS")
                    promise.resolve(null)
                    return@Thread
                }

                // ── USB IR Toy v2 data packet (reached only for TOY_V2) ───────────────
                // big-endian uint16 in 21.333µs ticks + 0xFF 0xFF EOT
                val numPairs = pattern.size() / 2
                val buf = ByteArray(numPairs * 4 + 2)
                var idx = 0
                for (i in 0 until numPairs) {
                    val markTick  = (pattern.getInt(i * 2)     / TICK_US).toInt().coerceIn(1, 0xFFFE)
                    val spaceTick = (pattern.getInt(i * 2 + 1) / TICK_US).toInt().coerceIn(1, 0xFFFE)
                    buf[idx++] = (markTick  shr 8).toByte(); buf[idx++] = (markTick  and 0xFF).toByte()
                    buf[idx++] = (spaceTick shr 8).toByte(); buf[idx++] = (spaceTick and 0xFF).toByte()
                }
                buf[idx++] = 0xFF.toByte(); buf[idx++] = 0xFF.toByte()

                val preview = buf.take(8).joinToString(" ") { "0x${it.toInt().and(0xFF).toString(16).padStart(2,'0')}" }
                Log.d(TAG, "transmit: [TOY_V2] sending $idx bytes preview=[$preview]")
                val bytesSent = conn.bulkTransfer(ep, buf, idx, 3000)
                Log.d(TAG, "transmit: bulkTransfer result=$bytesSent")
                if (bytesSent < 0) {
                    promise.reject("USB_IR_TRANSMIT_FAILED", "bulkTransfer error $bytesSent")
                } else {
                    Log.d(TAG, "transmit: SUCCESS — $bytesSent bytes sent")
                    promise.resolve(null)
                }
            } catch (e: Exception) {
                promise.reject("USB_IR_TRANSMIT_ERROR", e.message ?: "Unknown error", e)
            } finally {
                isTransmitting.set(false)
            }
        }.start()
    }

    // ─── ElkSmart protocol helpers ────────────────────────────────────────────
    // Ported from github.com/iodn/android-ir-blaster (GPLv3)
    // ElkSmartUsbProtocolFormatter.kt

    /**
     * Send the 0xFC*4 identify packet and read the 6-byte response.
     * bytes[4..5] identify device subtype.
     */
    private fun elkSmartHandshake(
        conn: UsbDeviceConnection,
        inEp: UsbEndpoint,
        outEp: UsbEndpoint
    ): Boolean {
        // Drain any stale IN data
        val drain = ByteArray(maxOf(inEp.maxPacketSize, 64))
        while (true) {
            val r = conn.bulkTransfer(inEp, drain, drain.size, 10)
            if (r <= 0) break
        }

        val identify = byteArrayOf(0xFC.toByte(), 0xFC.toByte(), 0xFC.toByte(), 0xFC.toByte())
        val w = conn.bulkTransfer(outEp, identify, identify.size, 200)
        if (w != identify.size) {
            Log.w(TAG, "elkSmartHandshake: write failed (w=$w expected ${identify.size})")
            return false
        }

        val resp = ByteArray(64)
        var got = -1
        val deadline = android.os.SystemClock.uptimeMillis() + 450L
        while (android.os.SystemClock.uptimeMillis() < deadline) {
            val n = conn.bulkTransfer(inEp, resp, resp.size, 150)
            if (n > 0) { got = n; break }
        }

        if (got < 6) {
            Log.w(TAG, "elkSmartHandshake: short/no response (got=$got)")
            return false
        }
        if (resp[0] != 0xFC.toByte() || resp[1] != 0xFC.toByte() ||
            resp[2] != 0xFC.toByte() || resp[3] != 0xFC.toByte()) {
            val hex = resp.take(got).joinToString(" ") { "0x${it.toInt().and(0xFF).toString(16).padStart(2,'0')}" }
            Log.w(TAG, "elkSmartHandshake: bad magic in response: $hex")
            return false
        }

        val typeHi = resp[4].toInt() and 0xFF
        val typeLo = resp[5].toInt() and 0xFF
        elkSmartSubtype = when {
            typeHi == 0x70 && typeLo == 0x01 -> ElkSmartSubtype.D552
            typeHi == 0x02 && typeLo == 0xAA -> ElkSmartSubtype.D226
            else -> ElkSmartSubtype.UNKNOWN
        }
        Log.d(TAG, "elkSmartHandshake: OK subtype=$elkSmartSubtype (0x${typeHi.toString(16)} 0x${typeLo.toString(16)})")
        return elkSmartSubtype != ElkSmartSubtype.UNKNOWN
    }

    /** Reverse all 8 bits of the low byte of [v], then invert. */
    private fun elkSmartMangleByte(v: Int): Byte {
        var value = v and 0xFF
        var reversed = 0
        repeat(8) {
            reversed = (reversed shl 1) or (value and 1)
            value = value ushr 1
        }
        return (reversed.inv() and 0xFF).toByte()
    }

    /** Checksum for a full 62-byte frame: mangled((sum&0xF0)|((sum>>8)&0x0F)). */
    private fun elkSmartChecksum62(buf: ByteArray): Byte {
        var sum = 0
        for (i in 0 until 62) sum += (buf[i].toInt() and 0xFF)
        val x = (sum and 0xF0) or ((sum ushr 8) and 0x0F)
        return elkSmartMangleByte(x)
    }

    /**
     * Encode a microsecond duration value into the ElkSmart compact format.
     * Values ≤ 2032µs: quantize to 1/16µs (single byte).
     * Larger values: 7-bit variable-length encoding (continuation bit = 0x80).
     */
    private fun elkSmartCompressValueUs(valueUs: Int, out: ArrayList<Byte>) {
        if (valueUs <= 2032) {
            val q = if (valueUs <= 1) valueUs
                    else ((valueUs / 16.0) + 0.5).toInt()
            out.add((q and 0xFF).toByte())
            return
        }
        var v = valueUs
        while (true) {
            var b = v and 0x7F
            v = v ushr 7
            if (v != 0) b = b or 0x80
            if ((b and 0xFF) == 0xFF) b = 0xFE  // 0xFF is reserved
            out.add((b and 0xFF).toByte())
            if (v == 0) break
        }
    }

    private data class ElkSmartPulse(val onUs: Int, val offUs: Int)

    private fun elkSmartToPulses(patternUs: IntArray): List<ElkSmartPulse> {
        val out = ArrayList<ElkSmartPulse>((patternUs.size + 1) / 2)
        var i = 0
        while (i < patternUs.size) {
            val on  = patternUs[i].coerceAtLeast(0)
            val off = if (i + 1 < patternUs.size) patternUs[i + 1].coerceAtLeast(0)
                      else 10_000  // trailing gap for odd-length patterns
            out.add(ElkSmartPulse(on, off))
            i += 2
        }
        return out
    }

    /**
     * RLE-compress the pulse list using the top-2 most-frequent pulse pairs.
     * Header: [p2.on p2.off p1.on p1.off 0xFF 0xFF 0xFF]
     * Body:   0x00=p1, 0x01=p2, else inline compressed on+off values.
     */
    private fun elkSmartCompressPulses(pulses: List<ElkSmartPulse>): ByteArray {
        if (pulses.isEmpty()) return ByteArray(0)

        val freq = HashMap<ElkSmartPulse, Int>(pulses.size)
        for (p in pulses) freq[p] = (freq[p] ?: 0) + 1
        val sorted = freq.entries.sortedByDescending { it.value }

        val p1 = sorted.getOrNull(0)?.key ?: pulses[0]  // most frequent  → token 0x00
        val p2 = sorted.getOrNull(1)?.key ?: p1          // 2nd frequent   → token 0x01

        val out = ArrayList<Byte>()
        elkSmartCompressValueUs(p2.onUs,  out)
        elkSmartCompressValueUs(p2.offUs, out)
        elkSmartCompressValueUs(p1.onUs,  out)
        elkSmartCompressValueUs(p1.offUs, out)
        out.add(0xFF.toByte())
        out.add(0xFF.toByte())
        out.add(0xFF.toByte())

        for (p in pulses) {
            when {
                p == p1 -> out.add(0x00)
                p == p2 -> out.add(0x01)
                else -> {
                    elkSmartCompressValueUs(p.onUs,  out)
                    elkSmartCompressValueUs(p.offUs, out)
                }
            }
        }
        return out.toByteArray()
    }

    /**
     * Full ElkSmart encode:
     *   message = [0xFF*4] + [mangled freq bytes] + [mangled len bytes] + payload
     * Fragmented into 63-byte frames (62 data + 1 checksum), last frame smaller.
     */
    private fun elkSmartEncode(frequencyHz: Int, patternUs: IntArray): List<ByteArray> {
        val pulses  = elkSmartToPulses(patternUs)
        val payload = elkSmartCompressPulses(pulses)

        val f   = frequencyHz + 0x7FFFF
        val len = payload.size

        val msg = ArrayList<Byte>(9 + payload.size)
        msg.add(0xFF.toByte()); msg.add(0xFF.toByte())
        msg.add(0xFF.toByte()); msg.add(0xFF.toByte())
        msg.add(elkSmartMangleByte(f ushr 8))
        msg.add(elkSmartMangleByte(f ushr 16))
        msg.add(elkSmartMangleByte(f))
        msg.add(elkSmartMangleByte(len ushr 8))
        msg.add(elkSmartMangleByte(len))
        for (b in payload) msg.add(b)

        val message = msg.toByteArray()
        val frames  = ArrayList<ByteArray>()
        var offset  = 0
        while (offset < message.size) {
            val chunk = minOf(62, message.size - offset)
            if (chunk == 62) {
                val buf = ByteArray(63)
                System.arraycopy(message, offset, buf, 0, 62)
                buf[62] = elkSmartChecksum62(buf)
                frames.add(buf)
            } else {
                val buf = ByteArray(chunk)
                System.arraycopy(message, offset, buf, 0, chunk)
                frames.add(buf)
            }
            offset += chunk
        }
        return frames
    }
}
