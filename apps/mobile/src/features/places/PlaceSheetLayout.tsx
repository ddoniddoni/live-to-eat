import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, type } from '@/components/tokens';

type PlaceSheetLayoutProps = {
  children: ReactNode;
  closeLabel: string;
  eyebrow: string;
  onDismiss: () => void;
  title: string;
  visible: boolean;
};

export function PlaceSheetLayout({ children, closeLabel, eyebrow, onDismiss, title, visible }: PlaceSheetLayoutProps) {
  return (
    <Modal animationType="slide" onRequestClose={onDismiss} presentationStyle="pageSheet" visible={visible}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>{eyebrow}</Text>
              <Text accessibilityRole="header" style={styles.title}>
                {title}
              </Text>
            </View>
            <Pressable accessibilityRole="button" onPress={onDismiss} style={styles.closeButton}>
              <Text style={styles.closeText}>{closeLabel}</Text>
            </Pressable>
          </View>
          {children}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  closeButton: {
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  closeText: {
    color: colors.muted,
    fontFamily: type.body,
    fontSize: 14,
    fontWeight: '800',
  },
  eyebrow: {
    color: colors.tomato,
    fontFamily: type.utility,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.page,
    paddingTop: spacing.sm,
  },
  keyboardView: {
    flex: 1,
  },
  safeArea: {
    backgroundColor: colors.canvas,
    flex: 1,
  },
  title: {
    color: colors.ink,
    fontFamily: type.display,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 35,
    marginTop: 3,
  },
});
