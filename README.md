# efn-mobile — aplikasi Expo EFN (EraRasa)

Empat aplikasi Expo yang **berdiri sendiri**: tanpa kode bersama, tanpa workspace, satu `package.json` per app.
Ini keputusan pemilik proyek (docs/04 §15.9 L-89 di repo `efn-platform`).

| App | Folder | Isi |
|---|---|---|
| Super-App EFN | `apps/superapp` | semua brand, satu akun, poin lintas brand, belanja + ambil di toko, pre-order berjadwal, reservasi meja PB/Bacha, makan di tempat (scan QR meja) |
| Paris Baguette | `apps/parisbaguette` | belanja + pre-order, reservasi meja, makan di tempat |
| Bacha Coffee | `apps/bacha` | belanja + pre-order, reservasi meja (BCF), makan di tempat |
| GrandLucky | `apps/grandlucky` | belanja + ambil di toko (ritel: tanpa reservasi & makan di tempat) |

Mode "pesan-antar" tampil sebagai **Segera hadir** di semua app (L-88). Semua data dan angka (harga, slot, kapasitas,
jam reservasi) berasal dari BFF `efn-platform` (`https://api.<domain>`), dan Odoo menjadi engine-nya. App tidak
menyimpan rahasia apa pun.

## Menjalankan (per app)

```bash
cd apps/superapp            # atau parisbaguette | bacha | grandlucky
npm ci
npx tsc --noEmit            # typecheck
npx jest                    # unit test (jest-expo)
EFN_API_BASE_URL=https://api.efn.local npx expo start
npx expo export --platform android   # bundle produksi (cek build)
```

Default `apiBaseUrl` = `https://api.efn.local` (stack dev `efn-platform`). Untuk staging/produksi, set
`EFN_API_BASE_URL=https://api.<domain>` saat build. Hanya https yang diterima.

## Status verifikasi (22 Okt 2026)

Keempat app lulus `tsc --noEmit` tanpa error, jest 56/56, dan `expo export --platform android` (bundle Hermes
4,6–4,7 MB). Uji terhadap BFF dev sungguhan dari perangkat/emulator **belum** dijalankan.

## Super-App: modifier & mockup pembayaran (25 Okt 2026, K25-03/K25-07)

Hanya `apps/superapp` (K25-03: app brand dibekukan).

- **Modifier F&B** di detail produk (`src/ui/AttributePicker.tsx`, `src/lib/attributes.ts`): ukuran, gula, es, topping.
  Kontrak BFF sudah ada (G22 B-2/B-4: `attributes`, `attribute_value_ids`, `attributes_text`). Produk sama dengan pilihan
  berbeda = baris keranjang berbeda. Logika disalin dari web `superapp-web/lib/attributes.ts` (tanpa paket bersama).
- **Bayar dulu** (K25-07): checkout tidak lagi menawarkan "bayar di kasir".
- **Transfer bank + bukti = NYATA** (efn-platform docs/04 §17.2–17.5, G26):
  - Ditawarkan bila semua kanal di keranjang memuat `bank_transfer` di `payment_modes`, dan hanya untuk pesanan dari
    satu brand/PT.
  - Checkout mengirim `payment_method: "bank_transfer"`. Detail pesanan menampilkan rekening PT penjual, nominal, dan
    kode berita transfer dari BFF.
  - Foto bukti diunggah ke `POST /v1/orders/:id/transfer-proof` (multipart `photo`). App tidak menyimpannya.
  - Status: menunggu bukti → diverifikasi staf (polling 10 dtk) → ditolak (alasan + sisa unggah) / lunas.
  - Logika murni: `src/lib/payment.ts` (`transferStage`, `REJECT_REASON_LABEL`) dan parser `parseTransferPayment`
    (`src/api/types.ts`). Test: `__tests__/transfer.test.ts`.
- **Mockup payment gateway** (`EFN_PAYMENT_MOCKUP=true` saat build/start; default mati):
  - QRIS = alur nyata BFF (provider `mock` di dev/staging).
  - Virtual Account dan e-wallet = **tampilan saja** sampai BFF tahap 2 (§17.7), jadi pesanan dibuat sebagai `qris`.
    Pilihan metode hanya tersimpan di memori perangkat (`src/state/paymentChoice.ts`).
  - Tombol simulasi memanggil `POST /v1/orders/:id/simulate-payment` (BFF menolak 404 di production / provider ≠ mock).
    Untuk transfer, tombol meniru keputusan Verifikator (setujui / tolak + alasan); hanya bekerja dengan Odoo mock BFF.
  - Nomor VA diberi label CONTOH (berawalan `9999`).

```bash
EFN_PAYMENT_MOCKUP=true EFN_API_BASE_URL=https://api.efn.local npx expo start
```

## Aturan

- Jangan menambah paket bersama antar app; perbedaan antar brand cukup di `src/config/brand.ts` app itu.
- Rahasia (keystore, `google-services.json`, kredensial EAS) tidak pernah masuk repo (`.gitignore`).
- Desain mengikuti referensi ScreensDesign library dan token warna situs resmi brand (`efn-platform`
  `services/superapp-web/lib/brands.ts`).
