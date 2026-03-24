import { NativeModules, NativeEventEmitter } from 'react-native';
const native = NativeModules.MicStream;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const emitter = native ? new NativeEventEmitter(native) : null;
/**
 * MicStreamModule — real-time PCM microphone streaming.
 *
 * Captures microphone audio and delivers base64-encoded chunks of
 * 16 kHz / mono / 16-bit PCM via an event listener.
 *
 * Used to stream raw voice audio to Samsung Tizen TVs via
 * SamsungTizen.startVoiceSession / sendVoiceAudioChunk / stopVoiceSession —
 * the exact same protocol used by the physical Samsung remote mic button.
 *
 * Permissions:
 *   Android — RECORD_AUDIO (added by withMicStream config plugin)
 *   iOS     — NSMicrophoneUsageDescription (added by withMicStream config plugin)
 *             Must also be granted at runtime before calling start().
 */
export const MicStreamModule = {
    /**
     * Start capturing microphone audio.
     * Resolves once the stream has started.
     * Rejects with code "PERMISSION_DENIED" if the mic permission is missing.
     */
    start() {
        return native?.startRecording() ?? Promise.reject(new Error('MicStream native module not available'));
    },
    /**
     * Stop recording and release the microphone.
     * Always resolves (safe to call when not recording).
     */
    stop() {
        return native?.stopRecording() ?? Promise.resolve();
    },
    /**
     * Subscribe to audio chunks. The listener receives a base64 string for each
     * ~80 ms block of 16 kHz / mono / 16-bit PCM audio captured from the mic.
     *
     * Returns an unsubscribe function — call it to remove the listener.
     */
    onChunk(listener) {
        if (!emitter)
            return () => { };
        const sub = emitter.addListener('MicStream:chunk', listener);
        return () => sub.remove();
    },
};
//# sourceMappingURL=MicStreamModule.js.map