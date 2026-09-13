import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, type } from '@/components/tokens';
import { Icon, type IconName } from '@/components/ui/Icon';
import {
  type OnboardingInput,
  type SupportedLocale,
  isValidHandle,
} from '@/features/auth/authApi';
import type { AuthSessionController } from '@/features/auth/useAuthSession';

type OnboardingScreenProps = {
  auth: AuthSessionController;
  onChangeLanguage: (locale: SupportedLocale) => Promise<void>;
};

type Step = 'identity' | 'privacy';

const privacyPrinciples: Array<{
  bodyKey: 'auth.onboardingPrivateBody' | 'auth.onboardingSharingBody';
  icon: IconName;
  titleKey: 'auth.onboardingPrivateTitle' | 'auth.onboardingSharingTitle';
}> = [
  {
    bodyKey: 'auth.onboardingPrivateBody',
    icon: 'lock',
    titleKey: 'auth.onboardingPrivateTitle',
  },
  {
    bodyKey: 'auth.onboardingSharingBody',
    icon: 'share',
    titleKey: 'auth.onboardingSharingTitle',
  },
];

const getInitial = (value: string): string => Array.from(value.trim())[0]?.toLocaleUpperCase() ?? 'L';

const BrandHeader = ({ onSignOut }: { onSignOut: () => void }) => {
  const { t } = useTranslation();

  return (
    <View style={styles.brandHeader}>
      <View style={styles.brandIdentity}>
        <View style={styles.brandMark}>
          <Icon color={colors.paper} name="pin" size={16} />
        </View>
        <Text style={styles.wordmark}>LiveToEat</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        hitSlop={8}
        onPress={onSignOut}
        style={({ pressed }) => [styles.signOutButton, pressed ? styles.pressed : null]}
      >
        <Text style={styles.signOutText}>{t('auth.signOut')}</Text>
      </Pressable>
    </View>
  );
};

const Progress = ({ step }: { step: Step }) => {
  const { t } = useTranslation();
  const stepNumber = step === 'identity' ? 1 : 2;

  return (
    <View style={styles.progressRow}>
      <Text style={styles.progressLabel}>{t('auth.onboardingStep', { current: stepNumber, total: 2 })}</Text>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ max: 2, min: 1, now: stepNumber }}
        style={styles.progressTrack}
      >
        <View style={[styles.progressValue, step === 'privacy' ? styles.progressValueComplete : null]} />
      </View>
    </View>
  );
};

const ProfilePreview = ({ displayName, handle }: { displayName: string; handle: string }) => {
  const { t } = useTranslation();
  const name = displayName.trim() || t('auth.onboardingPreviewName');
  const normalizedHandle = handle.trim().toLowerCase() || t('auth.onboardingPreviewHandle');

  return (
    <View accessibilityLabel={t('auth.onboardingPreviewLabel')} style={styles.previewCard}>
      <View accessibilityElementsHidden style={styles.previewDecoration} />
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{getInitial(displayName)}</Text>
      </View>
      <View style={styles.previewCopy}>
        <Text numberOfLines={1} style={styles.previewName}>
          {name}
        </Text>
        <Text numberOfLines={1} style={styles.previewHandle}>
          @{normalizedHandle}
        </Text>
      </View>
      <View style={styles.privateBadge}>
        <Icon color={colors.success} name="lock" size={13} />
        <Text style={styles.privateBadgeText}>{t('auth.onboardingPrivateBadge')}</Text>
      </View>
    </View>
  );
};

const FieldLabel = ({ count, label, limit }: { count?: number; label: string; limit?: number }) => (
  <View style={styles.fieldLabelRow}>
    <Text style={styles.fieldLabel}>{label}</Text>
    {typeof count === 'number' && typeof limit === 'number' ? (
      <Text style={styles.characterCount}>{count}/{limit}</Text>
    ) : null}
  </View>
);

const PrimaryButton = ({
  busy = false,
  disabled = false,
  label,
  onPress,
}: {
  busy?: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ busy, disabled }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [
      styles.primaryButton,
      disabled ? styles.disabled : null,
      pressed && !disabled ? styles.primaryButtonPressed : null,
    ]}
  >
    {busy ? (
      <ActivityIndicator color={colors.paper} />
    ) : (
      <>
        <Text style={styles.primaryButtonText}>{label}</Text>
        <Icon color={colors.paper} name="arrow" size={18} />
      </>
    )}
  </Pressable>
);

