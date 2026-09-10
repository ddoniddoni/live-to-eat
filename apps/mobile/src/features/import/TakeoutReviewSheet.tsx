import { useEffect, useMemo, useState } from 'react';
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
  cancelTakeoutImport,
  commitTakeoutImportRow,
  skipTakeoutImportRow,
  type TakeoutImportBatch,
  type TakeoutImportRowState,
} from '@/features/import/takeoutBatchApi';
import { listImportRegions, type ImportRegionOption } from '@/features/import/regionApi';
import type { TakeoutPreview, TakeoutPreviewRow } from '@/features/import/takeoutImportApi';
import { PlaceSheetLayout } from '@/features/places/PlaceSheetLayout';
import { type PlaceSearchCandidate, searchPlaces } from '@/features/places/placeSearchApi';

type TakeoutReviewSheetProps = {
  batch: TakeoutImportBatch;
  onBack: () => void;
  onDismiss: () => void;
  preview: TakeoutPreview;
  visible: boolean;
};

const rowLabel = (previewRow: TakeoutPreviewRow, fallback: string): string =>
  previewRow.row.inputTitle ?? previewRow.row.inputUrl ?? fallback;

const searchQueryFor = (previewRow: TakeoutPreviewRow | undefined): string =>
  previewRow?.row.inputTitle ?? previewRow?.row.inputUrl ?? '';

const rowStateCounts = (rows: TakeoutPreviewRow[], states: Record<string, TakeoutImportRowState>) =>
  rows.reduce(
    (counts, previewRow) => {
      const state = states[previewRow.row.sourceRowKey] ?? 'pending';
      counts[state] += 1;
      return counts;
    },
    { duplicate: 0, pending: 0, saved: 0, skipped: 0 },
  );

