import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.saron.meusaron',
  appName: 'Meu Saron',
  webDir: 'dist/public',
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#16a34a',
      showSpinner: false,
    },
  },
};

export default config;
