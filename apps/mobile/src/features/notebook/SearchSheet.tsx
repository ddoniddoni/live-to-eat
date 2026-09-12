import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { copyAsPrivate, type NotebookPlace } from '@live-to-eat/domain';
import { Sheet } from '@/components/ui/Sheet';
import { Action, Chip, Empty, ui } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { colors } from '@/components/tokens';
import { demoCatalog } from './demoData';
import { FoodArtwork } from '@/components/ui/Artwork';
import { artKind } from './placeAppearance';
export function SearchSheet({
  onClose,
  onPick,
  savedIds,
}: {
  onClose: () => void;
  onPick: (p: NotebookPlace) => void;
  savedIds: string[];
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<string | null>(null);
  const saved = new Set(savedIds);
  const results = demoCatalog.filter((p) =>
    `${p.displayName} ${p.address} ${p.tags.join(' ')}`
      .toLocaleLowerCase()
      .includes((search ?? '').toLocaleLowerCase()),
  );
  return (
    <Sheet title={t('placeSearch.title')} subtitle={t('search.demoHint')} onClose={onClose}>
      <View
        style={[
          ui.row,
          {
            backgroundColor: colors.paper,
            borderWidth: 1,
            borderColor: colors.rule,
            borderRadius: 15,
            paddingLeft: 14,
          },
        ]}
      >
        <Icon name="search" color={colors.muted} />
        <TextInput
          autoFocus
          accessibilityLabel={t('placeSearch.placeholder')}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => setSearch(query.trim())}
          returnKeyType="search"
          placeholder={t('placeSearch.placeholder')}
          placeholderTextColor={colors.muted}
          style={{ minHeight: 54, flex: 1, color: colors.ink, fontSize: 15 }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('placeSearch.search')}
          onPress={() => setSearch(query.trim())}
          style={{ padding: 15, minHeight: 48 }}
        >
          <Icon name="arrow" color={colors.tomato} />
        </Pressable>
      </View>
      <View style={ui.row}>
        <Icon name="globe" size={14} color={colors.muted} />
        <Text style={ui.muted}>{t('search.scope')}</Text>
      </View>
      {search === null ? (
        <View style={{ gap: 14 }}>
          <Text style={ui.label}>{t('search.try')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {['성수', '커피', '도쿄', '베이커리'].map((q) => (
              <Chip
                key={q}
                label={q}
                onPress={() => {
                  setQuery(q);
                  setSearch(q);
                }}
              />
            ))}
          </View>
        </View>
      ) : null}
      <Text style={ui.heading}>
        {t(search === null ? 'search.samples' : 'placeSearch.results')}{' '}
        <Text style={{ color: colors.tomato }}>{results.length}</Text>
      </Text>
      {results.map((p) => (
        <Pressable
          key={p.savedId}
          accessibilityRole="button"
          onPress={() => onPick(copyAsPrivate(p, p.savedId))}
          style={[ui.row, { gap: 14, paddingVertical: 10 }]}
        >
          <FoodArtwork kind={artKind(p)} size={68} />
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={[ui.body, { fontWeight: '700' }]}>{p.displayName}</Text>
            <Text style={ui.muted}>{p.regionPath.map((r) => r.label).join(' · ')}</Text>
            <Text style={[ui.muted, { fontSize: 11 }]}>{p.tags.join(' · ')}</Text>
          </View>
          <Icon
            name={saved.has(p.savedId) ? 'check' : 'plus'}
            color={saved.has(p.savedId) ? colors.success : colors.ink}
            size={20}
          />
        </Pressable>
      ))}
      {results.length === 0 ? (
        <Empty
          title={t('search.empty')}
          body={t('search.emptyHint')}
          action={
            <Action
              secondary
              label={t('common.clear')}
              onPress={() => {
                setQuery('');
                setSearch(null);
              }}
            />
          }
        />
      ) : null}
    </Sheet>
  );
}
