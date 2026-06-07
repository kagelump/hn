import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.raycatdev.hnreader.v2',
  appName: 'HN Reader',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
