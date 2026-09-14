import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, BackHandler, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NotebookPlace } from '@live-to-eat/domain';
import { useQueryClient } from '@tanstack/react-query';
import type { PrivateCollection } from '@/features/places/collectionsApi';
import { colors } from '@/components/tokens';
import { Icon } from '@/components/ui/Icon';
import { ui } from '@/components/ui/primitives';
import { MyMapScreen } from '@/features/maps/MyMapScreen';
import { DiscoverScreen } from '@/features/discover/DiscoverScreen';
import { ProfileScreen } from '@/features/profile/ProfileScreen';
import { ShareSheet } from '@/features/shares/ShareSheet';
import { ShareManager } from '@/features/shares/ShareManager';
import { PlaceSearchSheet } from '@/features/places/PlaceSearchSheet';
import { deleteSavedPlace, updateSavedPlace } from '@/features/places/placeSearchApi';
import { setSavedPlaceVisibility } from '@/features/discover/publicMapApi';
import { useNotebook } from './useNotebook';
import { PlaceEditor } from './PlaceEditor';
import { SearchSheet } from './SearchSheet';
import { FoldersSheet } from './FoldersSheet';
import { WelcomeSheet } from './WelcomeSheet';
import { RequestError } from '@/components/ui/RequestError';
import { useRequest } from '@/lib/requests/useRequest';

type Overlay =
  | { type: 'search'; region: string }
  | { type: 'place'; place: NotebookPlace; isNew: boolean }
  | { type: 'folders' }
  | { type: 'share'; region: string }
  | { type: 'shares' }
  | null;
