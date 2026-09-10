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
import { PlaceSheetLayout } from '@/features/places/PlaceSheetLayout';
import type { SavedPlaceDraft } from '@/features/places/placeSearchApi';
import { useGoogleLinkFlow } from '@/features/share-inbox/useGoogleLinkFlow';

type GoogleLinkSheetProps = Readonly<{
  inputUrl: string;
  onDismiss: () => void;
  onSaved: (savedPlace: SavedPlaceDraft) => void;
  sourceHost: string | undefined;
  visible: boolean;
}>;

const hostFromUrl = (inputUrl: string): string | null => {
  try {
    return new URL(inputUrl).hostname.toLocaleLowerCase('en-US');
  } catch {
    return null;
  }
};

export function GoogleLinkSheet({ inputUrl, onDismiss, onSaved, sourceHost, visible }: GoogleLinkSheetProps) {
  const { t } = useTranslation();
  const {
    backToEntry,
    backToResults,
    candidates,
    checkLink,
    chooseCandidate,
    close,
    error,
    isManualSearch,
    isResolving,
    isSaving,
    isSearching,
    linkValue,
    manualQuery,
    runManualSearch,
    save,
    selected,
    setLinkValue,
    setManualQuery,
    stage,
  } = useGoogleLinkFlow({ inputUrl, onDismiss, onSaved });

  const currentHost = sourceHost ?? hostFromUrl(linkValue);
  const title = stage === 'confirm' ? t('googleLink.confirmTitle') : t('googleLink.title');

  return (
    <PlaceSheetLayout
      closeLabel={t('googleLink.close')}
      eyebrow={t('googleLink.eyebrow')}
      onDismiss={close}
      title={title}
      visible={visible}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {stage === 'entry' ? (
          <>
            <View style={styles.receipt}>
              <View style={styles.receiptTop}>
                <Text style={styles.receiptLabel}>{t('googleLink.sourceLabel')}</Text>
                <View accessibilityElementsHidden style={styles.receiptDot} />
              </View>
              <Text numberOfLines={1} style={styles.receiptHost}>
                {currentHost ?? t('googleLink.pasteSource')}
              </Text>
              <View accessibilityElementsHidden style={styles.perforation}>
                <View style={styles.perforationDot} />
                <View style={styles.perforationDot} />
                <View style={styles.perforationDot} />
                <View style={styles.perforationDot} />
                <View style={styles.perforationDot} />
              </View>
              <Text style={styles.receiptFoot}>{t('googleLink.sourceFoot')}</Text>
            </View>

            <Text style={styles.description}>{t('googleLink.description')}</Text>
            <Text style={styles.label}>{t('googleLink.inputLabel')}</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              maxLength={10_000}
              onChangeText={setLinkValue}
              onSubmitEditing={() => void checkLink()}
              placeholder={t('googleLink.inputPlaceholder')}
              placeholderTextColor={colors.muted}
              returnKeyType="go"
              style={[styles.input, styles.linkInput]}
              value={linkValue}
            />
            <Text style={styles.safetyNote}>{t('googleLink.safetyNote')}</Text>
            {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: isResolving }}
              disabled={isResolving}
              onPress={() => void checkLink()}
              style={[styles.primaryButton, isResolving ? styles.buttonDisabled : null]}
            >
              {isResolving ? <ActivityIndicator color={colors.paper} size="small" /> : null}
              <Text style={styles.primaryButtonText}>{t('googleLink.checkLink')}</Text>
            </Pressable>
          </>
        ) : null}

        {stage === 'results' ? (
          <>
            <View style={styles.linkStub}>
              <Text style={styles.stubLabel}>{isManualSearch ? t('googleLink.manualEyebrow') : t('googleLink.linkMatch')}</Text>
              <Text numberOfLines={1} style={styles.stubHost}>{currentHost ?? t('googleLink.pasteSource')}</Text>
            </View>

            {isManualSearch ? (
              <>
                <Text style={styles.description}>{t('googleLink.manualDescription')}</Text>
                <View style={styles.searchRow}>
                  <TextInput
                    autoCapitalize="words"
                    autoFocus
                    onChangeText={setManualQuery}
                    onSubmitEditing={() => void runManualSearch()}
                    placeholder={t('googleLink.manualPlaceholder')}
                    placeholderTextColor={colors.muted}
                    returnKeyType="search"
                    style={styles.searchInput}
                    value={manualQuery}
                  />
                  <Pressable
                    accessibilityLabel={t('googleLink.manualSearch')}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: isSearching }}
                    disabled={isSearching}
                    onPress={() => void runManualSearch()}
                    style={[styles.searchButton, isSearching ? styles.buttonDisabled : null]}
                  >
                    {isSearching ? <ActivityIndicator color={colors.paper} size="small" /> : <Text style={styles.searchButtonText}>↗</Text>}
                  </Pressable>
                </View>
              </>
            ) : (
              <Text style={styles.description}>{t('googleLink.matchDescription')}</Text>
            )}

            {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
            {candidates.length > 0 ? <Text style={styles.resultLabel}>{t('googleLink.candidates')}</Text> : null}
            {candidates.map((candidate) => (
              <Pressable
                accessibilityRole="button"
                key={candidate.ticket}
                onPress={() => chooseCandidate(candidate)}
                style={({ pressed }) => [styles.candidate, pressed ? styles.candidatePressed : null]}
              >
                <View style={styles.candidateMark}>
                  <Text style={styles.candidateMarkText}>+</Text>
                </View>
                <View style={styles.candidateCopy}>
                  <Text numberOfLines={1} style={styles.candidateName}>{candidate.displayName}</Text>
                  <Text numberOfLines={2} style={styles.candidateAddress}>{candidate.address}</Text>
                </View>
                <Text style={styles.candidateArrow}>→</Text>
              </Pressable>
            ))}
            {isManualSearch && candidates.length === 0 ? (
              <View style={styles.emptyResult}>
                <Text style={styles.emptyTitle}>{t('googleLink.manualEmptyTitle')}</Text>
                <Text style={styles.emptyBody}>{t('googleLink.manualEmptyBody')}</Text>
              </View>
            ) : null}
            <Pressable accessibilityRole="button" onPress={backToEntry} style={styles.backButton}>
              <Text style={styles.backText}>{t('googleLink.backToLink')}</Text>
            </Pressable>
          </>
        ) : null}

        {stage === 'confirm' && selected ? (
          <>
            <View style={styles.confirmReceipt}>
              <Text style={styles.confirmLabel}>{t('googleLink.confirmCandidate')}</Text>
              <Text style={styles.confirmName}>{selected.displayName}</Text>
              <Text style={styles.confirmAddress}>{selected.address}</Text>
              {selected.isPreview ? <Text style={styles.previewMarker}>{t('googleLink.previewResult')}</Text> : null}
              <View style={styles.confirmRule} />
              <Text style={styles.confirmSource}>{t('googleLink.confirmSource', { host: currentHost ?? t('googleLink.pasteSource') })}</Text>
            </View>
            <Text style={styles.privateNote}>{t('googleLink.privateNote')}</Text>
            {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: isSaving }}
              disabled={isSaving}
              onPress={() => void save()}
              style={[styles.primaryButton, isSaving ? styles.buttonDisabled : null]}
            >
              {isSaving ? <ActivityIndicator color={colors.paper} size="small" /> : null}
              <Text style={styles.primaryButtonText}>{t('googleLink.save')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={backToResults} style={styles.backButton}>
              <Text style={styles.backText}>{t('googleLink.backToCandidates')}</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </PlaceSheetLayout>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignSelf: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  backText: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.58,
  },
  candidate: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderColor: colors.rule,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.sm,
  },
  candidateAddress: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  candidateArrow: {
    color: colors.tomato,
    fontFamily: type.utility,
    fontSize: 16,
  },
  candidateCopy: {
    flex: 1,
  },
  candidateMark: {
    alignItems: 'center',
    backgroundColor: colors.wasabi,
    borderRadius: radii.pill,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  candidateMarkText: {
    color: colors.ink,
    fontFamily: type.utility,
    fontSize: 16,
    fontWeight: '700',
  },
  candidateName: {
    color: colors.ink,
    fontFamily: type.body,
    fontSize: 15,
    fontWeight: '900',
  },
  candidatePressed: {
    backgroundColor: '#F7FAE8',
  },
  confirmAddress: {
    color: colors.panelMuted,
    fontFamily: type.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  confirmLabel: {
    color: colors.wasabi,
    fontFamily: type.utility,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  confirmName: {
    color: colors.paper,
    fontFamily: type.display,
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: -0.7,
    lineHeight: 32,
    marginTop: 8,
  },
  confirmReceipt: {
    backgroundColor: colors.ink,
    borderRadius: radii.panel,
    padding: spacing.lg,
  },
  confirmRule: {
    backgroundColor: colors.rule,
    height: StyleSheet.hairlineWidth,
    marginTop: spacing.md,
  },
  confirmSource: {
    color: colors.panelMuted,
    fontFamily: type.utility,
    fontSize: 10,
    lineHeight: 15,
    marginTop: spacing.sm,
  },
  content: {
    gap: spacing.md,
    padding: spacing.page,
    paddingBottom: spacing.lg,
  },
  description: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 15,
    lineHeight: 22,
  },
  emptyBody: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  emptyResult: {
    backgroundColor: '#E9ECE5',
    borderRadius: 18,
    padding: spacing.md,
  },
  emptyTitle: {
    color: colors.ink,
    fontFamily: type.body,
    fontSize: 15,
    fontWeight: '900',
  },
  errorText: {
    color: '#A22B1E',
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  input: {
    backgroundColor: colors.paper,
    borderColor: colors.rule,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    color: colors.ink,
    fontFamily: type.body,
    fontSize: 15,
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
  },
  label: {
    color: colors.ink,
    fontFamily: type.utility,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  linkInput: {
    fontSize: 13,
  },
  linkStub: {
    borderBottomColor: colors.rule,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.rule,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
  },
  perforation: {
    flexDirection: 'row',
    gap: 7,
    marginTop: spacing.md,
  },
  perforationDot: {
    backgroundColor: colors.rule,
    borderRadius: radii.pill,
    height: 3,
    width: 3,
  },
  previewMarker: {
    color: colors.wasabi,
    fontFamily: type.utility,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: spacing.sm,
    textTransform: 'uppercase',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  primaryButtonText: {
    color: colors.paper,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: '900',
  },
  privateNote: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 13,
    lineHeight: 19,
  },
  receipt: {
    backgroundColor: colors.ink,
    borderRadius: radii.panel,
    padding: spacing.lg,
  },
  receiptDot: {
    backgroundColor: colors.tomato,
    borderRadius: radii.pill,
    height: 9,
    width: 9,
  },
  receiptFoot: {
    color: colors.panelMuted,
    fontFamily: type.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: spacing.sm,
  },
  receiptHost: {
    color: colors.paper,
    fontFamily: type.utility,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 6,
  },
  receiptLabel: {
    color: colors.wasabi,
    fontFamily: type.utility,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  receiptTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  resultLabel: {
    color: colors.ink,
    fontFamily: type.utility,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
  },
  safetyNote: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: -6,
  },
  searchButton: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: radii.pill,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  searchButtonText: {
    color: colors.paper,
    fontFamily: type.utility,
    fontSize: 18,
  },
  searchInput: {
    backgroundColor: colors.paper,
    borderColor: colors.rule,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    color: colors.ink,
    flex: 1,
    fontFamily: type.body,
    fontSize: 15,
    paddingHorizontal: spacing.sm,
    paddingVertical: 11,
  },
  searchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  stubHost: {
    color: colors.ink,
    fontFamily: type.utility,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },
  stubLabel: {
    color: colors.tomato,
    fontFamily: type.utility,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
