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

## Aturan

- Jangan menambah paket bersama antar app; perbedaan antar brand cukup di `src/config/brand.ts` app itu.
- Rahasia (keystore, `google-services.json`, kredensial EAS) tidak pernah masuk repo (`.gitignore`).
- Desain mengikuti referensi ScreensDesign library dan token warna situs resmi brand (`efn-platform`
  `services/superapp-web/lib/brands.ts`).
