import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useRef, useState, type RefObject } from 'react';
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
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, type } from '@/components/tokens';
import { FoodArtwork, MapArtwork } from '@/components/ui/Artwork';
import { Icon } from '@/components/ui/Icon';
import type { AuthSessionController } from '@/features/auth/useAuthSession';
import { validateCredentials, type AuthMode, type FormErrorKey } from './authForm';
import { HelpLinks } from '@/features/help/HelpLinks';

const copyKeys = {
  'forgot-password': {
    body: 'auth.forgotPasswordBody',
    eyebrow: 'auth.forgotPasswordEyebrow',
    title: 'auth.forgotPasswordTitle',
  },
  'sign-in': {
    body: 'auth.emailSignInBody',
    eyebrow: 'auth.signInEyebrow',
    title: 'auth.emailSignInTitle',
  },
  'sign-up': {
    body: 'auth.signUpBody',
    eyebrow: 'auth.signUpEyebrow',
    title: 'auth.signUpTitle',
  },
} as const;

const BrandHeader = () => (
  <View style={styles.brandHeader}>
    <View style={styles.brandMark}>
      <Icon color={colors.paper} name="pin" size={17} />
    </View>
    <Text style={styles.wordmark}>LiveToEat</Text>
  </View>
);

const Hero = () => (
  <View accessibilityElementsHidden style={styles.hero}>
    <MapArtwork />
    <View style={[styles.foodCard, styles.foodCardLeft]}>
      <FoodArtwork size={74} />
    </View>
    <View style={[styles.foodCard, styles.foodCardRight]}>
      <FoodArtwork kind={1} size={68} />
    </View>
    <View style={styles.heroBadge}>
      <Icon color={colors.success} name="lock" size={14} />
      <Text style={styles.heroBadgeText}>MY PRIVATE MAP</Text>
    </View>
  </View>
);

const AuthField = ({
  label,
  onToggleSecure,
  inputRef,
  secureVisible,
  ...inputProps
}: TextInputProps & {
  label: string;
  inputRef?: RefObject<TextInput | null>;
  onToggleSecure?: () => void;
  secureVisible?: boolean;
}) => {
  const { t } = useTranslation();

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputShell}>
        <TextInput
          {...inputProps}
          accessibilityLabel={label}
          placeholderTextColor={colors.muted}
          ref={inputRef}
          style={[styles.input, onToggleSecure ? styles.inputWithAction : null]}
        />
        {onToggleSecure ? (
          <Pressable
            testID={inputProps.testID ? `${inputProps.testID}-visibility` : undefined}
            accessibilityLabel={t(secureVisible ? 'auth.hidePassword' : 'auth.showPassword')}
            accessibilityRole="button"
            hitSlop={8}
            onPress={onToggleSecure}
            style={({ pressed }) => [styles.inputAction, pressed ? styles.pressed : null]}
          >
            <Text style={styles.inputActionText}>{t(secureVisible ? 'auth.hide' : 'auth.show')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};

const FormNotice = ({ children }: { children: string }) => (
  <View accessibilityRole="alert" style={styles.notice}>
    <View style={styles.noticeDot} />
    <Text style={styles.noticeText}>{children}</Text>
  </View>
);

const SubmitButton = ({ busy, disabled, label, onPress }: {
  busy: boolean;
  disabled: boolean;
  label: string;
  onPress: () => void;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ busy, disabled }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [
      styles.submitButton,
      disabled ? styles.disabled : null,
      pressed && !disabled ? styles.submitButtonPressed : null,
    ]}
  >
    {busy ? <ActivityIndicator color={colors.paper} /> : <Text style={styles.submitButtonText}>{label}</Text>}
  </Pressable>
);

const ProviderButton = ({ disabled, label, mark, onPress }: {
  disabled: boolean;
  label: string;
  mark: string;
  onPress: () => void;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ disabled }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [styles.providerButton, disabled ? styles.disabled : null, pressed ? styles.pressed : null]}
  >
    <View style={styles.providerMark}>
      <Text style={styles.providerMarkText}>{mark}</Text>
    </View>
    <Text style={styles.providerText}>{label}</Text>
  </Pressable>
);

