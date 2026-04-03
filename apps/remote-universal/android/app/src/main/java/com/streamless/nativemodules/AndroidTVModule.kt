package com.streamless.nativemodules

import android.content.Context
import android.util.Base64
import com.facebook.react.bridge.*
import java.io.*
import java.math.BigInteger
import java.net.InetSocketAddress
import java.security.*
import java.security.cert.CertificateFactory
import java.security.cert.X509Certificate
import java.security.interfaces.RSAPublicKey
import java.security.spec.PKCS8EncodedKeySpec
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit
import javax.net.ssl.*

/**
 * AndroidTVModule — implements the Android TV Remote Service (ATVRS) protocol
 * directly on-device. No backend server required.
 *
 * Protocol overview:
 *   PORT 6467 – TLS pairing service. Exchanges protobuf messages; TV displays a
 *               6-digit hex PIN. Client sends a SHA-256 secret derived from both
 *               RSA public keys + the PIN. On success: cert saved to prefs.
 *   PORT 6466 – TLS remote-control service. Uses the saved cert. After a short
 *               configure/ping exchange the client sends RemoteKeyInject messages.
 *
 * All network I/O runs on a background executor; React promises are resolved on
 * the calling thread pool, which is safe per the React Native bridge contract.
 */
class AndroidTVModule(private val rc: ReactApplicationContext) :
    ReactContextBaseJavaModule(rc) {

    override fun getName(): String = "AndroidTV"

    private val executor = Executors.newCachedThreadPool()

    // ── IME text debounce ──────────────────────────────────────────────────────
    private val TEXT_DEBOUNCE_MS = 300L
    private val textDebounceScheduler: ScheduledExecutorService =
        Executors.newSingleThreadScheduledExecutor()
    @Volatile private var textDebounceJob: ScheduledFuture<*>? = null
    @Volatile private var textDebounceIp   = ""
    @Volatile private var textDebounceText = ""

    // ── Shared prefs keys ───────────────────────────────────────────────────
    private val PREFS = "androidtv_remote"
    private val KEY_PRIV = "client_key_pem"
    private val KEY_CERT = "client_cert_pem"
    private val KEY_PAIRED = "paired_ips"   // comma-separated

    // ── Active pairing sockets (ip → socket still open during PIN entry) ───
    private val pairingSockets = ConcurrentHashMap<String, SSLSocket>()
    // Latch: set to a promise when confirmPairing is called, resolved by reader thread
    private val confirmPromises = ConcurrentHashMap<String, Promise>()

    // ── Persistent remote-control sessions (ip → open TLS session on 6466) ─
    private val remoteSessions = ConcurrentHashMap<String, RemoteSession>()
    // Serialises connect() so debounce + submitText can never race each other.
    private val sessionLock = Any()

    /**
     * Return the live session for [ip], or create and connect a new one.
     * Guaranteed: only one thread can run connect() for a given [ip] at a time.
     * Caller must propagate exceptions and call [remoteSessions].remove(ip) on failure.
     */
    private fun getOrConnectSession(ip: String): RemoteSession {
        // Fast path – no lock needed when a live session is already there.
        remoteSessions[ip]?.takeIf { it.alive }?.let { return it }
        // Slow path – serialise the connect so only one thread ever calls connect().
        synchronized(sessionLock) {
            // Re-check under lock: another thread may have just connected.
            remoteSessions[ip]?.takeIf { it.alive }?.let { return it }
            // Close the dead session (if any) only after we know we'll replace it.
            remoteSessions.remove(ip)?.close()
            val s = RemoteSession(ip)
            s.connect()              // may throw; don't store on failure
            remoteSessions[ip] = s   // only store after successful connect
            return s
        }
    }

    private inner class RemoteSession(val ip: String) {
        var socket: SSLSocket? = null
        var output: OutputStream? = null
        @Volatile var alive = false
        private val writeLock = Any()
        @Volatile var imeActive = false       // true when TV reported an active text field
        @Volatile var setActiveDone = false   // true after SetActive exchange completes
        @Volatile var imeRejected = false     // true after error 5 on this session — don't retry IME
        var lastSentText = ""                 // last text sent (for per-char diff)
        var imeCounter = 0                    // echoed from TV's remote_ime_batch_edit
        var imeFieldCounter = 0               // echoed from TV's remote_ime_batch_edit

        fun connect() {
            android.util.Log.d("AndroidTV", "[$ip] connect() — opening remote session on port 6466")
            close()
            val cert = getOrGenerateCert()
            android.util.Log.d("AndroidTV", "[$ip] cert loaded, creating TLS socket")
            val s = try {
                createTlsSocket(ip, 6466, cert.key, cert.cert)
            } catch (e: Exception) {
                android.util.Log.e("AndroidTV", "[$ip] TLS handshake failed: ${e.message}", e)
                throw e
            }
            android.util.Log.d("AndroidTV", "[$ip] TLS socket connected")
            socket = s
            val out = s.outputStream
            val inp = s.inputStream
            output = out

            // Protocol handshake: read until Configure exchange is done.
            val deadline = System.currentTimeMillis() + 10_000
            var ready = false
            while (!ready && System.currentTimeMillis() < deadline) {
                val msg = readDelimitedMessage(inp) ?: break
                val fields = decodeMessage(msg)
                android.util.Log.d("AndroidTV", "[$ip] handshake msg fields: ${fields.keys}")
                when {
                    fields.containsKey(RMF_CONFIGURE) -> {
                        val cfgBytes = (fields[RMF_CONFIGURE] as? ByteArray) ?: ByteArray(0)
                        val cfgFields = decodeMessage(cfgBytes)
                        val tvFeatures = (cfgFields[1] as? Long)?.toInt() ?: 0
                        android.util.Log.d("AndroidTV",
                            "[$ip] TV Configure code1=$tvFeatures (IME=${tvFeatures and 4 != 0})")
                        android.util.Log.d("AndroidTV", "[$ip] → sending Configure + SetActive")
                        out.write(buildRemoteMessage(mapOf(
                            RMF_CONFIGURE to V_MSG(buildRemoteConfigure(tvFeatures)),
                        )))
                        // Send SetActive immediately after Configure — required for
                        // the TV to start pushing IME events (field 20/22).
                        out.write(buildRemoteMessage(mapOf(
                            RMF_SET_ACTIVE to V_MSG(varintField(1, 622)),
                        )))
                        out.flush()
                        setActiveDone = true
                        ready = true
                    }
                    fields.containsKey(RMF_SET_ACTIVE) -> {
                        // TV's SetActive may arrive during handshake — acknowledge.
                        android.util.Log.d("AndroidTV", "[$ip] handshake: TV SetActive received")
                        setActiveDone = true
                    }
                    fields.containsKey(RMF_PING) -> {
                        android.util.Log.d("AndroidTV", "[$ip] → responding to Ping")
                        val pingFields = decodeMessage(
                            (fields[RMF_PING] as? ByteArray) ?: ByteArray(0)
                        )
                        val val1 = (pingFields[1] as? Long)?.toInt() ?: 0
                        out.write(buildRemoteMessage(mapOf(
                            RMF_PONG to V_MSG(varintField(1, val1)),
                        )))
                        out.flush()
                    }
                    fields.containsKey(RMF_IME_KEY_INJECT) -> {
                        // TV is advertising an active text field during handshake.
                        val info = decodeImeMessage(
                            (fields[RMF_IME_KEY_INJECT] as? ByteArray) ?: ByteArray(0))
                        imeActive    = info.hasTextField
                        lastSentText = info.text
                        android.util.Log.d("AndroidTV",
                            "[$ip] handshake: TV IME hasField=${info.hasTextField} text='${info.text}' hint='${info.hint}' → imeActive=$imeActive")
                        emitImeEvent(ip, info.text, info.hint, imeActive)
                    }
                    fields.containsKey(RMF_IME_SHOW_REQ) -> {
                        val info = decodeImeShowRequest(
                            (fields[RMF_IME_SHOW_REQ] as? ByteArray) ?: ByteArray(0))
                        imeActive = info.hasTextField
                        lastSentText = info.text
                        android.util.Log.d("AndroidTV",
                            "[$ip] handshake: TV ImeShowReq hasField=${info.hasTextField} text='${info.text}' hint='${info.hint}'")
                        emitImeEvent(ip, info.text, info.hint, imeActive)
                    }
                }
            }
            if (!ready) {
                android.util.Log.e("AndroidTV", "[$ip] handshake timed out — TV did not send Configure")
                close()
                throw IOException("TV did not become ready for commands")
            }
            android.util.Log.d("AndroidTV", "[$ip] handshake complete, session alive")
            alive = true

            // Background reader thread: handles ping/pong to keep the session alive.
            // SocketTimeoutException means no data arrived within soTimeout — the
            // session is still valid, just idle.  We catch it and loop so the
            // session is not killed by a stale TV that skips a ping cycle.
            executor.execute {
                try {
                    while (alive) {
                        try {
                            val msg = readDelimitedMessage(inp) ?: break  // null = real EOF
                            val fields = decodeMessage(msg)
                            android.util.Log.d("AndroidTV", "[$ip] reader: msg fields=${fields.keys}")
                            when {
                                fields.containsKey(RMF_SET_ACTIVE) -> {
                                    android.util.Log.d("AndroidTV",
                                        "[$ip] reader: TV SetActive received")
                                    if (!setActiveDone) {
                                        // Respond with our SetActive if not yet sent.
                                        synchronized(writeLock) {
                                            out.write(buildRemoteMessage(mapOf(
                                                RMF_SET_ACTIVE to V_MSG(varintField(1, 622)),
                                            )))
                                            out.flush()
                                        }
                                        setActiveDone = true
                                    }
                                }
                                fields.containsKey(RMF_PING) -> {
                                    val pf = decodeMessage(
                                        (fields[RMF_PING] as? ByteArray) ?: ByteArray(0)
                                    )
                                    val v = (pf[1] as? Long)?.toInt() ?: 0
                                    synchronized(writeLock) {
                                        out.write(buildRemoteMessage(mapOf(
                                            RMF_PONG to V_MSG(varintField(1, v)),
                                        )))
                                        out.flush()
                                    }
                                }
                                fields.containsKey(RMF_IME_KEY_INJECT) -> {
                                    // TV updated which text field is active.
                                    val info = decodeImeMessage(
                                        (fields[RMF_IME_KEY_INJECT] as? ByteArray) ?: ByteArray(0))
                                    imeActive    = info.hasTextField
                                    lastSentText = info.text
                                    android.util.Log.d("AndroidTV",
                                        "[$ip] TV IME hasField=${info.hasTextField} text='${info.text}' hint='${info.hint}' → imeActive=$imeActive")
                                    emitImeEvent(ip, info.text, info.hint, imeActive)
                                }
                                fields.containsKey(RMF_IME_SHOW_REQ) -> {
                                    // TV asks us to show the IME — contains text field status.
                                    val info = decodeImeShowRequest(
                                        (fields[RMF_IME_SHOW_REQ] as? ByteArray) ?: ByteArray(0))
                                    imeActive = info.hasTextField
                                    lastSentText = info.text
                                    android.util.Log.d("AndroidTV",
                                        "[$ip] TV ImeShowReq hasField=${info.hasTextField} text='${info.text}' hint='${info.hint}'")
                                    emitImeEvent(ip, info.text, info.hint, imeActive)
                                }
                                fields.containsKey(RMF_IME_BATCH_EDIT) -> {
                                    // TV sends batch edit with counter values — store them.
                                    val beBytes = (fields[RMF_IME_BATCH_EDIT] as? ByteArray) ?: ByteArray(0)
                                    val beFields = decodeMessage(beBytes)
                                    imeCounter = (beFields[1] as? Long)?.toInt() ?: imeCounter
                                    imeFieldCounter = (beFields[2] as? Long)?.toInt() ?: imeFieldCounter
                                    android.util.Log.d("AndroidTV",
                                        "[$ip] TV ImeBatchEdit: imeCounter=$imeCounter fieldCounter=$imeFieldCounter")
                                }
                                fields.containsKey(RMF_ERROR) -> {
                                    val errBytes = (fields[RMF_ERROR] as? ByteArray) ?: ByteArray(0)
                                    val errFields = decodeMessage(errBytes)
                                    val code = (errFields[1] as? Long)?.toInt() ?: -1
                                    android.util.Log.e("AndroidTV",
                                        "[$ip] RemoteError code=$code — TV rejected IME")
                                    imeActive = false
                                    imeRejected = true
                                }
                                else -> {
                                    // Log unknown fields for protocol investigation.
                                    fields.entries.forEach { (k, v) ->
                                        if (k != RMF_PING && k != RMF_PONG
                                                && k != RMF_IME_KEY_INJECT && k != RMF_IME_BATCH_EDIT
                                                && k != RMF_IME_SHOW_REQ
                                                && k != RMF_ERROR && k != RMF_CONFIGURE
                                                && k != RMF_SET_ACTIVE && k != RMF_KEY) {
                                            val raw = if (v is ByteArray)
                                                v.take(32).joinToString("") { "%02x".format(it) }
                                            else v.toString()
                                            android.util.Log.d("AndroidTV",
                                                "[$ip] unknown field $k = $raw")
                                        }
                                    }
                                }
                                // Ignore other messages (SetActive, etc.)
                            }
                        } catch (e: java.net.SocketTimeoutException) {
                            // No data within soTimeout — TV is idle, not dead.  Keep going.
                            continue
                        }
                    }
                } catch (e: Exception) {
                    android.util.Log.w("AndroidTV", "[$ip] reader thread died: ${e.message}")
                } finally {
                    android.util.Log.d("AndroidTV", "[$ip] session closed")
                    alive = false
                }
            }
        }

        fun sendKeyImmediate(keyCode: Int) {
            val out = output ?: throw IOException("Not connected")
            synchronized(writeLock) {
                out.write(buildRemoteMessage(mapOf(
                    RMF_KEY to V_MSG(
                        varintField(1, keyCode) +
                        varintField(2, DIR_SHORT)
                    ),
                )))
                out.flush()
            }
        }

        fun sendImeBatchEdit(text: String) {
            val out = output ?: throw IOException("Not connected")
            android.util.Log.d("AndroidTV", "[$ip] sendImeBatchEdit: imeCounter=$imeCounter fieldCounter=$imeFieldCounter text='$text'")
            synchronized(writeLock) {
                // RemoteImeBatchEdit (top-level field 21 in RemoteMessage)
                // Proto structure (from tronikos/androidtvremote2):
                //   field 1 (varint): ime_counter  — echoed from TV
                //   field 2 (varint): field_counter — echoed from TV
                //   field 3 (message, repeated): RemoteEditInfo {
                //       field 1 (varint): insert = 1
                //       field 2 (message): RemoteImeObject {
                //           field 1 (varint): start = len(text) - 1
                //           field 2 (varint): end   = len(text) - 1
                //           field 3 (string):  value = text
                //       }
                //   }
                val paramValue = maxOf(text.length - 1, 0)
                val imeObject = varintField(1, paramValue) +
                                varintField(2, paramValue) +
                                stringField(3, text)
                val editInfo = varintField(1, 1) + lenField(2, imeObject)
                val batchEdit = varintField(1, imeCounter) +
                                varintField(2, imeFieldCounter) +
                                lenField(3, editInfo)
                out.write(buildRemoteMessage(mapOf(RMF_IME_BATCH_EDIT to V_MSG(batchEdit))))
                out.flush()
            }
        }

        /**
         * Inject text character-by-character, sending only the diff vs [oldText].
         * Used as fallback when the TV has not opened an IME session (imeActive=false).
         */
        private fun sendTextPerChar(oldText: String, newText: String) {
            var common = 0
            while (common < oldText.length && common < newText.length
                    && oldText[common] == newText[common]) {
                common++
            }
            repeat(oldText.length - common) {
                sendKeyImmediate(KEYCODE_DEL)
                Thread.sleep(80)
            }
            for (ch in newText.substring(common)) {
                val kc = CHAR_KEY_MAP[ch.lowercaseChar()] ?: continue
                sendKeyImmediate(kc)
                Thread.sleep(80)
            }
        }

        /**
         * Route text to the TV.
         *
         * RMF_IME (batch edit) is the ONLY reliable text injection method.
         * Per-char D-pad keycodes are swallowed by the TV's on-screen keyboard
         * (Leanback IME) and never reach the text field.
         *
         * Standard Android TV does NOT push field 12 to tell us when a text field
         * is active.  If we send RMF_IME when no text field is active the TV
         * replies with RemoteError code=5 and kills the TLS session.  On the
         * next call [getOrConnectSession] auto-reconnects and we retry IME.
         *
         * The user is expected to navigate to a search/text field on the TV
         * before typing on the remote.  When a text field IS active, RMF_IME
         * works on all Android TV variants.
         */
        fun sendTextContent(text: String) {
            if (imeActive || (!imeRejected && setActiveDone)) {
                // IME: either TV explicitly told us (Google TV) or protocol is
                // ready and we haven't been rejected yet (standard Android TV).
                android.util.Log.d("AndroidTV",
                    "[$ip] sendTextContent: IME path, text='$text'")
                sendImeBatchEdit(text)
                lastSentText = text
            } else {
                // Fallback: per-char (works poorly but doesn't crash).
                val old = lastSentText
                lastSentText = text
                android.util.Log.d("AndroidTV",
                    "[$ip] sendTextContent: per-char fallback, old='$old' new='$text'")
                sendTextPerChar(old, text)
            }
        }

        fun close() {
            alive = false
            try { socket?.close() } catch (_: Exception) {}
            socket = null
            output = null
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // JS-facing API
    // ═══════════════════════════════════════════════════════════════════════

    @ReactMethod
    fun isPaired(ip: String, promise: Promise) {
        try {
            promise.resolve(loadPairedIps().contains(ip))
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    /**
     * Step 1 – Connect to the TV's pairing service. Resolves once the TV is
     * displaying the 6-digit PIN (i.e. after ConfigurationAck).
     */
    @ReactMethod
    fun startPairing(ip: String, promise: Promise) {
        executor.execute {
            try {
                val cert = getOrGenerateCert()
                val socket = createTlsSocket(ip, 6467, cert.key, cert.cert)
                pairingSockets[ip] = socket

                // Drive the pairing handshake up to the point the PIN appears.
                val out = socket.outputStream
                val inp = socket.inputStream

                // Greeting: send PairingRequest right after TLS handshake.
                out.write(buildPairingMessage(mapOf(
                    F_PROTO_VER to V_INT(2),
                    F_STATUS    to V_INT(STATUS_OK),
                    F_PAIR_REQ  to V_MSG(buildPairingRequest("Universal Remote")),
                )))
                out.flush()

                // Read messages until ConfigurationAck (TV shows PIN).
                loop@ while (true) {
                    val msg = readDelimitedMessage(inp) ?: break
                    val fields = decodeMessage(msg)

                    val status = (fields[F_STATUS] as? Long)?.toInt() ?: STATUS_OK
                    if (status != STATUS_OK) {
                        socket.close()
                        pairingSockets.remove(ip)
                        promise.reject("PAIRING_ERROR", "TV returned status $status")
                        return@execute
                    }

                    when {
                        fields.containsKey(F_PAIR_REQ_ACK) -> {
                            out.write(buildPairingMessage(mapOf(
                                F_PROTO_VER to V_INT(2),
                                F_STATUS    to V_INT(STATUS_OK),
                                F_PAIR_OPT  to V_MSG(buildPairingOption()),
                            )))
                            out.flush()
                        }
                        fields.containsKey(F_PAIR_OPT) -> {
                            out.write(buildPairingMessage(mapOf(
                                F_PROTO_VER to V_INT(2),
                                F_STATUS    to V_INT(STATUS_OK),
                                F_PAIR_CFG  to V_MSG(buildPairingConfig()),
                            )))
                            out.flush()
                        }
                        fields.containsKey(F_PAIR_CFG_ACK) -> {
                            // TV is now showing the PIN — resolve so the app can ask for it.
                            promise.resolve(null)
                            break@loop
                        }
                    }
                }
            } catch (e: Exception) {
                pairingSockets.remove(ip)
                promise.reject("PAIRING_ERROR", e.message ?: "Unknown error", e)
            }
        }
    }

    /**
     * Step 2 – Submit the 6-digit hex PIN shown on the TV screen.
     * The socket opened in [startPairing] must still be alive.
     */
    @ReactMethod
    fun confirmPairing(ip: String, pin: String, promise: Promise) {
        executor.execute {
            val socket = pairingSockets[ip]
            if (socket == null || socket.isClosed) {
                promise.reject("PAIRING_ERROR", "No active pairing session for $ip")
                return@execute
            }

            try {
                val out = socket.outputStream
                val inp = socket.inputStream

                val secret = computeSecret(socket, pin)

                out.write(buildPairingMessage(mapOf(
                    F_PROTO_VER  to V_INT(2),
                    F_STATUS     to V_INT(STATUS_OK),
                    F_PAIR_SEC   to V_MSG(buildPairingSecret(secret)),
                )))
                out.flush()

                // Wait for SecretAck from TV.
                val msg = readDelimitedMessage(inp)
                pairingSockets.remove(ip)
                socket.close()

                if (msg == null) {
                    promise.reject("PAIRING_ERROR", "TV closed connection without confirming")
                    return@execute
                }

                val fields = decodeMessage(msg)
                val status = (fields[F_STATUS] as? Long)?.toInt() ?: STATUS_OK

                if (status == STATUS_BAD_SECRET) {
                    promise.reject("BAD_PIN", "Wrong PIN — please check the code on your TV")
                } else if (status != STATUS_OK) {
                    promise.reject("PAIRING_ERROR", "Pairing failed with status $status")
                } else {
                    // Pairing complete — remember this TV.
                    addPairedIp(ip)
                    promise.resolve(null)
                }
            } catch (e: Exception) {
                pairingSockets.remove(ip)
                try { socket.close() } catch (_: Exception) {}
                promise.reject("PAIRING_ERROR", e.message ?: "Unknown error", e)
            }
        }
    }

    /**
     * Open a persistent remote-control session to the TV (port 6466).
     * Call after pairing to pre-establish the connection.
     * Subsequent sendKey calls will be near-instant.
     */
    @ReactMethod
    fun connectRemote(ip: String, promise: Promise) {
        executor.execute {
            if (!loadPairedIps().contains(ip)) {
                promise.reject("NOT_PAIRED", "Device $ip is not paired")
                return@execute
            }
            try {
                getOrConnectSession(ip)   // reuses existing live session if present
                promise.resolve(null)
            } catch (e: Exception) {
                val msg = e.message ?: "Unknown error"
                // SSL failures (cert mismatch after TV reset, protocol rejection, etc.)
                // mean our saved cert is no longer accepted — clear it and force re-pair.
                val needsRepair = msg.contains("ECONNRESET", ignoreCase = true)
                    || msg.contains("reset", ignoreCase = true)
                    || msg.contains("SSL", ignoreCase = true)
                    || msg.contains("handshake", ignoreCase = true)
                    || msg.contains("Failure in SSL", ignoreCase = true)
                if (needsRepair) {
                    removePairedIp(ip)
                    promise.reject("NOT_PAIRED", "TV rejected the connection (SSL error) — please re-pair")
                } else {
                    promise.reject("CONNECT_ERROR", msg, e)
                }
            }
        }
    }

    /**
     * Close the persistent remote-control session.
     */
    @ReactMethod
    fun disconnectRemote(ip: String, promise: Promise) {
        // Use sessionLock to avoid racing with a concurrent getOrConnectSession
        // that may have just stored a freshly-connected session.
        synchronized(sessionLock) {
            remoteSessions.remove(ip)?.close()
        }
        promise.resolve(null)
    }

    /**
     * Send a single ATVRS key event to a paired TV.
     * Uses the persistent session if available, otherwise opens one.
     */
    @ReactMethod
    fun sendKey(ip: String, keyCode: Int, promise: Promise) {
        executor.execute {
            if (!loadPairedIps().contains(ip)) {
                promise.reject("NOT_PAIRED", "Device $ip is not paired")
                return@execute
            }

            try {
                val session = getOrConnectSession(ip)
                session.sendKeyImmediate(keyCode)
                promise.resolve(null)
            } catch (e: Exception) {
                remoteSessions.remove(ip)?.close()
                val msg = e.message ?: "Unknown error"
                if (msg.contains("ECONNRESET") || msg.contains("reset")) {
                    removePairedIp(ip)
                    promise.reject("NOT_PAIRED", "TV rejected connection — please re-pair")
                } else {
                    promise.reject("SEND_ERROR", msg, e)
                }
            }
        }
    }

    // ─── Event helpers ────────────────────────────────────────────────────────

    /**
     * Decode a RemoteImeKeyInject payload received from the TV.
     *
     * Proto layout (TV → client):
     *   field 1 (string): text_field identifier (often empty)
     *   field 1 (message): RemoteAppInfo
     *   field 2 (message): RemoteTextFieldStatus
     *
     * RemoteTextFieldStatus:
     *   field 1 (varint): counter_field
     *   field 2 (bytes):  value  — current text in the text field
     *   field 3 (varint): start
     *   field 4 (varint): end
     *   field 5 (varint): int5
     *   field 6 (bytes):  label  — hint / placeholder text
     *
     * Returns Triple(hasTextField, text, hint).
     */
    private data class ImeTextInfo(val hasTextField: Boolean, val text: String, val hint: String)

    private fun decodeImeMessage(bytes: ByteArray): ImeTextInfo {
        val f = decodeMessage(bytes)
        android.util.Log.d("AndroidTV", "  IME raw fields: ${f.map { (k,v) ->
            "$k=${if (v is ByteArray) v.take(32).joinToString("") { "%02x".format(it) } else v}" }}")
        val statusBytes = (f[2] as? ByteArray)
        if (statusBytes == null) {
            android.util.Log.d("AndroidTV", "  IME: no RemoteTextFieldStatus (field 2)")
            return ImeTextInfo(false, "", "")
        }
        val sf = decodeMessage(statusBytes)
        android.util.Log.d("AndroidTV", "  TextFieldStatus fields: ${sf.map { (k,v) ->
            "$k=${if (v is ByteArray) "'${String(v, Charsets.UTF_8)}'" else v}" }}")
        val text  = (sf[2] as? ByteArray)?.let { String(it, Charsets.UTF_8) } ?: ""
        val hint  = (sf[6] as? ByteArray)?.let { String(it, Charsets.UTF_8) } ?: ""
        return ImeTextInfo(true, text, hint)
    }

    /**
     * Decode RemoteImeShowRequest (field 22):
     *   field 2 (message): RemoteTextFieldStatus
     */
    private fun decodeImeShowRequest(bytes: ByteArray): ImeTextInfo {
        val f = decodeMessage(bytes)
        android.util.Log.d("AndroidTV", "  ImeShowReq raw fields: ${f.map { (k,v) ->
            "$k=${if (v is ByteArray) v.take(32).joinToString("") { "%02x".format(it) } else v}" }}")
        val statusBytes = (f[2] as? ByteArray)
        if (statusBytes == null) {
            android.util.Log.d("AndroidTV", "  ImeShowReq: no RemoteTextFieldStatus (field 2)")
            return ImeTextInfo(true, "", "")  // show request itself means IME is active
        }
        val sf = decodeMessage(statusBytes)
        android.util.Log.d("AndroidTV", "  ShowReq TextFieldStatus fields: ${sf.map { (k,v) ->
            "$k=${if (v is ByteArray) "'${String(v, Charsets.UTF_8)}'" else v}" }}")
        val text = (sf[2] as? ByteArray)?.let { String(it, Charsets.UTF_8) } ?: ""
        val hint = (sf[6] as? ByteArray)?.let { String(it, Charsets.UTF_8) } ?: ""
        return ImeTextInfo(true, text, hint)
    }

    /** Emit the current TV IME state to JS. */
    private fun emitImeEvent(ip: String, text: String, hint: String, active: Boolean) {
        val params = com.facebook.react.bridge.Arguments.createMap().apply {
            putString("ip", ip)
            putString("text", text)
            putString("hint", hint)
            putBoolean("active", active)
        }
        rc.getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("AndroidTVIme", params)
    }

    // ── Required override for the module to support events ──────────────────

    override fun getConstants(): Map<String, Any> = emptyMap()

    @ReactMethod
    fun addListener(eventName: String) { /* required by RN */ }

    @ReactMethod
    fun removeListeners(count: Double) { /* required by RN */ }

    @ReactMethod
    fun sendText(ip: String, text: String, promise: Promise) {
        if (!loadPairedIps().contains(ip)) {
            promise.reject("NOT_PAIRED", "Device $ip is not paired")
            return
        }
        promise.resolve(null)
        // Cancel stale debounce so old text never leaks into a fresh session.
        textDebounceJob?.cancel(false)
        textDebounceIp   = ip
        textDebounceText = text
        textDebounceJob  = textDebounceScheduler.schedule({
            val t = textDebounceText
            val i = textDebounceIp
            executor.execute {
                try {
                    val session = getOrConnectSession(i)
                    session.sendTextContent(t)
                } catch (e: Exception) {
                    remoteSessions.remove(i)?.close()
                    android.util.Log.e("AndroidTV", "debounced sendText error: ${e.message}")
                }
            }
        }, TEXT_DEBOUNCE_MS, TimeUnit.MILLISECONDS)
    }

    @ReactMethod
    fun submitText(ip: String, text: String, promise: Promise) {
        if (!loadPairedIps().contains(ip)) {
            promise.reject("NOT_PAIRED", "Device $ip is not paired")
            return
        }
        textDebounceJob?.cancel(false)
        textDebounceJob = null
        executor.execute {
            try {
                val session = getOrConnectSession(ip)
                session.sendTextContent(text)
                Thread.sleep(80)
                session.sendKeyImmediate(KEYCODE_ENTER)
                session.lastSentText = ""  // TV likely clears the field after submit
                promise.resolve(null)
            } catch (e: Exception) {
                remoteSessions.remove(ip)?.close()
                val msg = e.message ?: "Unknown error"
                if (msg.contains("ECONNRESET") || msg.contains("reset")) {
                    removePairedIp(ip)
                    promise.reject("NOT_PAIRED", "TV rejected connection — please re-pair")
                } else {
                    promise.reject("SEND_ERROR", msg, e)
                }
            }
        }
    }

    @ReactMethod
    fun unpair(ip: String, promise: Promise) {
        remoteSessions.remove(ip)?.close()
        removePairedIp(ip)
        pairingSockets.remove(ip)?.let { try { it.close() } catch (_: Exception) {} }
        promise.resolve(null)
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Certificate management
    // ═══════════════════════════════════════════════════════════════════════

    private data class CertPair(val key: String, val cert: String)

    /** Returns the stored cert, generating a new one if needed. */
    private fun getOrGenerateCert(): CertPair {
        val prefs = rc.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val k = prefs.getString(KEY_PRIV, null)
        val c = prefs.getString(KEY_CERT, null)
        if (k != null && c != null) return CertPair(k, c)

        // Generate a new 2048-bit RSA self-signed cert.
        val kpg = KeyPairGenerator.getInstance("RSA")
        kpg.initialize(2048, SecureRandom())
        val keyPair = kpg.generateKeyPair()

        val certDER = buildSelfSignedCertDER(keyPair)
        val certPEM = derToPEM(certDER, "CERTIFICATE")

        // Export private key as PKCS#8 PEM.
        val keyPEM = derToPEM(keyPair.private.encoded, "PRIVATE KEY")

        prefs.edit().putString(KEY_PRIV, keyPEM).putString(KEY_CERT, certPEM).apply()
        return CertPair(keyPEM, certPEM)
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Self-signed X.509 DER builder (no external dependencies)
    // ═══════════════════════════════════════════════════════════════════════

    private fun buildSelfSignedCertDER(kp: KeyPair): ByteArray {
        val now = Date()
        val exp = Date(now.time + 50L * 365 * 24 * 60 * 60 * 1000)   // ~50 years

        val serial = BigInteger(160, SecureRandom())
        val subject = derSequence(
            derSet(derSequence(
                derOID(OID_CN) + derUtf8String("Universal Remote")
            ))
        )
        val spki = kp.public.encoded            // SubjectPublicKeyInfo already DER
        val algId = derSequence(derOID(OID_SHA256_RSA) + derNull())

        // TBSCertificate
        val tbs = derSequence(
            derContext0(derInteger(byteArrayOf(2))) +   // version = v3
            derInteger(positiveBytes(serial.toByteArray())) +
            algId +
            subject +
            derSequence(derUTCTime(now) + derUTCTime(exp)) +
            subject +
            spki
        )

        // Sign TBSCertificate.
        val sig = Signature.getInstance("SHA256withRSA")
        sig.initSign(kp.private)
        sig.update(tbs)
        val sigBytes = sig.sign()

        return derSequence(tbs + algId + derBitString(sigBytes))
    }

    // ═══════════════════════════════════════════════════════════════════════
    // TLS socket
    // ═══════════════════════════════════════════════════════════════════════

    private fun createTlsSocket(host: String, port: Int, keyPEM: String, certPEM: String): SSLSocket {
        val certFactory = CertificateFactory.getInstance("X.509")
        val x509 = certFactory.generateCertificate(
            ByteArrayInputStream(certPEM.toByteArray())
        ) as X509Certificate

        val privBytes = pemToBytes(keyPEM)
        val privKey = KeyFactory.getInstance("RSA")
            .generatePrivate(PKCS8EncodedKeySpec(privBytes))

        val ks = KeyStore.getInstance(KeyStore.getDefaultType()).also {
            it.load(null, null)
            it.setKeyEntry("client", privKey, CharArray(0), arrayOf(x509))
        }

        val kmf = KeyManagerFactory.getInstance("X509").also { it.init(ks, CharArray(0)) }

        val trustAll = object : X509TrustManager {
            override fun checkClientTrusted(c: Array<out X509Certificate>?, t: String?) {}
            override fun checkServerTrusted(c: Array<out X509Certificate>?, t: String?) {}
            override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
        }

        val ctx = SSLContext.getInstance("TLS")
        ctx.init(kmf.keyManagers, arrayOf(trustAll), SecureRandom())

        val socket = ctx.socketFactory.createSocket() as SSLSocket
        socket.connect(InetSocketAddress(host, port), 10_000)
        socket.soTimeout = 10_000
        // Android TV's ATVRS service (ports 6466/6467) only speaks TLS 1.2.
        // Modern Android negotiates TLS 1.3 by default; the TV rejects it with
        // "Failure in SSL library, usually a protocol error". Force TLS 1.2.
        socket.enabledProtocols = socket.supportedProtocols
            .filter { it == "TLSv1.2" || it == "TLSv1.1" }
            .toTypedArray()
            .takeIf { it.isNotEmpty() } ?: arrayOf("TLSv1.2")
        socket.startHandshake()
        return socket
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Secret computation  (mirrors PairingManager.sendCode in node.js)
    // ═══════════════════════════════════════════════════════════════════════

    private fun computeSecret(socket: SSLSocket, pin: String): ByteArray {
        // RSA public keys from both sides of the TLS connection.
        val clientCert = socket.session.localCertificates[0] as X509Certificate
        val serverCert = socket.session.peerCertificates[0] as X509Certificate

        fun rsaModulusBytes(cert: X509Certificate): ByteArray {
            val mod = (cert.publicKey as RSAPublicKey).modulus.toByteArray()
            // Strip leading sign byte that BigInteger.toByteArray() may add.
            return if (mod[0] == 0.toByte()) mod.copyOfRange(1, mod.size) else mod
        }

        fun rsaExpHex(cert: X509Certificate): String {
            return "0" + (cert.publicKey as RSAPublicKey).publicExponent.toString(16)
        }

        val md = MessageDigest.getInstance("SHA-256")
        md.update(rsaModulusBytes(clientCert))
        md.update(hexToBytes(rsaExpHex(clientCert)))
        md.update(rsaModulusBytes(serverCert))
        md.update(hexToBytes(rsaExpHex(serverCert)))
        // PIN suffix: skip first 2 hex chars (they encode the expected hash[0]).
        md.update(hexToBytes(pin.substring(2)))

        return md.digest()
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Paired IP list (SharedPreferences)
    // ═══════════════════════════════════════════════════════════════════════

    private fun loadPairedIps(): Set<String> {
        val raw = rc.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_PAIRED, "") ?: ""
        return if (raw.isBlank()) emptySet() else raw.split(",").toSet()
    }

    private fun addPairedIp(ip: String) {
        val set = loadPairedIps().toMutableSet().also { it.add(ip) }
        rc.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString(KEY_PAIRED, set.joinToString(",")).apply()
    }

    private fun removePairedIp(ip: String) {
        val set = loadPairedIps().toMutableSet().also { it.remove(ip) }
        rc.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString(KEY_PAIRED, set.joinToString(",")).apply()
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Minimal protobuf encoding (proto3, hand-coded, no library needed)
    // ═══════════════════════════════════════════════════════════════════════

    // Wire types
    private val WT_VARINT = 0
    private val WT_LEN    = 2

    private fun encodeVarint(v: Int): ByteArray {
        val buf = mutableListOf<Byte>()
        var n = v
        while (n and 0x7F.inv() != 0) {
            buf.add(((n and 0x7F) or 0x80).toByte())
            n = n ushr 7
        }
        buf.add(n.toByte())
        return buf.toByteArray()
    }

    private fun encodeTag(field: Int, wire: Int) = encodeVarint((field shl 3) or wire)

    // Helpers used in message builders
    private fun varintField(field: Int, v: Int) =
        encodeTag(field, WT_VARINT) + encodeVarint(v)

    private fun lenField(field: Int, data: ByteArray) =
        encodeTag(field, WT_LEN) + encodeVarint(data.size) + data

    private fun stringField(field: Int, s: String) = lenField(field, s.toByteArray(Charsets.UTF_8))

    private fun bytesField(field: Int, b: ByteArray) = lenField(field, b)

    // Wrapper types used in the map-based builder
    private sealed class Val
    private data class V_INT(val v: Int) : Val()
    private data class V_MSG(val b: ByteArray) : Val()

    private fun encodeFieldEntry(field: Int, v: Val): ByteArray = when (v) {
        is V_INT -> varintField(field, v.v)
        is V_MSG -> lenField(field, v.b)
    }

    private fun buildMessage(fields: Map<Int, Val>): ByteArray =
        fields.entries.fold(ByteArray(0)) { acc, e -> acc + encodeFieldEntry(e.key, e.value) }

    /** Prefix message with its length as a varint (protobuf delimited). */
    private fun delimited(msg: ByteArray): ByteArray = encodeVarint(msg.size) + msg

    // ── Pairing message builders ──────────────────────────────────────────

    // PairingMessage field numbers
    private val F_PROTO_VER   = 1
    private val F_STATUS      = 2
    private val F_PAIR_REQ    = 10
    private val F_PAIR_REQ_ACK = 11
    private val F_PAIR_OPT    = 20
    private val F_PAIR_CFG    = 30
    private val F_PAIR_CFG_ACK = 31
    private val F_PAIR_SEC    = 40
    private val F_PAIR_SEC_ACK = 41
    private val STATUS_OK        = 200
    private val STATUS_BAD_SECRET = 402

    private fun buildPairingMessage(fields: Map<Int, Val>) = delimited(buildMessage(fields))

    private fun buildPairingRequest(svcName: String) =
        stringField(1, svcName) + stringField(2, android.os.Build.MODEL)

    private fun buildPairingOption() =
        // input_encodings = [{ type=HEXADECIMAL(3), symbol_length=6 }]
        lenField(1, varintField(1, 3) + varintField(2, 6)) +
        varintField(3, 1)   // preferred_role = ROLE_TYPE_INPUT

    private fun buildPairingConfig() =
        lenField(1, varintField(1, 3) + varintField(2, 6)) +   // encoding
        varintField(2, 1)   // client_role = ROLE_TYPE_INPUT

    private fun buildPairingSecret(secret: ByteArray) = bytesField(1, secret)

    // ── Remote message builders ───────────────────────────────────────────

    // RemoteMessage field numbers
    private val RMF_CONFIGURE  = 1
    private val RMF_SET_ACTIVE = 2
    private val RMF_ERROR      = 3  // RemoteError
    private val RMF_PING       = 8
    private val RMF_PONG       = 9
    private val RMF_KEY        = 10
    private val RMF_IME_KEY_INJECT  = 20  // RemoteImeKeyInject
    private val RMF_IME_BATCH_EDIT  = 21  // RemoteImeBatchEdit (top-level!)
    private val RMF_IME_SHOW_REQ   = 22  // RemoteImeShowRequest
    private val DIR_SHORT      = 3   // RemoteDirection.SHORT
    private val KEYCODE_ENTER  = 66
    private val KEYCODE_DEL    = 67  // KEYCODE_DEL (backspace)
    /** Lowercase char → Android key code for per-char fallback injection. */
    private val CHAR_KEY_MAP = mapOf(
        ' '  to 62,
        '0'  to 7,  '1' to 8,  '2' to 9,  '3' to 10, '4' to 11,
        '5'  to 12, '6' to 13, '7' to 14, '8' to 15,  '9' to 16,
        'a'  to 29, 'b' to 30, 'c' to 31, 'd' to 32,  'e' to 33,
        'f'  to 34, 'g' to 35, 'h' to 36, 'i' to 37,  'j' to 38,
        'k'  to 39, 'l' to 40, 'm' to 41, 'n' to 42,  'o' to 43,
        'p'  to 44, 'q' to 45, 'r' to 46, 's' to 47,  't' to 48,
        'u'  to 49, 'v' to 50, 'w' to 51, 'x' to 52,  'y' to 53,
        'z'  to 54,
    )

    private fun buildRemoteMessage(fields: Map<Int, Val>) = delimited(buildMessage(fields))

    private fun buildRemoteConfigure(tvFeatures: Int = 622): ByteArray {
        // Intersect TV's supported features with what we want.
        // Feature flags: PING=1, KEY=2, IME=4, VOICE=8, POWER=32, VOLUME=64, APP_LINK=512
        val wantFeatures = 1 or 2 or 4 or 32 or 64 or 512  // PING|KEY|IME|POWER|VOLUME|APP_LINK
        val activeFeatures = tvFeatures and wantFeatures
        val deviceInfo =
            stringField(1, android.os.Build.MODEL) +
            stringField(2, android.os.Build.MANUFACTURER) +
            varintField(3, 1) +
            stringField(4, "1") +
            stringField(5, "com.streamless.remote") +
            stringField(6, "1.0.0")
        return varintField(1, activeFeatures) + lenField(2, deviceInfo)
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Minimal protobuf decoder (only the fields we care about)
    // ═══════════════════════════════════════════════════════════════════════

    /** Returns field_number → value (Long for varints, ByteArray for len-delim). */
    private fun decodeMessage(data: ByteArray): Map<Int, Any> {
        val result = mutableMapOf<Int, Any>()
        var pos = 0
        while (pos < data.size) {
            val (tagVal, p1) = readVarint(data, pos)
            pos = p1
            val fieldNum = (tagVal shr 3).toInt()
            val wire = (tagVal and 7L).toInt()
            when (wire) {
                0 -> {   // varint
                    val (v, p2) = readVarint(data, pos)
                    pos = p2
                    result[fieldNum] = v
                }
                2 -> {   // length-delimited
                    val (len, p2) = readVarint(data, pos)
                    pos = p2
                    result[fieldNum] = data.copyOfRange(pos, pos + len.toInt())
                    pos += len.toInt()
                }
                else -> break   // unsupported wire type — stop parsing
            }
        }
        return result
    }

    /** Read a length-prefixed protobuf message from the stream. Returns null on EOF. */
    private fun readDelimitedMessage(inp: InputStream): ByteArray? {
        // Decode the varint length prefix one byte at a time, stopping as soon as
        // the continuation bit (0x80) is clear.  The old implementation checked the
        // *accumulated value* for the continuation bit, which caused it to loop for
        // a second pass on any message whose length is >= 128 bytes — reading one
        // extra byte into the body as part of the length.
        var len = 0
        var shift = 0
        while (true) {
            val b = inp.read()   // -1 on EOF, 0-255 otherwise
            if (b < 0) return null
            len = len or ((b and 0x7F) shl shift)
            shift += 7
            if (b and 0x80 == 0) break  // no continuation bit — varint complete
        }
        if (len == 0) return ByteArray(0)
        val buf = ByteArray(len)
        var off = 0
        while (off < len) {
            val n = inp.read(buf, off, len - off)
            if (n < 0) return null
            off += n
        }
        return buf
    }

    private fun readVarint(data: ByteArray, start: Int): Pair<Long, Int> {
        var result = 0L
        var shift = 0
        var pos = start
        while (pos < data.size) {
            val b = data[pos++].toInt() and 0xFF
            result = result or ((b and 0x7F).toLong() shl shift)
            shift += 7
            if (b and 0x80 == 0) break
        }
        return result to pos
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Minimal DER / ASN.1 helpers for self-signed cert generation
    // ═══════════════════════════════════════════════════════════════════════

    private fun derLen(len: Int): ByteArray = when {
        len < 128        -> byteArrayOf(len.toByte())
        len < 256        -> byteArrayOf(0x81.toByte(), len.toByte())
        else             -> byteArrayOf(0x82.toByte(), (len ushr 8).toByte(), len.toByte())
    }

    private fun derTLV(tag: Int, v: ByteArray) =
        byteArrayOf(tag.toByte()) + derLen(v.size) + v

    private fun derSequence(v: ByteArray) = derTLV(0x30, v)
    private fun derSet(v: ByteArray)      = derTLV(0x31, v)
    private fun derInteger(v: ByteArray)  = derTLV(0x02, v)
    private fun derBitString(v: ByteArray)= derTLV(0x03, byteArrayOf(0) + v)
    private fun derNull()                 = byteArrayOf(0x05, 0x00)
    private fun derContext0(v: ByteArray) = derTLV(0xA0, v)
    private fun derUtf8String(s: String)  = derTLV(0x0C, s.toByteArray(Charsets.UTF_8))

    private fun derUTCTime(d: Date): ByteArray {
        val f = SimpleDateFormat("yyMMddHHmmss'Z'", Locale.US)
        f.timeZone = TimeZone.getTimeZone("UTC")
        return derTLV(0x17, f.format(d).toByteArray(Charsets.US_ASCII))
    }

    private fun derOID(oid: IntArray): ByteArray {
        val enc = mutableListOf<Byte>()
        enc.add(((oid[0] * 40) + oid[1]).toByte())
        for (i in 2 until oid.size) {
            var v = oid[i]
            val sub = mutableListOf<Byte>()
            sub.add((v and 0x7F).toByte())
            v = v ushr 7
            while (v > 0) {
                sub.add(0, (0x80 or (v and 0x7F)).toByte())
                v = v ushr 7
            }
            enc.addAll(sub)
        }
        return derTLV(0x06, enc.toByteArray())
    }

    // OID constants
    private val OID_SHA256_RSA = intArrayOf(1,2,840,113549,1,1,11)
    private val OID_CN         = intArrayOf(2,5,4,3)

    private fun positiveBytes(b: ByteArray): ByteArray =
        if (b.isNotEmpty() && b[0] == 0.toByte() && b.size > 1) b.copyOfRange(1, b.size) else b

    // ═══════════════════════════════════════════════════════════════════════
    // PEM utilities
    // ═══════════════════════════════════════════════════════════════════════

    private fun derToPEM(der: ByteArray, label: String): String {
        val b64 = Base64.encodeToString(der, Base64.NO_WRAP)
        return "-----BEGIN $label-----\n$b64\n-----END $label-----\n"
    }

    private fun pemToBytes(pem: String): ByteArray {
        val stripped = pem
            .replace(Regex("-----BEGIN[^-]+-----\\s*"), "")
            .replace(Regex("-----END[^-]+-----\\s*"), "")
            .replace("\\s".toRegex(), "")
        return Base64.decode(stripped, Base64.DEFAULT)
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Misc utilities
    // ═══════════════════════════════════════════════════════════════════════

    private fun hexToBytes(hex: String): ByteArray =
        ByteArray(hex.length / 2) { i ->
            hex.substring(i * 2, i * 2 + 2).toInt(16).toByte()
        }
}
