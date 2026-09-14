import { useCallback, useMemo, useState } from 'react';
import { FlatList, Keyboard, Pressable, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { buildRegionOptions, copyAsPrivate, searchCatalog, type NotebookPlace } from '@live-to-eat/domain';
import { Sheet } from '@/components/ui/Sheet';
import { Action, Chip, Empty, Notice, ui } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { colors } from '@/components/tokens';
import { RegionButton } from '@/features/regions/RegionButton';
import { RegionPickerSheet } from '@/features/regions/RegionPickerSheet';
import { FoodArtwork } from '@/components/ui/Artwork';
import { demoCatalog } from './demoData';
import { artKind } from './placeAppearance';

const regions = buildRegionOptions(demoCatalog);
export function SearchSheet({
  onClose,
  onPick,
  savedIds,
  initialRegion = 'kr',
}: {
  onClose: () => void;
  onPick: (p: NotebookPlace) => void;
  savedIds: string[];
  initialRegion?: string;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<string | null>(null);
  const [region, setRegion] = useState(() =>
    regions.some((r) => r.id === initialRegion) ? initialRegion : 'kr',
  );
  const [choosingRegion, setChoosingRegion] = useState(false);
  const [invalidQuery, setInvalidQuery] = useState(false);
  const saved = useMemo(() => new Set(savedIds), [savedIds]);
  const results = searchCatalog(demoCatalog, search ?? '', region);
  const selectedRegion = regions.find((r) => r.id === region);
  const regionLabel =
    region === 'kr'
      ? t('regions.nationwide')
      : (selectedRegion?.path
          .slice(1)
          .map((p) => p.label)
          .join(' · ') ?? t('regions.unknown'));
  const submit = (text: string) => {
    const value = text.trim();
    setInvalidQuery(value.length < 2);
    if (value.length >= 2) { Keyboard.dismiss(); setSearch(value); }
  };
  const renderPlace = useCallback(
    ({ item }: { item: NotebookPlace }) => (
      <SearchResult place={item} saved={saved.has(item.savedId)} onPick={onPick} />
    ),
    [saved, onPick],
  );

  if (choosingRegion)
    return (
      <RegionPickerSheet
        places={demoCatalog}
        value={region}
        rootId="kr"
        hint={t('regions.catalogHint')}
        onClose={() => setChoosingRegion(false)}
        onSelect={(id) => {
          setRegion(id);
          setChoosingRegion(false);
        }}
      />
    );

  return (
    <Sheet
      title={t('placeSearch.title')}
      subtitle={t('search.demoHint')}
      onClose={onClose}
      scrollable={false}
    >
      <FlatList
        data={results}
        keyExtractor={(p) => p.savedId}
        renderItem={renderPlace}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
        ListHeaderComponent={
          <View style={{ gap: 18, paddingBottom: 18 }}>
            <View
              style={[
                ui.row,
                {
                  backgroundColor: colors.paper,
                  borderWidth: 1,
                  borderColor: colors.rule,
                  borderRadius: 15,
                  paddingLeft: 14,
                },
              ]}
            >
              <Icon name="search" color={colors.muted} />
              <TextInput
                accessibilityLabel={t('placeSearch.placeholder')}
                testID="place-search-query"
                value={query}
                onChangeText={(value) => {
                  setQuery(value);
                  setInvalidQuery(false);
                }}
                onSubmitEditing={() => submit(query)}
                returnKeyType="search"
                maxLength={200}
                placeholder={t('placeSearch.placeholder')}
                placeholderTextColor={colors.muted}
                style={{ minHeight: 54, flex: 1, minWidth: 0, color: colors.ink, fontSize: 15 }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('placeSearch.search')}
                testID="place-search-submit"
                onPress={() => submit(query)}
                style={{ padding: 15, minHeight: 48 }}
              >
                <Icon name="arrow" color={colors.tomato} />
              </Pressable>
            </View>
            <View style={{ backgroundColor: colors.sage, padding: 16, borderRadius: 16, gap: 4 }}>
              <RegionButton label={regionLabel} onPress={() => setChoosingRegion(true)} />
              <Text style={ui.muted}>
                {t(region === 'kr' ? 'search.scopeNationwide' : 'search.scopeRegion', {
                  region: regionLabel,
                })}
              </Text>
            </View>
            {invalidQuery ? <Notice>{t('placeSearch.queryHint')}</Notice> : null}
            {search === null ? (
              <View style={{ gap: 12 }}>
                <Text style={ui.label}>{t('search.try')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {['서울', '부산', '제주', '커피'].map((word) => (
                    <Chip
                      key={word}
                      label={word}
                      onPress={() => {
                        setQuery(word);
                        submit(word);
                      }}
                    />
                  ))}
                </View>
              </View>
            ) : (
              <Text style={ui.muted}>{t('search.queryResults', { query: search })}</Text>
            )}
            <Text accessibilityRole="header" style={ui.heading}>
              {t(search === null ? 'search.samples' : 'placeSearch.results')}{' '}
              <Text style={{ color: colors.tomato }}>{results.length}</Text>
            </Text>
          </View>
        }
        ListEmptyComponent={
          <Empty
            title={t('search.empty')}
            body={t('search.emptyHint')}
            action={
              region !== 'kr' ? (
                <Action secondary label={t('search.tryNationwide')} onPress={() => setRegion('kr')} />
              ) : (
                <Action
                  secondary
                  label={t('common.clear')}
                  onPress={() => {
                    setQuery('');
                    setSearch(null);
                    setInvalidQuery(false);
                  }}
                />
              )
            }
          />
        }
      />
    </Sheet>
  );
}

function SearchResult({
  place,
  saved,
  onPick,
}: {
  place: NotebookPlace;
  saved: boolean;
  onPick: (p: NotebookPlace) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      testID={`search-result-${place.savedId}`}
      onPress={() => { Keyboard.dismiss(); onPick(copyAsPrivate(place, place.savedId)); }}
      style={[ui.row, { gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderColor: colors.rule }]}
    >
      <FoodArtwork kind={artKind(place)} size={64} />
      <View style={{ flex: 1, gap: 5 }}>
        <Text style={[ui.body, { fontWeight: '700' }]}>{place.displayName}</Text>
        <Text style={ui.muted}>{place.regionPath.map((r) => r.label).join(' · ')}</Text>
        <Text style={[ui.muted, { fontSize: 11 }]}>{place.tags.join(' · ')}</Text>
      </View>
      <Icon name={saved ? 'check' : 'plus'} color={saved ? colors.success : colors.ink} size={20} />
    </Pressable>
  );
}
