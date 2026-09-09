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
  signInWithAppleBrowser,
  signInWithGoogle,
  signInWithNativeApple,
} from '@/features/auth/authProviders';
import { clearSupabaseSession, getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';

type AuthStatus =
  | 'account-blocked'
  | 'active'
  | 'configuration-required'
  | 'connection-error'
  | 'loading'
  | 'onboarding'
  | 'signed-out';

type AuthSessionState = {
  error: AuthFailureCode | null;
  locale: SupportedLocale | null;
  status: AuthStatus;
};

export type AuthSessionController = AuthSessionState & {
  busy: boolean;
  completeOnboarding: (input: OnboardingInput) => Promise<void>;
  retry: () => Promise<void>;
  signInWithAppleBrowser: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithNativeApple: () => Promise<void>;
  signOut: () => Promise<void>;
};

const initialState = (): AuthSessionState => ({
  error: null,
  locale: null,
  status: isSupabaseConfigured() ? 'loading' : 'configuration-required',
});

const stateForAccount = async (accountState: AccountState): Promise<AuthSessionState> => {
  if (accountState === 'onboarding') {
    return { error: null, locale: null, status: 'onboarding' };
  }

  if (accountState === 'active') {
    const locale = await getActiveProfileLocale();
    return { error: null, locale, status: 'active' };
  }

  return { error: 'ACCOUNT_BLOCKED', locale: null, status: 'account-blocked' };
};

export const useAuthSession = (): AuthSessionController => {
  const [state, setState] = useState<AuthSessionState>(initialState);
  const [busy, setBusy] = useState(false);
  const revision = useRef(0);
  const mounted = useRef(true);

  const refresh = useCallback(async (): Promise<void> => {
    const currentRevision = revision.current + 1;
    revision.current = currentRevision;

    const supabase = getSupabaseClient();
    if (!supabase) {
      if (mounted.current) setState({ error: 'CONFIGURATION_REQUIRED', locale: null, status: 'configuration-required' });
      return;
    }

    if (mounted.current) setState({ error: null, locale: null, status: 'loading' });

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      if (error) throw error;

      const nextState = session
        ? await stateForAccount(await bootstrapAccount())
        : { error: null, locale: null, status: 'signed-out' as const };

      if (mounted.current && revision.current === currentRevision) setState(nextState);
    } catch (error) {
      if (mounted.current && revision.current === currentRevision) {
        setState({ error: toAuthFailure(error).code, locale: null, status: 'connection-error' });
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const supabase = getSupabaseClient();
    if (!supabase) return () => {
      mounted.current = false;
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });
    void refresh();

    return () => {
      mounted.current = false;
      subscription.unsubscribe();
    };
  }, [refresh]);

  const runAuthentication = useCallback(
    async (action: () => Promise<boolean>): Promise<void> => {
      if (busy) return;
      setBusy(true);
      try {
        const completed = await action();
        if (completed) await refresh();
      } catch (error) {
        if (mounted.current) {
          setState({ error: toAuthFailure(error).code, locale: null, status: 'signed-out' });
        }
      } finally {
        if (mounted.current) setBusy(false);
      }
    },
    [busy, refresh],
  );

  const finishOnboarding = useCallback(
    async (input: OnboardingInput): Promise<void> => {
      if (busy) return;
      setBusy(true);
      try {
        await completeOnboarding(input);
        await refresh();
      } catch (error) {
        if (mounted.current) {
          setState({ error: toAuthFailure(error).code, locale: null, status: 'onboarding' });
        }
      } finally {
        if (mounted.current) setBusy(false);
      }
    },
    [busy, refresh],
  );

  const signOut = useCallback(async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      await clearSupabaseSession();
      await refresh();
    } catch (error) {
      if (mounted.current) {
        setState({ error: toAuthFailure(error).code, locale: null, status: 'connection-error' });
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [busy, refresh]);

  return {
    ...state,
    busy,
    completeOnboarding: finishOnboarding,
    retry: refresh,
    signInWithAppleBrowser: () => runAuthentication(signInWithAppleBrowser),
    signInWithGoogle: () => runAuthentication(signInWithGoogle),
    signInWithNativeApple: () => runAuthentication(signInWithNativeApple),
    signOut,
  };
};
