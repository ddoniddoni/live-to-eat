import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors, radii, spacing, type } from '@/components/tokens';
import {
  type SavedPlaceDraft,
  deleteSavedPlace,
  updateSavedPlace,
} from '@/features/places/placeSearchApi';
import { setSavedPlaceVisibility } from '@/features/discover/publicMapApi';
import { PlaceSheetLayout } from '@/features/places/PlaceSheetLayout';

type SavedPlaceSheetProps = {
  initialSavedId?: string | null;
  onDelete: (savedId: string) => void;
  onDismiss: () => void;
  onUpdate: (savedPlace: SavedPlaceDraft) => void;
  savedPlaces: SavedPlaceDraft[];
  visible: boolean;
};

const parseTags = (value: string): string[] =>
  [...new Set(value.split(',').map((tag) => tag.trim()).filter((tag) => tag.length > 0))].slice(0, 20);

export function SavedPlaceSheet(props: SavedPlaceSheetProps) {
  if (!props.visible) return null;
  return <SavedPlaceSheetContent key={props.initialSavedId ?? "list"} {...props} />;
}

function SavedPlaceSheetContent({
  initialSavedId = null,
  onDelete,
  onDismiss,
  onUpdate,
  savedPlaces,
  visible,
}: SavedPlaceSheetProps) {
  const { t } = useTranslation();
  const initialPlace = savedPlaces.find(place => place.savedId === initialSavedId) ?? null;
  const [selected, setSelected] = useState<SavedPlaceDraft | null>(initialPlace);
  const [note, setNote] = useState(initialPlace?.note ?? '');
  const [tags, setTags] = useState(() => initialPlace?.tags.join(', ') ?? '');
  const [visitStatus, setVisitStatus] = useState<'visited' | 'want'>(initialPlace?.visitStatus ?? 'want');
  const [isRecommended, setIsRecommended] = useState(initialPlace?.isRecommended ?? false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteConfirmationVisible, setIsDeleteConfirmationVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choosePlace = (savedPlace: SavedPlaceDraft): void => {
    setSelected(savedPlace);
    setNote(savedPlace.note);
    setTags(savedPlace.tags.join(', '));
    setVisitStatus(savedPlace.visitStatus);
    setIsRecommended(savedPlace.isRecommended);
    setError(null);
    setIsDeleteConfirmationVisible(false);
  };

  const save = async (): Promise<void> => {
    if (!selected || isSaving || isDeleting) return;

    setError(null);
    setIsSaving(true);
    try {
      const nextPlace = await updateSavedPlace({
        isRecommended,
        note: note.trim(),
        savedPlace: selected,
        tags: parseTags(tags),
        visitStatus,
      });
      setSelected(nextPlace);
      onUpdate(nextPlace);
    } catch {
      setError(t('savedPlaces.updateError'));
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async (): Promise<void> => {
    if (!selected || isSaving || isDeleting) return;

    if (!isDeleteConfirmationVisible) {
      setIsDeleteConfirmationVisible(true);
      return;
    }

    setError(null);
    setIsDeleting(true);
    try {
      await deleteSavedPlace(selected);
      onDelete(selected.savedId);
      setSelected(null);
      setIsDeleteConfirmationVisible(false);
    } catch {
      setError(t('savedPlaces.deleteError'));
    } finally {
      setIsDeleting(false);
    }
  };

  const togglePublicVisibility = async (): Promise<void> => {
    if (!selected || isSaving || isDeleting) return;

    const visibility = selected.visibility === 'public' ? 'private' : 'public';
    setError(null);
    setIsSaving(true);
    try {
      const version = await setSavedPlaceVisibility({
        expectedVersion: selected.version,
        savedId: selected.savedId,
        visibility,
      });
      const nextPlace: SavedPlaceDraft = { ...selected, version, visibility };
      setSelected(nextPlace);
      onUpdate(nextPlace);
    } catch {
      setError(t('savedPlaces.visibilityError'));
    } finally {
      setIsSaving(false);
    }
  };

  const close = (): void => {
    if (isSaving || isDeleting) return;
    onDismiss();
  };

  return (
    <PlaceSheetLayout
      closeLabel={t('savedPlaces.close')}
      eyebrow={t('savedPlaces.eyebrow')}
      onDismiss={close}
      title={selected ? t('savedPlaces.editTitle') : t('savedPlaces.title')}
      visible={visible}
    >
          {selected ? (
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              <View style={styles.placeTicket}>
                <Text style={styles.placeName}>{selected.displayName}</Text>
                <Text style={styles.placeAddress}>{selected.address}</Text>
                {selected.collectionName ? <Text style={styles.collectionName}>#{selected.collectionName}</Text> : null}
                {selected.savedId.startsWith('preview-') ? (
                  <Text style={styles.previewMarker}>{t('savedPlaces.previewMarker')}</Text>
                ) : null}
              </View>

              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: selected.visibility === 'public', disabled: isSaving || isDeleting }}
                disabled={isSaving || isDeleting}
                onPress={() => void togglePublicVisibility()}
                style={[styles.publicSetting, selected.visibility === 'public' ? styles.publicSettingEnabled : null]}
              >
                <View style={styles.publicSettingText}>
                  <Text style={styles.publicSettingTitle}>{t('savedPlaces.publicTitle')}</Text>
                  <Text style={styles.publicSettingBody}>{t('savedPlaces.publicBody')}</Text>
                </View>
                <View style={[styles.publicIndicator, selected.visibility === 'public' ? styles.publicIndicatorEnabled : null]}>
                  <View style={[styles.publicKnob, selected.visibility === 'public' ? styles.publicKnobEnabled : null]} />
                </View>
              </Pressable>

              <Text style={styles.label}>{t('savedPlaces.visitStatus')}</Text>
              <View style={styles.segmentedControl}>
                {(['want', 'visited'] as const).map((option) => {
                  const selectedStatus = visitStatus === option;
                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ selected: selectedStatus }}
                      key={option}
                      onPress={() => {
                        setVisitStatus(option);
                        if (option === 'want') setIsRecommended(false);
                      }}
                      style={[styles.segment, selectedStatus ? styles.segmentSelected : null]}
                    >
                      <Text style={[styles.segmentText, selectedStatus ? styles.segmentTextSelected : null]}>
                        {t(`savedPlaces.${option}`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isRecommended, disabled: visitStatus !== 'visited' }}
                disabled={visitStatus !== 'visited'}
                onPress={() => setIsRecommended((current) => !current)}
                style={[styles.recommendation, visitStatus !== 'visited' ? styles.recommendationDisabled : null]}
              >
                <View style={[styles.checkbox, isRecommended ? styles.checkboxSelected : null]}>
                  {isRecommended ? <Text style={styles.checkmark}>✓</Text> : null}
                </View>
                <View style={styles.recommendationTextArea}>
                  <Text style={styles.recommendationTitle}>{t('savedPlaces.recommended')}</Text>
                  <Text style={styles.recommendationHint}>{t('savedPlaces.recommendedHint')}</Text>
                </View>
              </Pressable>

              <Text style={styles.label}>{t('savedPlaces.note')}</Text>
              <TextInput
                maxLength={2000}
                multiline
                onChangeText={setNote}
                placeholder={t('savedPlaces.notePlaceholder')}
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.noteInput]}
                textAlignVertical="top"
                value={note}
              />

              <Text style={styles.label}>{t('savedPlaces.tags')}</Text>
              <TextInput
                autoCapitalize="none"
                maxLength={1200}
                onChangeText={setTags}
                placeholder={t('savedPlaces.tagsPlaceholder')}
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={tags}
              />

              {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: isSaving || isDeleting }}
                disabled={isSaving || isDeleting}
                onPress={() => void save()}
                style={[styles.primaryButton, isSaving || isDeleting ? styles.buttonDisabled : null]}
              >
                {isSaving ? <ActivityIndicator color={colors.paper} size="small" /> : null}
                <Text style={styles.primaryButtonText}>{t('savedPlaces.saveChanges')}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: isSaving || isDeleting }}
                disabled={isSaving || isDeleting}
                onPress={() => void remove()}
                style={[styles.deleteButton, isDeleteConfirmationVisible ? styles.deleteButtonConfirm : null]}
              >
                {isDeleting ? <ActivityIndicator color={colors.tomato} size="small" /> : null}
                <Text style={[styles.deleteText, isDeleteConfirmationVisible ? styles.deleteTextConfirm : null]}>
                  {isDeleteConfirmationVisible ? t('savedPlaces.confirmDelete') : t('savedPlaces.delete')}
                </Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setSelected(null)} style={styles.backButton}>
                <Text style={styles.backText}>{t('savedPlaces.backToList')}</Text>
              </Pressable>
            </ScrollView>
          ) : (
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              <Text style={styles.description}>{t('savedPlaces.description')}</Text>
              {savedPlaces.length > 0 ? (
                <View style={styles.list}>
                  {savedPlaces.map((savedPlace) => (
                    <Pressable
                      accessibilityRole="button"
                      key={savedPlace.savedId}
                      onPress={() => choosePlace(savedPlace)}
                      style={({ pressed }) => [styles.listItem, pressed ? styles.listItemPressed : null]}
                    >
                      <View style={styles.listDot} />
                      <View style={styles.listTextArea}>
                        <Text numberOfLines={1} style={styles.listName}>
                          {savedPlace.displayName}
                        </Text>
                        <Text numberOfLines={1} style={styles.listAddress}>
                          {savedPlace.address}
                        </Text>
                        {savedPlace.collectionName ? <Text style={styles.listCollection}>#{savedPlace.collectionName}</Text> : null}
                      </View>
                      <Text style={styles.listStatus}>{t(`savedPlaces.${savedPlace.visitStatus}`)}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>{t('savedPlaces.emptyTitle')}</Text>
                  <Text style={styles.emptyBody}>{t('savedPlaces.emptyBody')}</Text>
                </View>
              )}
            </ScrollView>
          )}
    </PlaceSheetLayout>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  backText: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  checkbox: {
    alignItems: 'center',
    borderColor: '#AEB7B0',
    borderRadius: 6,
    borderWidth: 1,
    height: 21,
    justifyContent: 'center',
    width: 21,
  },
  checkboxSelected: {
    backgroundColor: colors.wasabi,
    borderColor: colors.wasabi,
  },
  checkmark: {
    color: colors.ink,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: '900',
  },
  closeButton: {
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  closeText: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: '800',
  },
  collectionName: {
    color: colors.wasabi,
    fontFamily: type.utility,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: spacing.sm,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 32,
    paddingHorizontal: spacing.page,
    paddingTop: spacing.md,
  },
  deleteButton: {
    alignItems: 'center',
    borderColor: '#D8B2AC',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: spacing.sm,
    minHeight: 50,
  },
  deleteButtonConfirm: {
    backgroundColor: '#FFF0ED',
    borderColor: colors.tomato,
  },
  deleteText: {
    color: colors.tomato,
    fontFamily: type.body,
    fontSize: 15,
    fontWeight: '900',
  },
  deleteTextConfirm: {
    color: '#A92B1E',
  },
  description: {
    color: colors.ink,
    fontFamily: type.body,
    fontSize: 17,
    lineHeight: 25,
    marginBottom: spacing.md,
  },
  emptyBody: {
    color: colors.panelMuted,
    fontFamily: type.body,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyState: {
    backgroundColor: colors.ink,
    borderRadius: radii.panel,
    gap: 6,
    marginTop: 24,
    padding: spacing.lg,
  },
  emptyTitle: {
    color: colors.paper,
    fontFamily: type.display,
    fontSize: 23,
    fontWeight: '900',
  },
  errorText: {
    color: '#AA2D1D',
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 19,
    marginTop: spacing.sm,
  },
  eyebrow: {
    color: colors.tomato,
    fontFamily: type.utility,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.page,
    paddingTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.paper,
    borderColor: '#CDD3CF',
    borderRadius: 14,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: type.body,
    fontSize: 16,
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
  },
  keyboardView: {
    flex: 1,
  },
  label: {
    color: colors.ink,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
    marginTop: spacing.lg,
  },
  list: {
    borderTopColor: '#CDD3CF',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.sm,
  },
  listAddress: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 12,
    marginTop: 2,
  },
  listCollection: {
    color: colors.tomato,
    fontFamily: type.utility,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 5,
  },
  listDot: {
    backgroundColor: colors.wasabi,
    borderRadius: radii.pill,
    height: 9,
    width: 9,
  },
  listItem: {
    alignItems: 'center',
    borderBottomColor: '#CDD3CF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 78,
    paddingVertical: 11,
  },
  listItemPressed: {
    opacity: 0.65,
  },
  listName: {
    color: colors.ink,
    fontFamily: type.body,
    fontSize: 16,
    fontWeight: '900',
  },
  listStatus: {
    color: colors.tomato,
    fontFamily: type.utility,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  listTextArea: {
    flex: 1,
  },
  noteInput: {
    minHeight: 112,
  },
  placeAddress: {
    color: colors.panelMuted,
    fontFamily: type.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  placeName: {
    color: colors.paper,
    fontFamily: type.display,
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  placeTicket: {
    backgroundColor: colors.ink,
    borderRadius: radii.panel,
    padding: spacing.lg,
  },
  previewMarker: {
    color: colors.tomato,
    fontFamily: type.utility,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: spacing.sm,
    textTransform: 'uppercase',
  },
  publicIndicator: {
    backgroundColor: '#CDD3CF',
    borderRadius: radii.pill,
    height: 24,
    justifyContent: 'center',
    paddingHorizontal: 3,
    width: 43,
  },
  publicIndicatorEnabled: {
    backgroundColor: colors.wasabi,
  },
  publicKnob: {
    backgroundColor: colors.paper,
    borderRadius: radii.pill,
    height: 18,
    width: 18,
  },
  publicKnobEnabled: {
    alignSelf: 'flex-end',
  },
  publicSetting: {
    alignItems: 'center',
    backgroundColor: '#F0F2EA',
    borderColor: '#DDE1D9',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    marginTop: spacing.md,
    padding: spacing.sm,
  },
  publicSettingBody: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  publicSettingEnabled: {
    borderColor: colors.wasabi,
  },
  publicSettingText: {
    flex: 1,
  },
  publicSettingTitle: {
    color: colors.ink,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: '900',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: spacing.lg,
    minHeight: 54,
  },
  primaryButtonText: {
    color: colors.paper,
    fontFamily: type.body,
    fontSize: 16,
    fontWeight: '800',
  },
  recommendation: {
    alignItems: 'flex-start',
    backgroundColor: '#F0F2EA',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.md,
    padding: spacing.sm,
  },
  recommendationDisabled: {
    opacity: 0.5,
  },
  recommendationHint: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  recommendationTextArea: {
    flex: 1,
  },
  recommendationTitle: {
    color: colors.ink,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: '900',
  },
  safeArea: {
    backgroundColor: colors.canvas,
    flex: 1,
  },
  segment: {
    alignItems: 'center',
    borderColor: '#CDD3CF',
    borderRadius: radii.pill,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10,
  },
  segmentSelected: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  segmentedControl: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentText: {
    color: colors.ink,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: '800',
  },
  segmentTextSelected: {
    color: colors.paper,
  },
  title: {
    color: colors.ink,
    fontFamily: type.display,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 35,
    marginTop: 3,
  },
});
