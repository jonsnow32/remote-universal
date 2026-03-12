import Foundation
import Security
import React
import CommonCrypto

// MARK: – Error helper

private struct ATVError: LocalizedError {
  let message: String
  init(_ message: String) { self.message = message }
  var errorDescription: String? { message }
}

// ──────────────────────────────────────────────────────────────────────
// MARK: – Minimal protobuf helpers  (field encoders / decoder)
// ──────────────────────────────────────────────────────────────────────

private enum ProtoVal {
  case varint(Int)
  case msg(Data)
}

private func encodeVarint(_ v: Int) -> Data {
  var buf = Data(); var n = v
  while n & ~0x7F != 0 { buf.append(UInt8((n & 0x7F) | 0x80)); n >>= 7 }
  buf.append(UInt8(n)); return buf
}

private func encodeTag(field: Int, wire: Int) -> Data { encodeVarint((field << 3) | wire) }

private func varintField(_ field: Int, _ v: Int) -> Data {
  encodeTag(field: field, wire: 0) + encodeVarint(v)
}
private func lenField(_ field: Int, _ data: Data) -> Data {
  encodeTag(field: field, wire: 2) + encodeVarint(data.count) + data
}
private func stringField(_ field: Int, _ s: String) -> Data { lenField(field, Data(s.utf8)) }
private func bytesField(_ field: Int, _ b: Data) -> Data { lenField(field, b) }

private func buildMessage(_ fields: [(Int, ProtoVal)]) -> Data {
  var buf = Data()
  for (field, val) in fields {
    switch val {
    case .varint(let v): buf += varintField(field, v)
    case .msg(let d):    buf += lenField(field, d)
    }
  }
  return buf
}

private func delimited(_ msg: Data) -> Data { encodeVarint(msg.count) + msg }

private func readVarint(_ data: Data, from start: Int) -> (Int64, Int)? {
  var result: Int64 = 0; var shift = 0; var pos = start
  while pos < data.count {
    let b = Int64(data[pos]); pos += 1
    result |= (b & 0x7F) << shift; shift += 7
    if b & 0x80 == 0 { return (result, pos) }
  }
  return nil
}

private func decodeMessage(_ data: Data) -> [Int: Any] {
  var result: [Int: Any] = []; var pos = 0
  while pos < data.count {
    guard let (tagVal, p1) = readVarint(data, from: pos) else { break }
    pos = p1
    let fieldNum = Int(tagVal >> 3)
    let wire = Int(tagVal & 7)
    switch wire {
    case 0:
      guard let (v, p2) = readVarint(data, from: pos) else { return result }
      pos = p2; result[fieldNum] = v
    case 2:
      guard let (len, p2) = readVarint(data, from: pos) else { return result }
      pos = p2
      let end = pos + Int(len)
      guard end <= data.count else { return result }
      result[fieldNum] = data[pos..<end]; pos = end
    default:
      return result
    }
  }
  return result
}

// ──────────────────────────────────────────────────────────────────────
// MARK: – Minimal DER / ASN.1 helpers  (for self-signed cert generation)
// ──────────────────────────────────────────────────────────────────────

private func derLen(_ len: Int) -> Data {
  if len < 128 { return Data([UInt8(len)]) }
  if len < 256 { return Data([0x81, UInt8(len)]) }
  return Data([0x82, UInt8(len >> 8), UInt8(len & 0xFF)])
}
private func derTLV(_ tag: UInt8, _ v: Data) -> Data { Data([tag]) + derLen(v.count) + v }
private func derSequence(_ v: Data) -> Data { derTLV(0x30, v) }
private func derSet(_ v: Data)      -> Data { derTLV(0x31, v) }
private func derInteger(_ v: Data)  -> Data { derTLV(0x02, v) }
private func derBitString(_ v: Data)-> Data { derTLV(0x03, Data([0x00]) + v) }
private func derNull()              -> Data { Data([0x05, 0x00]) }
private func derContext0(_ v: Data) -> Data { derTLV(0xA0, v) }
private func derUTF8String(_ s: String) -> Data { derTLV(0x0C, Data(s.utf8)) }

