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
        private const val ACTION_USB_PERMISSION = "com.streamless.USB_IR_PERMISSION"

        // ── Event names ────────────────────────────────────────────────────────
        const val EVENT_CONNECTED     = "USB_IR_BLASTER_CONNECTED"
        const val EVENT_DISCONNECTED  = "USB_IR_BLASTER_DISCONNECTED"
        const val EVENT_PERM_GRANTED  = "USB_IR_PERMISSION_GRANTED"
        const val EVENT_PERM_DENIED   = "USB_IR_PERMISSION_DENIED"

        // ── USB IR Toy v2 raw transmit constants ───────────────────────────────
        // One "tick" in the USB IR Toy protocol = 21.333 µs
        private const val TICK_US = 21.333

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
        for (device in usbManager.deviceList.values) {
            if (isLikelyIRDevice(device)) {
                onDeviceAttached(device)
                break // manage one IR device at a time
            }
        }
    }

    private fun onDeviceAttached(device: UsbDevice) {
        if (!isLikelyIRDevice(device)) return
        currentDevice = device
        val params = Arguments.createMap().apply {
            putString("name", friendlyName(device))
            putString("vendorId", device.vendorId.toString(16))
            putString("productId", device.productId.toString(16))
        }
        emitEvent(EVENT_CONNECTED, params)

        if (usbManager.hasPermission(device)) {
            openConnection(device)
            // Notify JS that the device is immediately ready (no dialog needed)
            emitEvent(EVENT_PERM_GRANTED, null)
        } else {
            val intent = PendingIntent.getBroadcast(
                reactContext, 0, Intent(ACTION_USB_PERMISSION),
                PendingIntent.FLAG_UPDATE_CURRENT or permissionFlags()
            )
            usbManager.requestPermission(device, intent)
        }
    }

    private fun onDeviceDetached() {
        closeConnection()
        currentDevice = null
        emitEvent(EVENT_DISCONNECTED, null)
    }

    private fun openConnection(device: UsbDevice) {
        closeConnection()
        val conn = usbManager.openDevice(device) ?: return
        deviceConnection = conn
        // Locate a bulk-out or interrupt-out endpoint for transmission
        outer@ for (i in 0 until device.interfaceCount) {
            val iface = device.getInterface(i)
            if (!conn.claimInterface(iface, true)) continue
            for (j in 0 until iface.endpointCount) {
                val ep = iface.getEndpoint(j)
                if (ep.direction == UsbConstants.USB_DIR_OUT &&
                    (ep.type == UsbConstants.USB_ENDPOINT_XFER_BULK ||
                     ep.type == UsbConstants.USB_ENDPOINT_XFER_INT)) {
                    bulkOutEndpoint = ep
                    break@outer
                }
            }
        }
    }

    private fun closeConnection() {
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
            promise.resolve(true)
            return
        }
        val intent = PendingIntent.getBroadcast(
            reactContext, 0, Intent(ACTION_USB_PERMISSION),
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
        val conn = deviceConnection
        val ep   = bulkOutEndpoint

        if (conn == null || ep == null) {
            promise.reject(
                "USB_IR_NOT_CONNECTED",
                "USB IR blaster not connected or permission not granted"
            )
            return
        }

        // Run on a background thread — USB bulk transfer blocks
        Thread {
            try {
                val numPairs = pattern.size() / 2
                // Packet layout: 1 (mode byte) + numPairs * 4 (2 bytes mark + 2 bytes space) + 2 (EOT)
                val buf = ByteArray(1 + numPairs * 4 + 2)
                var idx = 0

                buf[idx++] = 0x03 // USB IR Toy v2: enter raw transmit mode

                for (i in 0 until numPairs) {
                    val markUs  = pattern.getInt(i * 2)
                    val spaceUs = pattern.getInt(i * 2 + 1)
                    val markTick  = (markUs  / TICK_US).toInt().coerceIn(1, 0xFFFE)
                    val spaceTick = (spaceUs / TICK_US).toInt().coerceIn(1, 0xFFFE)
                    buf[idx++] = (markTick  shr 8).toByte()
                    buf[idx++] = (markTick  and 0xFF).toByte()
                    buf[idx++] = (spaceTick shr 8).toByte()
                    buf[idx++] = (spaceTick and 0xFF).toByte()
                }

                // End-of-transmission marker
                buf[idx++] = 0xFF.toByte()
                buf[idx++] = 0xFF.toByte()

                val bytesSent = conn.bulkTransfer(ep, buf, idx, 3000 /* ms timeout */)
                if (bytesSent < 0) {
                    promise.reject(
                        "USB_IR_TRANSMIT_FAILED",
                        "USB bulk transfer returned error code $bytesSent"
                    )
                } else {
                    promise.resolve(null)
                }
            } catch (e: Exception) {
                promise.reject(
                    "USB_IR_TRANSMIT_ERROR",
                    e.message ?: "Unknown transmit error",
                    e
                )
            }
        }.start()
    }
}
