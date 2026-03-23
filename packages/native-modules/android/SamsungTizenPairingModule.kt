package com.streamless.nativemodules

import com.facebook.react.bridge.*
import com.facebook.react.modules.websocket.WebSocketModule

/**
 * Ensures Samsung TVs (2018+) can be paired via WSS port 8002 from JS WebSocket.
 *
 * React Native's WebSocketModule builds its own OkHttpClient and rejects
 * Samsung's self-signed LAN certificate on port 8002.  The stable hook to fix
 * this is WebSocketModule.setCustomClientBuilder() — but calling it in
 * MainApplication.onCreate() is fragile (expo prebuild can regenerate that file).
 *
 * By calling it here in initialize(), which runs when React Native loads this
 * package, the cert bypass is set up reliably as long as SamsungTizenPairingPackage
 * is listed in getPackages() — which the config plugin ensures.
 *
 * After this module loads, the JS SamsungTizen class can open wss://ip:8002
 * directly and handle the pairing popup entirely in JavaScript.
 *
 * pairWithTV() is a no-op on Android (kept for API symmetry with iOS Swift module).
 */
class SamsungTizenPairingModule(rc: ReactApplicationContext) :
    ReactContextBaseJavaModule(rc) {

    override fun getName() = "SamsungTizenPairing"

    override fun initialize() {
        super.initialize()
        // Apply LAN SSL trust to every JS WebSocket connection so WSS 8002
        // (Samsung TV pairing port) can negotiate a self-signed certificate.
        WebSocketModule.setCustomClientBuilder { builder ->
            LanSslConfigurator.apply(builder)
        }
    }

    /** No-op on Android — JS WebSocket handles the full pairing flow. */
    @ReactMethod
    fun pairWithTV(ip: String, deviceId: String, promise: Promise) {
        promise.resolve(null)
    }
}
