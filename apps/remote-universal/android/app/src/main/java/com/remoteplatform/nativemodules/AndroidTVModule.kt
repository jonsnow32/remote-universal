package com.remoteplatform.nativemodules

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

    private inner class RemoteSession(val ip: String) {
        var socket: SSLSocket? = null
        var output: OutputStream? = null
        @Volatile var alive = false
        private val writeLock = Any()

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
                        android.util.Log.d("AndroidTV", "[$ip] → sending Configure")
                        out.write(buildRemoteMessage(mapOf(
                            RMF_CONFIGURE to V_MSG(buildRemoteConfigure()),
                        )))
                        out.flush()
                        ready = true
                    }
                    fields.containsKey(RMF_SET_ACTIVE) -> {
                        android.util.Log.d("AndroidTV", "[$ip] → sending SetActive")
                        out.write(buildRemoteMessage(mapOf(
                            RMF_SET_ACTIVE to V_MSG(varintField(1, 622)),
                        )))
                        out.flush()
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
            executor.execute {
                try {
                    while (alive) {
                        val msg = readDelimitedMessage(inp) ?: break
                        val fields = decodeMessage(msg)
                        when {
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
                            // Ignore other messages (SetActive, etc.)
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
                val session = RemoteSession(ip)
                session.connect()
                remoteSessions[ip]?.close()
                remoteSessions[ip] = session
                promise.resolve(null)
            } catch (e: Exception) {
                val msg = e.message ?: "Unknown error"
                if (msg.contains("ECONNRESET") || msg.contains("reset")) {
                    removePairedIp(ip)
                    promise.reject("NOT_PAIRED", "TV rejected connection — please re-pair")
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
        remoteSessions.remove(ip)?.close()
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
                var session = remoteSessions[ip]
                // Reconnect if there is no session or it died.
                if (session == null || !session.alive) {
                    session?.close()
                    val newSession = RemoteSession(ip)
                    newSession.connect()
                    remoteSessions[ip] = newSession
                    session = newSession
                }
                session.sendKeyImmediate(keyCode)
                promise.resolve(null)
            } catch (e: Exception) {
                // On failure, tear down the session so next call retries.
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
    private val RMF_PING       = 8
    private val RMF_PONG       = 9
    private val RMF_KEY        = 10
    private val DIR_SHORT      = 3   // RemoteDirection.SHORT

    private fun buildRemoteMessage(fields: Map<Int, Val>) = delimited(buildMessage(fields))

    private fun buildRemoteConfigure(): ByteArray {
        val deviceInfo =
            stringField(1, android.os.Build.MODEL) +
            stringField(2, android.os.Build.MANUFACTURER)
        return varintField(1, 622) + lenField(2, deviceInfo)
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
        val lenBuf = ByteArray(1)
        if (inp.read(lenBuf) != 1) return null
        var len = lenBuf[0].toInt() and 0xFF
        // Handle multi-byte varint length (rare for these small messages).
        var shift = 7
        while (len and 0x80 != 0) {
            if (inp.read(lenBuf) != 1) return null
            len = (len and 0x7F) or ((lenBuf[0].toInt() and 0xFF) shl shift)
            shift += 7
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
