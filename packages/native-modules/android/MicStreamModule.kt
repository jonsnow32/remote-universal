package com.remoteplatform.nativemodules

import android.Manifest
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Base64
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlin.concurrent.thread

/**
 * MicStreamModule — real-time PCM microphone streaming.
 *
 * Captures audio from the device microphone and emits base64-encoded chunks
 * of 16 kHz / mono / 16-bit PCM via the "MicStream:chunk" React Native event.
 *
 * Required permission:  android.permission.RECORD_AUDIO
 * (granted at runtime before calling startRecording).
 *
 * Used by the Voice remote feature to stream raw audio to Samsung Tizen TVs
 * via the ms.remote.voice WebSocket protocol — exactly like a physical remote.
 */
class MicStreamModule(rc: ReactApplicationContext) : ReactContextBaseJavaModule(rc) {

    companion object {
        const val SAMPLE_RATE   = 16_000
        const val CHUNK_FRAMES  = 1_280           // 80 ms of audio at 16 kHz
        const val BYTES_PER_FRAME = 2             // 16-bit PCM
        val CHANNELS = AudioFormat.CHANNEL_IN_MONO
        val FORMAT   = AudioFormat.ENCODING_PCM_16BIT
    }

    override fun getName() = "MicStream"

    private var recorder: AudioRecord? = null
    @Volatile private var recording = false

    // ── Event emitter ─────────────────────────────────────────────────────────

    private fun emit(b64: String) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("MicStream:chunk", b64)
    }

    // ── Public API ────────────────────────────────────────────────────────────

    @ReactMethod
    fun startRecording(promise: Promise) {
        if (recording) { promise.resolve(null); return }

        if (reactApplicationContext.checkSelfPermission(Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED) {
            promise.reject("PERMISSION_DENIED", "Microphone permission not granted")
            return
        }

        val chunkBytes = CHUNK_FRAMES * BYTES_PER_FRAME
        val minBuf     = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNELS, FORMAT)
        val bufBytes   = maxOf(minBuf, chunkBytes * 4)

        val ar = AudioRecord(
            MediaRecorder.AudioSource.VOICE_RECOGNITION,
            SAMPLE_RATE, CHANNELS, FORMAT, bufBytes,
        )
        if (ar.state != AudioRecord.STATE_INITIALIZED) {
            promise.reject("INIT_FAILED", "AudioRecord initialisation failed")
            return
        }

        recorder = ar
        recording = true
        ar.startRecording()
        promise.resolve(null)

        // Read loop runs on a daemon thread — never blocks the JS thread.
        thread(isDaemon = true, name = "MicStreamThread") {
            val buf = ByteArray(chunkBytes)
            while (recording) {
                val read = ar.read(buf, 0, chunkBytes)
                if (read > 0) {
                    val b64 = Base64.encodeToString(buf, 0, read, Base64.NO_WRAP)
                    emit(b64)
                }
            }
        }
    }

    @ReactMethod
    fun stopRecording(promise: Promise) {
        recording = false
        try { recorder?.stop(); recorder?.release() } catch (_: Exception) {}
        recorder = null
        promise.resolve(null)
    }

    // Required by React Native NativeEventEmitter on the JS side.
    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}
}
