import { useCallback, useMemo, useState } from 'react';
import { FlatList, Keyboard, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  buildRegionOptions,
  regionOptionsAt,
  type RegionOption,
  type RegionSource,
} from '@live-to-eat/domain';
import { Sheet } from '@/components/ui/Sheet';
import { Action, Field, ui } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { colors } from '@/components/tokens';
import { regionStyles as styles } from './regionStyles';

type Props = {
  places: readonly RegionSource[];
  value: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  rootId?: string;
  hint: string;
};

function useRegionSelection(places: readonly RegionSource[], value: string, rootId?: string) {
  const options = useMemo(() => buildRegionOptions(places), [places]);
  const base = rootId ?? 'all';
  const [draft, setDraft] = useState(() =>
    value === 'unclassified' || options.some((r) => r.id === value) ? value : base,
  );
  const [query, setQuery] = useState('');
  const current = options.find((r) => r.id === draft);
  const path = current?.path.filter((part) => part.id !== rootId) ?? [];
  const unclassifiedCount = places.filter((p) => p.regionPath.length === 0).length;
  const count =
    draft === 'all' ? places.length : draft === 'unclassified' ? unclassifiedCount : (current?.count ?? 0);
  const choices = regionOptionsAt(options, draft === 'all' ? null : draft, query, rootId ?? null);
  const navigate = useCallback((id: string) => {
    setDraft(id);
    setQuery('');
  }, []);
  return { base, draft, query, setQuery, current, path, unclassifiedCount, count, choices, navigate };
}

export function RegionPickerSheet({ places, value, onSelect, onClose, rootId, hint }: Props) {
  const { t } = useTranslation();
  const { base, draft, query, setQuery, current, path, unclassifiedCount, count, choices, navigate } =
    useRegionSelection(places, value, rootId);
  const baseLabel = t(rootId ? 'regions.nationwide' : 'regions.allSaved');
  const label =
    draft === base
      ? baseLabel
      : draft === 'unclassified'
        ? t('map.unclassified')
        : (current?.label ?? t('regions.unknown'));
  const renderRegion = useCallback(
    ({ item }: { item: RegionOption }) => <RegionRow option={item} onSelect={navigate} />,
    [navigate],
  );

  return (
    <Sheet
      title={t('regions.title')}
      subtitle={hint}
      onClose={onClose}
      scrollable={false}
      footer={
        <>
          <View style={styles.footer}>
            <Text style={ui.muted}>{current?.path.map((part) => part.label).join(' · ') || label}</Text>
            <Text style={ui.body}>{t('regions.placeCount', { count })}</Text>
          </View>
          <Action
            label={t('regions.apply', { region: label })}
            icon="check"
            testID="region-apply"
            onPress={() => { Keyboard.dismiss(); onSelect(draft); }}
          />
        </>
      }
    >
      <FlatList
        data={choices}
        renderItem={renderRegion}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>{t('regions.eyebrow')}</Text>
            <Field
              label={t('regions.find')}
              testID="region-search"
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
              placeholder={t('regions.placeholder')}
              value={query}
              onChangeText={setQuery}
            />
            <View style={styles.trail}>
              <Pressable accessibilityRole="button" accessibilityState={{ selected: draft === base }}
                testID="region-root" onPress={() => navigate(base)} style={styles.crumb}>
                <Text style={styles.crumbText}>{baseLabel}</Text>
              </Pressable>
              {path.map((part) => (
                <Pressable
                  key={part.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: draft === part.id }}
                  onPress={() => navigate(part.id)}
                  style={styles.crumb}
                >
                  <Text style={styles.crumbText}>› {part.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text accessibilityRole="header" style={ui.heading}>
              {query.trim() ? t('regions.results') : label}
            </Text>
            {!rootId && draft === base && !query.trim() ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => navigate('unclassified')}
                style={styles.row}
              >
                <View style={styles.rowCopy}>
                  <Text style={styles.rowLabel}>{t('map.unclassified')}</Text>
                  <Text style={ui.muted}>{t('regions.placeCount', { count: unclassifiedCount })}</Text>
                </View>
                <Icon name="chevron" color={colors.muted} size={16} />
              </Pressable>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name={query.trim() ? 'search' : 'pin'} color={colors.tomato} size={24} />
            <Text style={ui.body}>{t(query.trim() ? 'regions.noResults' : 'regions.ready')}</Text>
            <Text style={ui.muted}>{t(query.trim() ? 'regions.noResultsHint' : 'regions.readyHint')}</Text>
          </View>
        }
      />
    </Sheet>
  );
}

function RegionRow({ option, onSelect }: { option: RegionOption; onSelect: (id: string) => void }) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      testID={`region-${option.id}`}
      accessibilityLabel={t('regions.open', { region: option.path.map((p) => p.label).join(' · ') })}
      onPress={() => onSelect(option.id)}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <View style={styles.rowCopy}>
        <Text style={styles.rowLabel}>{option.label}</Text>
        <Text style={styles.rowPath}>
          {option.path
            .slice(0, -1)
            .map((p) => p.label)
            .join(' · ')}
        </Text>
      </View>
      <Text style={ui.muted}>{t('regions.placeCount', { count: option.count })}</Text>
      <Icon name="chevron" color={colors.muted} size={16} />
    </Pressable>
  );
}
