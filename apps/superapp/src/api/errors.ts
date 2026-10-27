/**
 * Pesan galat Bahasa Indonesia per `error.code` BFF (docs/04 §3, §10.3.7, §12.2, §14.A.3, §14.C.2, §15.5).
 * Salinan dari superapp-web lib/orders.ts + lib/fnb.ts (+ booking G23). Pesan BFF TIDAK ditampilkan mentah.
 */

export const ERROR_MESSAGES: Record<string, string> = {
  simulation_unavailable: 'Simulasi pembayaran tidak tersedia di server ini (hanya dev/staging dengan provider mock).',
  // auth
  captcha_required: 'Verifikasi keamanan kedaluwarsa. Coba kirim kode lagi.',
  age_confirmation_required: 'Centang pernyataan bahwa Anda berusia minimal 17 tahun, lalu tekan Masuk lagi. Kode yang sama masih bisa dipakai.',
  privacy_consent_required: 'Setujui Kebijakan Privasi dan pemrosesan data pribadi, lalu tekan Masuk lagi. Kode yang sama masih bisa dipakai.',
  invalid_phone: 'Nomor HP tidak valid. Contoh: 0812 3456 7890.',
  unauthenticated: 'Sesi berakhir. Silakan masuk kembali.',
  unauthorized: 'Sesi berakhir. Silakan masuk kembali.',
  account_deleting: 'Akun ini sedang dalam proses penghapusan sehingga tidak dapat digunakan.',
  // online (§10.3.7)
  price_changed: 'Harga berubah sejak ringkasan dibuat. Kami sudah menghitung ulang — periksa total baru sebelum membayar.',
  out_of_stock: 'Sebagian barang habis. Kurangi atau hapus barang yang ditandai, lalu coba lagi.',
  item_unavailable: 'Sebagian barang atau gerai sedang tidak tersedia. Periksa kembali keranjang Anda.',
  order_not_cancellable: 'Pesanan ini sudah dibayar atau diproses sehingga tidak bisa dibatalkan di aplikasi. Hubungi layanan pelanggan.',
  invalid_state: 'Status pesanan sudah berubah. Muat ulang.',
  online_unavailable: 'Belanja online sedang tidak tersedia. Anda tetap bisa berbelanja langsung di gerai. Silakan coba lagi nanti.',
  payment_provider_error: 'Pembayaran belum dapat diproses. Silakan coba lagi.',
  payment_provider_unavailable: 'Layanan pembayaran sedang tidak tersedia. Silakan coba lagi beberapa saat lagi.',
  invalid_request: 'Permintaan tidak valid. Muat ulang lalu coba lagi.',
  not_found: 'Data tidak ditemukan.',
  quote_expired: 'Ringkasan harga sudah kedaluwarsa. Kami menghitung ulang total Anda.',
  cart_changed: 'Keranjang berubah setelah ringkasan dibuat. Kami menghitung ulang total Anda.',
  cart_has_issues: 'Ada barang yang tidak bisa dipesan. Perbaiki barang yang ditandai sebelum membayar.',
  cart_version_conflict: 'Keranjang Anda baru saja diubah di perangkat lain. Kami memuat versi terbaru.',
  idempotency_conflict: 'Permintaan ini sedang diproses. Buka daftar pesanan Anda.',
  idempotency_key_required: 'Permintaan tidak valid. Muat ulang lalu coba lagi.',
  too_many_open_orders: 'Anda masih punya pesanan yang belum dibayar. Selesaikan atau batalkan dulu sebelum membuat pesanan baru.',
  fulfilment_unavailable: 'Pesan-antar belum tersedia. Silakan pilih ambil di gerai.',
  pickup_code_unavailable: 'Kode ambil tersedia setelah pesanan dikonfirmasi gerai.',
  order_in_review: 'Pesanan Anda sedang diperiksa tim kami, jadi kode ambil ditahan sementara.',
  counter_payment_single_part_only: 'Bayar di kasir hanya untuk pesanan dari satu PT. Pisahkan pesanan per PT, atau pilih QRIS.',
  payment_method_unavailable: 'Metode pembayaran ini belum tersedia untuk pesanan Anda. Pilih metode lain.',
  // transfer bank + bukti (G26 §17.2, §17.4)
  transfer_single_part_only: 'Transfer bank hanya untuk pesanan dari satu brand. Pisahkan keranjang atau pilih QRIS.',
  transfer_not_awaiting_proof: 'Pesanan ini tidak sedang menunggu bukti transfer. Muat ulang untuk melihat status terbaru.',
  transfer_proof_limit: 'Batas unggah bukti transfer untuk pesanan ini sudah tercapai. Hubungi layanan pelanggan.',
  transfer_window_closed: 'Waktu unggah bukti transfer sudah habis. Batalkan pesanan lalu pesan ulang bila perlu.',
  transfer_proof_invalid: 'Foto bukti tidak dapat dibaca. Kirim foto JPG, PNG, atau WebP yang jelas.',
  transfer_proof_unavailable: 'Bukti transfer belum dapat dikirim. Coba lagi sebentar lagi — jatah unggah Anda tidak berkurang.',
  payload_too_large: 'Ukuran foto terlalu besar (maksimal 8 MB).',
  unsupported_media_type: 'Format foto tidak didukung. Kirim foto JPG, PNG, atau WebP.',
  rate_limited: 'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.',
  insufficient_points: 'Saldo poin tidak cukup.',
  points_unavailable: 'Poin sedang tidak tersedia untuk pesanan ini.',
  // pre-order (§15.4)
  slot_unavailable: 'Jadwal yang dipilih sudah penuh atau di luar jam buka. Pilih jadwal lain.',
  // meja QR (§14.A.3)
  table_session_invalid: 'Kode QR meja tidak valid atau sudah berakhir. Pindai ulang QR di meja Anda, atau minta bantuan pelayan.',
  table_session_closed: 'Sesi meja ini sudah ditutup. Minta pelayan bila Anda ingin memesan lagi.',
  ordering_unavailable: 'Pemesanan dari ponsel sedang tidak tersedia. Silakan pesan ke pelayan.',
  note_invalid: 'Catatan tidak valid. Hindari nomor telepon dan alamat email, dan maksimal 140 karakter.',
  session_limit_reached: 'Batas pesanan untuk meja ini sudah tercapai. Silakan pesan ke pelayan.',
  points_already_claimed: 'Poin untuk meja ini sudah diklaim oleh akun lain.',
  // reservasi (§15.5)
  outside_hours: 'Jam yang dipilih di luar jam buka gerai. Pilih jam lain.',
  too_late: 'Jam tersebut terlalu dekat dengan sekarang. Pilih jam yang lebih lambat.',
  too_far: 'Tanggal tersebut terlalu jauh. Pilih tanggal yang lebih dekat.',
  party_size: 'Jumlah tamu di luar batas reservasi online gerai ini.',
  booking_unavailable: 'Reservasi online sedang tidak tersedia di gerai ini. Silakan hubungi gerai.',
  booking_not_cancellable: 'Reservasi ini sudah tidak bisa dibatalkan di aplikasi. Hubungi gerai.',
  // klien
  network: 'Koneksi bermasalah. Periksa internet Anda lalu coba lagi.',
  timeout: 'Server terlalu lama merespons. Coba lagi.',
  bad_response: 'Respons server tidak dikenali. Coba lagi beberapa saat lagi.',
  config_insecure: 'Konfigurasi server tidak aman (harus HTTPS).',
};

export const GENERIC_ERROR = 'Terjadi kendala. Silakan coba lagi beberapa saat lagi.';

export function errorMessage(code: string | null | undefined): string {
  if (code && Object.prototype.hasOwnProperty.call(ERROR_MESSAGES, code)) return ERROR_MESSAGES[code]!;
  return GENERIC_ERROR;
}

/** Galat checkout yang berarti "hitung ulang ringkasan". */
export const REQUOTE_CODES: readonly string[] = ['price_changed', 'quote_expired', 'cart_changed', 'out_of_stock', 'item_unavailable', 'slot_unavailable'];
