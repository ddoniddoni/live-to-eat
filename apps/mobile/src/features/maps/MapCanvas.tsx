import Constants from 'expo-constants';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { useTranslation } from 'react-i18next';

import { colors, radii, spacing, type } from '@/components/tokens';
type MapCanvasProps = {
  onSelectPlace?: (savedId: string) => void;
  places?: MapPinPlace[];
  selectedSavedId?: string | null;
};

export type MapPinPlace = Readonly<{
  coordinate: { latitude: number; longitude: number } | null;
  displayName: string;
  savedId: string;
}>;

type PositionedPlace = MapPinPlace & {
  coordinate: NonNullable<MapPinPlace['coordinate']>;
};

type MapCluster = {
  coordinate: PositionedPlace['coordinate'];
  id: string;
  places: PositionedPlace[];
};

const initialWorldRegion: Region = {
  latitude: 20,
  latitudeDelta: 110,
  longitude: 0,
  longitudeDelta: 330,
};

const googleMapsConfigured = Constants.expoConfig?.extra?.googleMapsConfigured === true;

const hasCoordinate = (place: MapPinPlace): place is PositionedPlace => place.coordinate !== null;

const clusterPlaces = (places: MapPinPlace[], region: Region): MapCluster[] => {
  const cellSize = Math.max(0.0001, region.latitudeDelta, region.longitudeDelta) / 9;
  const buckets = new Map<string, PositionedPlace[]>();

  for (const place of places) {
    if (!hasCoordinate(place)) continue;

    const bucketId = `${Math.floor(place.coordinate.latitude / cellSize)}:${Math.floor(place.coordinate.longitude / cellSize)}`;
    const bucket = buckets.get(bucketId) ?? [];
    bucket.push(place);
    buckets.set(bucketId, bucket);
  }

  return [...buckets.entries()].map(([id, groupedPlaces]) => {
    const coordinate = groupedPlaces.reduce(
      (total, place) => ({
        latitude: total.latitude + place.coordinate.latitude / groupedPlaces.length,
        longitude: total.longitude + place.coordinate.longitude / groupedPlaces.length,
      }),
      { latitude: 0, longitude: 0 },
    );

    return { coordinate, id, places: groupedPlaces };
  });
};

