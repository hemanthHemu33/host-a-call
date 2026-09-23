import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';

import { useReducedMotion } from '@/components/ui/interaction';
import { ui } from '@/components/ui/theme';
import backgroundArtwork from '../../../assets/backgrounds/glassmorphism-background.png';

export function AppGlassBackground() {
  const reducedMotion = useReducedMotion();
  const animateArtwork = Platform.OS !== 'android' && !reducedMotion;
  const [drift] = useState(() => new Animated.Value(0));

  useEffect(() => {
    drift.stopAnimation();

    if (!animateArtwork) {
      drift.setValue(0);
      return undefined;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          duration: 18_000,
          easing: Easing.inOut(Easing.sin),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          duration: 18_000,
          easing: Easing.inOut(Easing.sin),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => {
      animation.stop();
    };
  }, [animateArtwork, drift]);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.background}
    >
      <Animated.Image
        accessibilityIgnoresInvertColors
        resizeMode="cover"
        source={backgroundArtwork}
        style={[
          styles.artwork,
          {
            transform: [
              {
                translateX: drift.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-5, 5],
                }),
              },
              {
                translateY: drift.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-8, 8],
                }),
              },
              {
                scale: drift.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1.025, 1.045],
                }),
              },
            ],
          },
        ]}
      />
      <View style={styles.readabilityWash} />
    </View>
  );
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: ui.color.background.app,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 0,
  },
  artwork: {
    bottom: -18,
    left: -18,
    position: 'absolute',
    right: -18,
    top: -18,
  },
  readabilityWash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,250,252,0.08)',
  },
});
