# Universal Remote — Go-To-Market Strategy

> **Core positioning:** "Mất remote? Mở app — điều khiển ngay trong 2 phút."
> Chiến lược 3 giai đoạn: B2C Freemium → Pro Subscription → B2B White-Label

---

## 1. Tổng quan chiến lược

```
                        REVENUE STREAMS

     Phase 1              Phase 2              Phase 3
   (0–6 tháng)          (6–18 tháng)         (18 tháng+)
  ──────────────        ──────────────        ──────────────
  Universal Remote  →   Pro Subscription  →   B2B White-Label
  B2C · Free tier        $2.99/tháng           $499–5000/tháng
  Build user base        Main revenue          Enterprise upside

  Mục tiêu:             Mục tiêu:             Mục tiêu:
  10 000 DAU            $6 000/tháng          1–2 brand clients
  App store rank        20% conversion        pitch bằng track record
```

---

## 2. Phase 1 — B2C Free (0–6 tháng)

### Mục tiêu
- Đạt **10 000 downloads** trong 6 tháng đầu
- Xây dựng IR code database phong phú (user-contributed)
- Tối ưu onboarding: từ download → control device đầu tiên < **2 phút**

### User journey

```
[Mất remote TV]
      │
      ▼
[Tìm "universal remote" trên App Store / Play Store]
      │
      ▼
[Download app — Free]
      │
      ▼
[Mở app → Grant network permission]
      │
      ├─── Auto scan LAN ──► Tìm thấy TV → Tap → Dùng ngay ✅ (30 giây)
      │
      └─── Không tìm thấy → Add manually:
                Category → Brand → Model → Done ✅ (90 giây)
```

### Free tier — nội dung

| Feature | Free |
|---|---|
| Số thiết bị | 3 |
| IR blaster (Android) | ✅ |
| Wi-Fi control | ✅ |
| Auto-discovery (LAN scan) | ✅ |
| Remote layouts | Standard only |
| Cloud backup | ❌ |
| Macro / automation | ❌ |
| Custom layout | ❌ |

### Growth tactics

| Tactic | Chi tiết |
|---|---|
| **ASO** | Keywords: "universal remote", "TV remote", "ac remote control", "điều khiển tivi" |
| **User-contributed IR codes** | Khi user học IR code mới → đóng góp vào shared database (như Waze) |
| **App Store ratings prompt** | Trigger sau lần đầu control thành công — NPS rất cao ở moment này |
| **Referral** | "Chia sẻ app cho bạn bè" → unlock thêm 2 slot thiết bị (total 5) |
| **Viral loop** | Khi user đăng story trên mạng xã hội: "Mất remote mà vẫn xem được phim nhờ app này" |

---

## 3. Phase 2 — B2C Pro Subscription (6–18 tháng)

### Mục tiêu
- **20% conversion** Free → Pro
- **$6 000+ MRR** tại 10 000 MAU
- Churn < 8%/tháng

### Pro tier — nội dung

| Feature | Free | Pro ($2.99/tháng) |
|---|---|---|
| Số thiết bị | 3 | Không giới hạn |
| IR blaster | ✅ | ✅ |
| Wi-Fi / BLE control | ✅ | ✅ |
| Auto-discovery | ✅ | ✅ |
| Cloud backup & sync | ❌ | ✅ |
| Macro / automation | ❌ | ✅ |
| Custom remote layout | ❌ | ✅ |
| Multi-room groups | ❌ | ✅ |
| Scheduled actions (timer) | ❌ | ✅ |
| Voice command (Phase 4) | ❌ | ✅ |
| Priority IR database access | ❌ | ✅ |

### Upsell triggers — đúng moment

```
Trigger 1: User thêm thiết bị thứ 4
  → "Bạn đã có 3 thiết bị (giới hạn Free)"
  → "Nâng Pro để thêm không giới hạn — $2.99/tháng"
  → [Dùng thử 7 ngày miễn phí]

Trigger 2: User cố tạo Macro
  → "Macro là tính năng Pro"
  → Demo animation: "Movie Night" tắt đèn + bật TV + bật AC
  → [Mở khóa Pro]

Trigger 3: User đổi điện thoại mới
  → "Khôi phục danh sách thiết bị của bạn"
  → "Cloud backup yêu cầu Pro"
  → [Nâng cấp ngay]

Trigger 4: Sau 30 ngày dùng Free (retention hook)
  → In-app: "Bạn đã control X lượt trong tháng này"
  → "Thử Pro miễn phí 7 ngày?"
```

### Pricing model

| Option | Giá | Ghi chú |
|---|---|---|
| Monthly | $2.99/tháng | Giá thấp — friction thấp |
| Annual | $19.99/năm ($1.67/tháng) | Save 44% — khuyến khích |
| Lifetime | $39.99 (one-time) | Tạo FOMO, dùng lúc launch |

