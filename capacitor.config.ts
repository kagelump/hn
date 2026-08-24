import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.raycatdev.hn',
  appName: 'HN Reader',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    // OTA web-bundle updates. autoUpdate: check Capgo on launch/resume, download
    // in the background, and activate the new bundle on the next cold start.
    CapacitorUpdater: {
      autoUpdate: true
    }
  }
};

export default config;
