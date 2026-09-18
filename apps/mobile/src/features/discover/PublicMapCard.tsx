import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '@/components/tokens';
import { FoodArtwork } from '@/components/ui/Artwork';
import { Icon } from '@/components/ui/Icon';
import { ui } from '@/components/ui/primitives';
import type { PublicMapSummary } from './publicMapApi';

export type PublicMapPerson = PublicMapSummary & { regionLabel?: string; region?: string; theme?: string };
export const PublicMapCard = memo(function PublicMapCard({ person, index, isDemo, regional, regionLabel, onSelect }: {
  person: PublicMapPerson; index: number; isDemo: boolean; regional: boolean; regionLabel: string;
  onSelect: (person: PublicMapPerson) => void;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      testID={`discover-person-${person.handle}`}
      onPress={() => onSelect(person)}
      style={({ pressed }) => ({
        backgroundColor: colors.paper,
        borderWidth: 1,
        borderColor: colors.rule,
        borderRadius: 24,
        overflow: 'hidden',
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View
        style={{
          backgroundColor:
            index % 3 === 0 ? colors.blush : index % 3 === 1 ? colors.sage : colors.lavender,
          padding: 22,
          minHeight: 157,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <View style={{ flex: 1, gap: 12 }}>
          <View style={[ui.row, { gap: 4 }]}>
            <Icon name="pin" size={12} color={colors.muted} />
            <Text style={{ flex: 1, fontSize: 11, color: colors.muted }}>
              {regional ? regionLabel : person.regionLabel ?? t('explore.publicMap')}
            </Text>
          </View>
          <Text
            style={{
              fontSize: 23,
              lineHeight: 32,
              fontWeight: '700',
              letterSpacing: -0.8,
              color: colors.ink,
            }}
          >
            {person.bio || t('explore.defaultBio')}
          </Text>
        </View>
        <View style={{ transform: [{ rotate: index % 2 === 0 ? '12deg' : '-12deg' }] }}>
          <FoodArtwork kind={index} size={94} />
        </View>
      </View>
      <View style={[ui.between, { padding: 18 }]}>
        <View style={[ui.row, { flex: 1, minWidth: 0 }]}>
          <View
            style={{
              height: 40,
              width: 40,
              borderRadius: 20,
              backgroundColor: colors.sage,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink }}>
              {person.displayName.slice(0, 1)}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Text testID={`discover-person-name-${person.handle}`} style={[ui.body, { fontWeight: '700', fontSize: 14 }]}>
              {person.displayName}
              {t('explore.personMap')}
            </Text>
            <Text style={[ui.muted, { fontSize: 11 }]}>
              {t(regional ? 'discover.regionPlaceCount' : 'discover.placeCount', { count: person.publicPlaceCount })}
              {isDemo ? ` · ${t('common.demo')}` : ''}
            </Text>
          </View>
        </View>
        <Icon name="arrow" size={20} />
      </View>
    </Pressable>
  );
});
