import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.raycatdev.hn',
  appName: 'HN Reader',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    // Bundle discovery is handled by src/modules/otaUpdates.ts using a static
    // GitHub Pages manifest and GitHub Release assets. Keep the plugin's cloud
    // checks and telemetry disabled in future native builds.
    CapacitorUpdater: {
      autoUpdate: false,
      statsUrl: ''
    }
  }
};

export default config;