private func derUTCTime(_ date: Date) -> Data {
  let f = DateFormatter()
  f.dateFormat = "yyMMddHHmmss'Z'"; f.timeZone = TimeZone(identifier: "UTC")!
  return derTLV(0x17, Data(f.string(from: date).utf8))
}

private func derOID(_ oid: [Int]) -> Data {
  var enc = Data()
  enc.append(UInt8(oid[0] * 40 + oid[1]))
  for i in 2..<oid.count {
    var v = oid[i]; var sub = [UInt8]()
    sub.append(UInt8(v & 0x7F)); v >>= 7
    while v > 0 { sub.insert(UInt8(0x80 | (v & 0x7F)), at: 0); v >>= 7 }
    enc.append(contentsOf: sub)
  }
  return derTLV(0x06, enc)
}

// OID constants
private let OID_RSA_ENCRYPTION = [1,2,840,113549,1,1,1]
private let OID_SHA256_RSA     = [1,2,840,113549,1,1,11]
private let OID_CN             = [2,5,4,3]

// ──────────────────────────────────────────────────────────────────────
// MARK: – DER length reader  (for PKCS#1 parsing)
// ──────────────────────────────────────────────────────────────────────

private func readDerLen(_ data: Data, _ pos: Int) -> (Int, Int) {
  let first = Int(data[pos])
  if first < 0x80 { return (first, pos + 1) }
  let numBytes = first & 0x7F
  var len = 0
  for i in 1...numBytes { len = (len << 8) | Int(data[pos + i]) }
  return (len, pos + 1 + numBytes)
}

// ──────────────────────────────────────────────────────────────────────
// MARK: – AndroidTV React Native module
// ──────────────────────────────────────────────────────────────────────

@objc(AndroidTV)
class AndroidTVModule: NSObject, RCTBridgeModule {

  @objc static func moduleName() -> String! { "AndroidTV" }
  @objc static func requiresMainQueueSetup() -> Bool { false }

  private let defaults  = UserDefaults.standard
  private let bgQueue   = DispatchQueue(label: "com.remote.androidtv", attributes: .concurrent)
  private let lock      = NSLock()

  // ip → open (read, write) streams kept alive between startPairing and confirmPairing
  private var pairingSessions: [String: (CFReadStream, CFWriteStream)] = [:]
  // ip → server TLS certificate extracted during pairing (needed for secret computation)
  private var serverCerts: [String: SecCertificate] = [:]

  // ── JS API ─────────────────────────────────────────────────────────

  @objc func isPaired(_ ip: String,
                      resolver resolve: RCTPromiseResolveBlock,
                      rejecter reject:  RCTPromiseRejectBlock) {
    resolve(loadPairedIps().contains(ip))
  }

  /// Step 1 – Connect to the TV pairing service (port 6467).
  /// Resolves once the TV is showing the 6-digit hex PIN on screen.
  @objc func startPairing(_ ip: String,
                          resolver resolve: @escaping RCTPromiseResolveBlock,
                          rejecter reject:  @escaping RCTPromiseRejectBlock) {
    bgQueue.async { [weak self] in
      guard let self = self else { return }
      do {
        let identity = try self.getOrGenerateIdentity()
        let (r, w, serverCert) = try self.createTlsStreams(host: ip, port: 6467, identity: identity)

        self.lock.lock()
        self.pairingSessions[ip] = (r, w)
        if let cert = serverCert { self.serverCerts[ip] = cert }
        self.lock.unlock()

        // Send PairingRequest immediately after TLS handshake
        try self.streamWrite(w, data: delimited(buildMessage([
          (1,  .varint(2)),                        // proto_ver = 2
          (2,  .varint(200)),                      // status = OK
          (10, .msg(self.buildPairingRequest())),  // PairingRequest
        ])))

        // Drive the handshake until ConfigurationAck (TV shows PIN)
        while true {
          guard let data = self.streamReadDelimited(r) else {
            throw ATVError("TV closed connection during pairing handshake")
          }
          let fields = decodeMessage(data)
          let status = Int(fields[2] as? Int64 ?? 200)
          guard status == 200 else { throw ATVError("TV returned error status \(status)") }

          if fields[11] != nil {      // PairingRequestAck → send PairingOption
            try self.streamWrite(w, data: delimited(buildMessage([
              (1,  .varint(2)),
              (2,  .varint(200)),
              (20, .msg(self.buildPairingOption())),
            ])))
          } else if fields[20] != nil { // PairingOption → send PairingConfig
            try self.streamWrite(w, data: delimited(buildMessage([
              (1,  .varint(2)),
              (2,  .varint(200)),
              (30, .msg(self.buildPairingConfig())),
            ])))
          } else if fields[31] != nil { // PairingConfigurationAck → PIN visible on TV
            resolve(nil)
            return
          }
        }
      } catch {
        self.lock.lock()
        self.pairingSessions.removeValue(forKey: ip)
        self.serverCerts.removeValue(forKey: ip)
        self.lock.unlock()
        reject("PAIRING_ERROR", error.localizedDescription, nil)
      }
    }
  }

