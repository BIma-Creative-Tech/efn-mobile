/**
 * Config plugin DEV SAJA: APK uji di emulator (BlueStacks) mempercayai CA dev lokal untuk SATU host BFF dev.
 *
 * Aktif hanya bila build memasang `EFN_DEV_CA_FILE` (path PEM CA dev) + `EFN_API_BASE_URL` (https://api.<host>).
 * Tanpa env itu plugin tidak melakukan apa pun (build produksi tidak berubah). Yang ditambahkan:
 * - `res/raw/efn_dev_ca.pem` (CA publik dev, bukan kunci privat);
 * - `res/xml/network_security_config.xml`: domain-config HANYA untuk host BFF dev → trust-anchors = CA dev + sistem;
 *   `cleartextTrafficPermitted="false"` (TLS tetap wajib). Domain lain tetap trust store sistem saja.
 * Tidak ada pengecualian http:// dan tidak ada "trust all".
 */
const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

function devHost() {
  const m = /^https:\/\/([a-z0-9.-]+)(:\d{1,5})?\/?$/i.exec(process.env.EFN_API_BASE_URL || '');
  return m ? m[1].toLowerCase() : null;
}

module.exports = function withDevCa(config) {
  const caFile = process.env.EFN_DEV_CA_FILE;
  const host = devHost();
  if (!caFile || !host) return config;
  const pem = fs.readFileSync(caFile, 'utf8');
  if (!/^-----BEGIN CERTIFICATE-----/m.test(pem) || /PRIVATE KEY/.test(pem)) throw new Error('EFN_DEV_CA_FILE harus sertifikat CA PEM (tanpa kunci privat)');

  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const res = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');
      fs.mkdirSync(path.join(res, 'raw'), { recursive: true });
      fs.mkdirSync(path.join(res, 'xml'), { recursive: true });
      fs.writeFileSync(path.join(res, 'raw', 'efn_dev_ca.pem'), pem);
      fs.writeFileSync(
        path.join(res, 'xml', 'network_security_config.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<!-- DEV SAJA (plugins/with-dev-ca.js): CA dev lokal dipercaya hanya untuk ${host}. -->
<network-security-config>
  <base-config cleartextTrafficPermitted="false">
    <trust-anchors><certificates src="system" /></trust-anchors>
  </base-config>
  <domain-config cleartextTrafficPermitted="false">
    <domain includeSubdomains="false">${host}</domain>
    <trust-anchors>
      <certificates src="@raw/efn_dev_ca" />
      <certificates src="system" />
    </trust-anchors>
  </domain-config>
</network-security-config>
`,
      );
      return cfg;
    },
  ]);
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application[0];
    app.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    return cfg;
  });
};
