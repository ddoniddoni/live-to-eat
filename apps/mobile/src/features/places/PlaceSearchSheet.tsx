import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors, radii, spacing, type } from '@/components/tokens';
import {
  type PrivateCollection,
  createPrivateCollection,
  listPrivateCollections,
} from '@/features/places/collectionsApi';
import { FolderManagerSheet } from '@/features/places/FolderManagerSheet';
import { PlaceSheetLayout } from '@/features/places/PlaceSheetLayout';
import {
  type PlaceSearchCandidate,
  type SavedPlaceDraft,
  saveSearchCandidate,
  searchPlaces,
} from '@/features/places/placeSearchApi';

type PlaceSearchSheetProps = {
  collections: PrivateCollection[];
  onCollectionsChange: (collections: PrivateCollection[]) => void;
  onDismiss: () => void;
  onSaved: (savedPlace: SavedPlaceDraft) => void;
  visible: boolean;
};

const parseTags = (value: string): string[] =>
  [...new Set(value.split(',').map((tag) => tag.trim()).filter((tag) => tag.length > 0))].slice(0, 20);

export function PlaceSearchSheet({ collections, onCollectionsChange, onDismiss, onSaved, visible }: PlaceSearchSheetProps) {
  const { i18n, t } = useTranslation();
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<PlaceSearchCandidate[]>([]);
  const [selected, setSelected] = useState<PlaceSearchCandidate | null>(null);
  const [note, setNote] = useState('');
  const [tags, setTags] = useState('');
  const [visitStatus, setVisitStatus] = useState<'visited' | 'want'>('want');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [isLoadingCollections, setIsLoadingCollections] = useState(true);
  const [isFolderManagerVisible, setIsFolderManagerVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    void listPrivateCollections()
      .then((nextCollections) => {
        if (isCurrent) onCollectionsChange(nextCollections);
      })
      .catch(() => {
        if (isCurrent) setError(t('placeSearch.collectionLoadError'));
      })
      .finally(() => {
        if (isCurrent) setIsLoadingCollections(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [onCollectionsChange, t]);

  const runSearch = async (): Promise<void> => {
    if (query.trim().length < 2 || isSearching) {
      setError(t('placeSearch.queryHint'));
      return;
    }

    setError(null);
    setIsSearching(true);
    try {
      const languageCode = i18n.language.startsWith('ko') ? 'ko' : 'en';
      setCandidates(await searchPlaces(query, languageCode));
    } catch {
      setCandidates([]);
      setError(t('placeSearch.searchError'));
    } finally {
      setIsSearching(false);
    }
  };

  const chooseCandidate = (candidate: PlaceSearchCandidate): void => {
    setSelected(candidate);
    setError(null);
  };

  const save = async (): Promise<void> => {
    if (!selected || isSaving) return;

    setError(null);
    setIsSaving(true);
    try {
      const savedPlace = await saveSearchCandidate({
        candidate: selected,
        collection: collections.find((collection) => collection.id === selectedCollectionId) ?? null,
        note: note.trim(),
        tags: parseTags(tags),
        visitStatus,
      });
      onSaved(savedPlace);
      onDismiss();
    } catch {
      setError(t('placeSearch.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const createCollection = async (): Promise<void> => {
    if (isSaving || isCreatingCollection && newCollectionName.trim().length < 1) return;

    setError(null);
    setIsCreatingCollection(true);
    try {
      const createdCollection = await createPrivateCollection(newCollectionName);
      onCollectionsChange([createdCollection, ...collections]);
      setSelectedCollectionId(createdCollection.id);
      setNewCollectionName('');
      setIsCreatingCollection(false);
    } catch {
      setError(t('placeSearch.collectionCreateError'));
    }
  };

  const close = (): void => {
    if (isSearching || isSaving) return;
    onDismiss();
  };

  const updateCollections = (nextCollections: PrivateCollection[]): void => {
    onCollectionsChange(nextCollections);
    if (!nextCollections.some((collection) => collection.id === selectedCollectionId)) {
      setSelectedCollectionId(null);
    }
  };

  return (
    <>
      <PlaceSheetLayout
        closeLabel={t('placeSearch.close')}
        eyebrow={t('placeSearch.eyebrow')}
        onDismiss={close}
        title={selected ? t('placeSearch.confirmTitle') : t('placeSearch.title')}
        visible={visible}
      >
          {selected ? (
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              <View style={styles.selectedPlace}>
                <Text style={styles.selectedName}>{selected.displayName}</Text>
                <Text style={styles.selectedAddress}>{selected.address}</Text>
                {selected.isPreview ? <Text style={styles.previewMarker}>{t('placeSearch.previewResult')}</Text> : null}
              </View>

              <Text style={styles.label}>{t('placeSearch.visitStatus')}</Text>
              <View style={styles.segmentedControl}>
                {(['want', 'visited'] as const).map((option) => {
                  const selectedStatus = visitStatus === option;
                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ selected: selectedStatus }}
                      key={option}
                      onPress={() => setVisitStatus(option)}
                      style={[styles.segment, selectedStatus ? styles.segmentSelected : null]}
                    >
                      <Text style={[styles.segmentText, selectedStatus ? styles.segmentTextSelected : null]}>
                        {t(`placeSearch.${option}`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>{t('placeSearch.note')}</Text>
              <TextInput
                maxLength={2000}
                multiline
                onChangeText={setNote}
                placeholder={t('placeSearch.notePlaceholder')}
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.noteInput]}
                textAlignVertical="top"
                value={note}
              />

              <Text style={styles.label}>{t('placeSearch.tags')}</Text>
              <TextInput
                autoCapitalize="none"
                maxLength={1_200}
                onChangeText={setTags}
                placeholder={t('placeSearch.tagsPlaceholder')}
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={tags}
              />
              <Text style={styles.hint}>{t('placeSearch.privateHint')}</Text>

              <Text style={styles.label}>{t('placeSearch.collection')}</Text>
              <ScrollView
                contentContainerStyle={styles.collectionChips}
                horizontal
                keyboardShouldPersistTaps="handled"
                showsHorizontalScrollIndicator={false}
              >
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected: selectedCollectionId === null }}
                  onPress={() => setSelectedCollectionId(null)}
                  style={[styles.collectionChip, selectedCollectionId === null ? styles.collectionChipSelected : null]}
                >
                  <Text style={[styles.collectionChipText, selectedCollectionId === null ? styles.collectionChipTextSelected : null]}>
                    {t('placeSearch.noCollection')}
                  </Text>
                </Pressable>
                {collections.map((collection) => {
                  const isSelected = collection.id === selectedCollectionId;
                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      key={collection.id}
                      onPress={() => setSelectedCollectionId(collection.id)}
                      style={[styles.collectionChip, isSelected ? styles.collectionChipSelected : null]}
                    >
                      <Text style={[styles.collectionChipText, isSelected ? styles.collectionChipTextSelected : null]}>
                        {collection.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {isLoadingCollections ? <Text style={styles.hint}>{t('placeSearch.collectionLoading')}</Text> : null}
              {isCreatingCollection ? (
                <View style={styles.collectionCreateRow}>
                  <TextInput
                    autoFocus
                    maxLength={120}
                    onChangeText={setNewCollectionName}
                    placeholder={t('placeSearch.collectionPlaceholder')}
                    placeholderTextColor={colors.muted}
                    style={styles.collectionInput}
                    value={newCollectionName}
                  />
                  <Pressable
                    accessibilityLabel={t('placeSearch.createCollection')}
                    accessibilityRole="button"
                    onPress={() => void createCollection()}
                    style={styles.collectionCreateButton}
                  >
                    <Text style={styles.collectionCreateButtonText}>+</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setIsCreatingCollection(true)}
                  style={styles.newCollectionButton}
                >
                  <Text style={styles.newCollectionText}>+ {t('placeSearch.newCollection')}</Text>
                </Pressable>
              )}
              {collections.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setIsFolderManagerVisible(true)}
                  style={styles.manageCollectionsButton}
                >
                  <Text style={styles.manageCollectionsText}>{t('placeSearch.manageCollections')}</Text>
                </Pressable>
              ) : null}

              {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: isSaving }}
                disabled={isSaving}
                onPress={() => void save()}
                style={[styles.primaryButton, isSaving ? styles.buttonDisabled : null]}
              >
                {isSaving ? <ActivityIndicator color={colors.paper} size="small" /> : null}
                <Text style={styles.primaryButtonText}>{t('placeSearch.save')}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setSelected(null)} style={styles.backButton}>
                <Text style={styles.backText}>{t('placeSearch.backToResults')}</Text>
              </Pressable>
            </ScrollView>
          ) : (
            <FlatList
              contentContainerStyle={styles.content}
              data={candidates}
              keyboardShouldPersistTaps="handled"
              keyExtractor={(candidate) => candidate.ticket}
              ListEmptyComponent={
                <View style={styles.emptyResult}>
                  <Text style={styles.emptyResultTitle}>{t('placeSearch.emptyTitle')}</Text>
                  <Text style={styles.emptyResultBody}>{t('placeSearch.emptyBody')}</Text>
                </View>
              }
              ListHeaderComponent={
                <View>
                  <Text style={styles.description}>{t('placeSearch.description')}</Text>
                  <View style={styles.searchRow}>
                    <TextInput
                      autoCapitalize="words"
                      autoFocus
                      onChangeText={setQuery}
                      onSubmitEditing={() => void runSearch()}
                      placeholder={t('placeSearch.placeholder')}
                      placeholderTextColor={colors.muted}
                      returnKeyType="search"
                      style={styles.searchInput}
                      value={query}
                    />
                    <Pressable
                      accessibilityLabel={t('placeSearch.search')}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: isSearching }}
                      disabled={isSearching}
                      onPress={() => void runSearch()}
                      style={[styles.searchButton, isSearching ? styles.buttonDisabled : null]}
                    >
                      {isSearching ? <ActivityIndicator color={colors.paper} size="small" /> : <Text style={styles.searchButtonText}>↗</Text>}
                    </Pressable>
                  </View>
                  <Text style={styles.globalScope}>{t('placeSearch.globalScope')}</Text>
                  {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
                  {candidates.length > 0 ? <Text style={styles.resultLabel}>{t('placeSearch.results')}</Text> : null}
                </View>
              }
              renderItem={({ item: candidate }) => (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => chooseCandidate(candidate)}
                  style={({ pressed }) => [styles.resultCard, pressed ? styles.resultCardPressed : null]}
                >
                  <View style={styles.resultNumber}>
                    <Text style={styles.resultNumberText}>+</Text>
                  </View>
                  <View style={styles.resultTextArea}>
                    <Text numberOfLines={1} style={styles.resultName}>
                      {candidate.displayName}
                    </Text>
                    <Text numberOfLines={2} style={styles.resultAddress}>
                      {candidate.address}
                    </Text>
                  </View>
                  <Text style={styles.resultArrow}>→</Text>
                </Pressable>
              )}
            />
          )}
      </PlaceSheetLayout>
      {isFolderManagerVisible ? (
        <FolderManagerSheet
          collections={collections}
          onChange={updateCollections}
          onDismiss={() => setIsFolderManagerVisible(false)}
          visible
        />
      ) : null}
    </>
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
  collectionChip: {
    borderColor: '#CDD3CF',
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  collectionChipSelected: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  collectionChipText: {
    color: colors.ink,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: '800',
  },
  collectionChipTextSelected: {
    color: colors.paper,
  },
  collectionChips: {
    gap: 7,
    paddingRight: spacing.page,
  },
  collectionCreateButton: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: 12,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  collectionCreateButtonText: {
    color: colors.wasabi,
    fontFamily: type.utility,
    fontSize: 20,
    fontWeight: '900',
  },
  collectionCreateRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.sm,
  },
  collectionInput: {
    backgroundColor: colors.paper,
    borderColor: '#CDD3CF',
    borderRadius: 12,
    borderWidth: 1,
    color: colors.ink,
    flex: 1,
    fontFamily: type.body,
    fontSize: 15,
    height: 46,
    paddingHorizontal: spacing.sm,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 32,
    paddingHorizontal: spacing.page,
    paddingTop: spacing.md,
  },
  description: {
    color: colors.ink,
    fontFamily: type.body,
    fontSize: 17,
    lineHeight: 25,
    marginBottom: spacing.md,
  },
  emptyResult: {
    backgroundColor: colors.ink,
    borderRadius: radii.panel,
    gap: 6,
    marginTop: 32,
    padding: spacing.lg,
  },
  emptyResultBody: {
    color: colors.panelMuted,
    fontFamily: type.body,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyResultTitle: {
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
  globalScope: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 12,
    lineHeight: 17,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.page,
    paddingTop: spacing.sm,
  },
  hint: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 7,
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
  manageCollectionsButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    paddingVertical: 5,
  },
  manageCollectionsText: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 12,
    fontWeight: '800',
  },
  noteInput: {
    minHeight: 112,
  },
  newCollectionButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingVertical: 5,
  },
  newCollectionText: {
    color: colors.tomato,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: '900',
  },
  previewMarker: {
    color: colors.tomato,
    fontFamily: type.utility,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: spacing.sm,
    textTransform: 'uppercase',
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
  resultAddress: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  resultArrow: {
    color: colors.tomato,
    fontFamily: type.utility,
    fontSize: 18,
  },
  resultCard: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderBottomColor: '#DDE1DD',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 75,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
  },
  resultCardPressed: {
    backgroundColor: '#E8ECE3',
  },
  resultLabel: {
    color: colors.muted,
    fontFamily: type.utility,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  resultList: {
    marginTop: 30,
  },
  resultName: {
    color: colors.ink,
    fontFamily: type.body,
    fontSize: 16,
    fontWeight: '800',
  },
  resultNumber: {
    alignItems: 'center',
    backgroundColor: colors.wasabi,
    borderRadius: radii.pill,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  resultNumberText: {
    color: colors.ink,
    fontFamily: type.body,
    fontSize: 17,
    fontWeight: '800',
  },
  resultTextArea: {
    flex: 1,
  },
  safeArea: {
    backgroundColor: colors.canvas,
    flex: 1,
  },
  searchButton: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  searchButtonText: {
    color: colors.wasabi,
    fontFamily: type.utility,
    fontSize: 20,
    fontWeight: '800',
  },
  searchInput: {
    backgroundColor: colors.paper,
    borderColor: '#CDD3CF',
    borderRadius: 14,
    borderWidth: 1,
    color: colors.ink,
    flex: 1,
    fontFamily: type.body,
    fontSize: 16,
    height: 52,
    paddingHorizontal: spacing.sm,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
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
  selectedAddress: {
    color: colors.panelMuted,
    fontFamily: type.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  selectedName: {
    color: colors.paper,
    fontFamily: type.display,
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  selectedPlace: {
    backgroundColor: colors.ink,
    borderRadius: radii.panel,
    padding: spacing.lg,
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