  /// Step 2 – Submit the 6-digit hex PIN shown on the TV screen.
  @objc func confirmPairing(_ ip: String,
                             pin: String,
                             resolver resolve: @escaping RCTPromiseResolveBlock,
                             rejecter reject:  @escaping RCTPromiseRejectBlock) {
    bgQueue.async { [weak self] in
      guard let self = self else { return }

      self.lock.lock()
      let session    = self.pairingSessions.removeValue(forKey: ip)
      let serverCert = self.serverCerts.removeValue(forKey: ip)
      self.lock.unlock()

      guard let (r, w) = session else {
        reject("PAIRING_ERROR", "No active pairing session for \(ip)", nil)
        return
      }

      do {
        let identity = try self.getOrGenerateIdentity()
        let secret = try self.computeSecret(identity: identity, serverCert: serverCert, pin: pin)

        // Send PairingSecret
        try self.streamWrite(w, data: delimited(buildMessage([
          (1,  .varint(2)),
          (2,  .varint(200)),
          (40, .msg(bytesField(1, secret))),  // PairingSecret
        ])))

        // Await SecretAck
        guard let ackData = self.streamReadDelimited(r) else {
          CFReadStreamClose(r); CFWriteStreamClose(w)
          reject("PAIRING_ERROR", "TV closed connection without acknowledging PIN", nil)
          return
        }
        CFReadStreamClose(r); CFWriteStreamClose(w)

        let fields = decodeMessage(ackData)
        let status = Int(fields[2] as? Int64 ?? 200)

        if status == 402 {
          reject("BAD_PIN", "Wrong PIN — please check the code on your TV", nil)
        } else if status != 200 {
          reject("PAIRING_ERROR", "Pairing failed with status \(status)", nil)
        } else {
          self.addPairedIp(ip)
          resolve(nil)
        }
      } catch {
        CFReadStreamClose(r); CFWriteStreamClose(w)
        reject("PAIRING_ERROR", error.localizedDescription, nil)
      }
    }
  }

