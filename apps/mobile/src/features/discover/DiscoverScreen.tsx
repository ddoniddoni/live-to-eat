import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { buildRegionOptions, copyAsPrivate, type NotebookPlace } from '@live-to-eat/domain';
import { colors } from '@/components/tokens';
import { FoodArtwork } from '@/components/ui/Artwork';
import { Icon } from '@/components/ui/Icon';
import { Action, Empty, Notice, ui } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/Sheet';
import { demoCatalog, demoPeople } from '@/features/notebook/demoData';
import type { NotebookController } from '@/features/notebook/useNotebook';
import { ReportSheet } from '@/features/safety/ReportSheet';
import type { ReportTarget } from '@/features/safety/reportForm';
import { RegionButton } from '@/features/regions/RegionButton';
import { RegionPickerSheet } from '@/features/regions/RegionPickerSheet';
import { publicPlacesInRegion } from './discoverRegions';
import {
  copyPublicPlace,
  loadDiscoverablePublicMaps,
  loadPublicMap,
  type PublicMapSummary,
} from './publicMapApi';

type Person = PublicMapSummary & { regionLabel?: string; region?: string; theme?: string };
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
  const [selected, setSelected] = useState<Person | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const language = i18n.language.startsWith('ko') ? 'ko' : 'en';
  const maps = useQuery({
    queryKey: ['discover', language, isDemo],
    queryFn: () => loadDiscoverablePublicMaps(language),
    enabled: !isDemo,
  });
  const people: Person[] = isDemo
    ? demoPeople.map((p) => ({ ...p, publicPlaceCount: publicPlacesInRegion(demoCatalog, p.ids, region).length }))
    : (maps.data ?? []);
  const blockedHandles = new Set(book.state.blockedHandles);
  const visible = people.filter(
    (p) =>
      !blockedHandles.has(p.handle) &&
      p.publicPlaceCount > 0 &&
      `${p.displayName} ${p.handle} ${p.bio}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const publicCatalog = useMemo(() => {
    const blocked = new Set(book.state.blockedHandles);
    const publicIds = new Set<string>(demoPeople.filter((p) => !blocked.has(p.handle)).flatMap((p) => Array.from(p.ids)));
    return demoCatalog.filter((place) => publicIds.has(place.savedId));
  }, [book.state.blockedHandles]);
  const regionOptions = useMemo(() => buildRegionOptions(publicCatalog), [publicCatalog]);
  const regionLabel = region === 'kr' ? t('regions.nationwide') : regionOptions.find((r) => r.id === region)?.path.slice(1).map((p) => p.label).join(' · ') ?? t('regions.unknown');
  return (
    <>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 24, paddingBottom: 110, gap: 21 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[ui.between, { paddingTop: 8 }]}>
          <Text style={{ fontSize: 12, color: colors.tomato, fontWeight: '700', letterSpacing: 1.5 }}>
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
        {visible.map((person, index) => (
          <Pressable
            accessibilityRole="button"
            key={person.handle}
            onPress={() => setSelected(person)}
            style={({ pressed }) => ({
              backgroundColor: colors.paper,
              borderWidth: 1,
              borderColor: colors.rule,
              borderRadius: 24,
              overflow: 'hidden',
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <View
              style={{
                backgroundColor:
                  index % 3 === 0 ? colors.blush : index % 3 === 1 ? colors.sage : colors.lavender,
                padding: 22,
                minHeight: 157,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <View style={{ flex: 1, gap: 12 }}>
                <View style={[ui.row, { gap: 4 }]}>
                  <Icon name="pin" size={12} color={colors.muted} />
                  <Text style={{ fontSize: 11, color: colors.muted }}>
                    {isDemo && region !== 'kr' ? regionLabel : person.regionLabel ?? t('explore.publicMap')}
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 23,
                    lineHeight: 32,
                    fontWeight: '700',
                    letterSpacing: -0.8,
                    color: colors.ink,
                  }}
                >
                  {person.bio || t('explore.defaultBio')}
                </Text>
              </View>
              <View style={{ transform: [{ rotate: index % 2 === 0 ? '12deg' : '-12deg' }] }}>
                <FoodArtwork kind={index} size={94} />
              </View>
            </View>
            <View style={[ui.between, { padding: 18 }]}>
              <View style={ui.row}>
                <View
                  style={{
                    height: 40,
                    width: 40,
                    borderRadius: 20,
                    backgroundColor: colors.sage,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink }}>
                    {person.displayName.slice(0, 1)}
                  </Text>
                </View>
                <View style={{ gap: 3 }}>
                  <Text style={[ui.body, { fontWeight: '700', fontSize: 14 }]}>
                    {person.displayName}
                    {t('explore.personMap')}
                  </Text>
                  <Text style={[ui.muted, { fontSize: 11 }]}>
                    {t(isDemo && region !== 'kr' ? 'discover.regionPlaceCount' : 'discover.placeCount', { count: person.publicPlaceCount })}
                    {isDemo ? ` · ${t('common.demo')}` : ''}
                  </Text>
                </View>
              </View>
              <Icon name="arrow" size={20} />
            </View>
          </Pressable>
        ))}
        {!visible.length && !maps.isLoading ? (
          <Empty title={t('explore.empty')} body={t('explore.emptyHint')}
            action={isDemo && region !== 'kr' ? <Action secondary label={t('regions.showNationwide')} onPress={() => onRegionChange('kr')} /> : undefined} />
        ) : null}
        <View style={[ui.row, { padding: 16, gap: 12 }]}>
          <Icon name="lock" color={colors.muted} size={17} />
          <Text style={[ui.muted, { flex: 1, fontSize: 12 }]}>{t('explore.privacy')}</Text>
        </View>
      </ScrollView>
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
function PublicMapDetail({
  person,
  book,
  isDemo,
  region,
  onClose,
  onSaved,
  onReport,
}: {
  person: Person;
  book: NotebookController;
  isDemo: boolean;
  region: string;
  onClose: () => void;
  onSaved: () => void;
  onReport: (target: ReportTarget) => void;
}) {
  const { t, i18n } = useTranslation();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState<string[]>([]);
  const [blockConfirm, setBlockConfirm] = useState(false);
  const language = i18n.language.startsWith('ko') ? 'ko' : 'en';
  const snapshot = useQuery({
    queryKey: ['public-map', person.handle, language],
    queryFn: () => loadPublicMap({ handle: person.handle, languageCode: language }),
    enabled: !isDemo,
    staleTime: 0,
  });
  const ids = isDemo
    ? (demoPeople.find((p) => p.handle === person.handle)?.ids as readonly string[] | undefined)
    : undefined;
  const ownedIds = new Set(book.state.places.map(p => p.savedId));
  const copiedIds = new Set(copied);
  const places: NotebookPlace[] = isDemo
    ? publicPlacesInRegion(demoCatalog, ids ?? [], region)
        .map((p) => Object.assign(copyAsPrivate(p, p.savedId), { publicNote: t('explore.sampleNote') }))
    : (snapshot.data?.places ?? []).map((p) => ({
        savedId: p.sourceSavedId,
        displayName: p.displayName,
        address: p.address,
        coordinate: p.coordinate,
        publicNote: p.publicNote ?? '',
        collectionId: null,
        collectionName: null,
        note: '',
        tags: [],
        visitStatus: 'want',
        visibility: 'public',
        isRecommended: false,
        regionPath: [],
        version: 1,
      }));
  const save = async (place: NotebookPlace) => {
    if (busy) return;
    setBusy(place.savedId);
    setError(false);
    try {
      if (isDemo) {
        if (!book.state.places.some((p) => p.savedId === place.savedId))
          book.upsert(copyAsPrivate(place, place.savedId));
      } else {
        await copyPublicPlace(place.savedId);
        await book.refresh();
      }
      setCopied((v) => [...v, place.savedId]);
      onSaved();
    } catch {
      setError(true);
    } finally {
      setBusy(null);
    }
  };
  return (
    <Sheet
      title={`${person.displayName}${t('explore.personMap')}`}
      subtitle={`@${person.handle}`}
      onClose={onClose}
    >
      <PublicMapIntro person={person} region={region} isDemo={isDemo} />
      {error || (snapshot.isError && !isDemo) ? <Notice>{t('discover.copyError')}</Notice> : null}
      {snapshot.isError && !isDemo ? (
        <Action label={t('common.retry')} onPress={() => void snapshot.refetch()} />
      ) : null}
      {snapshot.isLoading && !isDemo ? <Text style={ui.muted}>{t('discover.loadingMap')}</Text> : null}
      {places.map((p, index) => {
        const saved =
          copiedIds.has(p.savedId) || (isDemo && ownedIds.has(p.savedId));
        return (
          <View
            key={p.savedId}
            style={{ gap: 13, borderBottomWidth: 1, borderColor: colors.rule, paddingBottom: 22 }}
          >
            <View style={ui.row}>
              <FoodArtwork kind={index} size={64} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[ui.body, { fontWeight: '700' }]}>{p.displayName}</Text>
                <Text style={ui.muted}>{p.address}</Text>
              </View>
            </View>
            {p.publicNote ? <Text style={ui.body}>{p.publicNote}</Text> : null}
            <Action
              label={t(saved ? 'discover.copied' : 'discover.copyToMap')}
              icon={saved ? 'check' : 'plus'}
              secondary
              disabled={saved || busy !== null}
              busy={busy === p.savedId}
              onPress={() => void save(p)}
            />
            <Pressable accessibilityRole="button" accessibilityLabel={t('report.placeActionLabel', { place: p.displayName })}
              onPress={() => onReport({ kind: 'saved-place', handle: person.handle, displayName: person.displayName, savedId: p.savedId, placeName: p.displayName })}
              style={({ pressed }) => ({ minHeight: 44, alignSelf: 'flex-end', justifyContent: 'center', opacity: pressed ? 0.65 : 1 })}>
              <Text style={ui.muted}>{t('report.placeAction')}</Text>
            </Pressable>
          </View>
        );
      })}
      <Text style={ui.muted}>{t('explore.copyHint')}</Text>
      <Action secondary label={t('report.profileAction')} icon="shield"
        onPress={() => onReport({ kind: 'profile', handle: person.handle, displayName: person.displayName })} />
      {isDemo ? (
        <>
          <Action secondary label={t('explore.block')} icon="shield" onPress={() => setBlockConfirm(true)} />
          {blockConfirm ? (
            <View style={{ gap: 12 }}>
              <Notice>{t('explore.blockHint')}</Notice>
              <Action
                danger
                label={t('explore.blockConfirm')}
                onPress={() => {
                  book.update((b) => ({ ...b, blockedHandles: [...b.blockedHandles, person.handle] }));
                  onClose();
                }}
              />
              <Action secondary label={t('common.cancel')} onPress={() => setBlockConfirm(false)} />
            </View>
          ) : null}
        </>
      ) : null}
    </Sheet>
  );
}

function PublicMapIntro({ person, region, isDemo }: { person: Person; region: string; isDemo: boolean }) {
  const { t } = useTranslation();
  return (
    <View style={{ padding: 24, backgroundColor: colors.sage, borderRadius: 22, gap: 12 }}>
      <Icon name="map" size={28} color={colors.success} />
      <Text style={[ui.heading, { fontSize: 24, lineHeight: 33 }]}>{person.bio}</Text>
      <Text style={ui.muted}>
        {t(isDemo && region !== 'kr' ? 'discover.regionPlaceCount' : 'discover.placeCount', { count: person.publicPlaceCount })}
      </Text>
    </View>
  );
}
