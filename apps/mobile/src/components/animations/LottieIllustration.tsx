import type { ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import type { LottieAssetId } from './registry';
import { ui } from '../ui/theme';

type LottieColorFilters = readonly { color: string; keypath: string }[];

export type LottieIllustrationProps = {
  assetId: LottieAssetId;
  colorFilters?: LottieColorFilters;
  fallback?: ReactNode;
  fallbackLabel: string;
  loop?: boolean;
  playing?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function LottieIllustration({
  assetId,
  fallback,
  fallbackLabel,
  style,
  testID = `lottie-${assetId}`,
}: LottieIllustrationProps) {
  return (
    <View
      accessibilityLabel={fallbackLabel}
      accessibilityRole="image"
      style={[styles.container, styles.fallback, style]}
      testID={`${testID}-fallback`}
    >
      {fallback ?? <Text style={styles.fallbackText}>{fallbackLabel}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 96,
    minWidth: 96,
    overflow: 'hidden',
  },
  fallback: {
    alignItems: 'center',
    backgroundColor: ui.color.brand.primarySoft,
    borderRadius: ui.radii.xxl,
    justifyContent: 'center',
    padding: ui.spacing[4],
  },
  fallbackText: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
    textAlign: 'center',
  },
});