  /// Send a single ATVRS key event to a paired Android TV.
  @objc func sendKey(_ ip: String,
                     keyCode: Int,
                     resolver resolve: @escaping RCTPromiseResolveBlock,
                     rejecter reject:  @escaping RCTPromiseRejectBlock) {
    bgQueue.async { [weak self] in
      guard let self = self else { return }

      guard self.loadPairedIps().contains(ip) else {
        reject("NOT_PAIRED", "Device \(ip) is not paired", nil)
        return
      }

      var r: CFReadStream? = nil
      var w: CFWriteStream? = nil

      do {
        let identity = try self.getOrGenerateIdentity()
        let streams = try self.createTlsStreams(host: ip, port: 6466, identity: identity)
        r = streams.0; w = streams.1

        // Exchange: Configure → SetActive (if present) → PingPong → send key
        let deadline = Date().addingTimeInterval(10)
        var ready = false

        while !ready && Date() < deadline {
          guard let data = self.streamReadDelimited(streams.0) else { break }
          let fields = decodeMessage(data)

          if fields[1] != nil {                          // Configure
            try self.streamWrite(streams.1, data: delimited(buildMessage([
              (1, .msg(self.buildRemoteConfigure())),
            ])))
            ready = true

          } else if fields[2] != nil {                   // SetActive
            try self.streamWrite(streams.1, data: delimited(buildMessage([
              (2, .msg(varintField(1, 622))),
            ])))

          } else if let pingData = fields[8] as? Data {  // Ping → Pong
            let pingFields = decodeMessage(pingData)
            let val1 = Int(pingFields[1] as? Int64 ?? 0)
            try self.streamWrite(streams.1, data: delimited(buildMessage([
              (9, .msg(varintField(1, val1))),
            ])))
          }
        }

        guard ready else { throw ATVError("TV did not become ready for commands") }

        // Send key injection (direction = SHORT = 3)
        try self.streamWrite(streams.1, data: delimited(buildMessage([
          (10, .msg(varintField(1, keyCode) + varintField(2, 3))),
        ])))

        Thread.sleep(forTimeInterval: 0.3)
        resolve(nil)

      } catch {
        let msg = error.localizedDescription
        let isReset = msg.contains("ECONNRESET") || msg.contains("connection reset") || msg.contains("reset by peer")
        if isReset {
          self.removePairedIp(ip)
          reject("NOT_PAIRED", "TV rejected connection — please re-pair", nil)
        } else {
          reject("SEND_ERROR", msg, nil)
        }
      }

      if let rv = r { CFReadStreamClose(rv) }
      if let wv = w { CFWriteStreamClose(wv) }
    }
  }

  @objc func unpair(_ ip: String,
                    resolver resolve: RCTPromiseResolveBlock,
                    rejecter reject:  RCTPromiseRejectBlock) {
    removePairedIp(ip)
    lock.lock()
    if let (r, w) = pairingSessions.removeValue(forKey: ip) {
      CFReadStreamClose(r); CFWriteStreamClose(w)
    }
    serverCerts.removeValue(forKey: ip)
    lock.unlock()
    resolve(nil)
  }

  // ── TLS socket (CFStream + SSL) ────────────────────────────────────

  private func createTlsStreams(host: String, port: Int, identity: SecIdentity)
    throws -> (CFReadStream, CFWriteStream, SecCertificate?) {

    var readRef:  Unmanaged<CFReadStream>?
    var writeRef: Unmanaged<CFWriteStream>?
    CFStreamCreatePairWithSocketToHost(nil, host as CFString, UInt32(port), &readRef, &writeRef)

    guard let r = readRef?.takeRetainedValue(),
          let w = writeRef?.takeRetainedValue() else {
      throw ATVError("Failed to allocate socket streams to \(host):\(port)")
    }

    // Client certificate + trust-all server cert (Android TV uses self-signed)
    let sslSettings: [CFString: Any] = [
      kCFStreamSSLCertificates:              [identity] as CFArray,
      kCFStreamSSLValidatesCertificateChain: kCFBooleanFalse!,
      kCFStreamSSLIsServer:                  kCFBooleanFalse!,
    ]
    CFReadStreamSetProperty(r,  kCFStreamPropertySSLSettings, sslSettings as CFDictionary)
    CFWriteStreamSetProperty(w, kCFStreamPropertySSLSettings, sslSettings as CFDictionary)

    guard CFReadStreamOpen(r), CFWriteStreamOpen(w) else {
      throw ATVError("Failed to open TLS streams to \(host):\(port)")
    }

    // Wait for TLS handshake to complete (streams go from .opening → .open)
    let deadline = Date().addingTimeInterval(10)
    while true {
      let rs = CFReadStreamGetStatus(r)
      let ws = CFWriteStreamGetStatus(w)
      if rs == .error || ws == .error {
        if let err = CFReadStreamCopyError(r) { throw err as Error }
        throw ATVError("TLS stream error connecting to \(host):\(port)")
      }
      if rs == .open && ws == .open { break }
      guard Date() < deadline else {
        throw ATVError("TLS connect timeout to \(host):\(port)")
      }
      Thread.sleep(forTimeInterval: 0.05)
    }

    // Extract peer certificate for secret computation (available after handshake)
    let peerCert = (CFReadStreamCopyProperty(r, kCFStreamPropertySSLPeerCertificates) as? [SecCertificate])?.first

    return (r, w, peerCert)
  }