export function MapCanvas({ onSelectPlace, places = [], selectedSavedId = null }: MapCanvasProps) {
  const { t } = useTranslation();
  const mapRef = useRef<MapView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);
  const [visibleRegion, setVisibleRegion] = useState<Region>(initialWorldRegion);
  const clusters = useMemo(() => clusterPlaces(places, visibleRegion), [places, visibleRegion]);
  const positionedPlaces = useMemo(() => places.filter(hasCoordinate), [places]);
  const coordinateCount = positionedPlaces.length;
  const pendingLocationCount = places.length - coordinateCount;
  const handleMapReady = useCallback(() => {
    setIsLoading(false);
    setIsMapReady(true);
  }, []);

  useEffect(() => {
    if (!isMapReady || positionedPlaces.length === 0) return;

    const coordinates = positionedPlaces.map((place) => place.coordinate);
    if (coordinates.length === 1) {
      const [coordinate] = coordinates;
      if (!coordinate) return;

      mapRef.current?.animateToRegion(
        {
          latitude: coordinate.latitude,
          latitudeDelta: 0.06,
          longitude: coordinate.longitude,
          longitudeDelta: 0.06,
        },
        260,
      );
      return;
    }

    mapRef.current?.fitToCoordinates(coordinates, {
      animated: true,
      edgePadding: { bottom: 58, left: 40, right: 40, top: 58 },
    });
  }, [isMapReady, positionedPlaces]);

  const focusCluster = useCallback(
    (cluster: MapCluster): void => {
      const [firstPlace] = cluster.places;
      if (!firstPlace) return;

      if (cluster.places.length === 1) {
        onSelectPlace?.(firstPlace.savedId);
        return;
      }

      mapRef.current?.animateToRegion(
        {
          latitude: cluster.coordinate.latitude,
          latitudeDelta: Math.max(0.03, visibleRegion.latitudeDelta / 3),
          longitude: cluster.coordinate.longitude,
          longitudeDelta: Math.max(0.03, visibleRegion.longitudeDelta / 3),
        },
        260,
      );
    },
    [onSelectPlace, visibleRegion.latitudeDelta, visibleRegion.longitudeDelta],
  );

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
        onRegionChangeComplete={setVisibleRegion}
        provider={PROVIDER_GOOGLE}
        ref={mapRef}
        style={StyleSheet.absoluteFill}
      >
        {clusters.map((cluster) => {
          const [firstPlace] = cluster.places;
          if (!firstPlace) return null;

          const isCluster = cluster.places.length > 1;
          const isSelected = cluster.places.some((place) => place.savedId === selectedSavedId);
          const label = isCluster ? String(cluster.places.length) : firstPlace.displayName.slice(0, 1);
          const title = isCluster ? t('map.clusterTitle', { count: cluster.places.length }) : firstPlace.displayName;

          return (
            <Marker coordinate={cluster.coordinate} key={cluster.id} onPress={() => focusCluster(cluster)} title={title}>
              <View style={[styles.pin, isCluster ? styles.clusterPin : null, isSelected ? styles.selectedPin : null]}>
                <Text style={[styles.pinText, isCluster ? styles.clusterPinText : null]}>{label}</Text>
              </View>
            </Marker>
          );
        })}
      </MapView>

      <View pointerEvents="none" style={styles.mapLabel}>
        <Text style={styles.mapLabelText}>{t('map.provider')}</Text>
      </View>
      {coordinateCount > 0 ? (
        <View pointerEvents="none" style={styles.pinState}>
          <View style={styles.pinStateDot} />
          <Text style={styles.pinStateText}>{t('map.pinsVisible', { count: coordinateCount })}</Text>
        </View>
      ) : null}

      {isLoading ? (
        <View pointerEvents="none" style={styles.loadingState}>
          <ActivityIndicator color={colors.tomato} size="small" />
          <Text style={styles.loadingText}>{t('map.loading')}</Text>
        </View>
      ) : null}

      {pendingLocationCount > 0 ? (
        <View pointerEvents="none" style={styles.locationState}>
          <Text style={styles.locationStateText}>{t('map.locationPending', { count: pendingLocationCount })}</Text>
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
  clusterPin: {
    backgroundColor: colors.ink,
    minWidth: 38,
  },
  clusterPinText: {
    color: colors.wasabi,
  },
  configurationBody: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 12,
    lineHeight: 17,
  },
  configurationNotice: {
    backgroundColor: colors.paper,
    gap: 3,
    left: spacing.sm,
    padding: spacing.sm,
    position: 'absolute',
    right: spacing.sm,
    top: 128,
  },
  configurationTitle: {
    color: colors.ink,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: '800',
  },
  frame: {
    backgroundColor: colors.paper,
    borderRadius: radii.panel,
    flex: 1,
    minHeight: 280,
    overflow: 'hidden',
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
  locationState: {
    backgroundColor: 'rgba(255, 243, 214, 0.94)',
    left: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    position: 'absolute',
    right: spacing.sm,
    top: 92,
  },
  locationStateText: {
    color: colors.ink,
    fontFamily: type.body,
    fontSize: 11,
    fontWeight: '700',
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
  pin: {
    alignItems: 'center',
    backgroundColor: colors.tomato,
    borderColor: colors.paper,
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 32,
    justifyContent: 'center',
    minWidth: 32,
    paddingHorizontal: 7,
  },
  pinState: {
    alignItems: 'center',
    backgroundColor: 'rgba(21, 32, 42, 0.9)',
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    position: 'absolute',
    right: spacing.sm,
    top: spacing.sm,
  },
  pinStateDot: {
    backgroundColor: colors.wasabi,
    borderRadius: radii.pill,
    height: 7,
    width: 7,
  },
  pinStateText: {
    color: colors.paper,
    fontFamily: type.utility,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  pinText: {
    color: colors.paper,
    fontFamily: type.utility,
    fontSize: 12,
    fontWeight: '900',
  },
  selectedPin: {
    backgroundColor: colors.wasabi,
    borderColor: colors.ink,
  },
});
