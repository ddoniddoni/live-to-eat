import '@/lib/i18n';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '@/components/tokens';
import { Action, ui } from '@/components/ui/primitives';

import { configureSupabaseAutoRefresh } from '@/lib/supabase/client';

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 30_000,
          },
        },
      }),
  );

  useEffect(() => configureSupabaseAutoRefresh(), []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  const { t } = useTranslation();
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.canvas, justifyContent: 'center', padding: 28, gap: 18 }}
    >
      <Text accessibilityRole="header" style={ui.heading}>
        {t('common.unexpectedError')}
      </Text>
      <Text style={ui.body}>{t('common.errorHint')}</Text>
      <Action label={t('common.retry')} onPress={() => void retry()} />
    </SafeAreaView>
  );
}
