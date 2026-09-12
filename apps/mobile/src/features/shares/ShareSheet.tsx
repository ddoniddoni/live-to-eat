import { useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { inRegion, makeShareDraft, type ShareDraft } from '@live-to-eat/domain';
import { colors } from '@/components/tokens';
import { Sheet } from '@/components/ui/Sheet';
import { Action, Chip, Empty, Field, Notice, ui } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { MapArtwork } from '@/components/ui/Artwork';
import type { NotebookController } from '@/features/notebook/useNotebook';
import { PlaceCard } from '@/features/notebook/PlaceCard';

type Props = {
  book: NotebookController;
  initialRegion: string;
  isDemo: boolean;
  onClose: () => void;
  onCreated: () => void;
};
export function ShareSheet({ book, initialRegion, isDemo, onClose, onCreated }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [region, setRegion] = useState(initialRegion);
  const [ids, setIds] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [days, setDays] = useState(7);
  const [consent, setConsent] = useState(false);
  const [showAuthor, setShowAuthor] = useState(true);
  const [error, setError] = useState(false);
  const regions = [
    ...new Map(book.state.places.flatMap((p) => p.regionPath.map((r) => [r.id, r] as const))).values(),
  ];
  const regionPlaces = book.state.places.filter((p) => inRegion(p, region));
  const selectedIds = new Set(ids);
  const selected = regionPlaces.filter((p) => selectedIds.has(p.savedId));
  const privateCount = selected.filter((p) => p.visibility === 'private').length;
  const regionTitle =
    region === 'all'
      ? t('notebook.allRegions')
      : region === 'unclassified'
        ? t('map.unclassified')
        : (regions.find((r) => r.id === region)?.label ?? '');
  const create = () => {
    try {
      const now = Date.now();
      const input: Omit<ShareDraft, 'revokedAt'> = {
        id: `draft-${now}`,
        title: title.trim() || `${regionTitle} · ${t('sharing.myPlaces')}`,
        regionId: region,
        savedIds: selected.map((p) => p.savedId),
        createdAt: now,
        expiresAt: now + days * 86400000,
        showAuthor,
      };
      book.update((b) => makeShareDraft(b, input, consent));
      onCreated();
      onClose();
    } catch {
      setError(true);
    }
  };
  return (
    <Sheet
      title={t('sharing.create')}
      subtitle={t('sharing.draftHint')}
      onClose={onClose}
      footer={
        step === 2 ? (
          <>
            {!isDemo ? <Notice>{t('sharing.connectionRequired')}</Notice> : null}
            <Action
              label={t('sharing.saveDraft')}
              onPress={create}
              disabled={!isDemo || !selected.length || (privateCount > 0 && !consent)}
            />
            <Action secondary label={t('common.back')} onPress={() => setStep(1)} />
          </>
        ) : (
          <Action
            label={t(step === 0 ? 'sharing.selectPlaces' : 'sharing.preview')}
            onPress={() => setStep((s) => s + 1)}
            disabled={step === 1 && selected.length === 0}
            icon="arrow"
          />
        )
      }
    >
      <View style={ui.row}>
        {['region', 'places', 'preview'].map((s, index) => (
          <View key={s} style={{ flex: 1, gap: 8 }}>
            <View
              style={{
                height: 3,
                borderRadius: 2,
                backgroundColor: index <= step ? colors.tomato : colors.rule,
              }}
            />
            <Text
              style={{
                fontSize: 11,
                color: index === step ? colors.tomato : colors.muted,
                fontWeight: '600',
              }}
            >
              {index + 1} {t(`sharing.step_${s}`)}
            </Text>
          </View>
        ))}
      </View>
      {step === 0 ? (
        <>
          <Text style={ui.title}>{t('sharing.regionTitle')}</Text>
          <Text style={ui.muted}>{t('sharing.regionHint')}</Text>
          <Chip
            label={t('notebook.allRegions')}
            selected={region === 'all'}
            onPress={() => {
              setRegion('all');
              setIds([]);
            }}
          />
          {regions.map((r) => (
            <Chip
              key={r.id}
              label={r.label}
              selected={region === r.id}
              onPress={() => {
                setRegion(r.id);
                setIds([]);
              }}
            />
          ))}
          <Chip
            label={t('map.unclassified')}
            selected={region === 'unclassified'}
            onPress={() => {
              setRegion('unclassified');
              setIds([]);
            }}
          />
        </>
      ) : null}
      {step === 1 ? (
        <>
          <View style={ui.between}>
            <View>
              <Text style={ui.heading}>{regionTitle}</Text>
              <Text style={ui.muted}>{t('sharing.selected', { count: selected.length })}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                setIds(
                  ids.length === regionPlaces.length ? [] : regionPlaces.slice(0, 200).map((p) => p.savedId),
                )
              }
              style={{ padding: 12, minHeight: 44 }}
            >
              <Text style={{ color: colors.tomato, fontSize: 13, fontWeight: '700' }}>
                {t(ids.length === regionPlaces.length ? 'sharing.deselectAll' : 'sharing.selectAll')}
              </Text>
            </Pressable>
          </View>
          <Text style={ui.muted}>{t('sharing.snapshotHint')}</Text>
          <View>
            {regionPlaces.map((p) => (
              <PlaceCard
                key={p.savedId}
                place={p}
                selected={selectedIds.has(p.savedId)}
                onPress={() =>
                  setIds((current) =>
                    selectedIds.has(p.savedId)
                      ? current.filter((id) => id !== p.savedId)
                      : current.length < 200
                        ? [...current, p.savedId]
                        : current,
                  )
                }
              />
            ))}
          </View>
          {!regionPlaces.length ? <Empty title={t('sharing.empty')} body={t('sharing.emptyHint')} /> : null}
          <Action secondary label={t('common.back')} onPress={() => setStep(0)} />
        </>
      ) : null}
      {step === 2 ? (
        <>
          <Field
            label={t('sharing.name')}
            value={title}
            onChangeText={setTitle}
            maxLength={80}
            placeholder={`${regionTitle} · ${t('sharing.myPlaces')}`}
          />
          <View
            style={{
              borderWidth: 1,
              borderColor: colors.rule,
              borderRadius: 22,
              overflow: 'hidden',
              backgroundColor: colors.paper,
            }}
          >
            <View style={{ height: 130 }}>
              <MapArtwork />
            </View>
            <View style={{ padding: 20, gap: 16 }}>
              <Text style={ui.heading}>{title || `${regionTitle} · ${t('sharing.myPlaces')}`}</Text>
              {showAuthor ? (
                <Text style={ui.muted}>{book.state.profile.displayName || t('profile.defaultName')}</Text>
              ) : null}
              {selected.map((p) => (
                <View key={p.savedId} style={{ gap: 4 }}>
                  <Text style={[ui.body, { fontWeight: '700' }]}>{p.displayName}</Text>
                  <Text style={ui.muted}>{p.address}</Text>
                  {p.publicNote ? <Text style={ui.body}>{p.publicNote}</Text> : null}
                </View>
              ))}
            </View>
          </View>
          <View style={ui.row}>
            <Icon name="lock" size={18} color={colors.success} />
            <Text style={[ui.muted, { flex: 1 }]}>{t('sharing.privateHint')}</Text>
          </View>
          <View>
            <Text style={ui.label}>{t('sharing.expiry')}</Text>
            <View style={ui.row}>
              {[1, 7, 30].map((day) => (
                <Chip
                  key={day}
                  label={t('sharing.days', { count: day })}
                  selected={days === day}
                  onPress={() => setDays(day)}
                />
              ))}
            </View>
          </View>
          <View style={ui.between}>
            <Text style={[ui.body, { flex: 1 }]}>{t('sharing.showAuthor')}</Text>
            <Switch
              accessibilityLabel={t('sharing.showAuthor')}
              value={showAuthor}
              onValueChange={setShowAuthor}
              trackColor={{ false: colors.rule, true: colors.success }}
            />
          </View>
          {privateCount > 0 ? (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consent }}
              onPress={() => setConsent((v) => !v)}
              style={[
                ui.row,
                { padding: 18, backgroundColor: colors.blush, borderRadius: 16, alignItems: 'flex-start' },
              ]}
            >
              <View
                style={{
                  width: 23,
                  height: 23,
                  borderRadius: 7,
                  borderWidth: 1,
                  borderColor: colors.tomato,
                  backgroundColor: consent ? colors.tomato : colors.paper,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {consent ? <Icon name="check" size={17} color={colors.paper} /> : null}
              </View>
              <Text style={[ui.body, { flex: 1, fontSize: 13, lineHeight: 21 }]}>
                {t('sharing.consent', { count: privateCount })}
              </Text>
            </Pressable>
          ) : null}
          <Text style={ui.muted}>{t('sharing.forwardHint')}</Text>
          {error ? <Notice>{t('common.saveError')}</Notice> : null}
        </>
      ) : null}
    </Sheet>
  );
}