  // ── Stream I/O ─────────────────────────────────────────────────────

  private func streamWrite(_ stream: CFWriteStream, data: Data) throws {
    let bytes = [UInt8](data)
    var written = 0
    while written < bytes.count {
      let n = CFWriteStreamWrite(stream,
                                 UnsafePointer(bytes).advanced(by: written),
                                 bytes.count - written)
      if n <= 0 { throw ATVError("Write error on TLS stream") }
      written += n
    }
  }

  private func streamReadExact(_ stream: CFReadStream, count: Int) -> Data? {
    var buf = [UInt8](repeating: 0, count: count)
    var received = 0
    while received < count {
      let n = CFReadStreamRead(stream, &buf + received, count - received)
      if n <= 0 { return nil }
      received += n
    }
    return Data(buf)
  }

  /// Read one length-prefixed (varint) protobuf message from the stream.
  private func streamReadDelimited(_ stream: CFReadStream) -> Data? {
    var len = 0; var shift = 0
    repeat {
      guard let b = streamReadExact(stream, count: 1) else { return nil }
      let byte = Int(b[0])
      len |= (byte & 0x7F) << shift; shift += 7
      if byte & 0x80 == 0 { break }
    } while true
    if len == 0 { return Data() }
    return streamReadExact(stream, count: len)
  }

  // ── Protocol message builders ──────────────────────────────────────

  private func buildPairingRequest() -> Data {
    // field 1 = service_name, field 2 = device_name
    return stringField(1, "Universal Remote") +
           stringField(2, UIDevice.current.name.isEmpty ? "iPhone" : UIDevice.current.name)
  }

  private func buildPairingOption() -> Data {
    // input_encodings[0] = { type=HEXADECIMAL(3), symbol_length=6 }; preferred_role = INPUT(1)
    return lenField(1, varintField(1, 3) + varintField(2, 6)) + varintField(3, 1)
  }

  private func buildPairingConfig() -> Data {
    // encoding = { type=HEXADECIMAL(3), symbol_length=6 }; client_role = INPUT(1)
    return lenField(1, varintField(1, 3) + varintField(2, 6)) + varintField(2, 1)
  }

  private func buildRemoteConfigure() -> Data {
    let deviceInfo = stringField(1, UIDevice.current.name.isEmpty ? "iPhone" : UIDevice.current.name) +
                     stringField(2, "Apple")
    return varintField(1, 622) + lenField(2, deviceInfo)
  }

  // ── Secret computation ─────────────────────────────────────────────
  //
  // SHA-256( clientModulus || clientExpHex || serverModulus || serverExpHex || pin[2:] )
  // Mirrors computeSecret() in AndroidTVModule.kt

  private func computeSecret(identity: SecIdentity,
                              serverCert: SecCertificate?,
                              pin: String) throws -> Data {
    var clientCertRef: SecCertificate?
    SecIdentityCopyCertificate(identity, &clientCertRef)
    guard let clientCert = clientCertRef else { throw ATVError("No client certificate in identity") }
    guard let sCert = serverCert else { throw ATVError("No server certificate stored for this session") }

    let (clientMod, clientExp) = try extractRSAComponents(from: clientCert)
    let (serverMod, serverExp) = try extractRSAComponents(from: sCert)

    var ctx = CC_SHA256_CTX(); CC_SHA256_Init(&ctx)

    func update(_ d: Data) {
      d.withUnsafeBytes { CC_SHA256_Update(&ctx, $0.baseAddress, CC_LONG($0.count)) }
    }

    update(clientMod)
    update(Data(hexStringToBytes("0" + String(clientExp, radix: 16))))
    update(serverMod)
    update(Data(hexStringToBytes("0" + String(serverExp, radix: 16))))
    // PIN suffix: skip the first 2 hex chars (they encode expected hash[0])
    update(Data(hexStringToBytes(String(pin.dropFirst(2)))))

    var digest = Data(count: Int(CC_SHA256_DIGEST_LENGTH))
    digest.withUnsafeMutableBytes {
      CC_SHA256_Final($0.baseAddress!.assumingMemoryBound(to: UInt8.self), &ctx)
    }
    return digest
  }

