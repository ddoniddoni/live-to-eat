import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { FailureKind } from '@/lib/requests/request';
import { colors } from '@/components/tokens';
import { Icon } from './Icon';
import { Action, ui } from './primitives';

export function RequestError({ error, onRetry, context = 'save' }: {
  error: FailureKind | null;
  onRetry?: () => void;
  context?: 'save' | 'load' | 'search';
}) {
  const { t } = useTranslation();
  if (!error) return null;
  return (
    <View testID="request-error" style={{ backgroundColor: colors.blush, borderRadius: 18, padding: 18, gap: 12 }}>
      <View style={[ui.row, { alignItems: 'flex-start', gap: 12 }]}>
        <Icon name={context === 'search' ? 'search' : 'pin'} color={colors.tomato} size={22} />
        <View style={{ flex: 1, gap: 6 }}>
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[ui.body, { fontWeight: '700' }]}>
            {t(`request.${context}Title`)}
          </Text>
          <Text style={ui.body}>{t(`request.${error}`)}</Text>
          <Text style={ui.muted}>{t(context === 'save' ? 'request.draftKept' : 'request.recordsKept')}</Text>
        </View>
      </View>
      {onRetry ? <Action secondary label={t('common.retry')} onPress={onRetry} testID="request-retry" /> : null}
    </View>
  );
}
