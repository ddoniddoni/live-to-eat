import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, type } from '@/components/tokens';

const readiness = ['workspace', 'mobile', 'share'] as const;

export default function BootstrapScreen() {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <View style={styles.headerRow}>
          <Text accessibilityRole="text" style={styles.eyebrow}>
            M0 · {t('bootstrap.label')}
          </Text>
          <View accessibilityElementsHidden style={styles.mark}>
            <View style={styles.markDot} />
            <View style={styles.markLine} />
            <View style={[styles.markDot, styles.markDotEnd]} />
          </View>
        </View>

        <View style={styles.hero}>
          <Text accessibilityRole="header" style={styles.wordmark}>
            LiveToEat
          </Text>
          <Text style={styles.statement}>{t('bootstrap.statement')}</Text>
        </View>

        <View style={styles.statusPanel}>
          <Text style={styles.panelTitle}>{t('bootstrap.title')}</Text>
          <Text style={styles.panelBody}>{t('bootstrap.body')}</Text>

          <View style={styles.readinessList}>
            {readiness.map((item) => (
              <View key={item} style={styles.readinessRow}>
                <View accessibilityElementsHidden style={styles.statusDot} />
                <Text style={styles.readinessLabel}>{t(`bootstrap.items.${item}`)}</Text>
                <Text style={styles.readinessState}>{t('bootstrap.ready')}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.footnote}>{t('bootstrap.footnote')}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.canvas,
    flex: 1,
  },
  page: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.lg,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: colors.muted,
    fontFamily: type.utility,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  mark: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  markDot: {
    backgroundColor: colors.tomato,
    borderRadius: radii.pill,
    height: 12,
    width: 12,
  },
  markDotEnd: {
    backgroundColor: colors.wasabi,
  },
  markLine: {
    backgroundColor: colors.ink,
    height: 2,
    width: 36,
  },
  hero: {
    gap: spacing.md,
  },
  wordmark: {
    color: colors.ink,
    fontFamily: type.display,
    fontSize: 58,
    fontWeight: '900',
    letterSpacing: -3.6,
    lineHeight: 62,
  },
  statement: {
    color: colors.ink,
    fontFamily: type.body,
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.5,
    lineHeight: 31,
    maxWidth: 300,
  },
  statusPanel: {
    backgroundColor: colors.ink,
    borderRadius: radii.panel,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  panelTitle: {
    color: colors.paper,
    fontFamily: type.display,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  panelBody: {
    color: colors.panelMuted,
    fontFamily: type.body,
    fontSize: 15,
    lineHeight: 22,
  },
  readinessList: {
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  readinessRow: {
    alignItems: 'center',
    borderTopColor: colors.rule,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 43,
  },
  statusDot: {
    backgroundColor: colors.wasabi,
    borderRadius: radii.pill,
    height: 8,
    marginRight: spacing.sm,
    width: 8,
  },
  readinessLabel: {
    color: colors.paper,
    flex: 1,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: '600',
  },
  readinessState: {
    color: colors.wasabi,
    fontFamily: type.utility,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  footnote: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 13,
    lineHeight: 19,
  },
});
