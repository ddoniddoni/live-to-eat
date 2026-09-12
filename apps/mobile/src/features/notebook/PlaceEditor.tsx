import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { parseTags, type NotebookPlace } from '@live-to-eat/domain';
import { colors } from '@/components/tokens';
import { FoodArtwork } from '@/components/ui/Artwork';
import { Icon } from '@/components/ui/Icon';
import { Action, Chip, Field, Notice, ui } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/Sheet';
import { artKind } from './placeAppearance';

type Props = {
  place: NotebookPlace;
  collections: { id: string; name: string }[];
  isNew?: boolean;
  allowFolderEdit: boolean;
  onClose: () => void;
  onSave: (p: NotebookPlace) => Promise<void>;
  onDelete?: () => Promise<void>;
};
export function PlaceEditor({
  place,
  collections,
  isNew = false,
  allowFolderEdit,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(place);
  const [tags, setTags] = useState(() => place.tags.join(', '));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [confirm, setConfirm] = useState<'discard' | 'delete' | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(place) || tags !== place.tags.join(', ');
  const close = () => {
    if (busy) return;
    if (dirty) setConfirm('discard');
    else onClose();
  };
  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      await onSave({
        ...draft,
        tags: parseTags(tags),
        isRecommended: draft.visitStatus === 'visited' && draft.isRecommended,
      });
      onClose();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!onDelete || busy) return;
    setBusy(true);
    try {
      await onDelete();
      onClose();
    } catch {
      setError(true);
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      title={t(isNew ? 'editor.addTitle' : 'editor.title')}
      onClose={close}
      footer={
        confirm ? (
          <View style={{ padding: 20, backgroundColor: colors.blush, borderRadius: 18, gap: 14 }}>
            <Text accessibilityRole="alert" style={ui.heading}>
              {t(`editor.${confirm}Title`)}
            </Text>
            <Text style={ui.muted}>{t(`editor.${confirm}Body`)}</Text>
            <Action
              label={t(`editor.${confirm}Confirm`)}
              danger
              busy={busy}
              onPress={confirm === 'delete' ? () => void remove() : onClose}
            />
            <Action label={t('common.cancel')} secondary onPress={() => setConfirm(null)} />
          </View>
        ) : (
          <Action
            label={t(isNew ? 'editor.saveNew' : 'editor.save')}
            onPress={() => void save()}
            busy={busy}
            icon={isNew ? 'plus' : 'check'}
          />
        )
      }
    >
      <View style={[ui.row, { gap: 17 }]}>
        <FoodArtwork kind={artKind(place)} size={92} />
        <View style={{ flex: 1, gap: 7 }}>
          <Text style={[ui.heading, { fontSize: 22 }]}>{place.displayName}</Text>
          <Text style={ui.muted}>{place.address}</Text>
          {place.savedId.startsWith('demo-') ? (
            <Text style={[ui.muted, { fontSize: 11 }]}>{t('common.samplePlace')}</Text>
          ) : null}
        </View>
      </View>
      <View>
        <Text style={ui.label}>{t('placeSearch.visitStatus')}</Text>
        <View style={ui.row}>
          {(['want', 'visited'] as const).map((v) => (
            <Chip
              key={v}
              label={t(`placeSearch.${v}`)}
              selected={draft.visitStatus === v}
              onPress={() =>
                setDraft((d) => ({ ...d, visitStatus: v, isRecommended: v === 'visited' && d.isRecommended }))
              }
            />
          ))}
        </View>
      </View>
      <View style={ui.between}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={ui.label}>{t('savedPlaces.recommended')}</Text>
          <Text style={ui.muted}>{t('savedPlaces.recommendedHint')}</Text>
        </View>
        <Switch
          accessibilityLabel={t('savedPlaces.recommended')}
          disabled={draft.visitStatus !== 'visited'}
          value={draft.isRecommended}
          onValueChange={(value) => setDraft((d) => ({ ...d, isRecommended: value }))}
          trackColor={{ false: colors.rule, true: colors.tomato }}
        />
      </View>
      <Field
        label={t('placeSearch.note')}
        multiline
        maxLength={2000}
        value={draft.note}
        onChangeText={(note) => setDraft((d) => ({ ...d, note }))}
        placeholder={t('placeSearch.notePlaceholder')}
      />
      <View style={[ui.row, { marginTop: -12 }]}>
        <Icon name="lock" size={13} color={colors.muted} />
        <Text style={ui.muted}>{t('editor.privateNote')}</Text>
      </View>
      <Field
        label={t('placeSearch.tags')}
        value={tags}
        onChangeText={setTags}
        maxLength={1200}
        placeholder={t('placeSearch.tagsPlaceholder')}
      />
      {allowFolderEdit ? (
        <View>
          <Text style={ui.label}>{t('placeSearch.collection')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
            <Chip
              label={t('placeSearch.noCollection')}
              selected={!draft.collectionId}
              onPress={() => setDraft((d) => ({ ...d, collectionId: null, collectionName: null }))}
            />
            {collections.map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                selected={draft.collectionId === c.id}
                onPress={() => setDraft((d) => ({ ...d, collectionId: c.id, collectionName: c.name }))}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}
      {!isNew ? (
        <>
          <View style={ui.divider} />
          <View>
            <Text style={ui.label}>{t('editor.visibility')}</Text>
            <View style={{ gap: 9 }}>
              {(['private', 'unlisted', 'public'] as const).map((v) => (
                <Pressable
                  key={v}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: draft.visibility === v }}
                  onPress={() => setDraft((d) => ({ ...d, visibility: v }))}
                  style={[
                    ui.row,
                    {
                      padding: 15,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: draft.visibility === v ? colors.ink : colors.rule,
                      backgroundColor: colors.paper,
                    },
                  ]}
                >
                  <Icon name={v === 'private' ? 'lock' : v === 'unlisted' ? 'link' : 'globe'} size={20} />
                  <View style={{ flex: 1 }}>
                    <Text style={[ui.body, { fontWeight: '600' }]}>{t(`editor.${v}`)}</Text>
                    <Text style={ui.muted}>{t(`editor.${v}Hint`)}</Text>
                  </View>
                  {draft.visibility === v ? <Icon name="check" size={18} /> : null}
                </Pressable>
              ))}
            </View>
          </View>
          {draft.visibility !== 'private' ? (
            <Field
              label={t('editor.publicNote')}
              value={draft.publicNote}
              onChangeText={(publicNote) => setDraft((d) => ({ ...d, publicNote }))}
              maxLength={280}
              multiline
              placeholder={t('editor.publicNoteHint')}
            />
          ) : null}
        </>
      ) : (
        <View style={[ui.row, { backgroundColor: colors.sage, padding: 16, borderRadius: 14 }]}>
          <Icon name="lock" size={20} />
          <Text style={[ui.muted, { flex: 1, color: colors.ink }]}>{t('editor.defaultPrivate')}</Text>
        </View>
      )}
      {error ? <Notice>{t('common.saveError')}</Notice> : null}
      {onDelete ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setConfirm('delete')}
          style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center' }}
        >
          <Text style={{ color: colors.tomato, fontSize: 14 }}>{t('savedPlaces.delete')}</Text>
        </Pressable>
      ) : null}
    </Sheet>
  );
}
