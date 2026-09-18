import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Action, ui } from '@/components/ui/primitives';

export function PreferencesNotice({ error, onRetry }: { error: 'read' | 'write'; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <View testID="view-preferences-error" style={[ui.error, { marginHorizontal: 24, marginBottom: 12, padding: 14, gap: 8 }]}>
      <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={ui.muted}>{t(`viewPreferences.${error}Error`)}</Text>
      <Action secondary label={t('common.retry')} onPress={onRetry} />
    </View>
  );
}
