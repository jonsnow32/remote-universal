package com.remoteplatform.nativemodules

import android.Manifest
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Base64
import android.util.Log
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
        private const val TAG = "MicStream"
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
        if (recording) {
            Log.d(TAG, "startRecording called while already recording — no-op")
            promise.resolve(null)
            return
        }

        if (reactApplicationContext.checkSelfPermission(Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED) {
            Log.e(TAG, "startRecording: RECORD_AUDIO permission not granted")
            promise.reject("PERMISSION_DENIED", "Microphone permission not granted")
            return
        }

        val chunkBytes = CHUNK_FRAMES * BYTES_PER_FRAME
        val minBuf     = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNELS, FORMAT)
        if (minBuf <= 0) {
            Log.e(TAG, "startRecording: getMinBufferSize returned $minBuf — hardware may not support the requested format")
            promise.reject("INIT_FAILED", "AudioRecord.getMinBufferSize failed ($minBuf)")
            return
        }
        val bufBytes = maxOf(minBuf, chunkBytes * 4)
        Log.d(TAG, "startRecording: minBuf=$minBuf bufBytes=$bufBytes chunkBytes=$chunkBytes")

        val ar = AudioRecord(
            MediaRecorder.AudioSource.VOICE_RECOGNITION,
            SAMPLE_RATE, CHANNELS, FORMAT, bufBytes,
        )
        if (ar.state != AudioRecord.STATE_INITIALIZED) {
            Log.e(TAG, "startRecording: AudioRecord not initialized (state=${ar.state})")
            ar.release()
            promise.reject("INIT_FAILED", "AudioRecord initialisation failed (state=${ar.state})")
            return
        }

        recorder = ar
        recording = true
        ar.startRecording()

        if (ar.recordingState != AudioRecord.RECORDSTATE_RECORDING) {
            Log.e(TAG, "startRecording: startRecording() called but state is ${ar.recordingState} — aborting")
            recording = false
            recorder = null
            ar.release()
            promise.reject("START_FAILED", "AudioRecord.startRecording() did not transition to RECORDSTATE_RECORDING")
            return
        }

        Log.d(TAG, "startRecording: recording started — emitting MicStream:chunk events")
        promise.resolve(null)

        // Read loop runs on a daemon thread — never blocks the JS thread.
        // Capture `ar` locally so the thread never touches the nullable `recorder` field.
        thread(isDaemon = true, name = "MicStreamThread") {
            val buf = ByteArray(chunkBytes)
            var chunkCount = 0
            while (recording) {
                val read = ar.read(buf, 0, chunkBytes)
                when {
                    read > 0 -> {
                        chunkCount++
                        if (chunkCount == 1 || chunkCount % 50 == 0) {
                            Log.d(TAG, "MicStreamThread: emitting chunk #$chunkCount (${read} bytes)")
                        }
                        val b64 = Base64.encodeToString(buf, 0, read, Base64.NO_WRAP)
                        emit(b64)
                    }
                    read == AudioRecord.ERROR_DEAD_OBJECT -> {
                        // AudioRecord was invalidated (audio focus lost, output device changed, etc.).
                        // Stop the loop — the JS side will receive no more chunks.
                        Log.e(TAG, "MicStreamThread: ERROR_DEAD_OBJECT — AudioRecord died, stopping loop")
                        recording = false
                    }
                    read == AudioRecord.ERROR_INVALID_OPERATION -> {
                        Log.e(TAG, "MicStreamThread: ERROR_INVALID_OPERATION — read while not recording, stopping loop")
                        recording = false
                    }
                    read < 0 -> {
                        Log.e(TAG, "MicStreamThread: ar.read() returned error code $read — skipping chunk")
                    }
                    // read == 0: underrun, just continue
                }
            }
            Log.d(TAG, "MicStreamThread: exited after $chunkCount chunks")
        }
    }

    @ReactMethod
    fun stopRecording(promise: Promise) {
        Log.d(TAG, "stopRecording: signalling read loop to stop")
        recording = false
        try {
            recorder?.stop()
            recorder?.release()
        } catch (e: Exception) {
            Log.w(TAG, "stopRecording: exception while stopping AudioRecord", e)
        }
        recorder = null
        Log.d(TAG, "stopRecording: done")
        promise.resolve(null)
    }

    // Required by React Native NativeEventEmitter on the JS side.
    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}
}