export function TakeoutReviewSheet({ batch, onBack, onDismiss, preview, visible }: TakeoutReviewSheetProps) {
  const { i18n, t } = useTranslation();
  const [states, setStates] = useState<Record<string, TakeoutImportRowState>>({ ...batch.stateBySourceRowKey });
  const [query, setQuery] = useState(() =>
    searchQueryFor(preview.rows.find((previewRow) => (batch.stateBySourceRowKey[previewRow.row.sourceRowKey] ?? 'pending') === 'pending')),
  );
  const [candidates, setCandidates] = useState<PlaceSearchCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<PlaceSearchCandidate | null>(null);
  const [regions, setRegions] = useState<ImportRegionOption[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<ImportRegionOption | null>(null);
  const [isRegionListOpen, setIsRegionListOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCancelConfirmationOpen, setIsCancelConfirmationOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRegionLoadFailed, setIsRegionLoadFailed] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    void listImportRegions()
      .then((nextRegions) => {
        if (isCurrent) setRegions(nextRegions);
      })
      .catch(() => {
        if (isCurrent) setIsRegionLoadFailed(true);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const pendingRows = useMemo(
    () => preview.rows.filter((previewRow) => (states[previewRow.row.sourceRowKey] ?? 'pending') === 'pending'),
    [preview.rows, states],
  );
  const currentRow = pendingRows[0];
  const counts = rowStateCounts(preview.rows, states);
  const currentPosition = currentRow ? preview.rows.findIndex(({ row }) => row.sourceRowKey === currentRow.row.sourceRowKey) + 1 : 0;

  const search = async (): Promise<void> => {
    if (!currentRow || isSearching || query.trim().length < 2) {
      setError(t('takeoutReview.queryHint'));
      return;
    }

    setError(null);
    setIsSearching(true);
    try {
      const languageCode = i18n.language.startsWith('ko') ? 'ko' : 'en';
      setCandidates(await searchPlaces(query, languageCode));
    } catch {
      setCandidates([]);
      setError(t('takeoutReview.searchError'));
    } finally {
      setIsSearching(false);
    }
  };

  const updateCurrentState = (state: TakeoutImportRowState): void => {
    if (!currentRow) return;
    const nextStates = { ...states, [currentRow.row.sourceRowKey]: state };
    const nextRow = preview.rows.find((previewRow) => (nextStates[previewRow.row.sourceRowKey] ?? 'pending') === 'pending');

    setStates(nextStates);
    setQuery(searchQueryFor(nextRow));
    setCandidates([]);
    setSelectedCandidate(null);
    setSelectedRegion(null);
    setIsRegionListOpen(false);
    setError(null);
  };

  const save = async (): Promise<void> => {
    if (!currentRow || !selectedCandidate || isSaving || isSkipping) return;

    setError(null);
    setIsSaving(true);
    try {
      const state = await commitTakeoutImportRow({
        batch,
        candidate: selectedCandidate,
        previewRow: currentRow,
        regionId: selectedRegion?.id ?? null,
      });
      updateCurrentState(state);
    } catch {
      setError(t('takeoutReview.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const skip = async (): Promise<void> => {
    if (!currentRow || isSaving || isSkipping) return;

    setError(null);
    setIsSkipping(true);
    try {
      updateCurrentState(await skipTakeoutImportRow({ batch, previewRow: currentRow }));
    } catch {
      setError(t('takeoutReview.skipError'));
    } finally {
      setIsSkipping(false);
    }
  };

  const cancel = async (): Promise<void> => {
    if (isCancelling) return;

    if (!isCancelConfirmationOpen) {
      setIsCancelConfirmationOpen(true);
      return;
    }

    setIsCancelling(true);
    try {
      await cancelTakeoutImport(batch);
      onDismiss();
    } catch {
      setError(t('takeoutReview.cancelError'));
    } finally {
      setIsCancelling(false);
    }
  };

  const close = (): void => {
    if (isCancelling || isSaving || isSkipping) return;
    onDismiss();
  };

  const back = (): void => {
    if (isCancelling || isSaving || isSkipping) return;
    onBack();
  };

  return (
    <PlaceSheetLayout
      closeLabel={t('takeoutReview.close')}
      eyebrow={t('takeoutReview.eyebrow')}
      onDismiss={close}
      title={currentRow ? t('takeoutReview.title') : t('takeoutReview.completeTitle')}
      visible={visible}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {currentRow ? (
          <>
            <View style={styles.ledgerHeader}>
              <View>
                <Text style={styles.ledgerEyebrow}>{t('takeoutReview.rowLedger')}</Text>
                <Text style={styles.ledgerTitle}>{t('takeoutReview.rowCount', { current: currentPosition, total: preview.rows.length })}</Text>
              </View>
              <View accessibilityElementsHidden style={styles.pendingSeal}>
                <Text style={styles.pendingSealText}>{String(currentPosition).padStart(2, '0')}</Text>
              </View>
            </View>

            <View style={styles.sourceCard}>
              <Text style={styles.sourceFile}>{currentRow.sourceFileName}</Text>
              <Text style={styles.sourceName}>{rowLabel(currentRow, t('takeoutImport.unnamedPlace'))}</Text>
              {currentRow.row.inputUrl ? <Text numberOfLines={2} style={styles.sourceUrl}>{currentRow.row.inputUrl}</Text> : null}
              {currentRow.row.ownNote ? <Text style={styles.sourceNote}>{t('takeoutReview.noteKept')}</Text> : null}
              {currentRow.row.inputTags?.length ? <Text style={styles.sourceTags}>{currentRow.row.inputTags.join(' · ')}</Text> : null}
            </View>

            <Text style={styles.sectionLabel}>{t('takeoutReview.searchLabel')}</Text>
            <View style={styles.searchRow}>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setQuery}
                onSubmitEditing={() => void search()}
                placeholder={t('takeoutReview.searchPlaceholder')}
                placeholderTextColor={colors.muted}
                returnKeyType="search"
                style={styles.searchInput}
                value={query}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: isSearching }}
                disabled={isSearching}
                onPress={() => void search()}
                style={[styles.searchButton, isSearching ? styles.buttonDisabled : null]}
              >
                {isSearching ? <ActivityIndicator color={colors.paper} size="small" /> : <Text style={styles.searchButtonText}>{t('takeoutReview.search')}</Text>}
              </Pressable>
            </View>
            <Text style={styles.searchHint}>{t('takeoutReview.searchHint')}</Text>

            {candidates.length > 0 ? (
              <View style={styles.candidateList}>
                {candidates.map((candidate) => {
                  const isSelected = selectedCandidate?.ticket === candidate.ticket;

                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      key={candidate.ticket}
                      onPress={() => setSelectedCandidate(candidate)}
                      style={[styles.candidateRow, isSelected ? styles.candidateRowSelected : null]}
                    >
                      <View style={[styles.candidateMark, isSelected ? styles.candidateMarkSelected : null]} />
                      <View style={styles.candidateText}>
                        <Text style={styles.candidateName}>{candidate.displayName}</Text>
                        <Text style={styles.candidateAddress}>{candidate.address}</Text>
                      </View>
                      {candidate.isPreview ? <Text style={styles.previewFlag}>{t('takeoutReview.previewCandidate')}</Text> : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <View style={styles.regionSection}>
              <View style={styles.regionHeader}>
                <View>
                  <Text style={styles.sectionLabel}>{t('takeoutReview.regionLabel')}</Text>
                  <Text style={styles.regionHint}>{t('takeoutReview.regionHint')}</Text>
                </View>
                {selectedRegion ? <View style={styles.regionSeal}><Text style={styles.regionSealText}>✓</Text></View> : null}
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => setIsRegionListOpen((isOpen) => !isOpen)}
                style={styles.regionPicker}
              >
                <Text style={selectedRegion ? styles.regionSelectedText : styles.regionPickerText}>
                  {selectedRegion?.name ?? t('takeoutReview.noRegion')}
                </Text>
                <Text style={styles.regionPickerArrow}>{isRegionListOpen ? '−' : '+'}</Text>
              </Pressable>
              {isRegionListOpen ? (
                <View style={styles.regionList}>
                  <Pressable accessibilityRole="button" onPress={() => { setSelectedRegion(null); setIsRegionListOpen(false); }} style={styles.regionRow}>
                    <Text style={styles.regionRowText}>{t('takeoutReview.noRegion')}</Text>
                  </Pressable>
                  {regions.map((region) => (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: selectedRegion?.id === region.id }}
                      key={region.id}
                      onPress={() => { setSelectedRegion(region); setIsRegionListOpen(false); }}
                      style={styles.regionRow}
                    >
                      <Text style={styles.regionRowText}>{region.name}</Text>
                      <Text style={styles.regionKind}>{region.isPreview ? t('takeoutReview.previewRegion') : region.kind}</Text>
                    </Pressable>
                  ))}
                  {regions.length === 0 && !isRegionLoadFailed ? <Text style={styles.emptyRegions}>{t('takeoutReview.noRegionsAvailable')}</Text> : null}
                </View>
              ) : null}
              {isRegionLoadFailed ? <Text accessibilityRole="alert" style={styles.errorText}>{t('takeoutReview.regionLoadError')}</Text> : null}
            </View>

            {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: selectedCandidate === null || isSaving || isSkipping }}
              disabled={selectedCandidate === null || isSaving || isSkipping}
              onPress={() => void save()}
              style={[styles.saveButton, selectedCandidate === null || isSaving || isSkipping ? styles.buttonDisabled : null]}
            >
              {isSaving ? <ActivityIndicator color={colors.ink} size="small" /> : <Text style={styles.saveButtonText}>{t('takeoutReview.savePrivate')}</Text>}
            </Pressable>
            <Pressable accessibilityRole="button" disabled={isSaving || isSkipping} onPress={() => void skip()} style={styles.skipButton}>
              {isSkipping ? <ActivityIndicator color={colors.muted} size="small" /> : <Text style={styles.skipButtonText}>{t('takeoutReview.skip')}</Text>}
            </Pressable>
            <Text style={styles.boundary}>{t(batch.isPreview ? 'takeoutReview.previewBoundary' : 'takeoutReview.resumeBoundary')}</Text>
          </>
        ) : (
          <View style={styles.completePanel}>
            <View accessibilityElementsHidden style={styles.completeSeal}><Text style={styles.completeSealText}>✓</Text></View>
            <Text style={styles.completeLead}>{t('takeoutReview.completeLead')}</Text>
            <View style={styles.resultGrid}>
              <View style={styles.resultCell}><Text style={styles.resultValue}>{counts.saved}</Text><Text style={styles.resultLabel}>{t('takeoutReview.saved')}</Text></View>
              <View style={styles.resultCell}><Text style={styles.resultValue}>{counts.duplicate}</Text><Text style={styles.resultLabel}>{t('takeoutReview.duplicates')}</Text></View>
              <View style={styles.resultCell}><Text style={styles.resultValue}>{counts.skipped}</Text><Text style={styles.resultLabel}>{t('takeoutReview.skipped')}</Text></View>
            </View>
            <Text style={styles.completeBody}>{t(batch.isPreview ? 'takeoutReview.previewCompleteBody' : 'takeoutReview.completeBody')}</Text>
            <Pressable accessibilityRole="button" onPress={onDismiss} style={styles.saveButton}><Text style={styles.saveButtonText}>{t('takeoutReview.done')}</Text></Pressable>
          </View>
        )}

        {currentRow ? (
          <Pressable accessibilityRole="button" disabled={isSaving || isSkipping || isCancelling} onPress={() => void cancel()} style={styles.cancelButton}>
            <Text style={isCancelConfirmationOpen ? styles.cancelConfirmText : styles.cancelButtonText}>
              {t(isCancelConfirmationOpen ? 'takeoutReview.confirmCancel' : 'takeoutReview.cancel')}
            </Text>
          </Pressable>
        ) : null}
        {currentRow ? <Pressable accessibilityRole="button" onPress={back} style={styles.backButton}><Text style={styles.backButtonText}>{t('takeoutReview.back')}</Text></Pressable> : null}
      </ScrollView>
    </PlaceSheetLayout>
  );
}

const styles = StyleSheet.create({
  backButton: { alignItems: 'center', paddingBottom: spacing.sm, paddingTop: spacing.md },
  backButtonText: { color: colors.muted, fontFamily: type.body, fontSize: 13, fontWeight: '800' },
  boundary: { color: colors.muted, fontFamily: type.body, fontSize: 12, lineHeight: 18, marginHorizontal: spacing.xs, marginTop: spacing.sm, textAlign: 'center' },
  buttonDisabled: { opacity: 0.5 },
  candidateAddress: { color: colors.muted, fontFamily: type.body, fontSize: 12, lineHeight: 17, marginTop: 2 },
  candidateList: { borderTopColor: '#D6DCD7', borderTopWidth: StyleSheet.hairlineWidth, marginTop: spacing.md },
  candidateMark: { backgroundColor: '#D6DCD7', borderRadius: radii.pill, height: 9, width: 9 },
  candidateMarkSelected: { backgroundColor: colors.wasabi },
  candidateName: { color: colors.ink, fontFamily: type.body, fontSize: 14, fontWeight: '900' },
  candidateRow: { alignItems: 'center', borderBottomColor: '#D6DCD7', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 9, minHeight: 58, paddingHorizontal: spacing.xs },
  candidateRowSelected: { backgroundColor: '#E8ECE5' },
  candidateText: { flex: 1 },
  cancelButton: { alignItems: 'center', marginTop: spacing.lg, minHeight: 40, paddingHorizontal: spacing.md, justifyContent: 'center' },
  cancelButtonText: { color: colors.muted, fontFamily: type.body, fontSize: 12, fontWeight: '800' },
  cancelConfirmText: { color: '#B73324', fontFamily: type.body, fontSize: 12, fontWeight: '900' },
  completeBody: { color: colors.panelMuted, fontFamily: type.body, fontSize: 13, lineHeight: 19, marginTop: spacing.md },
  completeLead: { color: colors.paper, fontFamily: type.display, fontSize: 28, fontWeight: '900', letterSpacing: -0.5, marginTop: spacing.sm },
  completePanel: { backgroundColor: colors.ink, borderRadius: radii.panel, marginTop: spacing.md, padding: spacing.md },
  completeSeal: { alignItems: 'center', backgroundColor: colors.wasabi, borderRadius: radii.pill, height: 34, justifyContent: 'center', width: 34 },
  completeSealText: { color: colors.ink, fontFamily: type.body, fontSize: 18, fontWeight: '900' },
  content: { paddingBottom: 36, paddingHorizontal: spacing.page, paddingTop: spacing.md },
  emptyRegions: { color: colors.muted, fontFamily: type.body, fontSize: 12, lineHeight: 18, padding: spacing.sm },
  errorText: { color: '#B73324', fontFamily: type.body, fontSize: 13, fontWeight: '800', lineHeight: 19, marginTop: spacing.sm },
  ledgerEyebrow: { color: colors.wasabi, fontFamily: type.utility, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  ledgerHeader: { alignItems: 'flex-start', backgroundColor: colors.ink, borderTopLeftRadius: radii.panel, borderTopRightRadius: radii.panel, flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md, padding: spacing.md },
  ledgerTitle: { color: colors.paper, fontFamily: type.display, fontSize: 25, fontWeight: '900', letterSpacing: -0.4, marginTop: 4 },
  pendingSeal: { alignItems: 'center', borderColor: colors.tomato, borderRadius: radii.pill, borderWidth: 3, height: 42, justifyContent: 'center', width: 42 },
  pendingSealText: { color: colors.paper, fontFamily: type.utility, fontSize: 11, fontWeight: '900' },
  previewFlag: { color: colors.tomato, fontFamily: type.utility, fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },
  regionHeader: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between' },
  regionHint: { color: colors.muted, fontFamily: type.body, fontSize: 12, lineHeight: 17, marginTop: 3 },
  regionKind: { color: colors.muted, fontFamily: type.utility, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  regionList: { borderBottomColor: '#D6DCD7', borderBottomWidth: StyleSheet.hairlineWidth },
  regionPicker: { alignItems: 'center', backgroundColor: '#E8ECE5', borderRadius: 14, flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm, minHeight: 46, paddingHorizontal: spacing.sm },
  regionPickerArrow: { color: colors.ink, fontFamily: type.utility, fontSize: 20, fontWeight: '900' },
  regionPickerText: { color: colors.muted, fontFamily: type.body, fontSize: 13, fontWeight: '800' },
  regionRow: { alignItems: 'center', borderTopColor: '#D6DCD7', borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', minHeight: 44, paddingHorizontal: spacing.sm },
  regionRowText: { color: colors.ink, fontFamily: type.body, fontSize: 13, fontWeight: '800' },
  regionSeal: { alignItems: 'center', backgroundColor: colors.wasabi, borderRadius: radii.pill, height: 24, justifyContent: 'center', width: 24 },
  regionSealText: { color: colors.ink, fontFamily: type.body, fontSize: 13, fontWeight: '900' },
  regionSection: { borderTopColor: '#D6DCD7', borderTopWidth: StyleSheet.hairlineWidth, marginTop: spacing.lg, paddingTop: spacing.md },
  regionSelectedText: { color: colors.ink, fontFamily: type.body, fontSize: 13, fontWeight: '900' },
  resultCell: { flex: 1 },
  resultGrid: { borderTopColor: colors.rule, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.sm },
  resultLabel: { color: colors.panelMuted, fontFamily: type.utility, fontSize: 9, fontWeight: '900', letterSpacing: 0.4, marginTop: 2, textTransform: 'uppercase' },
  resultValue: { color: colors.wasabi, fontFamily: type.display, fontSize: 25, fontWeight: '900' },
  saveButton: { alignItems: 'center', backgroundColor: colors.wasabi, borderRadius: radii.pill, justifyContent: 'center', marginTop: spacing.lg, minHeight: 52, paddingHorizontal: spacing.md },
  saveButtonText: { color: colors.ink, fontFamily: type.body, fontSize: 15, fontWeight: '900' },
  searchButton: { alignItems: 'center', backgroundColor: colors.ink, borderRadius: 13, justifyContent: 'center', minHeight: 46, paddingHorizontal: spacing.sm },
  searchButtonText: { color: colors.paper, fontFamily: type.body, fontSize: 13, fontWeight: '900' },
  searchHint: { color: colors.muted, fontFamily: type.body, fontSize: 12, lineHeight: 18, marginTop: spacing.xs },
  searchInput: { color: colors.ink, flex: 1, fontFamily: type.body, fontSize: 14, minHeight: 46, paddingHorizontal: spacing.sm },
  searchRow: { backgroundColor: colors.paper, borderColor: '#D6DCD7', borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', marginTop: spacing.sm, padding: 3 },
  sectionLabel: { color: colors.ink, fontFamily: type.utility, fontSize: 10, fontWeight: '900', letterSpacing: 0.9, marginTop: spacing.lg, textTransform: 'uppercase' },
  skipButton: { alignItems: 'center', justifyContent: 'center', minHeight: 42, marginTop: spacing.sm },
  skipButtonText: { color: colors.muted, fontFamily: type.body, fontSize: 13, fontWeight: '800' },
  sourceCard: { backgroundColor: colors.ink, borderBottomLeftRadius: radii.panel, borderBottomRightRadius: radii.panel, borderTopColor: colors.rule, borderTopWidth: StyleSheet.hairlineWidth, padding: spacing.md },
  sourceFile: { color: colors.panelMuted, fontFamily: type.utility, fontSize: 10, fontWeight: '900', letterSpacing: 0.3 },
  sourceName: { color: colors.paper, fontFamily: type.body, fontSize: 17, fontWeight: '900', marginTop: 5 },
  sourceNote: { color: colors.wasabi, fontFamily: type.body, fontSize: 11, fontWeight: '800', marginTop: spacing.sm },
  sourceTags: { color: colors.panelMuted, fontFamily: type.body, fontSize: 11, lineHeight: 16, marginTop: spacing.xs },
  sourceUrl: { color: colors.panelMuted, fontFamily: type.body, fontSize: 11, lineHeight: 16, marginTop: 4 },
});
