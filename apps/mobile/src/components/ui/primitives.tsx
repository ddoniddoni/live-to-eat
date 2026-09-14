import type { ReactNode, Ref } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { colors, type } from '@/components/tokens';
import { Icon, type IconName } from './Icon';
export const ui = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: {
    fontFamily: type.body,
    color: colors.ink,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -1.1,
    lineHeight: 40,
  },
  heading: { fontFamily: type.body, color: colors.ink, fontSize: 20, fontWeight: '700', letterSpacing: -0.5 },
  body: { fontFamily: type.body, color: colors.ink, fontSize: 15, lineHeight: 23 },
  muted: { fontFamily: type.body, color: colors.muted, fontSize: 13, lineHeight: 20 },
  label: { fontFamily: type.body, color: colors.ink, fontSize: 14, fontWeight: '600', marginBottom: 10 },
  section: { gap: 16, marginTop: 28 },
  divider: { height: 1, backgroundColor: colors.rule },
  content: { padding: 24, paddingBottom: 32 },
  error: { backgroundColor: colors.blush, borderRadius: 14, padding: 16 },
  errorText: { color: colors.tomato, fontSize: 14, lineHeight: 21 },
  input: {
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 14,
    padding: 15,
    color: colors.ink,
    backgroundColor: colors.paper,
    fontFamily: type.body,
    fontSize: 15,
    minHeight: 50,
  },
});
export function Action({
  label,
  onPress,
  icon,
  secondary = false,
  danger = false,
  disabled = false,
  busy = false,
  testID,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  busy?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 52,
          paddingVertical: 14,
          paddingHorizontal: 18,
          borderRadius: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 9,
          backgroundColor: secondary ? colors.sage : danger ? colors.tomato : colors.ink,
          opacity: disabled || busy ? 0.5 : pressed ? 0.8 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? colors.ink : colors.paper} />
      ) : icon ? (
        <Icon name={icon} size={19} color={secondary ? colors.ink : colors.paper} />
      ) : null}
      <Text
        style={{
          color: secondary ? colors.ink : colors.paper,
          fontFamily: type.body,
          fontWeight: '700',
          fontSize: 15,
          flexShrink: 1,
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function IconButton({
  name,
  label,
  onPress,
  accent = false,
  disabled = false,
  testID,
}: {
  name: IconName;
  label: string;
  onPress: () => void;
  accent?: boolean;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 46,
        height: 46,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: accent ? colors.blush : colors.paper,
        opacity: disabled ? 0.5 : pressed ? 0.6 : 1,
      })}
    >
      <Icon name={name} color={accent ? colors.tomato : colors.ink} />
    </Pressable>
  );
}
export function Chip({
  label,
  selected = false,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: IconName;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        paddingHorizontal: 16,
        paddingVertical: 11,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: selected ? colors.ink : colors.rule,
        backgroundColor: selected ? colors.ink : colors.paper,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        flexShrink: 1,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {icon ? <Icon name={icon} size={15} color={selected ? colors.paper : colors.muted} /> : null}
      <Text
        style={{
          fontFamily: type.body,
          flexShrink: 1,
          fontSize: 13,
          fontWeight: selected ? '700' : '500',
          color: selected ? colors.paper : colors.muted,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Field({ label, inputRef, ...props }: TextInputProps & { label: string; inputRef?: Ref<TextInput> }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={ui.label}>{label}</Text>
      <TextInput
        {...props}
        ref={inputRef}
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={[ui.input, props.multiline ? { minHeight: 110, textAlignVertical: 'top' } : null, props.style]}
      />
    </View>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <View style={ui.error}>
      <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={ui.errorText}>
        {children}
      </Text>
    </View>
  );
}
export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 44, paddingHorizontal: 24, gap: 13 }}>
      <View style={{ padding: 20, borderRadius: 28, backgroundColor: colors.sage }}>
        <Icon name="pin" size={32} color={colors.success} />
      </View>
      <Text style={[ui.heading, { textAlign: 'center' }]}>{title}</Text>
      <Text style={[ui.muted, { textAlign: 'center', maxWidth: 270 }]}>{body}</Text>
      {action}
    </View>
  );
}
