import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MapArtwork } from '@/components/ui/Artwork';
import { ui } from '@/components/ui/primitives';
export type MapPinPlace = Readonly<{
  coordinate: { latitude: number; longitude: number } | null;
  displayName: string;
  savedId: string;
}>;
export function MapCanvas(_props: {
  places?: MapPinPlace[];
  onSelectPlace?: (id: string) => void;
  selectedSavedId?: string | null;
}) {
  const { t } = useTranslation();
  return (
    <View style={{ height: 240, borderRadius: 22, overflow: 'hidden' }}>
      <MapArtwork />
      <View
        style={{
          position: 'absolute',
          bottom: 15,
          left: 15,
          right: 15,
          backgroundColor: 'white',
          padding: 15,
          borderRadius: 12,
        }}
      >
        <Text style={ui.muted}>{t('notebook.demoMap')}</Text>
      </View>
    </View>
  );
}
