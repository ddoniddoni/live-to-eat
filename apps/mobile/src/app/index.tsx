import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, type } from '@/components/tokens';
import { AuthGate } from '@/features/auth/AuthGate';
import type { SupportedLocale } from '@/features/auth/authApi';
import { useAuthSession } from '@/features/auth/useAuthSession';
import { TakeoutImportSheet } from '@/features/import/TakeoutImportSheet';
import { MapCanvas } from '@/features/maps/MapCanvas';
import { PlaceSearchSheet } from '@/features/places/PlaceSearchSheet';
import { SavedPlaceSheet } from '@/features/places/SavedPlaceSheet';
import type { PrivateCollection } from '@/features/places/collectionsApi';
import type { SavedPlaceDraft } from '@/features/places/placeSearchApi';
import { ShareInboxNotice } from '@/features/share-inbox/ShareInboxNotice';
import { useShareInbox } from '@/features/share-inbox/useShareInbox';
import i18n from '@/lib/i18n';
import { isAuthPreviewMode } from '@/lib/supabase/client';

const changeLanguage = async (locale: SupportedLocale): Promise<void> => {
  await i18n.changeLanguage(locale);
};

export default function HomeScreen() {
  const auth = useAuthSession();
  const authPreviewMode = isAuthPreviewMode();

  useEffect(() => {
    if (auth.locale) void i18n.changeLanguage(auth.locale);
  }, [auth.locale]);

  if (authPreviewMode) return <MyMapScreen isPreview />;
  if (auth.status !== 'active') return <AuthGate auth={auth} onChangeLanguage={changeLanguage} />;

  return <MyMapScreen onSignOut={auth.signOut} />;
}

type MyMapScreenProps = {
  isPreview?: boolean;
  onSignOut?: () => Promise<void>;
};

