/**
 * Pilihan modifier F&B (ukuran, gula, es, shot, topping) di detail produk. Pola dari referensi "Coffee Shop App"
 * (docs/design/superapp-concept.md §5): pelanggan menyusun minuman sebelum masuk keranjang.
 *
 * - `radio`/`pills`/`select` = pilih satu (chip radio); `multi` = boleh lebih dari satu (chip centang).
 * - Atribut opsional pilih-satu mendapat chip "Tanpa". Atribut wajib TIDAK dipilih otomatis (pelanggan memilih sadar).
 * - Tambahan harga ditampilkan SEBELUM pajak dan hanya indikatif; total final dari quote Odoo.
 * - Aksesibilitas: grup berlabel `radiogroup`, setiap chip `radio`/`checkbox` dengan status terpilih, galat dibacakan.
 */
import { Text, View } from 'react-native';
import { isMultiAttribute, selectValue, type ProductAttribute, type Selection } from '../lib/attributes';
import { formatRupiah } from '../lib/format';
import { RADIUS, T, Touchable, font } from './kit';

interface Props {
  attributes: readonly ProductAttribute[];
  selection: Selection;
  onChange: (next: Selection) => void;
  /** Id atribut wajib yang belum dipilih (ditandai + pesan). */
  missing?: readonly number[];
  disabled?: boolean;
}

function OptionChip({ label, extra, selected, multi, disabled, onPress }: { label: string; extra: number; selected: boolean; multi: boolean; disabled?: boolean; onPress: () => void }) {
  const extraText = extra > 0 ? `+${formatRupiah(extra)}` : null;
  return (
    <Touchable
      role={multi ? 'checkbox' : 'radio'}
      selected={selected}
      disabled={disabled}
      label={extraText ? `${label}, tambah ${formatRupiah(extra)}` : label}
      onPress={onPress}
      style={{
        borderRadius: RADIUS.pill,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? T.action : T.border,
        backgroundColor: selected ? T.action : T.card,
        paddingHorizontal: 14,
        paddingVertical: 8,
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      <Text style={[{ color: selected ? T.onAction : T.text, fontSize: 14 }, font.bold]}>
        {multi && selected ? '✓ ' : ''}
        {label}
      </Text>
      {extraText ? <Text style={{ color: selected ? T.onAction : T.muted, fontSize: 11 }}>{extraText}</Text> : null}
    </Touchable>
  );
}

export function AttributePicker({ attributes, selection, onChange, missing = [], disabled }: Props) {
  if (attributes.length === 0) return null;
  return (
    <View style={{ gap: 14 }}>
      {attributes.map((a) => {
        const multi = isMultiAttribute(a);
        const chosen = selection[a.attribute_id] ?? [];
        const invalid = missing.includes(a.attribute_id);
        const hint = a.required ? (multi ? 'wajib, boleh lebih dari satu' : 'wajib pilih satu') : multi ? 'opsional, boleh lebih dari satu' : 'opsional';
        return (
          <View key={a.attribute_id} accessibilityRole={multi ? undefined : 'radiogroup'} accessibilityLabel={`${a.name}, ${hint}`} style={{ gap: 6 }}>
            <Text style={[{ color: T.text, fontSize: 15 }, font.bold]}>
              {a.name} <Text style={[{ color: invalid ? T.danger : T.muted, fontSize: 12 }, font.body]}>({hint})</Text>
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {!multi && !a.required ? (
                <OptionChip label="Tanpa" extra={0} multi={false} selected={chosen.length === 0} disabled={disabled} onPress={() => onChange(selectValue(attributes, selection, a.attribute_id, null))} />
              ) : null}
              {a.values.map((v) => {
                const on = chosen.includes(v.id);
                return (
                  <OptionChip
                    key={v.id}
                    label={v.name}
                    extra={v.price_extra_excl}
                    multi={multi}
                    selected={on}
                    disabled={disabled}
                    onPress={() => onChange(selectValue(attributes, selection, a.attribute_id, v.id, multi ? !on : true))}
                  />
                );
              })}
            </View>
            {invalid ? (
              <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={{ color: T.danger, fontSize: 13 }}>
                {multi ? `Pilih minimal satu ${a.name}.` : `Pilih salah satu ${a.name}.`}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
