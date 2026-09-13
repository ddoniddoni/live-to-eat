import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { readEmailAuthLink, type EmailAuthLinkKind } from '@/features/auth/authCallback';
import { AuthFlowError, toAuthFailure } from '@/features/auth/authApi';
import { getSupabaseClient } from '@/lib/supabase/client';

type OAuthProvider = 'apple' | 'google';

export type EmailCredentials = {
  email: string;
  password: string;
};

void WebBrowser.maybeCompleteAuthSession();

const getCallbackValue = (url: string, key: string): string | null => {
  const value = Linking.parse(url).queryParams?.[key];
  return typeof value === 'string' ? value : null;
};

const configuredClient = () => {
  const supabase = getSupabaseClient();
  if (!supabase) throw new AuthFlowError('CONFIGURATION_REQUIRED');
  return supabase;
};

const emailAuthLinkTargets = () => ({
  confirmation: Linking.createURL('auth/confirm'),
  recovery: Linking.createURL('auth/recovery'),
});

const exchangeBrowserCallback = async (callbackUrl: string, flowId: string | null | undefined): Promise<void> => {
  const supabase = configuredClient();
  const code = getCallbackValue(callbackUrl, 'code');

  if (code) {
    const { error } = flowId
      ? await supabase.auth.exchangeCodeForSession(code, { flowId })
      : await supabase.auth.exchangeCodeForSession(code);
    if (error) throw toAuthFailure(error);
    return;
  }

  const accessToken = getCallbackValue(callbackUrl, 'access_token');
  const refreshToken = getCallbackValue(callbackUrl, 'refresh_token');
  if (!accessToken || !refreshToken) throw new AuthFlowError('REQUEST_FAILED');

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) throw toAuthFailure(error);
};

const signInWithBrowserOAuth = async (provider: OAuthProvider): Promise<boolean> => {
  const redirectUrl = Linking.createURL('auth/oauth');
  const { data, error } = await configuredClient().auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) throw toAuthFailure(error);

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
  if (result.type !== 'success') return false;

  await exchangeBrowserCallback(result.url, data.flowId);
  return true;
};

export const signInWithGoogle = async (): Promise<boolean> => signInWithBrowserOAuth('google');

export const signInWithAppleBrowser = async (): Promise<boolean> => signInWithBrowserOAuth('apple');

export const signInWithEmail = async ({ email, password }: EmailCredentials): Promise<boolean> => {
  const { error } = await configuredClient().auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw toAuthFailure(error);
  return true;
};

export const signUpWithEmail = async ({ email, password }: EmailCredentials): Promise<boolean> => {
  const { data, error } = await configuredClient().auth.signUp({
    email: email.trim().toLowerCase(),
    options: {
      emailRedirectTo: emailAuthLinkTargets().confirmation,
    },
    password,
  });
  if (error) throw toAuthFailure(error);
  if (!data.user) throw new AuthFlowError('REQUEST_FAILED');

  return data.session !== null;
};

export const requestPasswordReset = async (email: string): Promise<void> => {
  const { error } = await configuredClient().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: emailAuthLinkTargets().recovery,
  });
  if (error) throw toAuthFailure(error);
};

export const exchangeEmailAuthLink = async (url: string): Promise<EmailAuthLinkKind | null> => {
  const callback = readEmailAuthLink(url, emailAuthLinkTargets());
  if (callback.kind === 'ignored') return null;
  if (callback.kind === 'invalid') throw new AuthFlowError('AUTH_LINK_INVALID');

  const supabase = configuredClient();
  const { error } = callback.flowId
    ? await supabase.auth.exchangeCodeForSession(callback.code, { flowId: callback.flowId })
    : await supabase.auth.exchangeCodeForSession(callback.code);

  if (error) throw toAuthFailure(error);

  return callback.linkKind;
};

export const updateRecoveredPassword = async (password: string): Promise<void> => {
  const { error } = await configuredClient().auth.updateUser({ password });
  if (error) throw toAuthFailure(error);
};

export const signInWithNativeApple = async (): Promise<boolean> => {
  if (Platform.OS !== 'ios') return signInWithAppleBrowser();

  try {
    const nonce = Crypto.randomUUID();
    const credential = await AppleAuthentication.signInAsync({
      nonce,
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) throw new AuthFlowError('REQUEST_FAILED');

    const { error } = await configuredClient().auth.signInWithIdToken({
      nonce,
      provider: 'apple',
      token: credential.identityToken,
    });
    if (error) throw toAuthFailure(error);

    // Apple only returns name/email on the initial authorization. They are intentionally not
    // copied into the product profile: the person chooses public profile details in onboarding.
    return true;
  } catch (error) {
    const code =
      error && typeof error === 'object' && typeof (error as { code?: unknown }).code === 'string'
        ? (error as { code: string }).code
        : null;

    if (code === 'ERR_REQUEST_CANCELED') return false;
    throw toAuthFailure(error);
  }
};
