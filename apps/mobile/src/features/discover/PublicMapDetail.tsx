import { useCallback, useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { copyAsPrivate, type NotebookPlace } from '@live-to-eat/domain';
import { useRequest } from '@/lib/requests/useRequest';
import { RequestError } from '@/components/ui/RequestError';
import { colors } from '@/components/tokens';
import { Icon } from '@/components/ui/Icon';
import { Action, Notice, ui } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/Sheet';
import { demoCatalog, demoPeople } from '@/features/notebook/demoData';
import type { NotebookController } from '@/features/notebook/useNotebook';
import type { ReportTarget } from '@/features/safety/reportForm';
import { publicPlacesInRegion } from './discoverRegions';
import { copyPublicPlace, loadPublicMap } from './publicMapApi';
import type { PublicMapPerson } from './PublicMapCard';
import { PublicPlaceRow } from './PublicPlaceRow';

export function PublicMapDetail({
  person,
  book,
  isDemo,
  region,
  onClose,
  onSaved,
  onReport,
}: {
  person: PublicMapPerson;
  book: NotebookController;
  isDemo: boolean;
  region: string;
  onClose: () => void;
  onSaved: () => void;
  onReport: (target: ReportTarget) => void;
}) {
  const { t, i18n } = useTranslation();
  const [savingId, setSavingId] = useState<string | null>(null);
  const request = useRequest();
  const busy = request.busy ? savingId : null;
  const [copied, setCopied] = useState<string[]>([]);
  const [blockConfirm, setBlockConfirm] = useState(false);
  const language = i18n.language.startsWith('ko') ? 'ko' : 'en';
  const snapshot = useQuery({
    queryKey: ['public-map', person.handle, language],
    queryFn: () => loadPublicMap({ handle: person.handle, languageCode: language }),
    enabled: !isDemo,
    staleTime: 0,
  });
  const ownedPlaces = book.state.places;
  const ownedIds = useMemo(() => new Set(ownedPlaces.map((place) => place.savedId)), [ownedPlaces]);
  const copiedIds = useMemo(() => new Set(copied), [copied]);
  const places = useMemo<NotebookPlace[]>(() => {
    if (isDemo) {
      const ids = demoPeople.find((p) => p.handle === person.handle)?.ids ?? [];
      return publicPlacesInRegion(demoCatalog, ids, region)
        .map((p) => Object.assign(copyAsPrivate(p, p.savedId), { publicNote: t('explore.sampleNote') }));
    }
    return (snapshot.data?.places ?? []).map((p) => ({
      savedId: p.sourceSavedId, displayName: p.displayName, address: p.address,
      coordinate: p.coordinate, publicNote: p.publicNote ?? '', collectionId: null, collectionName: null,
      note: '', tags: [], visitStatus: 'want', visibility: 'public', isRecommended: false, regionPath: [], version: 1,
    }));
  }, [isDemo, person.handle, region, snapshot.data?.places, t]);
  const { upsert, refresh } = book;
  const run = request.run;
  const save = useCallback(async (place: NotebookPlace) => {
    await run(async () => {
      setSavingId(place.savedId);
      if (isDemo) {
        if (!ownedPlaces.some((p) => p.savedId === place.savedId))
          await upsert(copyAsPrivate(place, place.savedId));
      } else {
        await copyPublicPlace(place.savedId);
        if (!await refresh()) throw new Error('REFRESH_FAILED');
      }
    }, () => {
      setCopied((v) => [...v, place.savedId]);
      onSaved();
    });
  }, [run, isDemo, ownedPlaces, upsert, refresh, onSaved]);
  const reportPlace = useCallback((place: NotebookPlace) => onReport({ kind: 'saved-place',
    handle: person.handle, displayName: person.displayName, savedId: place.savedId, placeName: place.displayName,
  }), [onReport, person.handle, person.displayName]);
  const renderPlace = useCallback(({ item, index }: { item: NotebookPlace; index: number }) => (
    <PublicPlaceRow place={item} index={index} saved={copiedIds.has(item.savedId) || (isDemo && ownedIds.has(item.savedId))}
      disabled={busy !== null} busy={busy === item.savedId} onSave={save} onReport={reportPlace} />
  ), [copiedIds, isDemo, ownedIds, busy, save, reportPlace]);
  return (
    <Sheet
      title={`${person.displayName}${t('explore.personMap')}`}
      subtitle={`@${person.handle}`}
      onClose={onClose}
      busy={request.busy}
      scrollable={false}
      contentKey={request.error ?? 'public'}
    >
      <FlatList
        testID="public-place-list"
        key={request.error ?? 'public'}
        data={places}
        keyExtractor={(place) => place.savedId}
        renderItem={renderPlace}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews={false}
        contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={<View style={{ gap: 22, marginBottom: 22 }}>
          <RequestError error={request.error} />
          <PublicMapIntro person={person} region={region} isDemo={isDemo} />
          {snapshot.isError && !isDemo ? <Notice>{t('discover.copyError')}</Notice> : null}
          {snapshot.isError && !isDemo ? (
            <Action label={t('common.retry')} onPress={() => void snapshot.refetch()} />
          ) : null}
          {snapshot.isLoading && !isDemo ? <Text style={ui.muted}>{t('discover.loadingMap')}</Text> : null}
        </View>}
        ListFooterComponent={<View style={{ gap: 22 }}>
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
                      void request.run(() => book.update((b) => ({ ...b,
                        blockedHandles: [...new Set([...b.blockedHandles, person.handle])] }), 'settings'), onClose);
                    }}
                  />
                  <Action secondary label={t('common.cancel')} onPress={() => setBlockConfirm(false)} />
                </View>
              ) : null}
            </>
          ) : null}
        </View>}
      />
    </Sheet>
  );
}

function PublicMapIntro({ person, region, isDemo }: { person: PublicMapPerson; region: string; isDemo: boolean }) {
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
