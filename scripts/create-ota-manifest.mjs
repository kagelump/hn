#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const [output, version, minimumNativeVersion, url, checksum, publishedAt] = process.argv.slice(2);

if (!output || !version || !minimumNativeVersion || !url || !checksum) {
  console.error('Usage: create-ota-manifest <output> <version> <minimum-native-version> <url> <sha256> [published-at]');
  process.exit(1);
}

const semver = /^\d+\.\d+\.\d+$/;
if (!semver.test(version) || !semver.test(minimumNativeVersion)) {
  console.error('Version and minimum native version must use MAJOR.MINOR.PATCH');
  process.exit(1);
}
const expectedUrl = `https://github.com/kagelump/hn/releases/download/ota-${version}/hn-reader-${version}.zip`;
if (url !== expectedUrl) {
  console.error(`Bundle URL must be ${expectedUrl}`);
  process.exit(1);
}
if (!/^[a-f0-9]{64}$/i.test(checksum)) {
  console.error('Checksum must be a SHA-256 hex digest');
  process.exit(1);
}

const manifest = {
  schema: 1,
  appId: 'com.raycatdev.hn',
  version,
  minimumNativeVersion,
  url,
  checksum: checksum.toLowerCase(),
  publishedAt: publishedAt || new Date().toISOString()
};

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`[ota] wrote ${output} for ${version}`);
