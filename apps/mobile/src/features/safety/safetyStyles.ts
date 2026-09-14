import { StyleSheet } from 'react-native';
import { colors, radii, spacing, type } from '@/components/tokens';
import { ui } from '@/components/ui/primitives';

export const safety = StyleSheet.create({
  heading: { gap: 12, paddingVertical: 4 },
  stamp: { width: 58, height: 58, borderRadius: 20, backgroundColor: colors.blush, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  eyebrow: { color: colors.tomato, fontFamily: type.utility, fontSize: 11, fontWeight: '700', letterSpacing: 1.3 },
  title: { color: colors.ink, fontFamily: type.display, fontSize: 30, lineHeight: 37, letterSpacing: -1, fontWeight: '900' },
  card: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.rule, borderRadius: radii.panel, paddingHorizontal: spacing.md },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 18 },
  detailIcon: { paddingTop: 2 },
  copy: { flex: 1, gap: 5, minWidth: 0 },
  rowTitle: { ...ui.body, fontWeight: '700' },
  choice: { borderWidth: 1, borderColor: colors.rule, backgroundColor: colors.paper, borderRadius: 16, flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 16, minHeight: 56 },
  choiceSelected: { borderColor: colors.success, backgroundColor: colors.sage },
  selection: { height: 22, width: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkbox: { borderRadius: 6 },
  selectionOn: { backgroundColor: colors.success, borderColor: colors.success },
  pressed: { opacity: 0.75 },
  stack: { gap: 10 },
  inset: { backgroundColor: colors.sage, padding: 18, borderRadius: 18, gap: 12 },
  review: { borderTopWidth: 3, borderTopColor: colors.tomato, backgroundColor: colors.paper, borderRadius: 16, padding: 20, gap: 16 },
  caption: { ...ui.muted, fontSize: 12 },
});
