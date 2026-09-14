import { Pressable, Text, View } from 'react-native';
import { colors } from '@/components/tokens';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ui } from '@/components/ui/primitives';
import { safety } from './safetyStyles';

export function SafetyIntro({ eyebrow, title, body, icon }: {
  eyebrow: string; title: string; body: string; icon: IconName;
}) {
  return (
    <View style={safety.heading}>
      <View style={safety.stamp}><Icon name={icon} color={colors.tomato} size={28} /></View>
      <Text style={safety.eyebrow}>{eyebrow}</Text>
      <Text accessibilityRole="header" style={safety.title}>{title}</Text>
      <Text style={ui.muted}>{body}</Text>
    </View>
  );
}

export function SafetyRow({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <View style={safety.detailRow}>
      <View style={safety.detailIcon}><Icon name={icon} size={20} color={colors.muted} /></View>
      <View style={safety.copy}>
        <Text style={safety.rowTitle}>{title}</Text>
        <Text style={ui.muted}>{body}</Text>
      </View>
    </View>
  );
}

export function SafetyChoice({ selected, label, description, onPress, checkbox = false }: {
  selected: boolean; label: string; description?: string; onPress: () => void; checkbox?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={checkbox ? 'checkbox' : 'radio'}
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [safety.choice, selected ? safety.choiceSelected : null, pressed ? safety.pressed : null]}
    >
      <View style={[safety.selection, checkbox ? safety.checkbox : null, selected ? safety.selectionOn : null]}>
        {selected ? <Icon name="check" color={colors.paper} size={14} /> : null}
      </View>
      <View style={safety.copy}>
        <Text style={safety.rowTitle}>{label}</Text>
        {description ? <Text style={ui.muted}>{description}</Text> : null}
      </View>
    </Pressable>
  );
}
