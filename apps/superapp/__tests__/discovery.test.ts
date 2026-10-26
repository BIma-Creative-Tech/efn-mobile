jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
import { API_DISCOVERY_URL, parseDiscovery, resolveDiscoveryUrl } from '../src/config/env';

describe('alamat BFF dinamis (build uji tunnel)', () => {
  it('mati bila env kosong', () => {
    expect(API_DISCOVERY_URL).toBeNull();
    expect(resolveDiscoveryUrl({ apiDiscoveryUrl: '' })).toBeNull();
  });
  it('hanya https tanpa query/kredensial', () => {
    expect(resolveDiscoveryUrl({ apiDiscoveryUrl: 'https://gist.githubusercontent.com/u/abc/raw/efn-api.json' })).toBe('https://gist.githubusercontent.com/u/abc/raw/efn-api.json');
    expect(resolveDiscoveryUrl({ apiDiscoveryUrl: 'http://gist.githubusercontent.com/u/raw/x.json' })).toBeNull();
    expect(resolveDiscoveryUrl({ apiDiscoveryUrl: 'https://a.b/x.json?t=1' })).toBeNull();
    expect(resolveDiscoveryUrl({ apiDiscoveryUrl: 'https://user:pw@a.b/x.json' })).toBeNull();
  });
  it('hanya menerima host *.trycloudflare.com', () => {
    expect(parseDiscovery({ api_base_url: 'https://opponents-pad-favorite-westminster.trycloudflare.com' })).toBe('https://opponents-pad-favorite-westminster.trycloudflare.com');
    expect(parseDiscovery({ api_base_url: 'https://evil.example.com' })).toBeNull();
    expect(parseDiscovery({ api_base_url: 'https://x.trycloudflare.com.evil.com' })).toBeNull();
    expect(parseDiscovery({ api_base_url: 'http://x.trycloudflare.com' })).toBeNull();
    expect(parseDiscovery(null)).toBeNull();
    expect(parseDiscovery('x')).toBeNull();
  });
});
