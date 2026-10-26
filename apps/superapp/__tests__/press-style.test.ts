import { splitLayoutStyle } from '../src/ui/press-style';

describe('Touchable: gaya tata letak ke Pressable luar (tab bawah rata penuh)', () => {
  it('flex/margin/alignSelf ke luar; warna, padding, minHeight, width tetap di dalam', () => {
    const { outer, inner } = splitLayoutStyle({ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 56, marginTop: 6 });
    expect(outer).toEqual({ flex: 1, marginTop: 6 });
    expect(inner).toEqual({ alignItems: 'center', justifyContent: 'center', minHeight: 56, flexGrow: 1 });
  });
  it('array gaya diratakan; tanpa flex tidak ada flexGrow tambahan', () => {
    const { outer, inner } = splitLayoutStyle([{ width: 44, height: 44 }, { alignSelf: 'stretch' }]);
    expect(outer).toEqual({ alignSelf: 'stretch' });
    expect(inner).toEqual({ width: 44, height: 44 });
  });
  it('tanpa gaya → keduanya undefined', () => {
    expect(splitLayoutStyle(undefined)).toEqual({ outer: undefined, inner: undefined });
  });
});
