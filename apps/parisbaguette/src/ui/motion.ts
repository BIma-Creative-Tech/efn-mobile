/**
 * Gerak yang menghormati "Kurangi gerakan" (AccessibilityInfo.isReduceMotionEnabled) — semua animasi dekoratif
 * (parallax, spring tekan, transisi masuk) mati bila aktif.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduce(v))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => setReduce(v));
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}
