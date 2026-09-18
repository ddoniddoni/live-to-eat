import * as Linking from 'expo-linking';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  type AccountState,
  type AuthFailureCode,
  type OnboardingInput,
  type SupportedLocale,
  bootstrapAccount,
  completeOnboarding,
  getActiveProfileLocale,
  toAuthFailure,
} from '@/features/auth/authApi';
import {
  type EmailCredentials,
  exchangeEmailAuthLink,
  requestPasswordReset,
  signInWithAppleBrowser,
  signInWithEmail,
  signInWithGoogle,
  signInWithNativeApple,
  signUpWithEmail,
  updateRecoveredPassword,
} from '@/features/auth/authProviders';
import {
  clearSupabaseSession,
  getSupabaseClient,
  isAuthPreviewMode,
  isSupabaseConfigured,
} from '@/lib/supabase/client';

type AuthStatus =
  | 'account-blocked'
  | 'active'
  | 'configuration-required'
  | 'connection-error'
  | 'email-confirmation-required'
  | 'loading'
  | 'onboarding'
  | 'password-recovery'
  | 'password-recovery-complete'
  | 'password-reset-sent'
  | 'sign-out-error'
  | 'signed-out';

type AuthSessionState = {
  accountId?: string;
  error: AuthFailureCode | null;
  locale: SupportedLocale | null;
  pendingEmail: string | null;
  status: AuthStatus;
};

