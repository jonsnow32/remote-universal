import AVFoundation
import React

/**
 * MicStreamModule — real-time PCM microphone streaming for iOS.
 *
 * Captures audio from the device microphone via AVAudioEngine and emits
 * base64-encoded chunks of 16 kHz / mono / 16-bit PCM via the
 * "MicStream:chunk" React Native event.
 *
 * NSMicrophoneUsageDescription must be present in Info.plist.
 *
 * Used by the Voice remote feature to stream raw audio to Samsung Tizen TVs
 * via the ms.remote.voice WebSocket protocol — exactly like a physical remote.
 */
@objc(MicStream)
class MicStreamModule: RCTEventEmitter {

    private var engine: AVAudioEngine?
    private var hasListeners = false

    override func supportedEvents() -> [String]! {
        return ["MicStream:chunk"]
    }

    override func startObserving() { hasListeners = true }
    override func stopObserving()  { hasListeners = false }

    @objc override static func requiresMainQueueSetup() -> Bool { return false }

    // MARK: – startRecording

    @objc func startRecording(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject:    @escaping RCTPromiseRejectBlock
    ) {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.record, mode: .measurement, options: .duckOthers)
            try session.setPreferredSampleRate(16_000)
            try session.setActive(true)
        } catch {
            reject("SESSION_ERR", error.localizedDescription, error)
            return
        }

        let eng  = AVAudioEngine()
        let node = eng.inputNode
        let hwFmt = node.inputFormat(forBus: 0)

        // Target: 16 kHz, mono, signed 16-bit integer (Tizen ms.remote.voice format)
        guard let targetFmt = AVAudioFormat(
            commonFormat: .pcmFormatInt16,
            sampleRate: 16_000,
            channels: 1,
            interleaved: true
        ) else {
            reject("FORMAT_ERR", "Cannot create target audio format", nil)
            return
        }

        guard let converter = AVAudioConverter(from: hwFmt, to: targetFmt) else {
            reject("CONVERTER_ERR", "Cannot create audio converter", nil)
            return
        }

        // Buffer size: ~80 ms at the hardware sample rate
        let tapFrames = AVAudioFrameCount((hwFmt.sampleRate * 0.08).rounded())

        node.installTap(onBus: 0, bufferSize: tapFrames, format: hwFmt) { [weak self] buffer, _ in
            guard let self = self, self.hasListeners else { return }

            // Output frames for this tap block at 16 kHz
            let outFrames = AVAudioFrameCount(
                Double(buffer.frameLength) * 16_000.0 / hwFmt.sampleRate
            )
            guard outFrames > 0,
                  let outBuf = AVAudioPCMBuffer(pcmFormat: targetFmt, frameCapacity: outFrames)
            else { return }

            var error: NSError?
            var inputConsumed = false
            let status = converter.convert(to: outBuf, error: &error) { _, outStatus in
                if inputConsumed { outStatus.pointee = .noDataNow; return nil }
                outStatus.pointee = .haveData
                inputConsumed = true
                return buffer
            }
            guard status != .error, error == nil,
                  let int16Ptr = outBuf.int16ChannelData?[0] else { return }

            let byteCount = Int(outBuf.frameLength) * 2   // 2 bytes per Int16
            let data = Data(bytes: int16Ptr, count: byteCount)
            let b64  = data.base64EncodedString()
            self.sendEvent(withName: "MicStream:chunk", body: b64)
        }

        engine = eng
        do {
            try eng.start()
            resolve(nil)
        } catch {
            node.removeTap(onBus: 0)
            engine = nil
            try? session.setActive(false)
            reject("START_ERR", error.localizedDescription, error)
        }
    }

    // MARK: – stopRecording

    @objc func stopRecording(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject:    @escaping RCTPromiseRejectBlock
    ) {
        engine?.inputNode.removeTap(onBus: 0)
        engine?.stop()
        engine = nil
        try? AVAudioSession.sharedInstance().setActive(false)
        resolve(nil)
    }
}
