#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const projectPath = 'ios/App/App.xcodeproj/project.pbxproj';
const infoPlistPath = 'ios/App/App/Info.plist';
const baselinePath = 'ios/app-store-connect-baseline.json';
const otaManifestPath = 'docs/ota/latest.json';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function parseVersion(value, label) {
  if (typeof value !== 'string' || !/^\d+\.\d+\.\d+$/.test(value)) {
    throw new Error(`${label} must use MAJOR.MINOR.PATCH; received ${String(value)}`);
  }
  return value.split('.').map(Number);
}

function compareVersions(left, right) {
  const a = parseVersion(left, 'Version');
  const b = parseVersion(right, 'Version');
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

function uniqueProjectValues(project, setting) {
  const expression = new RegExp(`\\b${setting} = ([^;]+);`, 'g');
  return [...new Set([...project.matchAll(expression)].map(match => match[1].trim().replace(/^"|"$/g, '')))];
}

function fail(messages) {
  console.error('[ios-version] FAIL');
  for (const message of messages) console.error(`  - ${message}`);
  process.exit(1);
}

const packageJson = readJson('package.json');
const baseline = readJson(baselinePath);
const otaManifest = readJson(otaManifestPath);
const project = readFileSync(projectPath, 'utf8');
const infoPlist = readFileSync(infoPlistPath, 'utf8');

const marketingVersions = uniqueProjectValues(project, 'MARKETING_VERSION');
const buildNumbers = uniqueProjectValues(project, 'CURRENT_PROJECT_VERSION');
const errors = [];

if (marketingVersions.length !== 1) {
  errors.push(`Debug and Release must share one MARKETING_VERSION; found ${marketingVersions.join(', ') || 'none'}`);
}
if (buildNumbers.length !== 1) {
  errors.push(`Debug and Release must share one CURRENT_PROJECT_VERSION; found ${buildNumbers.join(', ') || 'none'}`);
}

const marketingVersion = marketingVersions[0];
const buildNumber = Number(buildNumbers[0]);
let versionsAreValid = true;

try {
  parseVersion(packageJson.version, 'package.json version');
  parseVersion(marketingVersion, 'MARKETING_VERSION');
  parseVersion(baseline.lastApprovedVersion, 'lastApprovedVersion');
  parseVersion(otaManifest.version, 'OTA manifest version');
} catch (error) {
  errors.push(error.message);
  versionsAreValid = false;
}

if (marketingVersion && packageJson.version !== marketingVersion) {
  errors.push(`package.json ${packageJson.version} must equal MARKETING_VERSION ${marketingVersion}`);
}
if (versionsAreValid && compareVersions(marketingVersion, baseline.lastApprovedVersion) <= 0) {
  errors.push(`MARKETING_VERSION ${marketingVersion} must be above App Store approved ${baseline.lastApprovedVersion}`);
}
if (versionsAreValid && compareVersions(marketingVersion, otaManifest.version) <= 0) {
  errors.push(`MARKETING_VERSION ${marketingVersion} must be above published OTA ${otaManifest.version}`);
}
if (!Number.isSafeInteger(buildNumber) || buildNumber <= 0) {
  errors.push(`CURRENT_PROJECT_VERSION must be a positive integer; received ${buildNumbers[0]}`);
} else if (!Number.isSafeInteger(baseline.lastUploadedBuild) || buildNumber <= baseline.lastUploadedBuild) {
  errors.push(`CURRENT_PROJECT_VERSION ${buildNumber} must be above App Store build ${baseline.lastUploadedBuild}`);
}
if (!infoPlist.includes('<string>$(MARKETING_VERSION)</string>')) {
  errors.push('Info.plist CFBundleShortVersionString must use $(MARKETING_VERSION)');
}
if (!infoPlist.includes('<string>$(CURRENT_PROJECT_VERSION)</string>')) {
  errors.push('Info.plist CFBundleVersion must use $(CURRENT_PROJECT_VERSION)');
}

if (errors.length > 0) fail(errors);

console.log(
  `[ios-version] OK: App Store ${marketingVersion} (${buildNumber}) is above ` +
  `approved ${baseline.lastApprovedVersion}, uploaded build ${baseline.lastUploadedBuild}, ` +
  `and OTA ${otaManifest.version}`
);
