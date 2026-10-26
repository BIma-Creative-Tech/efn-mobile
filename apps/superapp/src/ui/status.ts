/** Nada warna lencana status pesanan/reservasi (tampilan saja). */
export type Tone = 'success' | 'warn' | 'danger' | 'neutral' | 'brand';

export function orderTone(status: string): Tone {
  if (status === 'completed') return 'success';
  if (['paid', 'fulfilling'].includes(status)) return 'brand';
  if (['awaiting_payment', 'awaiting_counter_payment', 'created', 'review'].includes(status)) return 'warn';
  if (['cancelled', 'expired', 'failed'].includes(status)) return 'danger';
  return 'neutral';
}

export function bookingTone(status: string): Tone {
  if (['confirmed', 'seated', 'done'].includes(status)) return 'success';
  if (status === 'requested') return 'warn';
  if (['cancelled', 'no_show', 'failed'].includes(status)) return 'danger';
  return 'neutral';
}