> **Tiêu chuẩn ngành:** TV remote apps trên App Store hiện tại charge $2.99–4.99/tháng. Vị thế $2.99 là cạnh tranh.

### Revenue projection

| MAU | Conversion | MRR |
|---|---|---|
| 5 000 | 15% | ~$2 200 |
| 10 000 | 20% | ~$6 000 |
| 50 000 | 20% | ~$30 000 |
| 100 000 | 22% | ~$66 000 |

---

## 4. Phase 3 — B2B White-Label (18 tháng+)

### Tại sao đợi đến Phase 3?

Đến lúc này bạn có **3 assets mạnh để pitch B2B**:

```
1. User base: "10 000+ người đang dùng app của chúng tôi mỗi ngày"
2. IR database: "500 000+ IR codes, 300+ brands — lớn hơn bất kỳ đối thủ nào"
3. Track record: "App 4.7★ trên store, churn < 8%/tháng"
```

Không có 3 thứ này → rất khó thuyết phục hãng lớn trả $499+/tháng.

### Target khách hàng B2B

| Khách hàng | Tier | Lý do mua |
|---|---|---|
| Hãng AC nội địa (Điều hòa Casper, Sunhouse...) | Starter $499 | Muốn có app riêng nhưng không có team mobile |
| Agency làm app cho hãng điện tử | Pro $1999 | Quản lý nhiều brand client |
| Hãng TV mid-range (TCL, Hisense VN) | Pro $1999 | App branded + OTA update |
| Samsung / LG (mua tech layer) | Enterprise $5000+ | Tích hợp vào ecosystem sẵn |

### B2B sales flow

```
[Cold outreach / inbound from app store listing]
      │
      ▼
[Demo call — 30 phút]
  • Trình bày tech: "Không cần dev team — chúng tôi lo hết"
  • Cho xem demo app sample trong 5 phút
      │
      ▼
[Pilot — 30 ngày miễn phí]
  • Họ configure brand, test trên thiết bị thật
      │
      ▼
[Contract ký]
  • Minimum 3 tháng
  • Pay monthly hoặc annual (discount 20%)
```

---

## 5. Competitive Landscape

| App | Model | Điểm yếu |
|---|---|---|
| **AnyMote** | B2C, $4.99/year | IR only, UI cũ |
| **SURE Universal** | B2C freemium | Quảng cáo nhiều, UX kém |
| **Peel Smart Remote** | Bị xóa khỏi Play Store | Policy violation |
| **Mi Remote (Xiaomi)** | Miễn phí, chỉ trên Xiaomi | Locked ecosystem |
| **SmartThings** | Miễn phí | Chỉ Samsung ecosystem |

**Cơ hội:** Không có app nào kết hợp tốt IR + Wi-Fi + BLE + đẹp + đa brand. Đây là gap.

---

## 6. Metrics cần theo dõi

### Phase 1 (B2C Free)
| Metric | Target 6 tháng |
|---|---|
| Downloads | 10 000 |
| D1 Retention | > 40% |
| D7 Retention | > 20% |
| Time to first control | < 2 phút |
| App Store rating | > 4.5★ |

### Phase 2 (Pro Subscription)
| Metric | Target |
|---|---|
| Free → Pro conversion | > 20% |
| MRR | $6 000 |
| Monthly churn | < 8% |
| LTV | > $18 (6 tháng trung bình) |

### Phase 3 (B2B)
| Metric | Target |
|---|---|
| Paying tenants | 3 trong năm đầu |
| MRR từ B2B | $3 000+ |
| Tenant churn | < 5%/tháng |

---

## 7. Kết luận — Priority order

```
✅ ĐANG LÀM ĐÚNG:
   └─ Build Universal Remote app với UX tốt
   └─ HomeScreen với Add Device wizard đơn giản
   └─ DiscoveryScreen auto-scan
   └─ IR blaster + Wi-Fi support

⬜ LÀM NGAY TIẾP THEO (để tới Phase 2):
   1. Paywall / Pro gate (RevenueCat hoặc Expo IAP)
   2. Cloud backup (Supabase auth + sync.ts)  
   3. Macro engine UI (MacroEngine đã có backend)
   4. App Store submission + ASO keywords

⏳ LÀM SAU (Phase 3):
   5. Tenant Portal (web dashboard)
   6. EAS Build CI/CD automation
   7. B2B outreach
```

> **Bottom line:** App này hoàn toàn có thể đạt $30 000+/tháng trong 18–24 tháng nếu tập trung đúng thứ tự: Free UX → Pro conversion → B2B expansion.
