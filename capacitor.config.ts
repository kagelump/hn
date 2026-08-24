import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.raycatdev.hn',
  appName: 'HN Reader',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    // OTA web-bundle updates. 'atBackground': check Capgo on launch/resume,
    // download in the background, and activate the new bundle on the next cold
    // start. The bundle version is reported from the native app version, so OTA
    // bundles must be versioned above it (see docs/ota-updates.md).
    CapacitorUpdater: {
      autoUpdate: 'atBackground'
    }
  }
};

export default config;
