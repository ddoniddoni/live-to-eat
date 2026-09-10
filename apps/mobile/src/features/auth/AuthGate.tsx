import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, type } from '@/components/tokens';
import {
  type AuthFailureCode,
  type OnboardingInput,
  type SupportedLocale,
  isValidHandle,
} from '@/features/auth/authApi';
import type { AuthSessionController } from '@/features/auth/useAuthSession';

type AuthGateProps = {
  auth: AuthSessionController;
  onChangeLanguage: (locale: SupportedLocale) => Promise<void>;
};

type PrimaryButtonProps = {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  variant?: 'dark' | 'light';
};

const PrimaryButton = ({ disabled = false, label, onPress, variant = 'dark' }: PrimaryButtonProps) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ disabled }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [
      styles.primaryButton,
      variant === 'light' ? styles.primaryButtonLight : styles.primaryButtonDark,
      disabled ? styles.buttonDisabled : null,
      pressed && !disabled ? styles.buttonPressed : null,
    ]}
  >
    <Text style={[styles.primaryButtonText, variant === 'light' ? styles.primaryButtonLightText : null]}>{label}</Text>
  </Pressable>
);

const StatusPage = ({ body, title }: { body: string; title: string }) => (
  <SafeAreaView style={styles.safeArea}>
    <View style={styles.statusPage}>
      <ActivityIndicator color={colors.tomato} size="small" />
      <Text accessibilityRole="header" style={styles.statusTitle}>
        {title}
      </Text>
      <Text style={styles.statusBody}>{body}</Text>
    </View>
  </SafeAreaView>
);

const ErrorNotice = ({ code }: { code: AuthFailureCode | null }) => {
  const { t } = useTranslation();
  if (!code) return null;

  const key = `auth.errors.${code}`;
  return (
    <View accessibilityRole="alert" style={styles.errorNotice}>
      <Text style={styles.errorText}>{t(key)}</Text>
    </View>
  );
};

const SignInScreen = ({ auth }: { auth: AuthSessionController }) => {
  const { t } = useTranslation();
  const [nativeAppleAvailable, setNativeAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    void AppleAuthentication.isAvailableAsync().then(setNativeAppleAvailable).catch(() => {
      setNativeAppleAvailable(false);
    });
  }, []);

  const disabled = auth.busy;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>{t('auth.signInEyebrow')}</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {t('auth.signInTitle')}
        </Text>
        <Text style={styles.lead}>{t('auth.signInBody')}</Text>

        <View style={styles.actionGroup}>
          <PrimaryButton disabled={disabled} label={t('auth.google')} onPress={() => void auth.signInWithGoogle()} />
          {Platform.OS === 'ios' && nativeAppleAvailable ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE}
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              cornerRadius={14}
              onPress={() => void auth.signInWithNativeApple()}
              style={[styles.appleButton, disabled ? styles.buttonDisabled : null]}
            />
          ) : (
            <PrimaryButton
              disabled={disabled}
              label={t('auth.appleBrowser')}
              onPress={() => void auth.signInWithAppleBrowser()}
              variant="light"
            />
          )}
        </View>

        <ErrorNotice code={auth.error} />

        <View style={styles.detailCard}>
          <Text style={styles.detailTitle}>{t('auth.googleBoundaryTitle')}</Text>
          <Text style={styles.detailBody}>{t('auth.googleBoundaryBody')}</Text>
        </View>
        <View style={styles.detailCard}>
          <Text style={styles.detailTitle}>{t('auth.accountRecoveryTitle')}</Text>
          <Text style={styles.detailBody}>{t('auth.accountRecoveryBody')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const OnboardingScreen = ({ auth, onChangeLanguage }: AuthGateProps) => {
  const { i18n, t } = useTranslation();
  const initialLocale: SupportedLocale = i18n.language.startsWith('ko') ? 'ko' : 'en';
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [locale, setLocale] = useState<SupportedLocale>(initialLocale);
  const [accepted, setAccepted] = useState(false);
  const handleIsValid = isValidHandle(handle);
  const canContinue = displayName.trim().length > 0 && handleIsValid && accepted && !auth.busy;

  const chooseLocale = (nextLocale: SupportedLocale): void => {
    setLocale(nextLocale);
    void onChangeLanguage(nextLocale);
  };

  const submit = (): void => {
    if (!canContinue) return;
    const input: OnboardingInput = { displayName, handle, locale };
    void auth.completeOnboarding(input);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>{t('auth.onboardingEyebrow')}</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {t('auth.onboardingTitle')}
        </Text>
        <Text style={styles.lead}>{t('auth.onboardingBody')}</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>{t('auth.displayName')}</Text>
          <TextInput
            autoCapitalize="words"
            maxLength={80}
            onChangeText={setDisplayName}
            placeholder={t('auth.displayNamePlaceholder')}
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={displayName}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>{t('auth.handle')}</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={30}
            onChangeText={setHandle}
            placeholder={t('auth.handlePlaceholder')}
            placeholderTextColor={colors.muted}
            style={[styles.input, handle.length > 0 && !handleIsValid ? styles.inputInvalid : null]}
            value={handle}
          />
          <Text style={styles.fieldHint}>{t('auth.handleHint')}</Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>{t('auth.language')}</Text>
          <View style={styles.languageRow}>
            {(['ko', 'en'] as const).map((option) => {
              const selected = locale === option;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  key={option}
                  onPress={() => chooseLocale(option)}
                  style={[styles.languageOption, selected ? styles.languageOptionSelected : null]}
                >
                  <Text style={[styles.languageText, selected ? styles.languageTextSelected : null]}>
                    {option === 'ko' ? '한국어' : 'English'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: accepted }}
          onPress={() => setAccepted((value) => !value)}
          style={styles.consentRow}
        >
          <View accessibilityElementsHidden style={[styles.checkbox, accepted ? styles.checkboxChecked : null]} />
          <Text style={styles.consentText}>{t('auth.consent')}</Text>
        </Pressable>
        <Text style={styles.legalNote}>{t('auth.legalNote')}</Text>

        <ErrorNotice code={auth.error} />
        <PrimaryButton disabled={!canContinue} label={t('auth.finish')} onPress={submit} />
      </ScrollView>
    </SafeAreaView>
  );
};

const ConfigurationScreen = ({ auth }: { auth: AuthSessionController }) => {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.statusPage}>
        <Text style={styles.eyebrow}>{t('auth.setupEyebrow')}</Text>
        <Text accessibilityRole="header" style={styles.statusTitle}>
          {t('auth.configurationTitle')}
        </Text>
        <Text style={styles.statusBody}>{t('auth.configurationBody')}</Text>
        <PrimaryButton label={t('auth.retry')} onPress={() => void auth.retry()} variant="light" />
      </View>
    </SafeAreaView>
  );
};

const RetryScreen = ({ auth }: { auth: AuthSessionController }) => {
  const { t } = useTranslation();
  const blocked = auth.status === 'account-blocked';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.statusPage}>
        <Text accessibilityRole="header" style={styles.statusTitle}>
          {t(blocked ? 'auth.blockedTitle' : 'auth.connectionTitle')}
        </Text>
        <Text style={styles.statusBody}>{t(blocked ? 'auth.blockedBody' : 'auth.connectionBody')}</Text>
        <ErrorNotice code={auth.error} />
        <PrimaryButton disabled={auth.busy} label={t('auth.retry')} onPress={() => void auth.retry()} variant="light" />
        {blocked ? <PrimaryButton disabled={auth.busy} label={t('auth.signOut')} onPress={() => void auth.signOut()} /> : null}
      </View>
    </SafeAreaView>
  );
};

