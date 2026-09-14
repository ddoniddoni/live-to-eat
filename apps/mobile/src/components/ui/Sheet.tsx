import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useReducedMotion } from './useReducedMotion';
import { colors } from '@/components/tokens';
import { Action, IconButton, ui } from './primitives';
export function Sheet({
  title,
  subtitle,
  onClose,
  children,
  footer,
  scrollable = true,
  onBack,
  unsavedChanges = false,
  busy = false,
  testID,
  closeLabel,
  contentKey = title,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  scrollable?: boolean;
  onBack?: () => void;
  unsavedChanges?: boolean;
  busy?: boolean;
  testID?: string;
  closeLabel?: string;
  contentKey?: string | number;
}) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const bodyPointerEvents = busy ? 'none' : 'auto';
  const [discarding, setDiscarding] = useState(false);
  const heading = useRef<Text>(null);
  const previousContent = useRef({ discarding, contentKey });
  const focusHeading = useCallback(() => {
    if (Platform.OS !== 'web' && heading.current)
      AccessibilityInfo.sendAccessibilityEvent(heading.current, 'focus');
  }, []);
  useEffect(() => {
    if (previousContent.current.discarding !== discarding || previousContent.current.contentKey !== contentKey) {
      focusHeading();
    }
    previousContent.current = { discarding, contentKey };
  }, [discarding, contentKey, focusHeading]);
  const requestClose = () => {
    if (busy) return;
    Keyboard.dismiss();
    if (discarding) setDiscarding(false);
    else if (unsavedChanges) setDiscarding(true);
    else onClose();
  };
  const requestBack = () => {
    if (busy) return;
    if (Keyboard.isVisible()) {
      Keyboard.dismiss();
      return;
    }
    if (discarding) setDiscarding(false);
    else if (onBack) onBack();
    else requestClose();
  };
  return (
    <Modal
      visible
      animationType={reducedMotion ? 'none' : 'slide'}
      presentationStyle="pageSheet"
      allowSwipeDismissal={false}
      onRequestClose={requestBack}
      onShow={focusHeading}
    >
      <SafeAreaView
        accessibilityViewIsModal
        onAccessibilityEscape={requestBack}
        testID={testID}
        style={{ flex: 1, backgroundColor: colors.canvas }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
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
              <Text
                ref={heading}
                accessible
                accessibilityRole="header"
                testID="sheet-title"
                style={[ui.heading, { flex: 1 }]}
              >
                {discarding ? t('draft.discardTitle') : title}
              </Text>
              <IconButton
                name="close"
                label={discarding ? t('draft.keepEditing') : (closeLabel ?? t('common.close'))}
                onPress={requestClose}
                disabled={busy}
                testID="sheet-close"
              />
            </View>
            {subtitle && !discarding ? <Text style={ui.muted}>{subtitle}</Text> : null}
          </View>
          {discarding ? (
            <ScrollView key="discard" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 20 }}>
              <Text style={ui.body}>{t('draft.discardBody')}</Text>
              <Action
                label={t('draft.keepEditing')}
                onPress={() => setDiscarding(false)}
                testID="draft-keep"
              />
              <Action secondary label={t('draft.discard')} onPress={onClose} testID="draft-discard" />
            </ScrollView>
          ) : scrollable ? (
            <ScrollView
              key={`content-${contentKey}`}
              pointerEvents={bodyPointerEvents}
              accessibilityElementsHidden={busy}
              keyboardDismissMode="on-drag"
              contentContainerStyle={{ padding: 24, gap: 22, paddingBottom: 40 }}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          ) : (
            <View pointerEvents={bodyPointerEvents} accessibilityElementsHidden={busy} style={{ flex: 1 }}>{children}</View>
          )}
          {footer && !discarding ? (
            <View
              testID="sheet-footer"
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
