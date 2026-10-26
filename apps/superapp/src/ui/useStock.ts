/**
 * Status stok gerai untuk produk yang sedang tampil (docs/04 §10.3.2). Dipanggil per batch ≤ 50 id; gagal (Odoo mati,
 * circuit terbuka) = status tidak diketahui → produk TIDAK ditandai habis (checkout tetap memvalidasi stok di server).
 */
import { useEffect, useState } from 'react';
import { api } from '../api';
import { getStock } from '../api/bff';
import type { StockStatus } from '../api/types';

export function isSoldOut(stock: Record<number, StockStatus>, productId: number): boolean {
  return stock[productId] === 'out';
}

export function useStock(channel: string | null | undefined, outlet: string | null | undefined, ids: number[]): Record<number, StockStatus> {
  const [stock, setStock] = useState<Record<number, StockStatus>>({});
  const key = `${channel ?? ''}|${outlet ?? ''}|${ids.join(',')}`;
  useEffect(() => {
    if (!channel || !outlet || ids.length === 0) {
      setStock({});
      return;
    }
    let alive = true;
    const batches: number[][] = [];
    for (let i = 0; i < ids.length; i += 50) batches.push(ids.slice(i, i + 50));
    void Promise.all(batches.map((b) => getStock(api, channel, outlet, b))).then((rs) => {
      if (!alive) return;
      const next: Record<number, StockStatus> = {};
      for (const r of rs) if (r.ok) Object.assign(next, r.data);
      setStock(next);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return stock;
}
