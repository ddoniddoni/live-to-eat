import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FlatList, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { buildRegionOptions } from '@live-to-eat/domain';
import { colors } from '@/components/tokens';
import { Icon } from '@/components/ui/Icon';
import { Action, Empty, Notice, ui } from '@/components/ui/primitives';
import { demoCatalog, demoPeople } from '@/features/notebook/demoData';
import type { NotebookController } from '@/features/notebook/useNotebook';
import { ReportSheet } from '@/features/safety/ReportSheet';
import type { ReportTarget } from '@/features/safety/reportForm';
import { RegionButton } from '@/features/regions/RegionButton';
import { RegionPickerSheet } from '@/features/regions/RegionPickerSheet';
import { countPublicPlacesByPerson } from './discoverRegions';
import { loadDiscoverablePublicMaps } from './publicMapApi';
import { PublicMapCard, type PublicMapPerson } from './PublicMapCard';
import { PublicMapDetail } from './PublicMapDetail';

export function DiscoverScreen({
  book,
  isDemo,
  region,
  onRegionChange,
  onSaved,
}: {
  book: NotebookController;
  isDemo: boolean;
  region: string;
  onRegionChange: (region: string) => void;
  onSaved: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState('');
  const [choosingRegion, setChoosingRegion] = useState(false);
  const [selected, setSelected] = useState<PublicMapPerson | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const language = i18n.language.startsWith('ko') ? 'ko' : 'en';
  const maps = useQuery({
    queryKey: ['discover', language, isDemo],
    queryFn: () => loadDiscoverablePublicMaps(language),
    enabled: !isDemo,
  });
  const demoSummaries = useMemo(() => countPublicPlacesByPerson(demoCatalog, demoPeople, region), [region]);
  const people = isDemo ? demoSummaries : maps.data;
  const visible = useMemo(() => {
    const blocked = new Set(book.state.blockedHandles);
    const search = query.toLocaleLowerCase();
    return (people ?? []).filter((person) => !blocked.has(person.handle) && person.publicPlaceCount > 0 &&
      `${person.displayName} ${person.handle} ${person.bio}`.toLocaleLowerCase().includes(search));
  }, [people, book.state.blockedHandles, query]);
  const publicCatalog = useMemo(() => {
    const blocked = new Set(book.state.blockedHandles);
    const publicIds = new Set<string>(demoPeople.filter((p) => !blocked.has(p.handle)).flatMap((p) => Array.from(p.ids)));
    return demoCatalog.filter((place) => publicIds.has(place.savedId));
  }, [book.state.blockedHandles]);
  const regionOptions = useMemo(() => buildRegionOptions(publicCatalog), [publicCatalog]);
  const regionLabel = region === 'kr' ? t('regions.nationwide') : regionOptions.find((r) => r.id === region)?.path.slice(1).map((p) => p.label).join(' · ') ?? t('regions.unknown');
  const renderPerson = useCallback(({ item, index }: { item: PublicMapPerson; index: number }) => (
    <PublicMapCard person={item} index={index} isDemo={isDemo} regional={isDemo && region !== 'kr'}
      regionLabel={regionLabel} onSelect={setSelected} />
  ), [isDemo, region, regionLabel]);
  return (
    <>
      <FlatList
        testID="discover-list"
        data={visible}
        keyExtractor={(person) => person.handle}
        renderItem={renderPerson}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 24, paddingBottom: 110 }}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={CardGap}
        ListHeaderComponent={<View style={{ gap: 21, marginBottom: 21 }}>
          <View style={[ui.between, { paddingTop: 8 }]}>
            <Text style={{ flex: 1, fontSize: 12, color: colors.tomato, fontWeight: '700', letterSpacing: 1.5 }}>
              PEOPLE, PLACES & TASTE
            </Text>
            <Icon name="compass" color={colors.tomato} />
          </View>
          <View style={{ gap: 10 }}>
            <Text accessibilityRole="header" style={[ui.title, { fontSize: 32, lineHeight: 43 }]}>
              {t('explore.title')}
            </Text>
            <Text style={ui.muted}>{t('explore.subtitle')}</Text>
          </View>
          <View
            style={[
              ui.row,
              {
                backgroundColor: colors.paper,
                borderWidth: 1,
                borderColor: colors.rule,
                borderRadius: 15,
                paddingHorizontal: 14,
              },
            ]}
          >
            <Icon name="search" size={20} color={colors.muted} />
            <TextInput
              testID="discover-search"
              accessibilityLabel={t('explore.search')}
              value={query}
              onChangeText={setQuery}
              placeholder={t('explore.search')}
              placeholderTextColor={colors.muted}
              style={{ minHeight: 50, flex: 1, fontSize: 14, color: colors.ink }}
            />
          </View>
          {isDemo ? (
            <View style={{ backgroundColor: colors.sage, borderRadius: 16, padding: 16, gap: 4 }}>
              <RegionButton label={regionLabel} onPress={() => setChoosingRegion(true)} />
              <Text style={ui.muted}>{t('discover.regionHint')}</Text>
            </View>
          ) : null}
          <View style={ui.between}>
            <Text style={ui.heading}>{t('explore.maps')}</Text>
            <Text style={ui.muted}>{t('discover.peopleCount', { count: visible.length })}</Text>
          </View>
          {maps.isError && !isDemo ? (
            <>
              <Notice>{t('discover.loadError')}</Notice>
              <Action label={t('common.retry')} onPress={() => void maps.refetch()} />
            </>
          ) : null}
          {maps.isLoading && !isDemo ? <Text style={ui.muted}>{t('discover.loading')}</Text> : null}
        </View>}
        ListEmptyComponent={
        !maps.isLoading ? (
          <Empty title={t('explore.empty')} body={t('explore.emptyHint')}
            action={isDemo && region !== 'kr' ? <Action secondary label={t('regions.showNationwide')} onPress={() => onRegionChange('kr')} /> : undefined} />
        ) : null
        }
        ListFooterComponent={<View style={[ui.row, { padding: 16, gap: 12 }]}>
          <Icon name="lock" color={colors.muted} size={17} />
          <Text style={[ui.muted, { flex: 1, fontSize: 12 }]}>{t('explore.privacy')}</Text>
        </View>}
      />
      {choosingRegion ? <RegionPickerSheet places={publicCatalog} value={region} rootId="kr" hint={t('regions.publicHint')}
        onClose={() => setChoosingRegion(false)} onSelect={(id) => { onRegionChange(id); setChoosingRegion(false); }} /> : null}
      {selected && !reportTarget ? (
        <PublicMapDetail
          key={selected.handle}
          person={selected}
          book={book}
          isDemo={isDemo}
          region={region}
          onClose={() => setSelected(null)}
          onSaved={onSaved}
          onReport={setReportTarget}
        />
      ) : null}
      {reportTarget ? <ReportSheet target={reportTarget} onClose={() => setReportTarget(null)} /> : null}
    </>
  );
}

function CardGap() { return <View style={{ height: 21 }} />; }
