/**
 * Ajak teman (referral MGM, docs/04 §20.2 + G33 §20.11). Kode sendiri + bagikan, hitungan jaringan (tanpa identitas),
 * poin referral, dan klaim kode teman selama jendela klaim. Program OFF (`503 mgm_unavailable`) → keterangan saja.
 * Angka/persentase reward TIDAK ditampilkan: ketentuan program menunggu persetujuan Legal (Permendag 70/2019).
 */
import { useState } from 'react';
import { ScrollView, Share, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../src/api';
import { claimReferral, getReferral } from '../src/api/bff';
import { errorMessage } from '../src/api/errors';
import { APP, ion, mci } from '../src/config/brand';
import { formatDate, formatNumber } from '../src/lib/format';
import { canClaim, formatReferralCode, normalizeReferralInput, referralErrorMessage, referralShareMessage } from '../src/lib/referral';
import { useApi, useLoggedIn } from '../src/ui/hooks';
import { Badge, Body, Button, Card, Divider, EmptyState, ErrorBanner, Eyebrow, InfoBanner, Loading, RADIUS, Reveal, T, font, gradient, shadow, styles } from '../src/ui/kit';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[{ color: T.text, fontSize: 22 }, font.heading]}>{value}</Text>
      <Text style={[{ color: T.muted, fontSize: 12, textAlign: 'center' }, font.body]}>{label}</Text>
    </View>
  );
}

export default function Referral() {
  const router = useRouter();
  const loggedIn = useLoggedIn();
  const view = useApi(() => (loggedIn ? getReferral(api) : null), [loggedIn]);
  const [input, setInput] = useState('');
  const [claimErr, setClaimErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loggedIn === null) return <Loading />;
  if (!loggedIn) {
    return (
      <View style={[styles.screen, styles.content]}>
        <EmptyState
          icon={mci('account-multiple-plus-outline')}
          title="Ajak teman"
          body="Masuk untuk melihat kode ajakan Anda."
          action="Masuk"
          onAction={() => router.push({ pathname: '/masuk', params: { next: 'back' } })}
        />
      </View>
    );
  }
  if (view.loading && !view.data) return <Loading variant="cards" />;
  if (view.error === 'mgm_unavailable') {
    return (
      <View style={[styles.screen, styles.content]}>
        <EmptyState icon={mci('account-multiple-plus-outline')} title="Segera hadir" body={referralErrorMessage('mgm_unavailable', errorMessage)} />
      </View>
    );
  }
  const v = view.data;
  if (!v) {
    return (
      <View style={[styles.screen, styles.content]}>
        <ErrorBanner message={referralErrorMessage(view.error, errorMessage)} onRetry={() => void view.reload()} />
      </View>
    );
  }

  const normalized = normalizeReferralInput(input);
  const submit = async () => {
    if (!normalized || busy) return;
    setBusy(true);
    setClaimErr(null);
    const r = await claimReferral(api, normalized);
    setBusy(false);
    if (!r.ok) return setClaimErr(r.code);
    setInput('');
    await view.reload();
  };
  const share = () => void Share.share({ message: referralShareMessage(v.code, APP.displayName) }).catch(() => undefined);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { gap: 14, paddingBottom: 40 }]} keyboardShouldPersistTaps="handled">
      <Reveal index={0}>
        <View style={[{ borderRadius: RADIUS.xl, padding: 20, gap: 14 }, gradient('#062e2a', '#0b4a40', 140), shadow.lg]}>
          <Eyebrow color="rgba(255,255,255,0.7)">Kode ajakan Anda</Eyebrow>
          <Text
            selectable
            accessibilityLabel={`Kode ajakan ${v.code.split('').join(' ')}`}
            style={[{ color: '#ffffff', fontSize: 34, letterSpacing: 4 }, font.heading]}
          >
            {formatReferralCode(v.code)}
          </Text>
          <Text style={[{ color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 19 }, font.body]}>
            Bagikan kode ini ke teman. Teman memasukkannya di menu Ajak teman setelah mendaftar.
          </Text>
          <Button variant="gold" title="Bagikan kode" icon={ion('share-social-outline')} onPress={share} />
        </View>
      </Reveal>

      <Reveal index={1}>
        <Card style={{ gap: 12 }}>
          <Eyebrow>Jaringan Anda</Eyebrow>
          <View style={{ flexDirection: 'row' }}>
            <Stat label="Teman langsung" value={formatNumber(v.network.level1)} />
            <Stat label="Teman dari teman" value={formatNumber(v.network.level2)} />
            <Stat label="Lanjutan" value={formatNumber(v.network.level3Plus)} />
          </View>
          <Divider />
          <View style={{ flexDirection: 'row' }}>
            <Stat label="Poin menunggu" value={formatNumber(v.rewards.pendingPoints)} />
            <Stat label="Poin masuk bulan ini" value={formatNumber(v.rewards.settledPointsMonth)} />
          </View>
          <Body small muted>
            Poin referral masuk ke saldo setelah masa tunggu pesanan teman selesai. Bila pesanan dibatalkan atau diretur, poin
            ikut disesuaikan. Hanya jumlah yang ditampilkan — nama teman tidak pernah dibagikan.
          </Body>
        </Card>
      </Reveal>

      <Reveal index={2}>
        <Card style={{ gap: 10 }}>
          <Eyebrow>Kode dari teman</Eyebrow>
          {v.referred ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Badge label="Terhubung" tone="success" icon={ion('checkmark-circle-outline')} />
              <Body small muted>
                {v.linkedAt ? `Sejak ${formatDate(v.linkedAt)}` : 'Akun Anda sudah terhubung.'}
              </Body>
            </View>
          ) : canClaim(v, Date.now()) ? (
            <>
              <Body small muted>
                {`Punya kode ajakan dari teman? Masukkan sebelum ${formatDate(v.claimUntil)}. Kode hanya bisa dipakai sekali.`}
              </Body>
              <TextInput
                style={[styles.input, { letterSpacing: 2 }]}
                value={input}
                onChangeText={(t) => {
                  setInput(t.slice(0, 12));
                  setClaimErr(null);
                }}
                placeholder="Contoh: ABCD 2345"
                placeholderTextColor={T.muted}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={12}
                accessibilityLabel="Kode ajakan dari teman"
                onSubmitEditing={() => void submit()}
              />
              <ErrorBanner message={claimErr ? referralErrorMessage(claimErr, errorMessage) : null} />
              <Button title="Pakai kode" icon={ion('link-outline')} busy={busy} disabled={!normalized || busy} onPress={() => void submit()} />
            </>
          ) : (
            <Body small muted>
              Batas waktu memasukkan kode ajakan sudah lewat.
            </Body>
          )}
        </Card>
      </Reveal>

      <InfoBanner icon={ion('document-text-outline')} message="Ketentuan program ajak teman menyusul. Besaran poin dapat berbeda per brand." />
    </ScrollView>
  );
}
