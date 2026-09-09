import type { SharedPlaceInboxCandidate } from '@live-to-eat/domain';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, type } from '@/components/tokens';

type ShareInboxNoticeProps = Readonly<{
  candidates: SharedPlaceInboxCandidate[];
  onDiscard: (payloadId: string) => void;
}>;

export function ShareInboxNotice({ candidates, onDiscard }: ShareInboxNoticeProps) {
  const { t } = useTranslation();
  const firstCandidate = candidates[0];

  if (!firstCandidate) {
    return null;
  }

  return (
    <View accessibilityLabel={t('shareInbox.accessibilityLabel')} style={styles.container}>
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>{t('shareInbox.eyebrow')}</Text>
        <Text style={styles.title}>{t('shareInbox.title')}</Text>
        <Text style={styles.body}>{t('shareInbox.body')}</Text>
        <Text numberOfLines={1} style={styles.host}>
          {firstCandidate.host}
        </Text>
      </View>
      <Pressable
        accessibilityHint={t('shareInbox.discardHint')}
        accessibilityRole="button"
        onPress={() => onDiscard(firstCandidate.payloadId)}
        style={({ pressed }) => [styles.discardButton, pressed ? styles.discardButtonPressed : undefined]}
      >
        <Text style={styles.discardText}>{t('shareInbox.discard')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-end',
    backgroundColor: colors.paper,
    borderColor: colors.ink,
    borderRadius: radii.panel,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  eyebrow: {
    color: colors.tomato,
    fontFamily: type.utility,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.ink,
    fontFamily: type.display,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  body: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  host: {
    color: colors.ink,
    fontFamily: type.utility,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
  },
  discardButton: {
    borderColor: colors.rule,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
    paddingVertical: 9,
  },
  discardButtonPressed: {
    backgroundColor: colors.canvas,
  },
  discardText: {
    color: colors.ink,
    fontFamily: type.utility,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
