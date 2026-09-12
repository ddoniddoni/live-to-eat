import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useReducedMotion } from './useReducedMotion';
import { colors } from '@/components/tokens';
import { IconButton, ui } from './primitives';
export function Sheet({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  return (
    <Modal visible animationType={reducedMotion ? 'none' : 'slide'} presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, width: '100%', maxWidth: 640, alignSelf: 'center' }}
        >
          <View
            style={{
              paddingHorizontal: 24,
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderColor: colors.rule,
            }}
          >
            <View style={ui.between}>
              <Text accessibilityRole="header" style={[ui.heading, { flex: 1 }]}>
                {title}
              </Text>
              <IconButton name="close" label={t('common.close')} onPress={onClose} />
            </View>
            {subtitle ? <Text style={ui.muted}>{subtitle}</Text> : null}
          </View>
          <ScrollView
            contentContainerStyle={{ padding: 24, gap: 22, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
          {footer ? (
            <View
              style={{
                padding: 20,
                borderTopWidth: 1,
                borderColor: colors.rule,
                backgroundColor: colors.paper,
                gap: 10,
              }}
            >
              {footer}
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