export const OnboardingScreen = ({ auth, onChangeLanguage }: OnboardingScreenProps) => {
  const { i18n, t } = useTranslation();
  const { width } = useWindowDimensions();
  const initialLocale: SupportedLocale = i18n.language.startsWith('ko') ? 'ko' : 'en';
  const [step, setStep] = useState<Step>('identity');
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [locale, setLocale] = useState<SupportedLocale>(initialLocale);
  const [accepted, setAccepted] = useState(false);
  const [identityTouched, setIdentityTouched] = useState(false);
  const handleRef = useRef<TextInput>(null);
  const normalizedHandle = handle.trim().toLowerCase();
  const displayNameIsValid = displayName.trim().length > 0;
  const handleIsValid = isValidHandle(normalizedHandle);
  const identityIsValid = displayNameIsValid && handleIsValid;
  const activeStep = auth.error === 'HANDLE_TAKEN' ? 'identity' : step;
  const identityValidationVisible = identityTouched || auth.error === 'HANDLE_TAKEN';
  const handleHasError = identityValidationVisible && !handleIsValid;
  const nameHasError = identityValidationVisible && !displayNameIsValid;
  const compact = width < 360;

  const clearServerError = (): void => {
    if (auth.error) {
      if (auth.error === 'HANDLE_TAKEN') setStep('identity');
      auth.clearError();
    }
  };

  const continueToPrivacy = (): void => {
    setIdentityTouched(true);
    if (!identityIsValid) return;
    clearServerError();
    setStep('privacy');
  };

  const chooseLocale = (nextLocale: SupportedLocale): void => {
    setLocale(nextLocale);
    void onChangeLanguage(nextLocale);
  };

  const submit = (): void => {
    if (!identityIsValid || !accepted || auth.busy) return;
    const input: OnboardingInput = { displayName, handle: normalizedHandle, locale };
    void auth.completeOnboarding(input);
  };

  const errorMessage = auth.error ? t(`auth.errors.${auth.error}`) : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={[styles.scrollContent, compact ? styles.scrollContentCompact : null]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <BrandHeader onSignOut={() => void auth.signOut()} />
            <Progress step={activeStep} />

            {activeStep === 'identity' ? (
              <View style={styles.stepContent}>
                <View style={styles.headingGroup}>
                  <Text style={styles.eyebrow}>{t('auth.onboardingEyebrow')}</Text>
                  <Text accessibilityRole="header" style={[styles.title, compact ? styles.titleCompact : null]}>
                    {t('auth.onboardingTitle')}
                  </Text>
                  <Text style={styles.lead}>{t('auth.onboardingBody')}</Text>
                </View>

                <ProfilePreview displayName={displayName} handle={normalizedHandle} />

                <View style={styles.formCard}>
                  <View style={styles.fieldGroup}>
                    <FieldLabel count={displayName.length} label={t('auth.displayName')} limit={60} />
                    <TextInput
                      accessibilityHint={nameHasError ? t('auth.displayNameRequired') : undefined}
                      accessibilityLabel={t('auth.displayName')}
                      autoCapitalize="words"
                      autoComplete="name"
                      maxLength={60}
                      onChangeText={(value) => {
                        clearServerError();
                        setDisplayName(value);
                      }}
                      onSubmitEditing={() => handleRef.current?.focus()}
                      placeholder={t('auth.displayNamePlaceholder')}
                      placeholderTextColor={colors.muted}
                      returnKeyType="next"
                      style={[styles.input, nameHasError ? styles.inputInvalid : null]}
                      value={displayName}
                    />
                    {nameHasError ? <Text style={styles.fieldError}>{t('auth.displayNameRequired')}</Text> : null}
                  </View>

                  <View style={styles.fieldGroup}>
                    <FieldLabel label={t('auth.handle')} />
                    <View style={[styles.handleShell, handleHasError ? styles.inputInvalid : null]}>
                      <Text style={styles.handlePrefix}>@</Text>
                      <TextInput
                        accessibilityHint={handleHasError ? t('auth.handleHint') : undefined}
                        accessibilityLabel={t('auth.handle')}
                        autoCapitalize="none"
                        autoCorrect={false}
                        maxLength={30}
                        onBlur={() => {
                          if (handle.length > 0) setIdentityTouched(true);
                        }}
                        onChangeText={(value) => {
                          clearServerError();
                          setHandle(value.replace(/^@/, '').toLowerCase());
                        }}
                        onSubmitEditing={continueToPrivacy}
                        placeholder={t('auth.handlePlaceholderShort')}
                        placeholderTextColor={colors.muted}
                        ref={handleRef}
                        returnKeyType="done"
                        style={styles.handleInput}
                        value={handle}
                      />
                      {handleIsValid ? (
                        <View accessibilityLabel={t('auth.handleValid')} style={styles.validIcon}>
                          <Icon color={colors.success} name="check" size={15} />
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.fieldHint, handleHasError ? styles.fieldError : null]}>
                      {auth.error === 'HANDLE_TAKEN' ? t('auth.errors.HANDLE_TAKEN') : t('auth.handleHint')}
                    </Text>
                  </View>
                </View>

                <PrimaryButton
                  disabled={!identityIsValid}
                  label={t('auth.onboardingContinue')}
                  onPress={continueToPrivacy}
                />
              </View>
            ) : (
              <View style={styles.stepContent}>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => setStep('identity')}
                  style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : null]}
                >
                  <Icon color={colors.ink} name="back" size={18} />
                  <Text style={styles.backButtonText}>{t('common.back')}</Text>
                </Pressable>

                <View style={styles.headingGroup}>
                  <Text style={styles.eyebrow}>{t('auth.onboardingPrivacyEyebrow')}</Text>
                  <Text accessibilityRole="header" style={[styles.title, compact ? styles.titleCompact : null]}>
                    {t('auth.onboardingPrivacyTitle')}
                  </Text>
                  <Text style={styles.lead}>{t('auth.onboardingPrivacyBody')}</Text>
                </View>

                <View style={styles.principleList}>
                  {privacyPrinciples.map((principle) => (
                    <View key={principle.titleKey} style={styles.principleCard}>
                      <View style={styles.principleIcon}>
                        <Icon color={colors.success} name={principle.icon} size={21} />
                      </View>
                      <View style={styles.principleCopy}>
                        <Text style={styles.principleTitle}>{t(principle.titleKey)}</Text>
                        <Text style={styles.principleBody}>{t(principle.bodyKey)}</Text>
                      </View>
                    </View>
                  ))}
                </View>

                <View style={styles.formCard}>
                  <Text style={styles.fieldLabel}>{t('auth.language')}</Text>
                  <View accessibilityRole="radiogroup" style={styles.languageRow}>
                    {(['ko', 'en'] as const).map((option) => {
                      const selected = locale === option;
                      return (
                        <Pressable
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                          key={option}
                          onPress={() => chooseLocale(option)}
                          style={({ pressed }) => [
                            styles.languageOption,
                            selected ? styles.languageOptionSelected : null,
                            pressed ? styles.pressed : null,
                          ]}
                        >
                          <Text style={[styles.languageText, selected ? styles.languageTextSelected : null]}>
                            {option === 'ko' ? '한국어' : 'English'}
                          </Text>
                          {selected ? <Icon color={colors.paper} name="check" size={16} /> : null}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: accepted }}
                  onPress={() => setAccepted((value) => !value)}
                  style={({ pressed }) => [styles.consentCard, pressed ? styles.pressed : null]}
                >
                  <View style={[styles.checkbox, accepted ? styles.checkboxChecked : null]}>
                    {accepted ? <Icon color={colors.paper} name="check" size={15} /> : null}
                  </View>
                  <View style={styles.consentCopy}>
                    <Text style={styles.consentText}>{t('auth.consent')}</Text>
                    <Text style={styles.legalNote}>{t('auth.legalNote')}</Text>
                  </View>
                </Pressable>

                {errorMessage ? (
                  <View accessibilityRole="alert" style={styles.errorNotice}>
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                ) : null}

                <PrimaryButton
                  busy={auth.busy}
                  disabled={!accepted || auth.busy}
                  label={t('auth.finish')}
                  onPress={submit}
                />
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.tomato,
    borderColor: colors.paper,
    borderRadius: 25,
    borderWidth: 3,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  avatarText: {
    color: colors.paper,
    fontFamily: type.display,
    fontSize: 23,
    fontWeight: '900',
  },
  backButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 5,
    minHeight: 44,
  },
  backButtonText: {
    color: colors.ink,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: '800',
  },
  brandHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  brandIdentity: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: colors.tomato,
    borderRadius: 11,
    height: 34,
    justifyContent: 'center',
    transform: [{ rotate: '-5deg' }],
    width: 34,
  },
  characterCount: {
    color: colors.muted,
    fontFamily: type.utility,
    fontSize: 11,
  },
  checkbox: {
    alignItems: 'center',
    borderColor: '#B8BDB9',
    borderRadius: 7,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    marginTop: 1,
    width: 24,
  },
  checkboxChecked: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  consentCard: {
    alignItems: 'flex-start',
    backgroundColor: colors.paper,
    borderColor: colors.rule,
    borderRadius: radii.panel,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  consentCopy: {
    flex: 1,
    gap: 5,
  },
  consentText: {
    color: colors.ink,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
  },
  content: {
    alignSelf: 'center',
    maxWidth: 480,
    width: '100%',
  },
  disabled: {
    opacity: 0.42,
  },
  errorNotice: {
    backgroundColor: '#FFE4DE',
    borderColor: colors.tomato,
    borderRadius: 14,
    borderWidth: 1,
    padding: spacing.sm,
  },
  errorText: {
    color: colors.ink,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  eyebrow: {
    color: colors.tomato,
    fontFamily: type.utility,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.7,
    textTransform: 'uppercase',
  },
  fieldError: {
    color: colors.tomato,
  },
  fieldGroup: {
    gap: 7,
  },
  fieldHint: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 12,
    lineHeight: 18,
  },
  fieldLabel: {
    color: colors.ink,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: '800',
  },
  fieldLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  formCard: {
    backgroundColor: colors.paper,
    borderColor: colors.rule,
    borderRadius: radii.panel,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  handleInput: {
    color: colors.ink,
    flex: 1,
    fontFamily: type.body,
    fontSize: 16,
    paddingVertical: 13,
  },
  handlePrefix: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 16,
    fontWeight: '800',
    marginLeft: spacing.sm,
  },
  handleShell: {
    alignItems: 'center',
    backgroundColor: colors.canvas,
    borderColor: '#CDD3CF',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 50,
  },
  headingGroup: {
    gap: spacing.sm,
  },
  input: {
    backgroundColor: colors.canvas,
    borderColor: '#CDD3CF',
    borderRadius: 14,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: type.body,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: spacing.sm,
    paddingVertical: 13,
  },
  inputInvalid: {
    borderColor: colors.tomato,
  },
  keyboardView: {
    flex: 1,
  },
  languageOption: {
    alignItems: 'center',
    borderColor: '#CDD3CF',
    borderRadius: 13,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.sm,
  },
  languageOptionSelected: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  languageRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  languageText: {
    color: colors.ink,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: '800',
  },
  languageTextSelected: {
    color: colors.paper,
  },
  lead: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 16,
    lineHeight: 24,
  },
  legalNote: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 11,
    lineHeight: 17,
  },
  pressed: {
    opacity: 0.72,
  },
  previewCard: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: radii.panel,
    boxShadow: '0 16px 26px rgba(37, 44, 41, 0.16)',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 92,
    overflow: 'hidden',
    padding: spacing.md,
    position: 'relative',
  },
  previewCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  previewDecoration: {
    backgroundColor: colors.tomato,
    borderRadius: 70,
    height: 120,
    opacity: 0.24,
    position: 'absolute',
    right: -50,
    top: -64,
    width: 120,
  },
  previewHandle: {
    color: '#BCC3BE',
    fontFamily: type.utility,
    fontSize: 12,
  },
  previewName: {
    color: colors.paper,
    fontFamily: type.display,
    fontSize: 20,
    fontWeight: '900',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.tomato,
    borderRadius: 15,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: spacing.md,
  },
  primaryButtonPressed: {
    opacity: 0.86,
    transform: [{ translateY: 1 }],
  },
  primaryButtonText: {
    color: colors.paper,
    fontFamily: type.body,
    fontSize: 16,
    fontWeight: '900',
  },
  principleBody: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 13,
    lineHeight: 19,
  },
  principleCard: {
    alignItems: 'flex-start',
    backgroundColor: colors.sage,
    borderRadius: 17,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  principleCopy: {
    flex: 1,
    gap: 3,
  },
  principleIcon: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderRadius: 13,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  principleList: {
    gap: spacing.xs,
  },
  principleTitle: {
    color: colors.ink,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: '900',
  },
  privateBadge: {
    alignItems: 'center',
    backgroundColor: colors.wasabi,
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  privateBadgeText: {
    color: colors.success,
    fontFamily: type.utility,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  progressLabel: {
    color: colors.muted,
    fontFamily: type.utility,
    fontSize: 11,
    fontWeight: '700',
  },
  progressRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  progressTrack: {
    backgroundColor: colors.rule,
    borderRadius: radii.pill,
    flex: 1,
    height: 5,
    overflow: 'hidden',
  },
  progressValue: {
    backgroundColor: colors.tomato,
    borderRadius: radii.pill,
    height: '100%',
    width: '50%',
  },
  progressValueComplete: {
    width: '100%',
  },
  safeArea: {
    backgroundColor: colors.canvas,
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 44,
    paddingHorizontal: spacing.page,
    paddingTop: spacing.md,
  },
  scrollContentCompact: {
    paddingHorizontal: spacing.md,
  },
  signOutButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 4,
  },
  signOutText: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: '800',
  },
  stepContent: {
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  title: {
    color: colors.ink,
    fontFamily: type.display,
    fontSize: 43,
    fontWeight: '900',
    letterSpacing: -1.7,
    lineHeight: 46,
  },
  titleCompact: {
    fontSize: 37,
    letterSpacing: -1.3,
    lineHeight: 40,
  },
  validIcon: {
    alignItems: 'center',
    backgroundColor: colors.wasabi,
    borderRadius: 11,
    height: 28,
    justifyContent: 'center',
    marginRight: 10,
    width: 28,
  },
  wordmark: {
    color: colors.ink,
    fontFamily: type.display,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
});
