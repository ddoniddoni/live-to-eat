import { useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '@/components/tokens';
import { HelpCenterSheet, type HelpPage } from './HelpCenterSheet';

// The form stays mounted underneath the reader; opening a document never grants consent.
export function HelpLinks({ disabled = false }: { disabled?: boolean }) {
  const { t } = useTranslation();
  const [page, setPage] = useState<HelpPage | null>(null);
  return <>
    <View style={styles.links}>
      {(['terms', 'privacy', 'home'] as const).map((id) => <Pressable key={id}
        accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled}
        testID={`help-entry-${id}`} onPress={() => { Keyboard.dismiss(); setPage(id); }}
        style={({ pressed }) => [styles.link, (disabled || pressed) && styles.faded]}>
        <Text style={styles.text}>{t(id === 'home' ? 'help.title' : `help.${id}.title`)}</Text>
      </Pressable>)}
    </View>
    {page ? <HelpCenterSheet initialPage={page} onClose={() => setPage(null)} /> : null}
  </>;
}

const styles = StyleSheet.create({
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 12 },
  link: { minHeight: 44, justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 4 },
  text: { color: colors.muted, fontSize: 13, textDecorationLine: 'underline' },
  faded: { opacity: 0.5 },
});