export const AuthGate = ({ auth, onChangeLanguage }: AuthGateProps) => {
  const { t } = useTranslation();

  if (auth.status === 'loading') {
    return <StatusPage body={t('auth.loadingBody')} title={t('auth.loadingTitle')} />;
  }

  if (auth.status === 'configuration-required') return <ConfigurationScreen auth={auth} />;
  if (auth.status === 'signed-out') return <SignInScreen auth={auth} />;
  if (auth.status === 'onboarding') return <OnboardingScreen auth={auth} onChangeLanguage={onChangeLanguage} />;

  return <RetryScreen auth={auth} />;
};

const styles = StyleSheet.create({
  actionGroup: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  appleButton: {
    height: 52,
    opacity: 1,
    width: '100%',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    opacity: 0.82,
  },
  checkbox: {
    borderColor: colors.ink,
    borderRadius: 5,
    borderWidth: 2,
    height: 20,
    marginTop: 1,
    width: 20,
  },
  checkboxChecked: {
    backgroundColor: colors.wasabi,
  },
  configurationBody: {
    color: colors.muted,
  },
  consentRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  consentText: {
    color: colors.ink,
    flex: 1,
    fontFamily: type.body,
    fontSize: 14,
    lineHeight: 21,
  },
  detailBody: {
    color: colors.panelMuted,
    fontFamily: type.body,
    fontSize: 14,
    lineHeight: 20,
  },
  detailCard: {
    backgroundColor: colors.ink,
    borderRadius: radii.panel,
    gap: 6,
    marginTop: spacing.sm,
    padding: spacing.lg,
  },
  detailTitle: {
    color: colors.paper,
    fontFamily: type.body,
    fontSize: 15,
    fontWeight: '800',
  },
  errorNotice: {
    backgroundColor: '#FFE4DE',
    borderColor: colors.tomato,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: spacing.md,
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
    color: colors.muted,
    fontFamily: type.utility,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  fieldGroup: {
    gap: 7,
    marginTop: spacing.lg,
  },
  fieldHint: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 12,
    lineHeight: 17,
  },
  fieldLabel: {
    color: colors.ink,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: '800',
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
    paddingVertical: 13,
  },
  inputInvalid: {
    borderColor: colors.tomato,
  },
  languageOption: {
    alignItems: 'center',
    borderColor: '#CDD3CF',
    borderRadius: radii.pill,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10,
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
    color: colors.ink,
    fontFamily: type.body,
    fontSize: 18,
    lineHeight: 27,
    marginTop: spacing.md,
  },
  legalNote: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 12,
    lineHeight: 17,
    marginLeft: 32,
    marginTop: 4,
  },
  page: {
    flexGrow: 1,
    paddingHorizontal: spacing.page,
    paddingVertical: 48,
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  primaryButtonDark: {
    backgroundColor: colors.ink,
  },
  primaryButtonLight: {
    backgroundColor: colors.paper,
    borderColor: colors.ink,
    borderWidth: 1,
  },
  primaryButtonLightText: {
    color: colors.ink,
  },
  primaryButtonText: {
    color: colors.paper,
    fontFamily: type.body,
    fontSize: 16,
    fontWeight: '800',
  },
  safeArea: {
    backgroundColor: colors.canvas,
    flex: 1,
  },
  statusBody: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  statusPage: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  statusTitle: {
    color: colors.ink,
    fontFamily: type.display,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 35,
    textAlign: 'center',
  },
  title: {
    color: colors.ink,
    fontFamily: type.display,
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1.7,
    lineHeight: 46,
    marginTop: spacing.sm,
  },
});
