import { useState } from 'react';
import { useRequest } from '@/lib/requests/useRequest';
import { RequestError } from '@/components/ui/RequestError';
import { Keyboard, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { parseTags, type NotebookPlace } from '@live-to-eat/domain';
import { colors } from '@/components/tokens';
import { FoodArtwork } from '@/components/ui/Artwork';
import { Icon } from '@/components/ui/Icon';
import { Action, Chip, Field, ui } from '@/components/ui/primitives';
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
  const { busy, error, run } = useRequest();
  const [confirm, setConfirm] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(place) || tags !== place.tags.join(', ');
  const save = async () => {
    await run(async () => {
      await onSave({
        ...draft,
        tags: parseTags(tags),
        isRecommended: draft.visitStatus === 'visited' && draft.isRecommended,
      });
    }, onClose);
  };
  const remove = async () => {
    if (onDelete) await run(onDelete, onClose);
  };
  if (confirm)
    return (
      <Sheet title={t('editor.deleteTitle')} onClose={() => setConfirm(false)} busy={busy}>
        <Text style={ui.body}>{t('editor.deleteBody')}</Text>
        <RequestError error={error} />
        <Action danger label={t('editor.deleteConfirm')} busy={busy} onPress={() => void remove()} />
        <Action secondary label={t('common.cancel')} disabled={busy} onPress={() => setConfirm(false)} />
      </Sheet>
    );
  return (
    <Sheet
      testID="place-editor"
      contentKey={error ?? 'edit'}
      title={t(isNew ? 'editor.addTitle' : 'editor.title')}
      onClose={onClose}
      unsavedChanges={dirty}
      busy={busy}
      footer={
        <Action
          testID="place-save"
          label={t(error ? 'common.retry' : isNew ? 'editor.saveNew' : 'editor.save')}
          onPress={() => {
            Keyboard.dismiss();
            void save();
          }}
          busy={busy}
          icon={isNew ? 'plus' : 'check'}
        />
      }
    >
      <RequestError error={error} />
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
        <View style={[ui.row, { flexWrap: 'wrap' }]}>
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
        testID="place-note"
        editable={!busy}
        label={t('placeSearch.note')}
        multiline
        maxLength={2000}
        value={draft.note}
        onChangeText={(note) => setDraft((d) => ({ ...d, note }))}
        placeholder={t('placeSearch.notePlaceholder')}
      />
      <View style={[ui.row, { marginTop: -12 }]}>
        <Icon name="lock" size={13} color={colors.muted} />
        <Text style={[ui.muted, { flex: 1 }]}>{t('editor.privateNote')}</Text>
      </View>
      <Field
        label={t('placeSearch.tags')}
        testID="place-tags"
        editable={!busy}
        returnKeyType="done"
        onSubmitEditing={Keyboard.dismiss}
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
                  accessibilityState={{ checked: draft.visibility === v }}
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
              editable={!busy}
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
      {onDelete ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            Keyboard.dismiss();
            setConfirm(true);
          }}
          style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center' }}
        >
          <Text style={{ color: colors.tomato, fontSize: 14 }}>{t('savedPlaces.delete')}</Text>
        </Pressable>
      ) : null}
    </Sheet>
  );
}
