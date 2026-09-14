import { StyleSheet } from 'react-native';
import { colors, type } from '@/components/tokens';
import { ui } from '@/components/ui/primitives';

export const regionStyles = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, flexShrink: 1 },
  triggerLabel: { ...ui.body, fontWeight: '700', flexShrink: 1 },
  list: { padding: 24, paddingBottom: 36 },
  header: { gap: 18, paddingBottom: 22 },
  eyebrow: {
    color: colors.tomato,
    fontFamily: type.utility,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  trail: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  crumb: {
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: 'center',
    backgroundColor: colors.sage,
    borderRadius: 12,
  },
  crumbText: { ...ui.muted, color: colors.ink, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 70,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderColor: colors.rule,
  },
  rowCopy: { flex: 1, minWidth: 0, gap: 4 },
  rowLabel: { ...ui.body, fontSize: 17, fontWeight: '700' },
  rowPath: { ...ui.muted, fontSize: 12 },
  footer: { gap: 4 },
  empty: { gap: 8, paddingVertical: 22 },
  pressed: { opacity: 0.65 },
});