function MyMapScreen({ isPreview = false, onSignOut }: MyMapScreenProps) {
  const { t } = useTranslation();
  const shareInbox = useShareInbox();
  const [isPlaceSearchVisible, setIsPlaceSearchVisible] = useState(false);
  const [isSavedPlacesVisible, setIsSavedPlacesVisible] = useState(false);
  const [isTakeoutImportVisible, setIsTakeoutImportVisible] = useState(false);
  const [collections, setCollections] = useState<PrivateCollection[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlaceDraft[]>([]);

  const savePlaceToMap = (savedPlace: SavedPlaceDraft): void => {
    setSavedPlaces((current) => {
      const existingIndex = current.findIndex((place) => place.savedId === savedPlace.savedId);
      if (existingIndex < 0) return [savedPlace, ...current];

      return current.map((place, index) => (index === existingIndex ? savedPlace : place));
    });
  };

  const updatePlaceOnMap = (savedPlace: SavedPlaceDraft): void => {
    setSavedPlaces((current) => current.map((place) => (place.savedId === savedPlace.savedId ? savedPlace : place)));
  };

  const deletePlaceFromMap = (savedId: string): void => {
    setSavedPlaces((current) => current.filter((place) => place.savedId !== savedId));
  };

  const updateCollections = useCallback((nextCollections: PrivateCollection[]): void => {
    setCollections(nextCollections);
    setSavedPlaces((current) =>
      current.map((place) => {
        if (!place.collectionId) return place;
        const collection = nextCollections.find((item) => item.id === place.collectionId);
        return collection
          ? { ...place, collectionName: collection.name }
          : { ...place, collectionId: null, collectionName: null };
      }),
    );
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text accessibilityRole="header" style={styles.title}>
              {t('map.title')}
            </Text>
            <Text style={styles.subtitle}>{t('map.subtitle')}</Text>
          </View>
          <View style={styles.headerActions}>
            <View accessibilityLabel={t('map.private')} accessibilityRole="text" style={styles.privacyPill}>
              <View accessibilityElementsHidden style={styles.privacyDot} />
              <Text style={styles.privacyText}>{t('map.private')}</Text>
            </View>
            {isPreview ? <Text style={styles.previewLabel}>{t('map.preview')}</Text> : null}
            {onSignOut ? (
              <Pressable accessibilityRole="button" onPress={() => void onSignOut()} style={styles.signOutButton}>
                <Text style={styles.signOutText}>{t('map.signOut')}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {isPreview ? (
          <View accessibilityRole="alert" style={styles.previewNotice}>
            <Text style={styles.previewNoticeText}>{t('map.previewNotice')}</Text>
          </View>
        ) : null}

        {shareInbox.candidates.length > 0 ? (
          <ShareInboxNotice candidates={shareInbox.candidates} onDiscard={shareInbox.discard} />
        ) : null}

        <MapCanvas />

        <View style={styles.emptyPanel}>
          <Text style={styles.emptyEyebrow}>{t('map.emptyEyebrow')}</Text>
          <Text style={styles.emptyTitle}>
            {savedPlaces.length > 0 ? t('map.savedPlacesTitle', { count: savedPlaces.length }) : t('map.emptyTitle')}
          </Text>
          <Text style={styles.emptyBody}>
            {savedPlaces.length > 0 ? t('map.savedPlacesBody') : t('map.emptyBody')}
          </Text>
          {savedPlaces.length > 0 ? (
            <View style={styles.savedPlaceList}>
              {savedPlaces.slice(0, 2).map((place) => (
                <Pressable
                  accessibilityRole="button"
                  key={place.savedId}
                  onPress={() => setIsSavedPlacesVisible(true)}
                  style={styles.savedPlaceRow}
                >
                  <View style={styles.savedPlaceText}>
                    <Text numberOfLines={1} style={styles.savedPlaceName}>
                      {place.displayName}
                    </Text>
                    <Text numberOfLines={1} style={styles.savedPlaceAddress}>
                      {place.address}
                    </Text>
                  </View>
                  <Text style={styles.savedPlaceStatus}>{t(`map.${place.visitStatus}`)}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => setIsPlaceSearchVisible(true)}
            style={styles.addPlaceButton}
          >
            <Text style={styles.addPlaceButtonText}>+ {t('map.addPlace')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setIsTakeoutImportVisible(true)}
            style={styles.importTakeoutButton}
          >
            <Text style={styles.importTakeoutButtonText}>↓ {t('map.importTakeout')}</Text>
          </Pressable>
          <View style={styles.locationNote}>
            <View accessibilityElementsHidden style={styles.locationDot} />
            <Text style={styles.locationText}>{t('map.locationNote')}</Text>
          </View>
        </View>

        {isPlaceSearchVisible ? (
          <PlaceSearchSheet
            collections={collections}
            onCollectionsChange={updateCollections}
            onDismiss={() => setIsPlaceSearchVisible(false)}
            onSaved={savePlaceToMap}
            visible
          />
        ) : null}
        {isSavedPlacesVisible ? (
          <SavedPlaceSheet
            onDelete={deletePlaceFromMap}
            onDismiss={() => setIsSavedPlacesVisible(false)}
            onUpdate={updatePlaceOnMap}
            savedPlaces={savedPlaces}
            visible
          />
        ) : null}
        {isTakeoutImportVisible ? (
          <TakeoutImportSheet onDismiss={() => setIsTakeoutImportVisible(false)} visible />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.canvas,
    flex: 1,
  },
  page: {
    flex: 1,
    gap: spacing.md,
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.lg,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  title: {
    color: colors.ink,
    fontFamily: type.display,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1.5,
    lineHeight: 37,
  },
  subtitle: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  privacyPill: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  privacyDot: {
    backgroundColor: colors.wasabi,
    borderRadius: radii.pill,
    height: 7,
    width: 7,
  },
  privacyText: {
    color: colors.paper,
    fontFamily: type.utility,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  previewLabel: {
    color: colors.tomato,
    fontFamily: type.utility,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  previewNotice: {
    backgroundColor: '#FFF3D6',
    borderColor: '#E5B34C',
    borderRadius: 12,
    borderWidth: 1,
    padding: spacing.sm,
  },
  previewNoticeText: {
    color: colors.ink,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  signOutButton: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  signOutText: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 12,
    fontWeight: '700',
  },
  addPlaceButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.wasabi,
    borderRadius: radii.pill,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
  },
  addPlaceButtonText: {
    color: colors.ink,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: '900',
  },
  emptyPanel: {
    backgroundColor: colors.ink,
    borderRadius: radii.panel,
    gap: 6,
    padding: spacing.lg,
  },
  importTakeoutButton: {
    alignSelf: 'flex-start',
    borderColor: '#657078',
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 9,
  },
  importTakeoutButtonText: {
    color: colors.paper,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: '800',
  },
  emptyEyebrow: {
    color: colors.wasabi,
    fontFamily: type.utility,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  emptyTitle: {
    color: colors.paper,
    fontFamily: type.display,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.7,
    lineHeight: 29,
  },
  emptyBody: {
    color: colors.panelMuted,
    fontFamily: type.body,
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 320,
  },
  locationNote: {
    alignItems: 'center',
    borderTopColor: colors.rule,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
  },
  locationDot: {
    backgroundColor: colors.tomato,
    borderRadius: radii.pill,
    height: 8,
    width: 8,
  },
  locationText: {
    color: colors.panelMuted,
    flex: 1,
    fontFamily: type.body,
    fontSize: 12,
    fontWeight: '600',
  },
  savedPlaceAddress: {
    color: colors.panelMuted,
    fontFamily: type.body,
    fontSize: 12,
    marginTop: 2,
  },
  savedPlaceList: {
    borderTopColor: colors.rule,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.md,
  },
  savedPlaceName: {
    color: colors.paper,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: '800',
  },
  savedPlaceRow: {
    alignItems: 'center',
    borderBottomColor: colors.rule,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: 10,
  },
  savedPlaceStatus: {
    color: colors.wasabi,
    fontFamily: type.utility,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  savedPlaceText: {
    flex: 1,
  },
});
