import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NotebookPlace } from '@live-to-eat/domain';
import { colors } from '@/components/tokens';
import { FoodArtwork } from '@/components/ui/Artwork';
import { Action, ui } from '@/components/ui/primitives';

export const PublicPlaceRow = memo(function PublicPlaceRow({ place, index, saved, busy, disabled, onSave, onReport }: {
  place: NotebookPlace; index: number; saved: boolean; busy: boolean; disabled: boolean;
  onSave: (place: NotebookPlace) => void; onReport: (place: NotebookPlace) => void;
}) {
  const { t } = useTranslation();
  return (
    <View testID={`public-place-${place.savedId}`} style={{ gap: 13, borderBottomWidth: 1, borderColor: colors.rule, paddingBottom: 22, marginBottom: 22 }}>
      <View style={ui.row}>
        <FoodArtwork kind={index} size={64} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[ui.body, { fontWeight: '700' }]}>{place.displayName}</Text>
          <Text style={ui.muted}>{place.address}</Text>
        </View>
      </View>
      {place.publicNote ? <Text style={ui.body}>{place.publicNote}</Text> : null}
      <Action testID={`public-save-${place.savedId}`} label={t(saved ? 'discover.copied' : 'discover.copyToMap')}
        icon={saved ? 'check' : 'plus'} secondary disabled={saved || disabled} busy={busy} onPress={() => onSave(place)} />
      <Pressable accessibilityRole="button" accessibilityLabel={t('report.placeActionLabel', { place: place.displayName })}
        onPress={() => onReport(place)} style={({ pressed }) => ({ minHeight: 44, alignSelf: 'flex-end', justifyContent: 'center', opacity: pressed ? 0.65 : 1 })}>
        <Text style={ui.muted}>{t('report.placeAction')}</Text>
      </Pressable>
    </View>
  );
});
