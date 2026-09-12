import type { ConfigContext, ExpoConfig } from 'expo/config';

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing configuration: ${name}`);
  return value;
};

const isConfiguredGoogleMapsKey = (value: string): boolean => !value.startsWith('YOUR_');

export default ({ config }: ConfigContext): ExpoConfig => {
  if (process.env.APP_VARIANT === 'production' && process.env.EXPO_PUBLIC_AUTH_PREVIEW === 'true') {
    throw new Error('Production builds cannot enable demo mode');
  }
  const iosGoogleMapsApiKey = required('GOOGLE_MAPS_IOS_KEY');
  const androidGoogleMapsApiKey = required('GOOGLE_MAPS_ANDROID_KEY');
  const iosBundleIdentifier = required('APP_IOS_BUNDLE_ID');

  return {
    ...config,
    name: 'LiveToEat',
    slug: 'live-to-eat',
    version: '0.1.0',
    icon: './assets/icon.png',
    platforms: ['ios', 'android', 'web'],
    web: { bundler: 'metro', output: 'single' },
    orientation: 'portrait',
    scheme: required('APP_SCHEME'),
    userInterfaceStyle: 'light',
    ios: {
      ...config.ios,
      bundleIdentifier: iosBundleIdentifier,
      deploymentTarget: '16.4',
      supportsTablet: true,
      usesAppleSignIn: true,
    },
    android: {
      ...config.android,
      package: required('APP_ANDROID_PACKAGE'),
      adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#C84032' },
      softwareKeyboardLayoutMode: 'resize',
    },
    plugins: [
      'expo-router',
      ['expo-splash-screen', { image: './assets/splash-icon.png', imageWidth: 180, backgroundColor: '#C84032' }],
      'expo-secure-store',
      'expo-apple-authentication',
      [
        'expo-build-properties',
        {
          android: {
            compileSdkVersion: 36,
            minSdkVersion: 24,
            targetSdkVersion: 36,
          },
        },
      ],
      [
        'react-native-maps',
        {
          iosGoogleMapsApiKey,
          androidGoogleMapsApiKey,
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      appVariant: process.env.APP_VARIANT ?? 'development',
      googleMapsConfigured:
        isConfiguredGoogleMapsKey(iosGoogleMapsApiKey) && isConfiguredGoogleMapsKey(androidGoogleMapsApiKey),
    },
  };
};
