import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NotebookPlace } from '@live-to-eat/domain';
import { FoodArtwork } from '@/components/ui/Artwork';
import { Icon } from '@/components/ui/Icon';
import { ui } from '@/components/ui/primitives';
import { colors } from '@/components/tokens';
import { artKind } from './placeAppearance';
export function PlaceCard({
  place,
  onPress,
  onSelect,
  selected,
  subtitle,
}: {
  place: NotebookPlace;
  onPress?: () => void;
  onSelect?: (place: NotebookPlace) => void;
  selected?: boolean;
  subtitle?: string;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole={selected === undefined ? 'button' : 'checkbox'}
      testID={`saved-place-${place.savedId}`}
      accessibilityState={selected === undefined ? {} : { checked: selected }}
      onPress={onSelect ? () => onSelect(place) : onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: 15,
        alignItems: 'center',
        paddingVertical: 17,
        borderBottomWidth: 1,
        borderColor: colors.rule,
        opacity: pressed ? 0.65 : 1,
      })}
    >
      <FoodArtwork kind={artKind(place)} size={76} />
      <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
        <Text style={[ui.body, { fontWeight: '700', fontSize: 16 }]}>{place.displayName}</Text>
        <Text style={ui.muted}>
          {subtitle ??
            [place.regionPath.at(-1)?.label ?? t('map.unclassified'), place.tags[0]]
              .filter(Boolean)
              .join(' · ')}
        </Text>
        <View style={[ui.row, { gap: 6, flexWrap: 'wrap' }]}>
          <View
            style={{
              backgroundColor: place.visitStatus === 'visited' ? colors.sage : colors.blush,
              paddingHorizontal: 7,
              paddingVertical: 3,
              borderRadius: 6,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: '600',
                color: place.visitStatus === 'visited' ? colors.success : colors.tomato,
              }}
            >
              {t(`placeSearch.${place.visitStatus}`)}
            </Text>
          </View>
          {place.isRecommended ? <Icon name="heart" size={13} color={colors.tomato} filled /> : null}
          {place.collectionName ? (
            <Text numberOfLines={1} style={[ui.muted, { fontSize: 11, flex: 1 }]}>
              {place.collectionName}
            </Text>
          ) : null}
        </View>
      </View>
      {selected === undefined ? (
        <Icon name="chevron" color={colors.muted} size={16} />
      ) : (
        <View
          style={{
            height: 24,
            width: 24,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: selected ? colors.ink : colors.rule,
            backgroundColor: selected ? colors.ink : colors.paper,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {selected ? <Icon name="check" size={16} color={colors.paper} /> : null}
        </View>
      )}
    </Pressable>
  );
}
