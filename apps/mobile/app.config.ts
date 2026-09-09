import type { ConfigContext, ExpoConfig } from 'expo/config';

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing configuration: ${name}`);
  return value;
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'LiveToEat',
  slug: 'live-to-eat',
  version: '0.1.0',
  platforms: ['ios', 'android'],
  orientation: 'portrait',
  scheme: required('APP_SCHEME'),
  userInterfaceStyle: 'automatic',
  ios: {
    ...config.ios,
    bundleIdentifier: required('APP_IOS_BUNDLE_ID'),
    deploymentTarget: '16.4',
    supportsTablet: true,
  },
  android: {
    ...config.android,
    package: required('APP_ANDROID_PACKAGE'),
  },
  plugins: [
    'expo-router',
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
        iosGoogleMapsApiKey: required('GOOGLE_MAPS_IOS_KEY'),
        androidGoogleMapsApiKey: required('GOOGLE_MAPS_ANDROID_KEY'),
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    appVariant: process.env.APP_VARIANT ?? 'development',
  },
});
