import { BlurView } from 'expo-blur';
import type { StyleProp, ViewStyle } from 'react-native';

import type { GlassBlurTint } from './GlassBlurLayer';

type GlassBlurLayerProps = {
  intensity: number;
  style: StyleProp<ViewStyle>;
  tint: GlassBlurTint;
};

export function GlassBlurLayer({
  intensity,
  style,
  tint,
}: GlassBlurLayerProps) {
  return <BlurView intensity={intensity} style={style} tint={tint} />;
}
