import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.princeauto.inventory',
  appName: 'PRINCE AMOFAH AUTOS',
  webDir: 'dist',
  server: {
    // Uncomment to load the live site instead of bundled files (updates without rebuilding):
    // url: 'https://prince-inventory-manager.vercel.app',
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#f4f5f7',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#1c2430',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1c2430',
    },
  },
}

export default config
