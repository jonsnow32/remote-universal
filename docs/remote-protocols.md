# Remote Protocols — Cơ chế điều khiển thiết bị

> Tài liệu giải thích chi tiết các protocols được hỗ trợ, cách app gửi lệnh đến end-device, và luồng hoạt động từ đầu đến cuối.

---

## 1. Tổng quan kiến trúc

Mọi protocol đều kế thừa từ `BaseProtocol` (`packages/core/src/protocols/BaseProtocol.ts`).

```
App gửi lệnh
     ↓
CommandDispatcher.dispatch(deviceId, action)
     ↓
getBestProtocol() — duyệt danh sách protocols của thiết bị theo thứ tự ưu tiên
     ↓
protocol.isAvailable() → chọn protocol đầu tiên khả dụng
     ↓
protocol.send(deviceId, payload)
+ sendWithRetry (tối đa 3 lần, exponential backoff: 100ms → 200ms → 400ms)
```

**`BaseProtocol` interface:**

```typescript
abstract isAvailable(): Promise<boolean>   // kiểm tra protocol có dùng được không
abstract discover(): Promise<string[]>     // tìm thiết bị
abstract connect(deviceId): Promise<void>  // kết nối
abstract send(deviceId, payload): Promise<void>  // gửi lệnh
abstract disconnect(deviceId): Promise<void>     // ngắt kết nối
sendWithRetry(command, payload, retries=3): Promise<void>  // retry với backoff
```

---

## 2. Các Protocols chi tiết

### 2.1 IR — Hồng ngoại

| Thuộc tính | Giá trị |
|---|---|
| **File** | `packages/core/src/protocols/IRProtocol.ts` |
| **Platform** | Android only (thiết bị có IR blaster phần cứng) |
| **Stateful** | Không (connectionless) |
| **Tầm xa** | ~10m, yêu cầu line-of-sight |

**Cơ chế hoạt động:**

App không giao tiếp qua mạng — phát tín hiệu hồng ngoại trực tiếp như remote vật lý thông thường. Native module `IRBlasterModule.kt` gọi Android `ConsumerIrManager`.

Payload là **Pronto Hex** — chuỗi hex encode tần số sóng mang (vd: 38 kHz) + pattern on/off tính bằng microsecond:

```
Pronto Hex: "0000 006D 0022 0000 0156 00AB 0015 0015 ..."
  │
  ├─ Word 0: 0x0000 = raw mode
  ├─ Word 1: 0x006D = frequency divisor → carrier ≈ 38,000 Hz
  ├─ Word 2: 0x0022 = 34 burst pairs in sequence 1
  ├─ Word 3: 0x0000 = 0 burst pairs in repeat sequence
  └─ Words 4+: alternating mark/space counts (Pronto ticks)
        ↓ parseProntoHex() trong IRModule.ts
frequencyHz: 38000
pattern: [9000, 4500, 560, 560, ...]  (µs)
        ↓
IRBlasterModule.kt → ConsumerIrManager.transmit(38000, [9000, 4500, ...])
```

**Luồng:**
```
IRProtocol.send(deviceId, prontoHex)
  → IRModule.transmit(deviceId, prontoHex)
  → parseProntoHex(prontoHex) → { frequencyHz, pattern }
  → NativeModules.IRBlaster.transmit(frequencyHz, pattern)
  → Android ConsumerIrManager.transmit()
```

**Dùng cho:** TV, điều hòa, đầu thu, bất kỳ thiết bị nào có đầu thu hồng ngoại.

---

### 2.2 Wi-Fi — HTTP/LAN

| Thuộc tính | Giá trị |
|---|---|
| **File** | `packages/core/src/protocols/WiFiProtocol.ts` |
| **Platform** | iOS + Android |
| **Stateful** | Không (HTTP stateless, per-request) |
| **Tầm xa** | Cùng mạng LAN (hoặc VPN) |

**Cơ chế hoạt động:**

Gửi lệnh qua **HTTP POST** đến IP của thiết bị trong mạng LAN nội bộ. Timeout 5 giây dùng `AbortController`.

```
App → POST http://192.168.1.100/command
      Content-Type: application/json
      body: '{"key": "KEY_POWER"}'
        ↓
Smart TV / Smart AC phản hồi HTTP 200
```

**Discovery trước khi gửi lệnh:**

Wi-Fi protocol không tự tìm thiết bị — phụ thuộc vào 2 discovery channels:

- **mDNS/Bonjour** (`MDNSDiscovery`): dùng `react-native-zeroconf`, lắng nghe service types:
  - `_googlecast._tcp` → Chromecast
  - `_airplay._tcp` → Apple TV
  - `_amzn-wplay._tcp` → Fire TV
  - `_smarttv-rest._tcp` → Tizen TV
