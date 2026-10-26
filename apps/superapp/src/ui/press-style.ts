import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Properti tata letak terhadap INDUK (flex, alignSelf, margin) harus ada di `Pressable` luar. Bila ikut di view dalam,
 * `flex: 1` tidak berefek (Pressable menyusut ke lebar isi): tab bawah menumpuk rata kiri, tombol `flex: 1` tidak
 * membagi baris. Sisanya (warna, padding, radius, minHeight, width) tetap di view dalam yang beranimasi.
 */
const OUTER_KEYS = new Set([
  'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical', 'marginStart', 'marginEnd',
]);

export function splitLayoutStyle(style: StyleProp<ViewStyle>): { outer: ViewStyle | undefined; inner: ViewStyle | undefined } {
  const flat = StyleSheet.flatten(style) as Record<string, unknown> | undefined;
  if (!flat) return { outer: undefined, inner: undefined };
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(flat)) (OUTER_KEYS.has(k) ? outer : inner)[k] = v;
  // Pressable yang melebar (flex/alignSelf stretch): view dalam ikut mengisi tinggi baris agar konten tetap di tengah.
  if (outer.flex !== undefined || outer.flexGrow !== undefined) inner.flexGrow = 1;
  return { outer: Object.keys(outer).length ? (outer as ViewStyle) : undefined, inner: Object.keys(inner).length ? (inner as ViewStyle) : undefined };
}
