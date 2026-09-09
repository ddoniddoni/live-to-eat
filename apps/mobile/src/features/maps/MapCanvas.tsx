import Constants from 'expo-constants';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { useTranslation } from 'react-i18next';

import { colors, radii, spacing, type } from '@/components/tokens';

const initialWorldRegion: Region = {
  latitude: 20,
  latitudeDelta: 110,
  longitude: 0,
  longitudeDelta: 110,
};

const googleMapsConfigured = Constants.expoConfig?.extra?.googleMapsConfigured === true;

export function MapCanvas() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const handleMapReady = useCallback(() => setIsLoading(false), []);

  return (
    <View style={styles.frame}>
      <MapView
        accessibilityHint={t('map.canvasHint')}
        accessibilityLabel={t('map.canvasLabel')}
        initialRegion={initialWorldRegion}
        loadingBackgroundColor={colors.canvas}
        loadingEnabled
        loadingIndicatorColor={colors.tomato}
        mapType="standard"
        onMapLoaded={handleMapReady}
        onMapReady={handleMapReady}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
      />

      <View pointerEvents="none" style={styles.mapLabel}>
        <Text style={styles.mapLabelText}>{t('map.provider')}</Text>
      </View>

      {isLoading ? (
        <View pointerEvents="none" style={styles.loadingState}>
          <ActivityIndicator color={colors.tomato} size="small" />
          <Text style={styles.loadingText}>{t('map.loading')}</Text>
        </View>
      ) : null}

      {!googleMapsConfigured ? (
        <View accessibilityRole="alert" style={styles.configurationNotice}>
          <Text style={styles.configurationTitle}>{t('map.configurationTitle')}</Text>
          <Text style={styles.configurationBody}>{t('map.configurationBody')}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: colors.paper,
    borderRadius: radii.panel,
    flex: 1,
    minHeight: 280,
    overflow: 'hidden',
  },
  mapLabel: {
    backgroundColor: colors.ink,
    borderRadius: radii.pill,
    left: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    position: 'absolute',
    top: spacing.sm,
  },
  mapLabelText: {
    color: colors.paper,
    fontFamily: type.utility,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  loadingState: {
    alignItems: 'center',
    backgroundColor: 'rgba(243, 245, 239, 0.9)',
    flexDirection: 'row',
    gap: spacing.xs,
    left: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    position: 'absolute',
    right: spacing.sm,
    top: 52,
  },
  loadingText: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 12,
    fontWeight: '600',
  },
  configurationNotice: {
    backgroundColor: colors.paper,
    gap: 3,
    left: spacing.sm,
    padding: spacing.sm,
    position: 'absolute',
    right: spacing.sm,
    top: 94,
  },
  configurationTitle: {
    color: colors.ink,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: '800',
  },
  configurationBody: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 12,
    lineHeight: 17,
  },
});