  // ── RSA public key extraction ──────────────────────────────────────

  private func extractRSAComponents(from cert: SecCertificate) throws -> (modulus: Data, exponent: Int) {
    // Get the public key from the certificate
    guard let pubKey = SecCertificateCopyKey(cert) else {
      throw ATVError("Cannot copy public key from certificate")
    }
    // SecKeyCopyExternalRepresentation for RSA public key returns PKCS#1 DER:
    //   SEQUENCE { INTEGER modulus, INTEGER exponent }
    var error: Unmanaged<CFError>?
    guard let repr = SecKeyCopyExternalRepresentation(pubKey, &error) as Data? else {
      throw ATVError("Cannot export RSA public key: \(String(describing: error?.takeRetainedValue()))")
    }
    return try parsePKCS1PublicKey(repr)
  }

  /// Parse DER PKCS#1 RSAPublicKey → (modulus bytes without leading zero, exponent int)
  private func parsePKCS1PublicKey(_ der: Data) throws -> (Data, Int) {
    guard der.count > 4, der[0] == 0x30 else {
      throw ATVError("Expected SEQUENCE tag (0x30) in PKCS#1 public key")
    }
    let (_, seqBodyStart) = readDerLen(der, 1)

    // First INTEGER = modulus
    var pos = seqBodyStart
    guard der[pos] == 0x02 else { throw ATVError("Expected INTEGER for RSA modulus") }
    pos += 1
    let (modLen, modBodyStart) = readDerLen(der, pos)
    pos = modBodyStart
    var modBytes = der[pos..<(pos + modLen)]
    if modBytes.first == 0x00 { modBytes = modBytes.dropFirst() } // strip sign byte
    pos += modLen

    // Second INTEGER = exponent
    guard der[pos] == 0x02 else { throw ATVError("Expected INTEGER for RSA exponent") }
    pos += 1
    let (expLen, expBodyStart) = readDerLen(der, pos)
    pos = expBodyStart
    let expBytes = der[pos..<(pos + expLen)]
    let exp = expBytes.reduce(0) { ($0 << 8) | Int($1) }

    return (Data(modBytes), exp)
  }

  // ── Certificate / identity management ─────────────────────────────
  //
  // Generates a 2048-bit RSA self-signed X.509 v3 certificate on first run
  // and stores it permanently in the iOS Keychain.

  private func getOrGenerateIdentity() throws -> SecIdentity {
    // 1. Check if we already have a stored identity
    let query: [CFString: Any] = [
      kSecClass:     kSecClassIdentity,
      kSecAttrLabel: "atvrs_identity" as CFString,
      kSecReturnRef: true,
    ]
    var item: CFTypeRef?
    if SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
       let identity = item as! SecIdentity? {
      return identity
    }

    // 2. Generate RSA-2048 keypair and store private key in keychain
    let keyAttrs: [CFString: Any] = [
      kSecAttrKeyType:       kSecAttrKeyTypeRSA,
      kSecAttrKeySizeInBits: 2048 as CFNumber,
      kSecAttrIsPermanent:   kCFBooleanTrue!,
      kSecAttrLabel:         "atvrs_key" as CFString,
    ]
    var pubKey:  SecKey?
    var privKey: SecKey?
    let genStatus = SecKeyGeneratePair(keyAttrs as CFDictionary, &pubKey, &privKey)
    guard genStatus == errSecSuccess, let pub = pubKey, let priv = privKey else {
      throw ATVError("Failed to generate RSA-2048 keypair: OSStatus \(genStatus)")
    }

    // 3. Build a self-signed X.509 v3 DER certificate
    let certDER = try buildSelfSignedCertDER(publicKey: pub, privateKey: priv)
    guard let cert = SecCertificateCreateWithData(nil, certDER as CFData) else {
      throw ATVError("Failed to parse generated certificate DER")
    }

    // 4. Store the certificate in the keychain (next to the private key)
    let certAttrs: [CFString: Any] = [
      kSecClass:     kSecClassCertificate,
      kSecValueRef:  cert,
      kSecAttrLabel: "atvrs_cert" as CFString,
    ]
    let addStatus = SecItemAdd(certAttrs as CFDictionary, nil)
    guard addStatus == errSecSuccess || addStatus == errSecDuplicateItem else {
      throw ATVError("Failed to store certificate in keychain: OSStatus \(addStatus)")
    }

    // 5. Construct an identity from the cert + its matching private key in keychain
    var identity: SecIdentity?
    let idStatus = SecIdentityCreateWithCertificate(nil, cert, &identity)
    guard idStatus == errSecSuccess, let ident = identity else {
      throw ATVError("SecIdentityCreateWithCertificate failed: OSStatus \(idStatus)")
    }
    return ident
  }

