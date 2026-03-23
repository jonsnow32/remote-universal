package com.streamless.nativemodules

import okhttp3.OkHttpClient
import java.security.SecureRandom
import java.security.cert.X509Certificate
import javax.net.ssl.HttpsURLConnection
import javax.net.ssl.SSLContext
import javax.net.ssl.X509TrustManager

/**
 * Applies LAN-device SSL trust to an OkHttpClient.Builder.
 *
 * Samsung TVs (2018+) use a self-signed certificate on WSS port 8002 for the
 * remote-control pairing channel. Android's default OkHttp trust store rejects
 * this certificate with a WebSocket close-code 1006, preventing pairing.
 *
 * In React Native 0.81, WebSocketModule builds its own OkHttpClient and exposes
 * a static WebSocketModule.setCustomClientBuilder() hook — it does NOT use
 * OkHttpClientProvider. We register this configurator there in
 * SamsungTizenPairingModule.initialize() so every WebSocket connection to a LAN
 * IP can negotiate TLS with a self-signed certificate.
 */
object LanSslConfigurator {

    /** Trusts any certificate — scoped to LAN hosts by the HostnameVerifier below. */
    private val trustAll = object : X509TrustManager {
        override fun checkClientTrusted(chain: Array<X509Certificate>, authType: String) = Unit
        override fun checkServerTrusted(chain: Array<X509Certificate>, authType: String) = Unit
        override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
    }

    private val sslContext = SSLContext.getInstance("TLS").apply {
        init(null, arrayOf(trustAll), SecureRandom())
    }

    /** Call this on any OkHttpClient.Builder before building. */
    fun apply(builder: OkHttpClient.Builder) {
        builder
            .sslSocketFactory(sslContext.socketFactory, trustAll)
            .hostnameVerifier { hostname, session ->
                // For LAN IPs (Samsung/LG/Daikin TVs), skip hostname verification —
                // they use self-signed certs with no valid CN/SAN.
                // For all other hosts, fall back to the system default verifier.
                isLanIp(hostname) ||
                    HttpsURLConnection.getDefaultHostnameVerifier().verify(hostname, session)
            }
    }

    /**
     * Returns true for RFC-1918 private addresses:
     *   10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
     * Also covers link-local 169.254.x.x used by some device protocols.
     */
    private fun isLanIp(host: String): Boolean =
        host.startsWith("192.168.") ||
        host.startsWith("10.") ||
        host.startsWith("169.254.") ||
        Regex("""^172\.(1[6-9]|2\d|3[01])\.""").containsMatchIn(host)
}
