import { View, type StyleProp, type ViewStyle } from 'react-native';

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
  void intensity;
  void tint;

  return <View pointerEvents="none" style={style} />;
}
