#!/bin/sh

# Xcode Cloud post-clone script.
#
# Capacitor references its iOS plugins as local Swift packages inside
# node_modules/ (see ios/App/CapApp-SPM/Package.swift). Xcode Cloud clones the
# repo but does not run npm, so node_modules/ and the built web assets are
# missing and SPM dependency resolution fails. This script restores them before
# Xcode resolves packages and builds.

set -e

# Xcode Cloud runs this script from the ci_scripts directory; move to repo root.
cd "$CI_PRIMARY_REPOSITORY_PATH"

# Node isn't preinstalled on Xcode Cloud build machines. Homebrew is.
brew install node

echo "node $(node -v) / npm $(npm -v)"

# Restore JS dependencies (this recreates the node_modules/@capacitor/* Swift
# packages that Package.swift points at), build the web bundle, and copy it
# into the native iOS project (ios/App/App/public).
npm ci
npm run build
npx cap sync ios
