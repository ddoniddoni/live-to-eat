import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, type } from '@/components/tokens';
import { beginTakeoutImport, type TakeoutImportBatch } from '@/features/import/takeoutBatchApi';
import {
  isTakeoutImportError,
  pickAndPreviewTakeout,
  type TakeoutImportErrorCode,
  type TakeoutPreview,
} from '@/features/import/takeoutImportApi';
import { TakeoutReviewSheet } from '@/features/import/TakeoutReviewSheet';
import { PlaceSheetLayout } from '@/features/places/PlaceSheetLayout';

type TakeoutImportSheetProps = {
  onDismiss: () => void;
  visible: boolean;
};

const formatFileSize = (size: number): string => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 102.4) / 10} KB`;
  return `${Math.round((size / (1024 * 1024)) * 10) / 10} MB`;
};

export function TakeoutImportSheet({ onDismiss, visible }: TakeoutImportSheetProps) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<TakeoutPreview | null>(null);
  const [reviewBatch, setReviewBatch] = useState<TakeoutImportBatch | null>(null);
  const [errorCode, setErrorCode] = useState<TakeoutImportErrorCode | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isStartingReview, setIsStartingReview] = useState(false);
  const [reviewError, setReviewError] = useState(false);

  const chooseFile = async (): Promise<void> => {
    if (isInspecting) return;

    setErrorCode(null);
    setPreview(null);
    setReviewBatch(null);
    setReviewError(false);
    setIsInspecting(true);
    try {
      const nextPreview = await pickAndPreviewTakeout();
      if (nextPreview) setPreview(nextPreview);
    } catch (error) {
      setErrorCode(isTakeoutImportError(error) ? error.code : 'READ_FAILED');
    } finally {
      setIsInspecting(false);
    }
  };

  const previewRows = preview?.rows.slice(0, 3) ?? [];

  const startReview = async (): Promise<void> => {
    if (!preview || preview.rows.length === 0 || isStartingReview) return;

    setReviewError(false);
    setIsStartingReview(true);
    try {
      setReviewBatch(await beginTakeoutImport(preview));
    } catch {
      setReviewError(true);
    } finally {
      setIsStartingReview(false);
    }
  };

  const dismiss = (): void => {
    setReviewBatch(null);
    setPreview(null);
    setReviewError(false);
    onDismiss();
  };

  if (reviewBatch && preview) {
    return (
      <TakeoutReviewSheet
        batch={reviewBatch}
        onBack={() => setReviewBatch(null)}
        onDismiss={dismiss}
        preview={preview}
        visible={visible}
      />
    );
  }

  return (
    <PlaceSheetLayout
      closeLabel={t('takeoutImport.close')}
      eyebrow={t('takeoutImport.eyebrow')}
      onDismiss={dismiss}
      title={t('takeoutImport.title')}
      visible={visible}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.description}>{t('takeoutImport.description')}</Text>

        <View style={styles.routeCard}>
          <View accessibilityElementsHidden style={styles.routeLine} />
          <View style={styles.routeStop}>
            <View style={[styles.routeDot, styles.routeDotStart]} />
            <View>
              <Text style={styles.routeLabel}>{t('takeoutImport.takeoutStep')}</Text>
              <Text style={styles.routeText}>{t('takeoutImport.takeoutStepBody')}</Text>
            </View>
          </View>
          <View style={styles.routeStop}>
            <View style={[styles.routeDot, styles.routeDotEnd]} />
            <View>
              <Text style={styles.routeLabel}>{t('takeoutImport.previewStep')}</Text>
              <Text style={styles.routeText}>{t('takeoutImport.previewStepBody')}</Text>
            </View>
          </View>
        </View>

        <View style={styles.limitRow}>
          <Text style={styles.limitPill}>{t('takeoutImport.csvLimit')}</Text>
          <Text style={styles.limitPill}>{t('takeoutImport.zipLimit')}</Text>
          <Text style={styles.limitPill}>{t('takeoutImport.rowLimit')}</Text>
        </View>

        {errorCode ? (
          <Text accessibilityRole="alert" style={styles.errorText}>{t(`takeoutImport.errors.${errorCode}`)}</Text>
        ) : null}
        {reviewError ? <Text accessibilityRole="alert" style={styles.errorText}>{t('takeoutImport.reviewStartError')}</Text> : null}

        {preview ? (
          <View style={styles.inspectionPanel}>
            <View style={styles.inspectionHeader}>
              <View>
                <Text style={styles.inspectionEyebrow}>{t('takeoutImport.inspected')}</Text>
                <Text style={styles.inspectionTitle}>{t('takeoutImport.previewTitle')}</Text>
              </View>
              <View accessibilityElementsHidden style={styles.inspectionSeal}>
                <Text style={styles.inspectionSealText}>✓</Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{preview.rows.length}</Text>
                <Text style={styles.statLabel}>{t('takeoutImport.places')}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>{preview.warnings.length}</Text>
                <Text style={styles.statLabel}>{t('takeoutImport.review')}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>{preview.files.length}</Text>
                <Text style={styles.statLabel}>{t('takeoutImport.files')}</Text>
              </View>
            </View>

            <View style={styles.fileList}>
              {preview.files.slice(0, 3).map((file) => (
                <View key={file.name} style={styles.fileRow}>
                  <View style={styles.fileTicket}>
                    <Text style={styles.fileTicketText}>CSV</Text>
                  </View>
                  <Text numberOfLines={1} style={styles.fileName}>{file.name}</Text>
                  <Text style={styles.fileSize}>{formatFileSize(file.size)}</Text>
                </View>
              ))}
              {preview.files.length > 3 ? (
                <Text style={styles.fileMore}>{t('takeoutImport.moreFiles', { count: preview.files.length - 3 })}</Text>
              ) : null}
            </View>

            {previewRows.length > 0 ? (
              <View style={styles.placeList}>
                <Text style={styles.listLabel}>{t('takeoutImport.previewPlaces')}</Text>
                {previewRows.map(({ row, sourceFileName }, index) => (
                  <View key={row.sourceRowKey} style={styles.placeRow}>
                    <Text style={styles.placeNumber}>{String(index + 1).padStart(2, '0')}</Text>
                    <View style={styles.placeText}>
                      <Text numberOfLines={1} style={styles.placeName}>
                        {row.inputTitle ?? row.inputUrl ?? t('takeoutImport.unnamedPlace')}
                      </Text>
                      <Text numberOfLines={1} style={styles.placeSource}>{sourceFileName}</Text>
                    </View>
                    <View accessibilityElementsHidden style={styles.privateMark} />
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyPreview}>{t('takeoutImport.emptyPreview')}</Text>
            )}

            <Text style={styles.nextBoundary}>{t('takeoutImport.nextBoundary')}</Text>
            {preview.rows.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: isStartingReview }}
                disabled={isStartingReview}
                onPress={() => void startReview()}
                style={[styles.reviewButton, isStartingReview ? styles.buttonDisabled : null]}
              >
                {isStartingReview ? <ActivityIndicator color={colors.ink} size="small" /> : <Text style={styles.reviewButtonText}>{t('takeoutImport.reviewPlaces')}</Text>}
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isInspecting }}
          disabled={isInspecting}
          onPress={() => void chooseFile()}
          style={[styles.chooseButton, isInspecting ? styles.buttonDisabled : null]}
        >
          {isInspecting ? <ActivityIndicator color={colors.ink} size="small" /> : <Text style={styles.chooseButtonIcon}>↓</Text>}
          <Text style={styles.chooseButtonText}>
            {t(isInspecting ? 'takeoutImport.inspecting' : preview ? 'takeoutImport.chooseAnother' : 'takeoutImport.chooseFile')}
          </Text>
        </Pressable>
        <Text style={styles.privacyHint}>{t('takeoutImport.privacyHint')}</Text>
      </ScrollView>
    </PlaceSheetLayout>
  );
}

const styles = StyleSheet.create({
  buttonDisabled: { opacity: 0.55 },
  chooseButton: {
    alignItems: 'center',
    backgroundColor: colors.wasabi,
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: spacing.lg,
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  chooseButtonIcon: { color: colors.ink, fontFamily: type.utility, fontSize: 20, fontWeight: '900' },
  chooseButtonText: { color: colors.ink, fontFamily: type.body, fontSize: 15, fontWeight: '900' },
  content: { paddingBottom: 36, paddingHorizontal: spacing.page, paddingTop: spacing.md },
  description: { color: colors.muted, fontFamily: type.body, fontSize: 15, lineHeight: 22 },
  emptyPreview: { color: colors.panelMuted, fontFamily: type.body, fontSize: 14, lineHeight: 20, marginTop: spacing.sm },
  errorText: { color: '#B73324', fontFamily: type.body, fontSize: 13, fontWeight: '800', lineHeight: 19, marginTop: spacing.md },
  fileList: { borderTopColor: colors.rule, borderTopWidth: StyleSheet.hairlineWidth, marginTop: spacing.md },
  fileMore: { color: colors.panelMuted, fontFamily: type.body, fontSize: 12, marginTop: spacing.xs },
  fileName: { color: colors.paper, flex: 1, fontFamily: type.body, fontSize: 13, fontWeight: '800' },
  fileRow: { alignItems: 'center', borderBottomColor: colors.rule, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 8, paddingVertical: 10 },
  fileSize: { color: colors.panelMuted, fontFamily: type.utility, fontSize: 10 },
  fileTicket: { alignItems: 'center', backgroundColor: '#354049', borderRadius: 5, justifyContent: 'center', paddingHorizontal: 6, paddingVertical: 4 },
  fileTicketText: { color: colors.wasabi, fontFamily: type.utility, fontSize: 8, fontWeight: '900', letterSpacing: 0.4 },
  inspectionEyebrow: { color: colors.wasabi, fontFamily: type.utility, fontSize: 10, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase' },
  inspectionHeader: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  inspectionPanel: { backgroundColor: colors.ink, borderRadius: radii.panel, marginTop: spacing.lg, padding: spacing.md },
  inspectionSeal: { alignItems: 'center', backgroundColor: colors.wasabi, borderRadius: radii.pill, height: 30, justifyContent: 'center', width: 30 },
  inspectionSealText: { color: colors.ink, fontFamily: type.body, fontSize: 17, fontWeight: '900' },
  inspectionTitle: { color: colors.paper, fontFamily: type.display, fontSize: 22, fontWeight: '900', letterSpacing: -0.4, marginTop: 3 },
  limitPill: { borderColor: '#D6DCD7', borderRadius: radii.pill, borderWidth: StyleSheet.hairlineWidth, color: colors.muted, fontFamily: type.utility, fontSize: 9, fontWeight: '800', letterSpacing: 0.2, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 5 },
  limitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md },
  listLabel: { color: colors.panelMuted, fontFamily: type.utility, fontSize: 10, fontWeight: '800', letterSpacing: 0.9, marginBottom: 3, textTransform: 'uppercase' },
  nextBoundary: { borderTopColor: colors.rule, borderTopWidth: StyleSheet.hairlineWidth, color: colors.panelMuted, fontFamily: type.body, fontSize: 12, lineHeight: 18, marginTop: spacing.md, paddingTop: spacing.sm },
  placeList: { marginTop: spacing.md },
  placeName: { color: colors.paper, fontFamily: type.body, fontSize: 14, fontWeight: '800' },
  placeNumber: { color: colors.wasabi, fontFamily: type.utility, fontSize: 10, width: 21 },
  placeRow: { alignItems: 'center', borderBottomColor: colors.rule, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 8, minHeight: 48 },
  placeSource: { color: colors.panelMuted, fontFamily: type.body, fontSize: 11, marginTop: 2 },
  placeText: { flex: 1 },
  privacyHint: { color: colors.muted, fontFamily: type.body, fontSize: 12, lineHeight: 18, marginHorizontal: spacing.xs, marginTop: spacing.sm, textAlign: 'center' },
  privateMark: { backgroundColor: colors.wasabi, borderRadius: radii.pill, height: 7, width: 7 },
  reviewButton: { alignItems: 'center', backgroundColor: colors.wasabi, borderRadius: radii.pill, justifyContent: 'center', marginTop: spacing.md, minHeight: 48, paddingHorizontal: spacing.md },
  reviewButtonText: { color: colors.ink, fontFamily: type.body, fontSize: 14, fontWeight: '900' },
  routeCard: { backgroundColor: '#E8ECE5', borderRadius: 18, gap: spacing.sm, marginTop: spacing.md, padding: spacing.md },
  routeDot: { borderRadius: radii.pill, height: 10, width: 10 },
  routeDotEnd: { backgroundColor: colors.wasabi },
  routeDotStart: { backgroundColor: colors.tomato },
  routeLabel: { color: colors.ink, fontFamily: type.body, fontSize: 13, fontWeight: '900' },
  routeLine: { backgroundColor: '#B6C0B8', height: 32, left: 22, position: 'absolute', top: 32, width: StyleSheet.hairlineWidth },
  routeStop: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  routeText: { color: colors.muted, fontFamily: type.body, fontSize: 12, lineHeight: 17, marginTop: 2 },
  stat: { flex: 1 },
  statDivider: { backgroundColor: colors.rule, height: 28, width: StyleSheet.hairlineWidth },
  statLabel: { color: colors.panelMuted, fontFamily: type.utility, fontSize: 9, fontWeight: '800', letterSpacing: 0.3, marginTop: 2, textTransform: 'uppercase' },
  statsRow: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: spacing.md },
  statValue: { color: colors.paper, fontFamily: type.display, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
});
