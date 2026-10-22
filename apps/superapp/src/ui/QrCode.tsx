/**
 * QR dirender DI PERANGKAT (qrcode-generator lokal + react-native-svg; tanpa layanan QR pihak ketiga, docs/04 §10.3.5).
 * Isi QR tidak pernah di-log.
 */
import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import qrcode from 'qrcode-generator';

export function QrCode({ value, label, size = 220 }: { value: string; label: string; size?: number }) {
  const qr = useMemo(() => {
    try {
      const q = qrcode(0, 'M');
      q.addData(value, 'Byte');
      q.make();
      const n = q.getModuleCount();
      let d = '';
      for (let r = 0; r < n; r += 1) for (let c = 0; c < n; c += 1) if (q.isDark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`;
      return { d, n: n + 8 };
    } catch {
      return null;
    }
  }, [value]);
  if (!qr) return null;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ alignSelf: 'center', backgroundColor: '#ffffff', padding: 8, borderRadius: 8 }}>
      <Svg width={size} height={size} viewBox={`0 0 ${qr.n} ${qr.n}`}>
        <Rect width={qr.n} height={qr.n} fill="#ffffff" />
        <Path d={qr.d} fill="#000000" />
      </Svg>
    </View>
  );
}
