import type { ConfigContext, ExpoConfig } from 'expo/config';

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing configuration: ${name}`);
  return value;
};

const isConfiguredGoogleMapsKey = (value: string): boolean => !value.startsWith('YOUR_');

export default ({ config }: ConfigContext): ExpoConfig => {
  const iosGoogleMapsApiKey = required('GOOGLE_MAPS_IOS_KEY');
  const androidGoogleMapsApiKey = required('GOOGLE_MAPS_ANDROID_KEY');
  const iosBundleIdentifier = required('APP_IOS_BUNDLE_ID');

  return {
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
      bundleIdentifier: iosBundleIdentifier,
      deploymentTarget: '16.4',
      supportsTablet: true,
      usesAppleSignIn: true,
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
          iosGoogleMapsApiKey,
          androidGoogleMapsApiKey,
        },
      ],
      [
        './plugins/withShareInbox',
        {
          appGroupId: `group.${iosBundleIdentifier}`,
          extensionBundleIdentifier: `${iosBundleIdentifier}.shareinbox`,
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      appVariant: process.env.APP_VARIANT ?? 'development',
      googleMapsConfigured:
        isConfiguredGoogleMapsKey(iosGoogleMapsApiKey) &&
        isConfiguredGoogleMapsKey(androidGoogleMapsApiKey),
    },
  };
};
