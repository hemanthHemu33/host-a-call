import { View, type StyleProp, type ViewStyle } from 'react-native';

export type GlassBlurTint = 'dark' | 'default' | 'light';

type GlassBlurLayerProps = {
  intensity: number;
  style: StyleProp<ViewStyle>;
  tint: GlassBlurTint;
};

export function GlassBlurLayer({ intensity, style }: GlassBlurLayerProps) {
  const webBlur = {
    backdropFilter: `blur(${String(Math.max(8, intensity / 2))}px)`,
    WebkitBackdropFilter: `blur(${String(Math.max(8, intensity / 2))}px)`,
  } as unknown as ViewStyle;

  return <View pointerEvents="none" style={[style, webBlur]} />;
}
