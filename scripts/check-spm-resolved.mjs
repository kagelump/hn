#!/usr/bin/env node
// Lint: keep the iOS SwiftPM lockfile (Package.resolved) consistent with
// Package.swift. Xcode Cloud disables automatic package resolution, so a stale
// Package.resolved (e.g. after `cap sync` adds a plugin with new transitive deps)
// fails the cloud build. Catch it locally before pushing.
//
// Two layers:
//   1. Static (runs everywhere, fast): every remote `.package(url:)` declared in
//      Package.swift must be pinned in Package.resolved.
//   2. Resolver drift (only where `xcodebuild` exists): re-resolve and fail if
//      Package.resolved changes. This is the layer that catches transitive deps
//      (like BigInt via @capgo/capacitor-updater). Self-skips on CI/non-macOS.
//
// Exit 0 = OK/skipped, 1 = drift detected.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const PKG_SWIFT = 'ios/App/CapApp-SPM/Package.swift';
const RESOLVED = 'ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved';

const ok = (m) => console.log(`[spm-check] ${m}`);
const skip = (m) => { console.log(`[spm-check] skip: ${m}`); process.exit(0); };
const fail = (m) => { console.error(`\n[spm-check] FAIL: ${m}\n`); process.exit(1); };

if (!existsSync(PKG_SWIFT)) skip(`${PKG_SWIFT} not found (not an iOS checkout)`);
if (!existsSync(RESOLVED)) fail(`${RESOLVED} is missing — it must be committed for Xcode Cloud`);

// --- Layer 1: static consistency ---------------------------------------------
const swift = readFileSync(PKG_SWIFT, 'utf8');
const declaredUrls = [...swift.matchAll(/\.package\(\s*url:\s*"([^"]+)"/g)].map((m) => m[1]);

const resolved = JSON.parse(readFileSync(RESOLVED, 'utf8'));
const pins = resolved.pins ?? resolved.object?.pins ?? [];
const norm = (u) => u.replace(/\.git$/, '').toLowerCase();
const pinnedLocations = new Set(
  pins.map((p) => norm(p.location ?? p.repositoryURL ?? ''))
);

const missing = declaredUrls.filter((u) => !pinnedLocations.has(norm(u)));
if (missing.length) {
  fail(
    `remote dependencies declared in Package.swift but not pinned in Package.resolved:\n  ` +
      missing.join('\n  ') +
      `\nRegenerate and commit the lockfile:\n` +
      `  xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App\n` +
      `  git add ${RESOLVED}`
  );
}
ok(`static OK: ${declaredUrls.length} direct remote dep(s) pinned, ${pins.length} total pins`);

// --- Layer 2: resolver drift (needs Xcode) -----------------------------------
let hasXcodebuild = false;
try {
  execSync('xcodebuild -version', { stdio: 'ignore' });
  hasXcodebuild = true;
} catch {
  skip('xcodebuild unavailable — resolver drift check skipped (expected on CI/non-macOS)');
}

if (hasXcodebuild) {
  try {
    execSync('xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App', {
      stdio: 'ignore'
    });
  } catch (e) {
    fail(`xcodebuild could not resolve packages:\n${e.message}`);
  }
  try {
    execSync(`git diff --quiet -- "${RESOLVED}"`, { stdio: 'ignore' });
    ok('resolver OK: Package.resolved is up to date with Package.swift');
  } catch {
    fail(
      `Package.resolved was out of date and has just been regenerated.\n` +
        `Review and commit it:\n  git add ${RESOLVED}`
    );
  }
}
