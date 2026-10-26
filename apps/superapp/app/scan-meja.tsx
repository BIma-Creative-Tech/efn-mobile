/**
 * Pindai QR meja (docs/04 §14.A): `https://<tenant>/meja#t=<token>`. Token hanya disimpan di memori proses
 * (tableSession), tidak di URL rute, tidak di log. Izin kamera diminta saat layar ini dibuka (manfaat jelas).
 * Bingkai bidik beranimasi (garis pindai naik-turun; diam bila "Kurangi gerakan").
 */
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { errorMessage } from '../src/api/errors';
import { tableTokenFromUrl } from '../src/api/types';
import { APP, ion } from '../src/config/brand';
import { tableSession } from '../src/state/tableSession';
import { Button, EmptyState, ErrorBanner, Icon, Loading, RADIUS, T, font, styles } from '../src/ui/kit';
import { useReduceMotion } from '../src/ui/motion';

const BOX = 240;

function ScanLine() {
  const reduce = useReduceMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    y.value = withRepeat(withTiming(BOX - 4, { duration: 1600, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [reduce, y]);
  const s = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[{ position: 'absolute', left: 12, right: 12, top: 0, height: 3, borderRadius: 2, backgroundColor: T.accent, boxShadow: '0px 0px 12px rgba(223,180,34,0.9)' }, s]} />;
}

function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const t = pos[0] === 't';
  const l = pos[1] === 'l';
  return (
    <View
      style={{
        position: 'absolute',
        width: 34,
        height: 34,
        [t ? 'top' : 'bottom']: 0,
        [l ? 'left' : 'right']: 0,
        borderColor: '#ffffff',
        borderTopWidth: t ? 4 : 0,
        borderBottomWidth: t ? 0 : 4,
        borderLeftWidth: l ? 4 : 0,
        borderRightWidth: l ? 0 : 4,
        borderTopLeftRadius: t && l ? 16 : 0,
        borderTopRightRadius: t && !l ? 16 : 0,
        borderBottomLeftRadius: !t && l ? 16 : 0,
        borderBottomRightRadius: !t && !l ? 16 : 0,
      }}
    />
  );
}

export default function ScanMeja() {
  const router = useRouter();
  const [perm, requestPerm] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  if (!APP.features.dineIn) {
    return (
      <View style={[styles.screen, styles.content]}>
        <EmptyState icon={ion('restaurant')} title="Belum tersedia" body="Pesan dari meja tidak tersedia di aplikasi ini." />
      </View>
    );
  }
  if (!perm) return <Loading />;
  if (!perm.granted) {
    return (
      <View style={[styles.screen, styles.content]}>
        <EmptyState icon={ion('camera-outline')} title="Izinkan kamera" body="Kamera dipakai hanya untuk memindai kode QR di meja gerai. Gambar tidak disimpan." action="Izinkan kamera" onAction={() => void requestPerm()} />
        {!perm.canAskAgain ? <Text style={[{ color: T.muted, fontSize: 13, textAlign: 'center' }, font.body]}>Izin ditolak. Aktifkan kamera untuk aplikasi ini di Pengaturan perangkat.</Text> : null}
      </View>
    );
  }
  return (
    <View style={[styles.screen, { gap: 12 }]}>
      <View style={{ flex: 1, marginHorizontal: 16, marginTop: 4, borderRadius: RADIUS.xl, overflow: 'hidden', backgroundColor: '#000' }} accessible accessibilityLabel="Bidik kode QR di meja">
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => {
            if (handled.current) return;
            const token = tableTokenFromUrl(data);
            if (!token || !tableSession.set(token)) {
              setError(errorMessage('table_session_invalid'));
              return;
            }
            handled.current = true;
            router.replace('/meja');
          }}
        />
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: BOX, height: BOX }}>
            <Corner pos="tl" />
            <Corner pos="tr" />
            <Corner pos="bl" />
            <Corner pos="br" />
            <ScanLine />
          </View>
        </View>
      </View>
      <View style={{ paddingHorizontal: 16, paddingBottom: 24, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: '#e3efe8', alignItems: 'center', justifyContent: 'center' }}>
            <Icon icon={ion('restaurant')} size={22} color={T.action} />
          </View>
          <Text style={[{ color: T.text, fontSize: 15, flex: 1 }, font.body]}>Arahkan kamera ke kode QR di meja Anda untuk melihat menu dan memesan.</Text>
        </View>
        <ErrorBanner message={error} />
        {error ? (
          <Button
            variant="secondary"
            title="Pindai lagi"
            icon={ion('scan-outline')}
            onPress={() => {
              handled.current = false;
              setError(null);
            }}
          />
        ) : null}
      </View>
    </View>
  );
}
