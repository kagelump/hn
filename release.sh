#!/bin/bash
# Release build script for HN Reader
# Usage: ./release.sh [versionCode]
#   versionCode defaults to 1, increment for each Play Store upload

set -e

VERSION_CODE="${1:-1}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Ensure Java 21
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home}"
if [ ! -d "$JAVA_HOME" ]; then
    echo "Error: Java 21 not found at $JAVA_HOME"
    echo "Install with: brew install openjdk@21"
    exit 1
fi

echo "=== Building web assets ==="
npm run build

echo ""
echo "=== Syncing to Android ==="
npx cap sync android

echo ""
echo "=== Building release bundle (versionCode=$VERSION_CODE) ==="
cd android
./gradlew bundleRelease

echo ""
echo "=== Done ==="
AAB="app/build/outputs/bundle/release/app-release.aab"
ls -lh "$AAB"
echo ""
echo "Upload this file to Google Play Console:"
echo "  $(pwd)/$AAB"
echo ""
echo "Keystore: app/hnreader-release.keystore"
echo "Properties: app/keystore.properties"
