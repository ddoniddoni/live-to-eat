import { Pressable, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui/Icon';
import { colors } from '@/components/tokens';
import { regionStyles as styles } from './regionStyles';

export function RegionButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      testID="region-picker-open"
      accessibilityLabel={t('regions.change', { region: label })}
      onPress={onPress}
      style={({ pressed }) => [styles.trigger, pressed ? styles.pressed : null]}
    >
      <Icon name="pin" color={colors.tomato} size={18} />
      <Text style={styles.triggerLabel}>
        {label}
      </Text>
      <Icon name="chevron" size={14} />
    </Pressable>
  );
}