- **SSDP** (`SSDPDiscovery`): probe HTTP `GET http://<ip>:8001/api/v2/` với 1.5s timeout, quét 4 subnets × 30 hosts → Samsung Tizen TV

**Dùng cho:** Samsung Smart TV, LG webOS TV, Daikin Smart AC, bất kỳ thiết bị IoT nào có HTTP API.

---

### 2.3 BLE — Bluetooth Low Energy

| Thuộc tính | Giá trị |
|---|---|
| **File** | `packages/core/src/protocols/BLEProtocol.ts` |
| **Platform** | iOS + Android |
| **Stateful** | Có (connect → write → disconnect) |
| **Tầm xa** | ~10m |

**Cơ chế hoạt động:**

Dùng `react-native-ble-plx`, giao tiếp qua **GATT protocol**. Payload được ghi vào GATT Characteristic UUID của thiết bị.

```
BLEModule.scanForDevices()         → scan BLE advertisements (timeout)
     ↓
BLEModule.connect(deviceId)        → GATT connect (negotiate MTU)
     ↓
BLEModule.write(deviceId, payload) → WriteCharacteristic vào service/char UUID
     ↓
BLEModule.disconnect(deviceId)     → GATT disconnect
```

Native bridge:
- **iOS:** `CoreBluetooth` framework (Swift)
- **Android:** `BluetoothLE` API (Kotlin)

Payload encode dạng **Base64** (dùng `btoa()` thay vì `Buffer.from()` để tương thích React Native).

**Dùng cho:** Loa Bluetooth, điều hòa BLE, thiết bị IoT tầm gần, remote BLE.

---

### 2.4 HomeKit

| Thuộc tính | Giá trị |
|---|---|
| **File** | `packages/core/src/protocols/HomeKitProtocol.ts` |
| **Platform** | iOS only (Swift native module) |
| **Stateful** | Được quản lý bởi HomeKit framework |
| **Tầm xa** | LAN + iCloud relay (kể cả khi ra ngoài nhà) |

**Cơ chế hoạt động:**

Apple **HomeKit Accessory Protocol (HAP)** — end-to-end encrypted. App chỉ gọi native module; HomeKit framework tự lo routing (qua Wi-Fi hoặc BLE tuỳ accessory, qua iCloud nếu ra ngoài).

```
App → HomeKitModule.sendCharacteristic(accessoryUUID, payload)
     ↓
Apple HomeKit framework (HAP - end-to-end encrypted)
     ↓ (local Wi-Fi hoặc BLE)
HomeKit Accessory (đèn, ổ cắm, thermostat, ...)
```

Discovery: `HomeKitModule.getAccessories()` trả về danh sách accessories đã được pair với HomeKit home của user.

**Đặc điểm nổi bật:**
- Bảo mật cao — tất cả traffic đều được mã hoá
- Không cần biết IP của accessory
- Hoạt động khi ra ngoài nhà qua Apple Home Hub (HomePod, Apple TV, iPad)

**Dùng cho:** Đèn thông minh, ổ cắm, khoá cửa, thermostat tương thích HomeKit.

---

### 2.5 Matter

| Thuộc tính | Giá trị |
|---|---|
| **File** | `packages/core/src/protocols/MatterProtocol.ts` |
| **Platform** | iOS + Android |
| **Stateful** | Có (commissioning → invoke → decommission) |
| **Tầm xa** | LAN (Wi-Fi) hoặc Thread mesh |

**Cơ chế hoạt động:**

**Matter** (chuẩn IoT mở, thay thế Zigbee/Z-Wave, được Apple/Google/Amazon/Samsung đồng thuận). Thiết bị tham gia vào **Matter fabric** qua commissioning (quét QR code hoặc NFC).

```
MatterModule.commission(deviceId)
  → Pair thiết bị vào Matter fabric (QR code / NFC setup code)
     ↓
MatterModule.invoke(deviceId, clusterPayload)
  → Gọi Matter Cluster command (vd: OnOff cluster, LevelControl cluster)
     ↓ (Wi-Fi trực tiếp hoặc Thread mesh qua Border Router)
Matter Device (đèn, ổ cắm, màn trập, cửa garage, ...)
     ↓
MatterModule.decommission(deviceId)  → xoá khỏi fabric
```

Payload theo cấu trúc Matter cluster:
```json
{ "cluster": "OnOff", "command": "toggle" }
{ "cluster": "LevelControl", "command": "moveToLevel", "value": 80 }
```

**Đặc điểm nổi bật:**
- Interoperable — một thiết bị Matter hoạt động với cả Google Home, Apple Home, Amazon Alexa
- Thread: mạng mesh IPv6 tiêu thụ điện thấp, không cần Wi-Fi router trực tiếp
- Local first — không phụ thuộc cloud

**Dùng cho:** Thiết bị IoT thế hệ mới (2023+): đèn, ổ cắm, cảm biến, thermostat, khoá cửa.

