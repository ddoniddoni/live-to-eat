import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, type } from '@/components/tokens';
import { MapCanvas } from '@/features/maps/MapCanvas';
import { ShareInboxNotice } from '@/features/share-inbox/ShareInboxNotice';
import { useShareInbox } from '@/features/share-inbox/useShareInbox';

export default function MyMapScreen() {
  const { t } = useTranslation();
  const shareInbox = useShareInbox();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text accessibilityRole="header" style={styles.title}>
              {t('map.title')}
            </Text>
            <Text style={styles.subtitle}>{t('map.subtitle')}</Text>
          </View>
          <View accessibilityLabel={t('map.private')} accessibilityRole="text" style={styles.privacyPill}>
            <View accessibilityElementsHidden style={styles.privacyDot} />
            <Text style={styles.privacyText}>{t('map.private')}</Text>
          </View>
        </View>

        {shareInbox.candidates.length > 0 ? (
          <ShareInboxNotice candidates={shareInbox.candidates} onDiscard={shareInbox.discard} />
        ) : null}

        <MapCanvas />

        <View style={styles.emptyPanel}>
          <Text style={styles.emptyEyebrow}>{t('map.emptyEyebrow')}</Text>
          <Text style={styles.emptyTitle}>{t('map.emptyTitle')}</Text>
          <Text style={styles.emptyBody}>{t('map.emptyBody')}</Text>
          <View style={styles.locationNote}>
            <View accessibilityElementsHidden style={styles.locationDot} />
            <Text style={styles.locationText}>{t('map.locationNote')}</Text>
          </View>
        </View>
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
    gap: spacing.md,
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.lg,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.ink,
    fontFamily: type.display,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1.5,
    lineHeight: 37,
  },
  subtitle: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  privacyPill: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  privacyDot: {
    backgroundColor: colors.wasabi,
    borderRadius: radii.pill,
    height: 7,
    width: 7,
  },
  privacyText: {
    color: colors.paper,
    fontFamily: type.utility,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  emptyPanel: {
    backgroundColor: colors.ink,
    borderRadius: radii.panel,
    gap: 6,
    padding: spacing.lg,
  },
  emptyEyebrow: {
    color: colors.wasabi,
    fontFamily: type.utility,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  emptyTitle: {
    color: colors.paper,
    fontFamily: type.display,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.7,
    lineHeight: 29,
  },
  emptyBody: {
    color: colors.panelMuted,
    fontFamily: type.body,
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 320,
  },
  locationNote: {
    alignItems: 'center',
    borderTopColor: colors.rule,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
  },
  locationDot: {
    backgroundColor: colors.tomato,
    borderRadius: radii.pill,
    height: 8,
    width: 8,
  },
  locationText: {
    color: colors.panelMuted,
    flex: 1,
    fontFamily: type.body,
    fontSize: 12,
    fontWeight: '600',
  },
});