export type AuthSessionController = AuthSessionState & {
  busy: boolean;
  cancelPasswordRecovery: () => Promise<void>;
  clearError: () => void;
  completeOnboarding: (input: OnboardingInput) => Promise<void>;
  completePasswordRecovery: (password: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  returnToSignIn: () => void;
  retry: () => Promise<void>;
  signInWithAppleBrowser: () => Promise<void>;
  signInWithEmail: (credentials: EmailCredentials) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithNativeApple: () => Promise<void>;
  signOut: () => Promise<void>;
  signUpWithEmail: (credentials: EmailCredentials) => Promise<void>;
};

const initialState = (): AuthSessionState => ({
  error: null,
  locale: null,
  pendingEmail: null,
  status: isAuthPreviewMode() ? 'active' : isSupabaseConfigured() ? 'loading' : 'configuration-required',
});

const stateForAccount = async (accountState: AccountState, accountId: string): Promise<AuthSessionState> => {
  if (accountState === 'onboarding') {
    return { error: null, locale: null, pendingEmail: null, status: 'onboarding' };
  }

  if (accountState === 'active') {
    const locale = await getActiveProfileLocale();
    return { accountId, error: null, locale, pendingEmail: null, status: 'active' };
  }

  return { error: 'ACCOUNT_BLOCKED', locale: null, pendingEmail: null, status: 'account-blocked' };
};

export const useAuthSession = (): AuthSessionController => {
  const [state, setState] = useState<AuthSessionState>(initialState);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const revision = useRef(0);
  const mounted = useRef(true);
  const passwordRecoveryActive = useRef(false);
  const sessionClearRequired = useRef(false);

  const refresh = useCallback(async (): Promise<void> => {
    // A token event must not reopen private screens after a failed sign-out.
    if (sessionClearRequired.current) return;
    const currentRevision = revision.current + 1;
    revision.current = currentRevision;

    if (isAuthPreviewMode()) {
      if (mounted.current) setState({ error: null, locale: null, pendingEmail: null, status: 'active' });
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      if (mounted.current) {
        setState({ error: 'CONFIGURATION_REQUIRED', locale: null, pendingEmail: null, status: 'configuration-required' });
      }
      return;
    }

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      if (error) throw error;

      const nextState = session
        ? await stateForAccount(await bootstrapAccount(), session.user.id)
        : { error: null, locale: null, pendingEmail: null, status: 'signed-out' as const };

      if (mounted.current && revision.current === currentRevision) setState(nextState);
    } catch (error) {
      if (mounted.current && revision.current === currentRevision) {
        setState({ error: toAuthFailure(error).code, locale: null, pendingEmail: null, status: 'connection-error' });
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (isAuthPreviewMode()) return () => {
      mounted.current = false;
    };

    const supabase = getSupabaseClient();
    if (!supabase) return () => {
      mounted.current = false;
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (sessionClearRequired.current) return;
      if (event === 'PASSWORD_RECOVERY') {
        passwordRecoveryActive.current = true;
        revision.current += 1;
        if (mounted.current) {
          setState({ error: null, locale: null, pendingEmail: null, status: 'password-recovery' });
        }
        return;
      }

      if (busyRef.current) return;
      if (event === 'SIGNED_OUT') passwordRecoveryActive.current = false;
      if (passwordRecoveryActive.current) return;
      void refresh();
    });

    const handleEmailLink = (url: string): void => {
      void exchangeEmailAuthLink(url).catch((error) => {
        passwordRecoveryActive.current = false;
        revision.current += 1;
        if (mounted.current) {
          setState({ error: toAuthFailure(error).code, locale: null, pendingEmail: null, status: 'signed-out' });
        }
      });
    };

    const linkSubscription = Linking.addEventListener('url', ({ url }) => handleEmailLink(url));
    void Linking.getInitialURL()
      .then((url) => {
        if (url) handleEmailLink(url);
      })
      .catch(() => undefined);
    void Promise.resolve().then(refresh);

    return () => {
      mounted.current = false;
      linkSubscription.remove();
      subscription.unsubscribe();
    };
  }, [refresh]);

  const runAuthentication = useCallback(
    async (action: () => Promise<boolean>): Promise<void> => {
      if (busyRef.current) return;
      busyRef.current = true;
      revision.current += 1;
      setBusy(true);
      try {
        const completed = await action();
        if (completed) await refresh();
      } catch (error) {
        if (mounted.current) {
          setState({ error: toAuthFailure(error).code, locale: null, pendingEmail: null, status: 'signed-out' });
        }
      } finally {
        busyRef.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [refresh],
  );

  const registerWithEmail = useCallback(
    async (credentials: EmailCredentials): Promise<void> => {
      if (busyRef.current) return;
      busyRef.current = true;
      revision.current += 1;
      setBusy(true);
      try {
        const authenticated = await signUpWithEmail(credentials);
        if (authenticated) {
          await refresh();
          return;
        }

        if (mounted.current) {
          setState({
            error: null,
            locale: null,
            pendingEmail: credentials.email.trim().toLowerCase(),
            status: 'email-confirmation-required',
          });
        }
      } catch (error) {
        if (mounted.current) {
          setState({ error: toAuthFailure(error).code, locale: null, pendingEmail: null, status: 'signed-out' });
        }
      } finally {
        busyRef.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [refresh],
  );

  const sendPasswordReset = useCallback(
    async (email: string): Promise<void> => {
      if (busyRef.current) return;
      busyRef.current = true;
      revision.current += 1;
      setBusy(true);
      try {
        await requestPasswordReset(email);
        if (mounted.current) {
          setState({
            error: null,
            locale: null,
            pendingEmail: email.trim().toLowerCase(),
            status: 'password-reset-sent',
          });
        }
      } catch (error) {
        if (mounted.current) {
          setState({ error: toAuthFailure(error).code, locale: null, pendingEmail: null, status: 'signed-out' });
        }
      } finally {
        busyRef.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [],
  );

  const finishPasswordRecovery = useCallback(
    async (password: string): Promise<void> => {
      if (busyRef.current) return;
      busyRef.current = true;
      revision.current += 1;
      setBusy(true);
      let passwordUpdated = false;
      try {
        await updateRecoveredPassword(password);
        passwordUpdated = true;
        sessionClearRequired.current = true;
        await clearSupabaseSession();
        sessionClearRequired.current = false;
        passwordRecoveryActive.current = false;
        if (mounted.current) {
          setState({ error: null, locale: null, pendingEmail: null, status: 'password-recovery-complete' });
        }
      } catch (error) {
        if (mounted.current) {
          setState({ error: toAuthFailure(error).code, locale: null, pendingEmail: null, status: passwordUpdated ? 'sign-out-error' : 'password-recovery' });
        }
      } finally {
        busyRef.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [],
  );

  const cancelPasswordRecovery = useCallback(async (): Promise<void> => {
    if (busyRef.current) return;
    busyRef.current = true;
    revision.current += 1;
    setBusy(true);
    sessionClearRequired.current = true;
    try {
      await clearSupabaseSession();
      sessionClearRequired.current = false;
      passwordRecoveryActive.current = false;
      revision.current += 1;
      if (mounted.current) {
        setState({ error: null, locale: null, pendingEmail: null, status: 'signed-out' });
      }
    } catch (error) {
      if (mounted.current) {
        setState({ error: toAuthFailure(error).code, locale: null, pendingEmail: null, status: 'sign-out-error' });
      }
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }, []);

  const finishOnboarding = useCallback(
    async (input: OnboardingInput): Promise<void> => {
      if (busyRef.current) return;
      busyRef.current = true;
      revision.current += 1;
      setBusy(true);
      try {
        await completeOnboarding(input);
        await refresh();
      } catch (error) {
        if (mounted.current) {
          setState({ error: toAuthFailure(error).code, locale: null, pendingEmail: null, status: 'onboarding' });
        }
      } finally {
        busyRef.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [refresh],
  );

  const signOut = useCallback(async (): Promise<void> => {
    if (busyRef.current) return;
    busyRef.current = true;
    revision.current += 1;
    setBusy(true);
    sessionClearRequired.current = true;
    try {
      await clearSupabaseSession();
      sessionClearRequired.current = false;
      passwordRecoveryActive.current = false;
      await refresh();
    } catch (error) {
      if (mounted.current) {
        setState({ error: toAuthFailure(error).code, locale: null, pendingEmail: null, status: 'sign-out-error' });
      }
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [refresh]);

  return {
    ...state,
    busy,
    cancelPasswordRecovery,
    clearError: () => setState((current) => ({ ...current, error: null })),
    completeOnboarding: finishOnboarding,
    completePasswordRecovery: finishPasswordRecovery,
    requestPasswordReset: sendPasswordReset,
    returnToSignIn: () => {
      if (busyRef.current || sessionClearRequired.current) return;
      passwordRecoveryActive.current = false;
      revision.current += 1;
      setState({ error: null, locale: null, pendingEmail: null, status: 'signed-out' });
    },
    retry: refresh,
    signInWithAppleBrowser: () => runAuthentication(signInWithAppleBrowser),
    signInWithEmail: (credentials) => runAuthentication(() => signInWithEmail(credentials)),
    signInWithGoogle: () => runAuthentication(signInWithGoogle),
    signInWithNativeApple: () => runAuthentication(signInWithNativeApple),
    signOut,
    signUpWithEmail: registerWithEmail,
  };
};
