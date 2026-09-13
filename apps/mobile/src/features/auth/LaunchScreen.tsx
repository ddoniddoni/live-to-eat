import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FoodArtwork, MapArtwork } from '@/components/ui/Artwork';
import { useReducedMotion } from '@/components/ui/useReducedMotion';
import { colors, radii, spacing, type } from '@/components/tokens';

export const LaunchScreen = () => {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(0.5);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          duration: 1_250,
          easing: Easing.inOut(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          duration: 1_250,
          easing: Easing.inOut(Easing.cubic),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();

    return () => animation.stop();
  }, [progress, reducedMotion]);

  const dishTranslateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-54, 54],
  });
  const dishTranslateY = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [10, -8, 8],
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <View style={styles.wordmarkRow}>
          <View style={styles.wordmarkDot} />
          <Text style={styles.wordmark}>LiveToEat</Text>
        </View>

        <View accessibilityElementsHidden style={styles.atlasCard}>
          <MapArtwork />
          <View style={styles.routeLine} />
          <View style={[styles.routeDot, styles.routeDotStart]} />
          <View style={[styles.routeDot, styles.routeDotEnd]} />
          <Animated.View
            style={[
              styles.movingDish,
              {
                transform: [{ translateX: dishTranslateX }, { translateY: dishTranslateY }, { rotate: '-7deg' }],
              },
            ]}
          >
            <FoodArtwork size={82} />
          </Animated.View>
        </View>

        <View accessibilityLiveRegion="polite" style={styles.copy}>
          <Text accessibilityRole="header" style={styles.title}>
            {t('auth.launchTitle')}
          </Text>
          <Text style={styles.body}>{t('auth.launchBody')}</Text>
          <View accessibilityLabel={t('auth.loadingProgress')} accessibilityRole="progressbar" style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  transform: [
                    {
                      translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-72, 72] }),
                    },
                  ],
                },
              ]}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  atlasCard: {
    backgroundColor: colors.paper,
    borderRadius: 32,
    boxShadow: '0 18px 30px rgba(37, 44, 41, 0.20)',
    height: 240,
    maxWidth: 390,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  body: {
    color: '#FBECE6',
    fontFamily: type.body,
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
  },
  copy: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  movingDish: {
    borderColor: colors.paper,
    borderRadius: radii.panel,
    borderWidth: 5,
    left: '50%',
    marginLeft: -41,
    marginTop: -41,
    position: 'absolute',
    top: '50%',
  },
  page: {
    alignItems: 'center',
    flex: 1,
    gap: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.page,
    paddingVertical: 32,
  },
  progressFill: {
    backgroundColor: colors.paper,
    borderRadius: radii.pill,
    height: 4,
    width: 72,
  },
  progressTrack: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: radii.pill,
    height: 4,
    marginTop: spacing.xs,
    overflow: 'hidden',
    width: 144,
  },
  routeDot: {
    backgroundColor: colors.tomato,
    borderColor: colors.paper,
    borderRadius: 8,
    borderWidth: 3,
    height: 16,
    position: 'absolute',
    top: '50%',
    width: 16,
  },
  routeDotEnd: {
    marginRight: 60,
    right: '50%',
    top: 158,
  },
  routeDotStart: {
    left: '50%',
    marginLeft: 60,
    top: 72,
  },
  routeLine: {
    borderColor: colors.tomato,
    borderRadius: 60,
    borderStyle: 'dashed',
    borderWidth: 2,
    height: 72,
    left: '50%',
    marginLeft: -82,
    marginTop: -36,
    position: 'absolute',
    top: '50%',
    transform: [{ rotate: '-18deg' }],
    width: 164,
  },
  safeArea: {
    backgroundColor: colors.tomato,
    flex: 1,
  },
  title: {
    color: colors.paper,
    fontFamily: type.display,
    fontSize: 31,
    fontWeight: '900',
    letterSpacing: -1.1,
    lineHeight: 37,
    textAlign: 'center',
  },
  wordmark: {
    color: colors.paper,
    fontFamily: type.body,
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  wordmarkDot: {
    backgroundColor: colors.wasabi,
    borderRadius: 7,
    height: 14,
    transform: [{ rotate: '45deg' }],
    width: 14,
  },
  wordmarkRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
  },
});
