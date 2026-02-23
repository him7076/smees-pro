import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.smees.pro',       // Aapka package name
  appName: 'SMEES Pro',         // App ka naam jo phone me dikhega
  webDir: 'build',
  server: {
    url: 'https://smees-pro.vercel.app/', // <-- YAHAN APNI LIVE WEBSITE KA LINK DAALEIN
    cleartext: true
  }
};

export default config;