import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { RequestError } from '@/components/ui/RequestError';
import { buildRegionOptions, type NotebookPlace } from '@live-to-eat/domain';
import { colors } from '@/components/tokens';
import { Icon } from '@/components/ui/Icon';
import { MapArtwork } from '@/components/ui/Artwork';
import { Action, Chip, Empty, IconButton, ui } from '@/components/ui/primitives';
import { RegionButton } from '@/features/regions/RegionButton';
import { RegionPickerSheet } from '@/features/regions/RegionPickerSheet';
import { PlaceCard } from '@/features/notebook/PlaceCard';
import type { NotebookController } from '@/features/notebook/useNotebook';
import { MapCanvas } from './MapCanvas';
import type { ViewPreferences } from '@/features/preferences/viewPreferences';
import { indexSavedPlaces, selectSavedPlaces } from './savedPlaceSelection';

type Props = {
  book: NotebookController;
  isDemo: boolean;
  region: string;
  onRegionChange: (region: string) => void;
  preferences: ViewPreferences;
  onPreferencesChange: (patch: Partial<ViewPreferences>) => void;
  onAdd: () => void;
  onPlace: (place: NotebookPlace) => void;
  onShare: (region: string) => void;
  onFolders: () => void;
};
export function MyMapScreen({ book, isDemo, region, onRegionChange, preferences, onPreferencesChange, onAdd, onPlace, onShare, onFolders }: Props) {
  const { t, i18n } = useTranslation();
  const { status, folder, mode, sort } = preferences;
  const [query, setQuery] = useState('');
  const [regionOpen, setRegionOpen] = useState(false);
  const regions = useMemo(
    () => buildRegionOptions(book.state.places),
    [book.state.places],
  );
  const searchIndex = useMemo(() => indexSavedPlaces(book.state.places, i18n.language), [book.state.places, i18n.language]);
  const filtered = useMemo(() => selectSavedPlaces(searchIndex, { mapRegion: region, status, folder, query, sort }),
    [searchIndex, region, status, folder, query, sort]);
  const regionLabel =
    region === 'all'
      ? t('regions.allSaved')
      : region === 'unclassified'
        ? t('map.unclassified')
        : (regions.find((r) => r.id === region)?.path.slice(1).map((p) => p.label).join(' · ') || regions.find((r) => r.id === region)?.label || t('regions.unknown'));
  const hasFilters = region !== 'all' || status !== 'all' || folder !== 'all' || query.trim().length > 0;
  const clearFilters = () => { onPreferencesChange({ mapRegion: 'all', status: 'all', folder: 'all' }); setQuery(''); };
  const renderPlace = useCallback(({ item }: { item: NotebookPlace }) => <PlaceCard place={item} onSelect={onPlace} />, [onPlace]);
  return (
    <View style={{ flex: 1 }}>
      <FlatList
        testID="saved-place-list"
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={false}
        data={mode === 'list' ? filtered : []}
        keyExtractor={(p) => p.savedId}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 110 }}
        refreshing={book.loading}
        onRefresh={() => void book.refresh()}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <View style={[ui.between, { paddingTop: 12 }]}>
              <View style={[ui.row, { flex: 1, flexWrap: 'wrap' }]}>
                <Text style={{ color: colors.tomato, fontSize: 23, fontWeight: '800', letterSpacing: -1.3, flexShrink: 1 }}>
                  LiveToEat<Text style={{ color: colors.ink }}> ·</Text>
                </Text>
                {isDemo ? (
                  <Text
                    style={{
                      color: colors.muted,
                      fontSize: 10,
                      borderWidth: 1,
                      borderColor: colors.rule,
                      borderRadius: 5,
                      padding: 4,
                    }}
                  >
                    {t('common.demo')}
                  </Text>
                ) : null}
              </View>
              <IconButton name="share" label={t('sharing.create')} onPress={() => onShare(region)} testID="create-share" />
            </View>
            <View style={{ marginTop: 22, marginBottom: 20, gap: 5 }}>
              <Text accessibilityRole="header" style={ui.title}>
                {t('notebook.title')}
              </Text>
              <Text style={ui.muted}>{t('notebook.subtitle', { count: book.total })}</Text>
            </View>
            <View style={[ui.between, { marginBottom: 16 }]}>
              <RegionButton label={regionLabel} onPress={() => setRegionOpen(true)} />
              <View
                style={{ flexDirection: 'row', backgroundColor: colors.sage, borderRadius: 12, padding: 3 }}
              >
                {(['list', 'map'] as const).map((item) => (
                  <Pressable
                    key={item}
                    accessibilityRole="tab"
                    accessibilityLabel={t(`notebook.${item}View`)}
                    accessibilityState={{ selected: mode === item }}
                    testID={`map-mode-${item}`}
                    onPress={() => onPreferencesChange({ mode: item })}
                    style={{
                      minWidth: 44,
                      minHeight: 44,
                      backgroundColor: mode === item ? colors.paper : 'transparent',
                      borderRadius: 9,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name={item} size={18} color={mode === item ? colors.ink : colors.muted} />
                  </Pressable>
                ))}
              </View>
            </View>
            {mode === 'list' && !query ? (
              <View style={{ height: 154, borderRadius: 22, overflow: 'hidden', marginBottom: 20 }}>
                <MapArtwork />
                <View
                  style={{
                    position: 'absolute',
                    left: 16,
                    top: 16,
                    backgroundColor: colors.paper,
                    borderRadius: 12,
                    padding: 10,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.ink }}>
                    {t('notebook.atlas')}
                  </Text>
                  <Text style={{ fontSize: 10, color: colors.muted, marginTop: 4 }}>
                    {t('notebook.illustration')}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  testID="map-manage-folders"
                  onPress={onFolders}
                  style={[
                    ui.row,
                    {
                      position: 'absolute',
                      bottom: 13,
                      left: 14,
                      backgroundColor: colors.paper,
                      paddingVertical: 9,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                      minHeight: 44,
                    },
                  ]}
                >
                  <Icon name="folder" size={16} />
                  <Text style={{ fontSize: 12, color: colors.ink, fontWeight: '600' }}>
                    {t('notebook.folders', { count: book.state.collections.length })}
                  </Text>
                  <Icon name="chevron" size={12} />
                </Pressable>
              </View>
            ) : null}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 7, paddingBottom: 16 }}
            >
              {['all', 'want', 'visited', 'recommended'].map((s) => (
                <Chip
                  key={s}
                  label={t(`notebook.${s}`)}
                  selected={status === s}
                  testID={`map-status-${s}`}
                  onPress={() => onPreferencesChange({ status: s as ViewPreferences['status'] })}
                />
              ))}
            </ScrollView>
            <View
              style={[
                ui.row,
                {
                  backgroundColor: colors.paper,
                  borderWidth: 1,
                  borderColor: colors.rule,
                  borderRadius: 14,
                  paddingHorizontal: 13,
                },
              ]}
            >
              <Icon name="search" size={18} color={colors.muted} />
              <TextInput
                testID="map-search"
                accessibilityLabel={t('notebook.search')}
                placeholder={t('notebook.search')}
                placeholderTextColor={colors.muted}
                value={query}
                onChangeText={setQuery}
                style={{ flex: 1, minHeight: 46, fontSize: 14, color: colors.ink }}
              />
              {query ? (
                <IconButton name="close" label={t('common.clear')} onPress={() => setQuery('')} />
              ) : null}
            </View>
            {book.state.collections.length ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 7, paddingTop: 12 }}
              >
                <Chip
                  label={t('notebook.allFolders')}
                  selected={folder === 'all'}
                  testID="map-folder-all"
                  onPress={() => onPreferencesChange({ folder: 'all' })}
                />
                {book.state.collections.map((c) => (
                  <Chip
                    key={c.id}
                    icon="folder"
                    label={c.name}
                    selected={folder === c.id}
                    testID={`map-folder-${c.id}`}
                    onPress={() => onPreferencesChange({ folder: c.id })}
                  />
                ))}
              </ScrollView>
            ) : null}
            <View style={[ui.between, { marginTop: 25, marginBottom: 2 }]}>
              <Text style={[ui.heading, { fontSize: 18 }]}>
                {t('notebook.saved')} <Text style={{ color: colors.tomato }}>{filtered.length}</Text>
              </Text>
              <Pressable
                accessibilityRole="button"
                testID={`map-sort-${sort}`}
                onPress={() => onPreferencesChange({ sort: sort === 'recent' ? 'name' : 'recent' })}
                style={[ui.row, { minHeight: 44, gap: 4 }]}
              >
                <Text style={ui.muted}>{t(`notebook.${sort}`)}</Text>
                <Icon name="sliders" size={14} color={colors.muted} />
              </Pressable>
            </View>
            <RequestError error={book.error} context="load" onRetry={() => void book.refresh()} />
            {!isDemo && book.total > book.state.places.length ? (
              <Text style={ui.muted}>
                {t('map.partialPlaces', { count: book.state.places.length, total: book.total })}
              </Text>
            ) : null}
            {mode === 'map' ? (
              <View style={{ gap: 16 }}>
                {isDemo ? (
                  <View style={{ height: 250, borderRadius: 22, overflow: 'hidden' }}>
                    <MapArtwork />
                    <View
                      style={{
                        position: 'absolute',
                        bottom: 16,
                        left: 16,
                        right: 16,
                        backgroundColor: colors.paper,
                        padding: 14,
                        borderRadius: 12,
                      }}
                    >
                      <Text style={ui.muted}>{t('notebook.demoMap')}</Text>
                    </View>
                  </View>
                ) : (
                  <MapCanvas
                    places={filtered}
                    onSelectPlace={(id) => {
                      const p = filtered.find((item) => item.savedId === id);
                      if (p) onPlace(p);
                    }}
                  />
                )}
                <Action
                  label={t('notebook.listView')}
                  secondary
                  onPress={() => onPreferencesChange({ mode: 'list' })}
                  icon="list"
                />
              </View>
            ) : null}
          </>
        }
        renderItem={renderPlace}
        ListEmptyComponent={
          mode === 'list' && !book.loading ? (
            <Empty
              title={t(hasFilters ? 'notebook.filteredEmptyTitle' : 'notebook.emptyTitle')}
              body={t(hasFilters ? 'notebook.filteredEmptyBody' : 'notebook.emptyBody')}
              action={hasFilters ? <Action testID="map-clear-filters" secondary label={t('notebook.clearFilters')} onPress={clearFilters} /> : <Action label={t('map.addPlace')} onPress={onAdd} icon="plus" />}
            />
          ) : null
        }
      />
      {regionOpen ? (
        <RegionPickerSheet places={book.state.places} value={region} hint={t('regions.savedHint')}
          onClose={() => setRegionOpen(false)} onSelect={(id) => { onRegionChange(id); setRegionOpen(false); }} />
      ) : null}
    </View>
  );
}
