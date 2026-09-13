import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { secureSessionStorage } from '@/lib/supabase/secureSessionStorage';

const sessionStorageKey = 'live-to-eat.auth.session.v1';
const authPreviewMode = process.env.EXPO_PUBLIC_AUTH_PREVIEW === 'true';

const readPublicConfiguration = (): { key: string; url: string } | null => {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !key || url.includes('YOUR_PROJECT') || key.startsWith('YOUR_')) return null;

  return { key, url };
};

const publicConfiguration = readPublicConfiguration();

let client: SupabaseClient | null = null;

export const isSupabaseConfigured = (): boolean => publicConfiguration !== null;
export const isAuthPreviewMode = (): boolean => authPreviewMode;

export const getSupabaseClient = (): SupabaseClient | null => {
  if (!publicConfiguration) return null;

  if (!client) {
    client = createClient(publicConfiguration.url, publicConfiguration.key, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        experimental: {
          appendPkceFlowIdToRedirects: true,
        },
        flowType: 'pkce',
        persistSession: true,
        storage: secureSessionStorage,
        storageKey: sessionStorageKey,
      },
    });
  }

  return client;
};

export const configureSupabaseAutoRefresh = (): (() => void) => {
  if (isAuthPreviewMode()) return () => undefined;

  const supabase = getSupabaseClient();
  if (!supabase) return () => undefined;

  const setRefreshState = (appState: string): void => {
    if (appState === 'active') {
      supabase.auth.startAutoRefresh();
      return;
    }

    supabase.auth.stopAutoRefresh();
  };

  setRefreshState(AppState.currentState);
  const subscription = AppState.addEventListener('change', setRefreshState);

  return () => {
    subscription.remove();
    supabase.auth.stopAutoRefresh();
  };
};

export const clearSupabaseSession = async (): Promise<void> => {
  const supabase = getSupabaseClient();
  let signOutError: unknown = null;

  if (supabase) {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    signOutError = error;
  }

  await secureSessionStorage.removeItem(sessionStorageKey);
  if (signOutError) throw signOutError;
};
