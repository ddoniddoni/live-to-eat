import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Sheet } from '@/components/ui/Sheet';
import { colors } from '@/components/tokens';
import { FoodArtwork } from '@/components/ui/Artwork';
import { Icon } from '@/components/ui/Icon';
import { Action, ui } from '@/components/ui/primitives';
export function WelcomeSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Sheet
      title="LiveToEat"
      onClose={onClose}
      footer={<Action label={t('welcome.start')} onPress={onClose} icon="arrow" testID="welcome-start" />}
    >
      <View
        style={{
          backgroundColor: colors.sage,
          borderRadius: 28,
          height: 220,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <View style={{ position: 'absolute', left: 28, top: 35, transform: [{ rotate: '-16deg' }] }}>
          <FoodArtwork size={135} />
        </View>
        <View style={{ position: 'absolute', right: 25, top: 75, transform: [{ rotate: '12deg' }] }}>
          <FoodArtwork kind={1} size={125} />
        </View>
        <View style={{ position: 'absolute', right: 50, top: 30 }}>
          <Icon name="heart" color={colors.tomato} size={24} />
        </View>
      </View>
      <Text style={[ui.title, { fontSize: 32, lineHeight: 44 }]}>{t('welcome.title')}</Text>
      <Text style={ui.body}>{t('welcome.body')}</Text>
      <View style={{ gap: 17 }}>
        {(['save', 'people', 'share'] as const).map((key, index) => (
          <View style={ui.row} key={key}>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                backgroundColor: colors.blush,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon
                name={index === 0 ? 'pin' : index === 1 ? 'person' : 'share'}
                size={18}
                color={colors.tomato}
              />
            </View>
            <Text style={[ui.body, { flex: 1, fontSize: 14 }]}>{t(`welcome.${key}`)}</Text>
          </View>
        ))}
      </View>
      <Text style={ui.muted}>{t('welcome.demo')}</Text>
    </Sheet>
  );
}
