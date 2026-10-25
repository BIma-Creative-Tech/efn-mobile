import { createApiClient, type FetchLike } from '../src/api/client';
import { simulatePayment, uploadTransferProof } from '../src/api/bff';
import { errorMessage, GENERIC_ERROR } from '../src/api/errors';
import { parseChannels, parseOrderDetail, parseTransferPayment, pollIntervalMs, type TransferPayment } from '../src/api/types';
import { REJECT_REASON_LABEL, transferStage } from '../src/lib/payment';

/** G26 docs/04 §17.3–17.4: transfer bank + bukti — parser, tahap layar, polling, dan unggah multipart. */

const ORDER = '0f8fad5b-d9cb-469f-a165-70867728950e';
const NOW = Date.parse('2026-10-25T10:00:00Z');
const BLOCK = {
  method: 'bank_transfer',
  status: 'awaiting_proof',
  account: { bank_name: 'Bank Demo', account_number: '9999 0001-23', account_holder: 'PT Demo EFN (mock)' },
  transfer_ref: 'QRST2345',
  uploads_left: 3,
  reject_reason: null,
  upload_deadline: '2026-10-25T10:50:00Z',
  expires_at: '2026-10-25T11:00:00Z',
};
const detail = (status: string, payment: unknown) => ({ order_id: ORDER, status, amount_payable: 52000, expires_at: BLOCK.expires_at, payment, parts: [{ channel_code: 'GL', company_code: 'GL', status: 'placed', lines: [] }] });

describe('parser blok payment transfer', () => {
  it('awaiting_payment: rekening (digit saja), kode berita, sisa unggah', () => {
    const o = parseOrderDetail(detail('awaiting_payment', BLOCK))!;
    expect(o.payment!.transfer).toEqual({
      status: 'awaiting_proof',
      account: { bank_name: 'Bank Demo', account_number: '9999000123', account_holder: 'PT Demo EFN (mock)' },
      transfer_ref: 'QRST2345',
      uploads_left: 3,
      reject_reason: null,
      upload_deadline: '2026-10-25T10:50:00Z',
    });
    expect(o.payment!.qr_string).toBeNull();
  });
  it('di luar awaiting_payment: rekening/kode/alasan dibuang walau dikirim server (L-52)', () => {
    const o = parseOrderDetail(detail('fulfilling', { ...BLOCK, status: 'rejected', reject_reason: 'unreadable' }))!;
    expect(o.payment!.transfer).toMatchObject({ status: 'none', account: null, transfer_ref: null, reject_reason: null });
  });
  it('allowlist: alasan/status/kode asing → null/none; rekening rusak → null; metode lain → transfer null', () => {
    const t = parseTransferPayment({ ...BLOCK, status: 'hacked', reject_reason: 'catatan bebas', transfer_ref: 'abc', account: { bank_name: 'X', account_number: '12ab', account_holder: 'Y' }, uploads_left: -2 }, true)!;
    expect(t).toMatchObject({ status: 'none', reject_reason: null, transfer_ref: null, account: null, uploads_left: 0 });
    expect(parseOrderDetail(detail('awaiting_payment', { method: 'qris', status: 'pending', qr_string: '000201' }))!.payment!.transfer).toBeNull();
  });
  it('payment_modes kanal: bank_transfer dikenali, nilai asing dibuang, tanpa duplikat', () => {
    const c = parseChannels({ items: [{ channel_code: 'GL', payment_modes: ['qris', 'bank_transfer', 'va', 'bank_transfer'], outlets: [] }] })!;
    expect(c[0]!.payment_modes).toEqual(['qris', 'bank_transfer']);
  });
});

