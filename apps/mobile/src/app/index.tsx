import { useEffect } from 'react';

import { AuthGate } from '@/features/auth/AuthGate';
import type { SupportedLocale } from '@/features/auth/authApi';
import { useAuthSession } from '@/features/auth/useAuthSession';
import { AppShell } from '@/features/notebook/AppShell';
import i18n from '@/lib/i18n';
import { isAuthPreviewMode } from '@/lib/supabase/client';

const changeLanguage = async (locale: SupportedLocale): Promise<void> => {
  await i18n.changeLanguage(locale);
};

export default function HomeScreen() {
  const auth = useAuthSession();
  const authPreviewMode = isAuthPreviewMode();

  useEffect(() => {
    if (auth.locale) void i18n.changeLanguage(auth.locale);
  }, [auth.locale]);

  if (authPreviewMode) return <AppShell isDemo />;
  if (auth.status !== 'active') return <AuthGate auth={auth} onChangeLanguage={changeLanguage} />;
  return <AppShell isDemo={false} onSignOut={auth.signOut} />;
}