export const AuthCredentialScreen = ({ auth }: { auth: AuthSessionController }) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [localError, setLocalError] = useState<FormErrorKey | null>(null);
  const [nativeAppleAvailable, setNativeAppleAvailable] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const confirmationRef = useRef<TextInput>(null);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    void AppleAuthentication.isAvailableAsync().then(setNativeAppleAvailable).catch(() => {
      setNativeAppleAvailable(false);
    });
  }, []);

  const clearFeedback = (): void => {
    if (localError) setLocalError(null);
    if (auth.error) auth.clearError();
  };

  const updateEmail = (value: string): void => {
    clearFeedback();
    setEmail(value);
  };

  const updatePassword = (value: string): void => {
    clearFeedback();
    setPassword(value);
  };

  const updatePasswordConfirmation = (value: string): void => {
    clearFeedback();
    setPasswordConfirmation(value);
  };

  const submit = (): void => {
    if (auth.busy) return;
    const normalizedEmail = email.trim().toLowerCase();
    const validationError = validateCredentials(mode, normalizedEmail, password, passwordConfirmation);
    if (validationError) {
      setLocalError(validationError);
      return;
    }
    if (mode === 'forgot-password') {
      void auth.requestPasswordReset(normalizedEmail);
      return;
    }
    if (mode === 'sign-up') {
      void auth.signUpWithEmail({ email: normalizedEmail, password });
      return;
    }

    void auth.signInWithEmail({ email: normalizedEmail, password });
  };

  const switchMode = (nextMode: AuthMode): void => {
    if (auth.busy) return;
    auth.clearError();
    setLocalError(null);
    setPassword('');
    setPasswordConfirmation('');
    setPasswordVisible(false);
    setMode(nextMode);
  };

  const disabled =
    auth.busy ||
    !email.trim() ||
    (mode !== 'forgot-password' && !password) ||
    (mode === 'sign-up' && !passwordConfirmation);
  const errorMessage = localError ? t(localError) : auth.error ? t(`auth.errors.${auth.error}`) : null;
  const selectedCopy = copyKeys[mode];

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
        <ScrollView
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.page}>
            <BrandHeader />
            <Hero />

            <View style={styles.copyBlock}>
              <Text style={styles.eyebrow}>{t(selectedCopy.eyebrow)}</Text>
              <Text accessibilityRole="header" style={styles.title}>
                {t(selectedCopy.title)}
              </Text>
              <Text style={styles.lead}>{t(selectedCopy.body)}</Text>
            </View>

            <View style={styles.form}>
              <AuthField
                testID="auth-email"
                editable={!auth.busy}
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                label={t('auth.email')}
                onChangeText={updateEmail}
                onSubmitEditing={() => {
                  if (mode === 'forgot-password') submit();
                  else passwordRef.current?.focus();
                }}
                placeholder={t('auth.emailPlaceholder')}
                returnKeyType={mode === 'forgot-password' ? 'done' : 'next'}
                submitBehavior={mode === 'forgot-password' ? 'blurAndSubmit' : 'submit'}
                textContentType="emailAddress"
                value={email}
              />
              {mode !== 'forgot-password' ? (
                <AuthField
                  testID="auth-password"
                  editable={!auth.busy}
                  autoCapitalize="none"
                  autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                  autoCorrect={false}
                  label={t('auth.password')}
                  onChangeText={updatePassword}
                  onSubmitEditing={() => mode === 'sign-up' ? confirmationRef.current?.focus() : submit()}
                  onToggleSecure={() => setPasswordVisible((visible) => !visible)}
                  placeholder={t('auth.passwordPlaceholder')}
                  inputRef={passwordRef}
                  returnKeyType={mode === 'sign-in' ? 'done' : 'next'}
                  submitBehavior={mode === 'sign-in' ? 'blurAndSubmit' : 'submit'}
                  secureTextEntry={!passwordVisible}
                  secureVisible={passwordVisible}
                  textContentType={mode === 'sign-in' ? 'password' : 'newPassword'}
                  value={password}
                />
              ) : null}
              {mode === 'sign-in' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: auth.busy }}
                  disabled={auth.busy}
                  hitSlop={8}
                  onPress={() => switchMode('forgot-password')}
                  style={({ pressed }) => [styles.forgotButton, pressed ? styles.pressed : null]}
                >
                  <Text style={styles.forgotButtonText}>{t('auth.forgotPassword')}</Text>
                </Pressable>
              ) : null}
              {mode === 'sign-up' ? (
                <>
                  <AuthField
                    editable={!auth.busy}
                    autoCapitalize="none"
                    autoComplete="new-password"
                    autoCorrect={false}
                    label={t('auth.passwordConfirmation')}
                    onChangeText={updatePasswordConfirmation}
                    onSubmitEditing={submit}
                    placeholder={t('auth.passwordConfirmationPlaceholder')}
                    inputRef={confirmationRef}
                    returnKeyType="done"
                    secureTextEntry={!passwordVisible}
                    textContentType="newPassword"
                    value={passwordConfirmation}
                  />
                  <Text style={styles.passwordHint}>{t('auth.passwordHint')}</Text>
                </>
              ) : null}

              {auth.status === 'configuration-required' && !errorMessage ? (
                <FormNotice>{t('auth.configurationInline')}</FormNotice>
              ) : null}
              {errorMessage ? <FormNotice>{errorMessage}</FormNotice> : null}

              <SubmitButton
                busy={auth.busy}
                disabled={disabled}
                label={t(
                  mode === 'sign-in'
                    ? 'auth.emailSignIn'
                    : mode === 'sign-up'
                      ? 'auth.createAccount'
                      : 'auth.sendResetEmail',
                )}
                onPress={submit}
              />
            </View>

            <View style={styles.switchRow}>
              {mode !== 'forgot-password' ? (
                <Text style={styles.switchPrompt}>
                  {t(mode === 'sign-in' ? 'auth.noAccount' : 'auth.haveAccount')}
                </Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: auth.busy }}
                disabled={auth.busy}
                hitSlop={8}
                onPress={() => switchMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
                style={({ pressed }) => (pressed ? styles.pressed : null)}
              >
                <Text style={styles.switchAction}>
                  {t(mode === 'sign-in' ? 'auth.goToSignUp' : 'auth.goToSignIn')}
                </Text>
              </Pressable>
            </View>

            {mode !== 'forgot-password' ? (
              <>
                <View style={styles.orRow}>
                  <View style={styles.orRule} />
                  <Text style={styles.orText}>{t('auth.orContinue')}</Text>
                  <View style={styles.orRule} />
                </View>

                <View style={styles.providerGroup}>
                  <ProviderButton
                    disabled={auth.busy}
                    label={t('auth.google')}
                    mark="G"
                    onPress={() => void auth.signInWithGoogle()}
                  />
                  {Platform.OS === 'ios' && nativeAppleAvailable ? (
                    <AppleAuthentication.AppleAuthenticationButton
                      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                      cornerRadius={16}
                      onPress={() => { if (!auth.busy) void auth.signInWithNativeApple(); }}
                      style={[styles.appleButton, auth.busy ? styles.disabled : null]}
                    />
                  ) : (
                    <ProviderButton
                      disabled={auth.busy}
                      label={t('auth.appleBrowser')}
                      mark="A"
                      onPress={() => void auth.signInWithAppleBrowser()}
                    />
                  )}
                </View>
              </>
            ) : null}

            <Text style={styles.privacyNote}>{t('auth.privateByDefault')}</Text>
            <HelpLinks disabled={auth.busy} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  appleButton: {
    height: 54,
    width: '100%',
  },
  brandHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: colors.tomato,
    borderRadius: 12,
    height: 34,
    justifyContent: 'center',
    transform: [{ rotate: '-7deg' }],
    width: 34,
  },
  copyBlock: {
    gap: spacing.xs,
  },
  disabled: {
    opacity: 0.5,
  },
  eyebrow: {
    color: colors.tomato,
    fontFamily: type.utility,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    color: colors.ink,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: '700',
  },
  foodCard: {
    borderColor: colors.paper,
    borderRadius: radii.panel,
    borderWidth: 4,
    boxShadow: '0 8px 14px rgba(37, 44, 41, 0.14)',
    position: 'absolute',
  },
  foodCardLeft: {
    bottom: 16,
    left: 24,
    transform: [{ rotate: '-8deg' }],
  },
  foodCardRight: {
    right: 30,
    top: 18,
    transform: [{ rotate: '9deg' }],
  },
  forgotButton: {
    alignSelf: 'flex-end',
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  forgotButtonText: {
    color: colors.tomato,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: '800',
  },
  form: {
    gap: spacing.md,
  },
  hero: {
    backgroundColor: colors.sage,
    borderRadius: 30,
    height: 174,
    overflow: 'hidden',
    position: 'relative',
  },
  heroBadge: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderRadius: radii.pill,
    bottom: 18,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: 'absolute',
    right: 20,
  },
  heroBadgeText: {
    color: colors.success,
    fontFamily: type.utility,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  input: {
    color: colors.ink,
    flex: 1,
    fontFamily: type.body,
    fontSize: 16,
    minHeight: 54,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputAction: {
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  inputActionText: {
    color: colors.tomato,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: '800',
  },
  inputShell: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderColor: '#D9DDD8',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 54,
  },
  inputWithAction: {
    paddingRight: 0,
  },
  keyboardView: {
    flex: 1,
  },
  lead: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 15,
    lineHeight: 23,
  },
  notice: {
    alignItems: 'flex-start',
    backgroundColor: colors.blush,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  noticeDot: {
    backgroundColor: colors.tomato,
    borderRadius: 4,
    height: 8,
    marginTop: 6,
    width: 8,
  },
  noticeText: {
    color: colors.ink,
    flex: 1,
    fontFamily: type.body,
    fontSize: 13,
    lineHeight: 20,
  },
  orRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  orRule: {
    backgroundColor: colors.rule,
    flex: 1,
    height: 1,
  },
  orText: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 12,
  },
  page: {
    gap: spacing.lg,
    maxWidth: 440,
    width: '100%',
  },
  passwordHint: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: -8,
  },
  pressed: {
    opacity: 0.68,
  },
  privacyNote: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 12,
    lineHeight: 19,
    paddingBottom: spacing.lg,
    textAlign: 'center',
  },
  providerButton: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderColor: colors.rule,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: spacing.md,
    position: 'relative',
  },
  providerGroup: {
    gap: spacing.sm,
  },
  providerMark: {
    alignItems: 'center',
    borderColor: colors.rule,
    borderRadius: 10,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    left: spacing.sm,
    position: 'absolute',
    width: 30,
  },
  providerMarkText: {
    color: colors.ink,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: '900',
  },
  providerText: {
    color: colors.ink,
    fontFamily: type.body,
    fontSize: 15,
    fontWeight: '700',
  },
  safeArea: {
    backgroundColor: colors.canvas,
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    flexGrow: 1,
    paddingHorizontal: spacing.page,
    paddingTop: spacing.md,
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: colors.tomato,
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 56,
    boxShadow: '0 8px 14px rgba(200, 64, 50, 0.2)',
  },
  submitButtonPressed: {
    opacity: 0.84,
    transform: [{ translateY: 1 }],
  },
  submitButtonText: {
    color: colors.paper,
    fontFamily: type.body,
    fontSize: 16,
    fontWeight: '800',
  },
  switchAction: {
    color: colors.tomato,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: '800',
  },
  switchPrompt: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 14,
  },
  switchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  title: {
    color: colors.ink,
    fontFamily: type.display,
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1.5,
    lineHeight: 43,
  },
  wordmark: {
    color: colors.ink,
    fontFamily: type.body,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
});