---

## 3. CommandDispatcher — Chọn protocol tốt nhất

File: `packages/core/src/commands/CommandDispatcher.ts`

Mỗi `DeviceDefinition` khai báo danh sách protocols theo thứ tự ưu tiên:

```typescript
// Ví dụ: Samsung Smart TV — ưu tiên Wi-Fi, fallback IR
device.protocols = ['wifi', 'ir']

// Ví dụ: BLE Speaker — chỉ BLE
device.protocols = ['ble']

// Ví dụ: Smart Bulb mới — Matter → HomeKit → Wi-Fi
device.protocols = ['matter', 'homekit', 'wifi']
```

`getBestProtocol()` duyệt lần lượt, gọi `isAvailable()` và chọn cái đầu tiên thành công:

```typescript
for (const protocolType of device.protocols) {
  const protocol = PROTOCOL_MAP[protocolType];
  if (await protocol.isAvailable()) return protocol;
}
// → throw nếu không có protocol nào khả dụng
```

---

## 4. Luồng hoàn chỉnh: User bấm nút → Thiết bị phản hồi

```
[User bấm "Power ON" trên remote Samsung TV]
         ↓
CommandDispatcher.dispatch("samsung-tv-living-room", "power_on")
         ↓
DeviceRegistry.getDevice("samsung-tv-living-room")
→ device.protocols = ['wifi', 'ir']
→ device.commands["power_on"] = { payload: '{"key":"KEY_POWER"}' }
         ↓
getBestProtocol():
  WiFiProtocol.isAvailable() → true ✓  (đang ở cùng LAN)
         ↓
sendWithRetry(command, '{"key":"KEY_POWER"}', retries=3)
  attempt 1:
    WiFiProtocol.send("192.168.1.100", '{"key":"KEY_POWER"}')
    → POST http://192.168.1.100/command  { key: "KEY_POWER" }
    → HTTP 200 ✓
         ↓
CommandResult { success: true, protocol: 'wifi', latencyMs: 87 }
```

**Khi Wi-Fi thất bại (vd: ra khỏi nhà):**
```
WiFiProtocol.isAvailable() → true (nhưng send timeout)
  attempt 1: timeout sau 5s → backoff 100ms
  attempt 2: timeout sau 5s → backoff 200ms
  attempt 3: timeout sau 5s → throw Error
         ↓
CommandDispatcher thử IRProtocol
  IRProtocol.isAvailable() → false (iOS không có IR blaster)
         ↓
throw "No available protocol for device"
```

---

## 5. Bảng so sánh tổng hợp

| Protocol | Platform | Kết nối | Tầm xa | Stateful | Dùng cho |
|---|---|---|---|---|---|
| **IR** | Android only | Hồng ngoại (vật lý) | ~10m, line-of-sight | Không | TV/AC cũ, universal remote |
| **Wi-Fi** | iOS + Android | HTTP/LAN | Cùng mạng | Không | Smart TV, Smart AC |
| **BLE** | iOS + Android | GATT/Bluetooth | ~10m | Có | Loa BT, IoT BLE |
| **HomeKit** | iOS only | HAP (mã hoá) | LAN + iCloud | Framework | Apple Home accessories |
| **Matter** | iOS + Android | Wi-Fi / Thread | LAN + mesh | Có | IoT thế hệ mới (2023+) |

---

## 6. Device Discovery — Tìm thiết bị trước khi điều khiển

Trước khi gửi lệnh Wi-Fi/BLE, app cần biết địa chỉ của thiết bị. `DeviceDiscovery` chạy 4 channels song song:

| Channel | Class | Cơ chế | Tìm được |
|---|---|---|---|
| **mDNS/Bonjour** | `MDNSDiscovery` | `react-native-zeroconf`, 4 service types | Chromecast, Apple TV, Fire TV, Tizen TV |
| **SSDP/HTTP probe** | `SSDPDiscovery` | HTTP GET port 8001, quét 4 subnets × 30 hosts | Samsung Tizen Smart TV |
| **BLE scan** | `BLEDiscovery` | `BLEModule.scanForDevices()` với timeout | Loa BT, BLE AC, BLE peripherals |
| **Hub/Cloud** | `HubDiscovery` | `CloudSync.getRegisteredDevices()` | SmartThings, LG ThinQ Cloud, Daikin Cloud |

Kết quả được merge, deduplicate theo `device.id`, timeout toàn bộ sau 8 giây:

```typescript
// Chờ tất cả channels xong
const devices = await discovery.discoverAll(8_000);

// Hoặc stream real-time (UI cập nhật ngay khi tìm thấy mỗi thiết bị)
await discovery.discoverStream(device => {
  setDeviceList(prev => [...prev, device]);
}, 8_000);
```
