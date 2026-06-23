import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.raycatdev.hn',
  appName: 'HN Reader',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
