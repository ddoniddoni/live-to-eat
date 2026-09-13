import { useTranslation } from 'react-i18next';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, type } from '@/components/tokens';
import { FoodArtwork } from '@/components/ui/Artwork';
import { Icon } from '@/components/ui/Icon';
import { type AuthFailureCode, type SupportedLocale } from '@/features/auth/authApi';
import type { AuthSessionController } from '@/features/auth/useAuthSession';
import { AuthCredentialScreen } from '@/features/auth/AuthCredentialScreen';
import { LaunchScreen } from '@/features/auth/LaunchScreen';
import { OnboardingScreen } from '@/features/auth/OnboardingScreen';
import { PasswordRecoveryScreen } from '@/features/auth/PasswordRecoveryScreen';

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

const EmailConfirmationScreen = ({ auth }: { auth: AuthSessionController }) => {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.confirmationPage}>
        <View accessibilityElementsHidden style={styles.confirmationArtwork}>
          <FoodArtwork kind={1} size={96} />
          <View style={styles.confirmationIcon}>
            <Icon color={colors.paper} name="check" size={24} />
          </View>
        </View>
        <Text style={styles.eyebrow}>{t('auth.confirmationEyebrow')}</Text>
        <Text accessibilityRole="header" style={styles.statusTitle}>
          {t('auth.confirmationTitle')}
        </Text>
        <Text style={styles.statusBody}>
          {t('auth.confirmationBody', { email: auth.pendingEmail ?? t('auth.yourEmail') })}
        </Text>
        <PrimaryButton label={t('auth.goToSignIn')} onPress={auth.returnToSignIn} />
      </View>
    </SafeAreaView>
  );
};

const PasswordResetSentScreen = ({ auth }: { auth: AuthSessionController }) => {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.confirmationPage}>
        <View accessibilityElementsHidden style={[styles.confirmationArtwork, styles.resetArtwork]}>
          <Icon color={colors.tomato} name="link" size={42} />
          <View style={[styles.confirmationIcon, styles.mailIcon]}>
            <Icon color={colors.paper} name="check" size={24} />
          </View>
        </View>
        <Text style={styles.eyebrow}>{t('auth.resetSentEyebrow')}</Text>
        <Text accessibilityRole="header" style={styles.statusTitle}>
          {t('auth.resetSentTitle')}
        </Text>
        <Text style={styles.statusBody}>
          {t('auth.resetSentBody', { email: auth.pendingEmail ?? t('auth.yourEmail') })}
        </Text>
        <Text style={styles.statusHint}>{t('auth.resetSentPrivacy')}</Text>
        <PrimaryButton label={t('auth.goToSignIn')} onPress={auth.returnToSignIn} />
      </View>
    </SafeAreaView>
  );
};

const PasswordRecoveryCompleteScreen = ({ auth }: { auth: AuthSessionController }) => {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.confirmationPage}>
        <View accessibilityElementsHidden style={[styles.confirmationArtwork, styles.completeArtwork]}>
          <Icon color={colors.paper} name="check" size={46} />
        </View>
        <Text style={styles.eyebrow}>{t('auth.passwordUpdatedEyebrow')}</Text>
        <Text accessibilityRole="header" style={styles.statusTitle}>
          {t('auth.passwordUpdatedTitle')}
        </Text>
        <Text style={styles.statusBody}>{t('auth.passwordUpdatedBody')}</Text>
        <PrimaryButton label={t('auth.signInWithNewPassword')} onPress={auth.returnToSignIn} />
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
  if (auth.status === 'loading') {
    return <LaunchScreen />;
  }

  if (auth.status === 'configuration-required' || auth.status === 'signed-out') {
    return <AuthCredentialScreen auth={auth} />;
  }
  if (auth.status === 'email-confirmation-required') return <EmailConfirmationScreen auth={auth} />;
  if (auth.status === 'password-reset-sent') return <PasswordResetSentScreen auth={auth} />;
  if (auth.status === 'password-recovery') return <PasswordRecoveryScreen auth={auth} />;
  if (auth.status === 'password-recovery-complete') return <PasswordRecoveryCompleteScreen auth={auth} />;
  if (auth.status === 'onboarding') return <OnboardingScreen auth={auth} onChangeLanguage={onChangeLanguage} />;

  return <RetryScreen auth={auth} />;
};

const styles = StyleSheet.create({
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    opacity: 0.82,
  },
  confirmationArtwork: {
    borderColor: colors.paper,
    borderRadius: 28,
    borderWidth: 5,
    boxShadow: '0 12px 20px rgba(37, 44, 41, 0.14)',
    position: 'relative',
  },
  confirmationIcon: {
    alignItems: 'center',
    backgroundColor: colors.success,
    borderColor: colors.paper,
    borderRadius: 22,
    borderWidth: 4,
    bottom: -10,
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    right: -12,
    width: 44,
  },
  confirmationPage: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  completeArtwork: {
    alignItems: 'center',
    backgroundColor: colors.success,
    height: 96,
    justifyContent: 'center',
    transform: [{ rotate: '-5deg' }],
    width: 96,
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
  mailIcon: {
    bottom: -12,
    right: -14,
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
  resetArtwork: {
    alignItems: 'center',
    backgroundColor: colors.sage,
    height: 96,
    justifyContent: 'center',
    width: 96,
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
  statusHint: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 13,
    lineHeight: 19,
    maxWidth: 320,
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
});