export function AppShell({
  isDemo,
  onSignOut,
}: {
  isDemo: boolean;
  onSignOut?: (() => Promise<void>) | undefined;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const book = useNotebook(isDemo);
  const welcome = useRequest();
  const queryClient = useQueryClient();
  const updateNotebook = book.update;
  const updateCollections = useCallback((collections: PrivateCollection[]) => {
    void updateNotebook(b => ({ ...b, collections })).catch(() => undefined);
  }, [updateNotebook]);
  useEffect(() => { if (!isDemo) return () => queryClient.clear(); }, [isDemo, queryClient]);
  const [tab, setTab] = useState<'map' | 'discover' | 'profile'>('map');
  const [mapRegion, setMapRegion] = useState('all');
  const [discoverRegion, setDiscoverRegion] = useState(isDemo ? 'kr' : 'all');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [tabBarHeight, setTabBarHeight] = useState(76);
  useEffect(() => {
    if (!toast) return;
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(toast);
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (overlay) return false;
      if (tab !== 'map') {
        setTab('map');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [tab, overlay]);
  const onClose = () => setOverlay(null);
  const openSearch = () => setOverlay({ type: 'search', region: tab === 'discover' ? discoverRegion : mapRegion });
  const savePlace = async (place: NotebookPlace) => {
    if (isDemo) {
      const existing = book.state.places.find((p) => p.savedId === place.savedId);
      await book.upsert({ ...place, version: (existing?.version ?? 0) + 1 });
    } else {
      const original = book.state.places.find((p) => p.savedId === place.savedId);
      if (!original) throw new Error('PLACE_MISSING');
      const updated = await updateSavedPlace({
        savedPlace: original,
        isRecommended: place.isRecommended,
        note: place.note,
        tags: place.tags,
        visitStatus: place.visitStatus,
      });
      let result = { ...updated, publicNote: original.publicNote };
      // Keep a successful private edit even when a later visibility request fails.
      await book.upsert(result);
      if (place.visibility !== original.visibility || place.publicNote !== original.publicNote) {
        const version = await setSavedPlaceVisibility({
          expectedVersion: updated.version,
          publicNote: place.publicNote,
          savedId: place.savedId,
          visibility: place.visibility,
        });
        result = { ...result, visibility: place.visibility, publicNote: place.publicNote, version };
        await book.upsert(result);
      }
    }
    setToast(t('common.saved'));
  };
  const openPlace = (place: NotebookPlace) => setOverlay({ type: 'place', place, isNew: false });
  if (book.loading && !book.loaded)
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: colors.canvas,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
        }}
      >
        <ActivityIndicator color={colors.tomato} />
        <Text style={ui.muted}>{t('map.loadingPlaces')}</Text>
      </SafeAreaView>
    );
  if (book.error && !book.loaded)
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.canvas, justifyContent: 'center', padding: 30, gap: 20 }}
      >
        <RequestError error={book.error} context="load" onRetry={() => void book.refresh()} />
      </SafeAreaView>
    );
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={{ flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center' }}>
        {tab === 'map' ? (
          <MyMapScreen
            book={book}
            isDemo={isDemo}
            region={mapRegion}
            onRegionChange={setMapRegion}
            onAdd={openSearch}
            onPlace={openPlace}
            onShare={(region) => setOverlay({ type: 'share', region })}
            onFolders={() => setOverlay({ type: 'folders' })}
          />
        ) : tab === 'discover' ? (
          <DiscoverScreen book={book} isDemo={isDemo} region={discoverRegion} onRegionChange={setDiscoverRegion} onSaved={() => setToast(t('common.saved'))} />
        ) : (
          <ProfileScreen
            book={book}
            isDemo={isDemo}
            onFolders={() => setOverlay({ type: 'folders' })}
            onShares={() => setOverlay({ type: 'shares' })}
            onSignOut={onSignOut}
          />
        )}
        <View style={{ position: 'absolute', bottom: tabBarHeight + 16, right: 24 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('map.addPlace')}
            testID="add-place"
            onPress={openSearch}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
              minHeight: 52,
              paddingHorizontal: 20,
              borderRadius: 18,
              backgroundColor: colors.tomato,
              boxShadow: '0 5px 16px rgba(115,40,28,0.18)',
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Icon name="plus" color={colors.paper} size={20} />
            <Text style={{ color: colors.paper, fontSize: 14, fontWeight: '700' }}>
              {t('common.savePlace')}
            </Text>
          </Pressable>
        </View>
        <View
          onLayout={(event) => setTabBarHeight(event.nativeEvent.layout.height)}
          style={{
            flexDirection: 'row',
            paddingTop: 10,
            paddingBottom: Math.max(insets.bottom, 13),
            borderTopWidth: 1,
            borderColor: colors.rule,
            backgroundColor: colors.paper,
          }}
        >
          {(['map', 'discover', 'profile'] as const).map((item) => (
            <Pressable
              key={item}
              accessibilityRole="tab"
              testID={`tab-${item}`}
              accessibilityState={{ selected: tab === item }}
              onPress={() => setTab(item)}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 50, paddingHorizontal: 4 }}
            >
              <View
                style={{
                  width: 48,
                  height: 27,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: tab === item ? colors.blush : 'transparent',
                  borderRadius: 10,
                }}
              >
                <Icon
                  name={item === 'map' ? 'map' : item === 'discover' ? 'compass' : 'person'}
                  size={22}
                  color={tab === item ? colors.tomato : colors.muted}
                />
              </View>
              <Text
                style={{
                  fontSize: 11,
                  textAlign: 'center',
                  fontWeight: tab === item ? '700' : '500',
                  color: tab === item ? colors.tomato : colors.muted,
                }}
              >
                {t(`common.tab_${item}`)}
              </Text>
            </Pressable>
          ))}
        </View>
        {toast ? (
          <View
            accessibilityRole="alert"
            style={{
              position: 'absolute',
              bottom: tabBarHeight + 76,
              left: 24,
              right: 24,
              backgroundColor: colors.ink,
              borderRadius: 14,
              padding: 16,
              pointerEvents: 'none',
            }}
          >
            <Text accessibilityLiveRegion="polite" style={{ color: colors.paper, fontSize: 14, textAlign: 'center' }}>{toast}</Text>
          </View>
        ) : null}
        {overlay?.type === 'search' ? (
          isDemo ? (
            <SearchSheet
              initialRegion={overlay.region}
              onClose={onClose}
              savedIds={book.state.places.map((p) => p.savedId)}
              onPick={(p) => {
                const existing = book.state.places.find((s) => s.savedId === p.savedId);
                setOverlay({ type: 'place', place: existing ?? p, isNew: !existing });
              }}
            />
          ) : (
            <PlaceSearchSheet
              visible
              collections={book.state.collections}
              onCollectionsChange={updateCollections}
              onDismiss={onClose}
              onSaved={(p) => {
                void book.upsert({ ...p, publicNote: '' }).then(() => setToast(t('common.saved'))).catch(() => undefined);
              }}
            />
          )
        ) : null}
        {overlay?.type === 'place' ? (
          <PlaceEditor
            key={overlay.place.savedId}
            place={overlay.place}
            isNew={overlay.isNew}
            collections={book.state.collections}
            allowFolderEdit={isDemo}
            onClose={onClose}
            onSave={savePlace}
            {...(!overlay.isNew
              ? {
                  onDelete: async () => {
                    if (!isDemo) await deleteSavedPlace(overlay.place);
                    await book.remove(overlay.place.savedId);
                    setToast(t('common.deleted'));
                  },
                }
              : {})}
          />
        ) : null}
        {overlay?.type === 'folders' ? <FoldersSheet book={book} isDemo={isDemo} onClose={onClose} /> : null}
        {overlay?.type === 'share' ? (
          <ShareSheet
            book={book}
            initialRegion={overlay.region}
            isDemo={isDemo}
            onClose={onClose}
            onCreated={() => setToast(t('sharing.created'))}
          />
        ) : null}
        {overlay?.type === 'shares' ? (
          <ShareManager
            book={book}
            onClose={onClose}
            onCreate={() => setOverlay({ type: 'share', region: 'all' })}
          />
        ) : null}
        {isDemo && !book.state.welcomed ? (
          <WelcomeSheet busy={welcome.busy} error={welcome.error}
            onClose={() => { void welcome.run(() => book.update((b) => ({ ...b, welcomed: true }), 'settings')); }} />
        ) : null}
      </View>
    </SafeAreaView>
  );
}
