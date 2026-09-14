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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, type } from '@/components/tokens';
import { Icon } from '@/components/ui/Icon';
import type { AuthSessionController } from '@/features/auth/useAuthSession';

type LocalError = 'passwordMismatch' | 'passwordTooShort';

export const PasswordRecoveryScreen = ({ auth }: { auth: AuthSessionController }) => {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [localError, setLocalError] = useState<LocalError | null>(null);
  const confirmationRef = useRef<TextInput>(null);

  const clearFeedback = (): void => {
    if (localError) setLocalError(null);
    if (auth.error) auth.clearError();
  };

  const submit = (): void => {
    if (auth.busy) return;
    if (password.length < 8) {
      setLocalError('passwordTooShort');
      return;
    }
    if (password !== confirmation) {
      setLocalError('passwordMismatch');
      return;
    }
    void auth.completePasswordRecovery(password);
  };

  const errorMessage = localError
    ? t(`auth.formErrors.${localError}`)
    : auth.error
      ? t(`auth.errors.${auth.error}`)
      : null;
  const disabled = auth.busy || !password || !confirmation;

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
            <View accessibilityElementsHidden style={styles.recoveryTicket}>
              <View style={styles.ticketTop}>
                <View style={styles.lockPlate}>
                  <Icon color={colors.paper} name="lock" size={28} />
                </View>
                <View style={styles.ticketCopy}>
                  <Text style={styles.ticketLabel}>PRIVATE ACCOUNT</Text>
                  <Text style={styles.ticketTitle}>LiveToEat</Text>
                </View>
              </View>
              <View style={styles.ticketRule} />
              <Text style={styles.ticketNote}>RESET PASS · KEEP EVERY SAVE</Text>
            </View>

            <View style={styles.copyBlock}>
              <Text style={styles.eyebrow}>{t('auth.newPasswordEyebrow')}</Text>
              <Text accessibilityRole="header" style={styles.title}>
                {t('auth.newPasswordTitle')}
              </Text>
              <Text style={styles.lead}>{t('auth.newPasswordBody')}</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{t('auth.newPassword')}</Text>
                <View style={styles.inputShell}>
                  <TextInput
                    accessibilityLabel={t('auth.newPassword')}
                    autoCapitalize="none"
                    autoComplete="new-password"
                    autoCorrect={false}
                    editable={!auth.busy}
                    onChangeText={(value) => {
                      clearFeedback();
                      setPassword(value);
                    }}
                    onSubmitEditing={() => confirmationRef.current?.focus()}
                    submitBehavior="submit"
                    placeholder={t('auth.newPasswordPlaceholder')}
                    placeholderTextColor={colors.muted}
                    returnKeyType="next"
                    secureTextEntry={!passwordVisible}
                    style={styles.input}
                    textContentType="newPassword"
                    value={password}
                  />
                  <Pressable
                    accessibilityLabel={t(passwordVisible ? 'auth.hidePassword' : 'auth.showPassword')}
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => setPasswordVisible((visible) => !visible)}
                    style={({ pressed }) => [styles.inputAction, pressed ? styles.pressed : null]}
                  >
                    <Text style={styles.inputActionText}>{t(passwordVisible ? 'auth.hide' : 'auth.show')}</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{t('auth.passwordConfirmation')}</Text>
                <View style={styles.inputShell}>
                  <TextInput
                    accessibilityLabel={t('auth.passwordConfirmation')}
                    autoCapitalize="none"
                    autoComplete="new-password"
                    autoCorrect={false}
                    editable={!auth.busy}
                    onChangeText={(value) => {
                      clearFeedback();
                      setConfirmation(value);
                    }}
                    onSubmitEditing={submit}
                    placeholder={t('auth.passwordConfirmationPlaceholder')}
                    placeholderTextColor={colors.muted}
                    ref={confirmationRef}
                    returnKeyType="done"
                    secureTextEntry={!passwordVisible}
                    style={styles.input}
                    textContentType="newPassword"
                    value={confirmation}
                  />
                </View>
              </View>

              <Text style={styles.passwordHint}>{t('auth.passwordHint')}</Text>
              {errorMessage ? (
                <View accessibilityRole="alert" style={styles.notice}>
                  <View style={styles.noticeDot} />
                  <Text style={styles.noticeText}>{errorMessage}</Text>
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ busy: auth.busy, disabled }}
                disabled={disabled}
                onPress={submit}
                style={({ pressed }) => [
                  styles.submitButton,
                  disabled ? styles.disabled : null,
                  pressed && !disabled ? styles.submitButtonPressed : null,
                ]}
              >
                {auth.busy ? (
                  <ActivityIndicator color={colors.paper} />
                ) : (
                  <Text style={styles.submitButtonText}>{t('auth.updatePassword')}</Text>
                )}
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={auth.busy}
              onPress={() => void auth.cancelPasswordRecovery()}
              style={({ pressed }) => [styles.cancelButton, pressed ? styles.pressed : null]}
            >
              <Text style={styles.cancelButtonText}>{t('auth.cancelRecovery')}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  cancelButton: {
    alignItems: 'center',
    paddingBottom: spacing.lg,
    paddingVertical: spacing.sm,
  },
  cancelButtonText: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: '700',
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
  form: {
    gap: spacing.md,
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
  keyboardView: {
    flex: 1,
  },
  lead: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 15,
    lineHeight: 23,
  },
  lockPlate: {
    alignItems: 'center',
    backgroundColor: colors.tomato,
    borderRadius: 18,
    height: 58,
    justifyContent: 'center',
    transform: [{ rotate: '-5deg' }],
    width: 58,
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
  recoveryTicket: {
    backgroundColor: colors.sage,
    borderRadius: radii.panel,
    boxShadow: '0 10px 20px rgba(37, 44, 41, 0.10)',
    gap: spacing.md,
    overflow: 'hidden',
    padding: spacing.lg,
  },
  safeArea: {
    backgroundColor: colors.canvas,
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    flexGrow: 1,
    paddingHorizontal: spacing.page,
    paddingTop: spacing.lg,
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: colors.tomato,
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 56,
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
  ticketCopy: {
    flex: 1,
    gap: 3,
  },
  ticketLabel: {
    color: colors.success,
    fontFamily: type.utility,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  ticketNote: {
    color: colors.muted,
    fontFamily: type.utility,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  ticketRule: {
    borderStyle: 'dashed',
    borderTopColor: '#B7C1B0',
    borderTopWidth: 1,
  },
  ticketTitle: {
    color: colors.ink,
    fontFamily: type.display,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
  },
  ticketTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  title: {
    color: colors.ink,
    fontFamily: type.display,
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1.5,
    lineHeight: 43,
  },
});