describe('tahap layar transfer', () => {
  const base = parseTransferPayment(BLOCK, true)!;
  const at = (over: Partial<TransferPayment>, now = NOW) => transferStage({ ...base, ...over }, now);
  it('upload → verifying → rejected(upload) → limit; deadline → closed; none → done', () => {
    expect(at({})).toBe('upload');
    expect(at({ status: 'awaiting_verification' })).toBe('verifying');
    expect(at({ status: 'rejected', reject_reason: 'amount_mismatch', uploads_left: 2 })).toBe('upload');
    expect(at({ status: 'rejected', uploads_left: 0 })).toBe('limit');
    expect(at({}, Date.parse('2026-10-25T10:50:00Z'))).toBe('closed');
    // bukti sedang diperiksa tetap 'verifying' walau batas unggah lewat (keputusan staf masih ditunggu)
    expect(at({ status: 'awaiting_verification' }, Date.parse('2026-10-25T10:55:00Z'))).toBe('verifying');
    expect(at({ status: 'none' })).toBe('done');
  });
  it('setiap alasan tolak punya teks pelanggan', () => {
    for (const r of ['amount_mismatch', 'unreadable', 'wrong_account', 'not_received', 'duplicate_proof'] as const) expect(REJECT_REASON_LABEL[r].length).toBeGreaterThan(5);
  });
  it('polling: 10 dtk saat diverifikasi, 30 dtk saat menunggu bukti, QRIS tetap 3 dtk', () => {
    expect(pollIntervalMs('awaiting_payment', 'awaiting_verification')).toBe(10_000);
    expect(pollIntervalMs('awaiting_payment', 'awaiting_proof')).toBe(30_000);
    expect(pollIntervalMs('awaiting_payment', 'rejected')).toBe(30_000);
    expect(pollIntervalMs('awaiting_payment', null)).toBe(3_000);
    expect(pollIntervalMs('expired', 'awaiting_verification')).toBeNull();
  });
  it('pesan galat transfer dalam Bahasa Indonesia', () => {
    for (const c of ['transfer_single_part_only', 'transfer_not_awaiting_proof', 'transfer_proof_limit', 'transfer_window_closed', 'transfer_proof_invalid', 'transfer_proof_unavailable', 'payload_too_large']) {
      expect(errorMessage(c)).not.toBe(GENERIC_ERROR);
    }
  });
});

describe('unggah bukti (multipart)', () => {
  function capture(status: number, body: unknown) {
    const calls: { url: string; method: string; headers: Record<string, string>; body: unknown }[] = [];
    const f: FetchLike = async (url, init) => {
      calls.push({ url, method: init.method, headers: init.headers, body: init.body });
      return { status, text: async () => JSON.stringify(body) };
    };
    const c = createApiClient({ baseUrl: 'https://api.efn.local', fetch: f, getToken: async () => 'tok_0123456789abcdef', onUnauthorized: () => undefined });
    return { c, calls };
  }
  it('POST multipart satu field photo, Bearer, tanpa content-type manual; 202 → blok payment', async () => {
    const { c, calls } = capture(202, { payment: { ...BLOCK, status: 'awaiting_verification', uploads_left: 2 } });
    const r = await uploadTransferProof(c, ORDER, { uri: 'file:///cache/bukti.jpg', mimeType: 'image/jpeg' });
    expect(r).toMatchObject({ ok: true, data: { status: 'awaiting_verification', uploads_left: 2 } });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(`https://api.efn.local/v1/orders/${ORDER}/transfer-proof`);
    expect(calls[0]!.method).toBe('POST');
    expect(calls[0]!.headers.authorization).toBe('Bearer tok_0123456789abcdef');
    expect(calls[0]!.headers['content-type']).toBeUndefined();
    const form = calls[0]!.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(form.getAll('photo')).toHaveLength(1);
    expect([...form.keys()]).toEqual(['photo']);
  });
  it('galat BFF diteruskan sebagai kode', async () => {
    const { c } = capture(429, { error: { code: 'transfer_proof_limit' } });
    expect(await uploadTransferProof(c, ORDER, { uri: 'file:///x.png', mimeType: 'image/png' })).toMatchObject({ ok: false, status: 429, code: 'transfer_proof_limit' });
  });
  it('form + body bersamaan ditolak klien', async () => {
    const { c, calls } = capture(200, {});
    const r = await c.request('POST', '/v1/orders/x/transfer-proof', { form: new FormData(), body: {} });
    expect(r).toMatchObject({ ok: false, code: 'invalid_request' });
    expect(calls).toHaveLength(0);
  });
  it('simulasi tolak membawa reject_reason; tanpa alasan body hanya status', async () => {
    const { c, calls } = capture(200, detail('awaiting_payment', BLOCK));
    await simulatePayment(c, ORDER, 'failed', 'wrong_account');
    await simulatePayment(c, ORDER, 'paid');
    expect(calls.map((x) => JSON.parse(x.body as string))).toEqual([{ status: 'failed', reject_reason: 'wrong_account' }, { status: 'paid' }]);
  });
});