  /// Build a minimal self-signed X.509 v3 DER certificate.
  /// Mirrors buildSelfSignedCertDER() in AndroidTVModule.kt.
  private func buildSelfSignedCertDER(publicKey: SecKey, privateKey: SecKey) throws -> Data {
    // SPKI: SEQUENCE { SEQUENCE { OID rsaEncryption, NULL }, BIT_STRING { PKCS#1 pubKey } }
    var error: Unmanaged<CFError>?
    guard let pkcs1Data = SecKeyCopyExternalRepresentation(publicKey, &error) as Data? else {
      throw ATVError("Cannot export RSA public key: \(String(describing: error?.takeRetainedValue()))")
    }
    let spki = derSequence(
      derSequence(derOID(OID_RSA_ENCRYPTION) + derNull()) +
      derBitString(pkcs1Data)
    )

    let now = Date()
    let exp = Date(timeIntervalSince1970: now.timeIntervalSince1970 + 50 * 365 * 24 * 3600)

    // Random 20-byte serial (positive)
    var serialBytes = [UInt8](repeating: 0, count: 20)
    SecRandomCopyBytes(kSecRandomDefault, 20, &serialBytes)
    serialBytes[0] &= 0x7F

    let subject = derSequence(
      derSet(derSequence(derOID(OID_CN) + derUTF8String("Universal Remote")))
    )
    let algId = derSequence(derOID(OID_SHA256_RSA) + derNull())

    let tbs = derSequence(
      derContext0(derInteger(Data([0x02]))) +        // version = v3
      derInteger(Data(serialBytes)) +
      algId +
      subject +
      derSequence(derUTCTime(now) + derUTCTime(exp)) +
      subject +
      spki
    )

    // Sign TBSCertificate with SHA-256 + RSA PKCS#1 v1.5
    guard let sigData = SecKeyCreateSignature(
      privateKey, .rsaSignatureMessagePKCS1v15SHA256, tbs as CFData, &error
    ) as Data? else {
      throw ATVError("Failed to sign certificate: \(String(describing: error?.takeRetainedValue()))")
    }

    return derSequence(tbs + algId + derBitString(sigData))
  }

  // ── Paired IP list (UserDefaults) ──────────────────────────────────

  private func loadPairedIps() -> Set<String> {
    let raw = defaults.string(forKey: "atvrs_paired_ips") ?? ""
    return raw.isEmpty ? [] : Set(raw.split(separator: ",").map(String.init))
  }

  private func addPairedIp(_ ip: String) {
    var set = loadPairedIps(); set.insert(ip)
    defaults.set(set.joined(separator: ","), forKey: "atvrs_paired_ips")
  }

  private func removePairedIp(_ ip: String) {
    var set = loadPairedIps(); set.remove(ip)
    defaults.set(set.joined(separator: ","), forKey: "atvrs_paired_ips")
  }

  // ── Hex helpers ────────────────────────────────────────────────────

  private func hexStringToBytes(_ hex: String) -> [UInt8] {
    var s = hex.hasPrefix("0x") ? String(hex.dropFirst(2)) : hex
    if s.count % 2 != 0 { s = "0" + s }
    var result = [UInt8]()
    var i = s.startIndex
    while i < s.endIndex {
      let j = s.index(i, offsetBy: 2)
      result.append(UInt8(s[i..<j], radix: 16) ?? 0)
      i = j
    }
    return result
  }
}
