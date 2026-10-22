/**
 * Pindai QR meja (docs/04 §14.A): `https://<tenant>/meja#t=<token>`. Token hanya disimpan di memori proses
 * (tableSession), tidak di URL rute, tidak di log. Izin kamera diminta saat layar ini dibuka (manfaat jelas).
 */
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { errorMessage } from '../src/api/errors';
import { tableTokenFromUrl } from '../src/api/types';
import { APP } from '../src/config/brand';
import { tableSession } from '../src/state/tableSession';
import { Body, Button, ErrorBanner, Loading, T, Title, styles } from '../src/ui/kit';

export default function ScanMeja() {
  const router = useRouter();
  const [perm, requestPerm] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  if (!APP.features.dineIn) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Body>Pesan dari meja tidak tersedia di aplikasi ini.</Body>
      </View>
    );
  }
  if (!perm) return <Loading />;
  if (!perm.granted) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Title level={2}>Izinkan kamera</Title>
        <Body muted>Kamera dipakai hanya untuk memindai kode QR di meja gerai. Gambar tidak disimpan.</Body>
        <Button title="Izinkan kamera" onPress={() => void requestPerm()} />
        {!perm.canAskAgain ? <Body muted small>Izin ditolak. Aktifkan kamera untuk aplikasi ini di Pengaturan perangkat.</Body> : null}
      </View>
    );
  }
  return (
    <View style={[styles.screen, { gap: 12 }]}>
      <View style={{ flex: 1, margin: 16, borderRadius: T.radius, overflow: 'hidden' }} accessible accessibilityLabel="Bidik kode QR di meja">
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
      </View>
      <View style={{ paddingHorizontal: 16, paddingBottom: 24, gap: 8 }}>
        <Body muted>Arahkan kamera ke kode QR di meja Anda.</Body>
        <ErrorBanner message={error} />
      </View>
    </View>
  );
}
