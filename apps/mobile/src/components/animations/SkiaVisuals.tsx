import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { AnimationQuality } from './registry';
import { ui } from '../ui/theme';

type VisualProps = {
  quality?: AnimationQuality;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export type TrustRingProps = VisualProps & {
  confidence: number;
  size?: number;
};

export type VoiceWaveformProps = VisualProps & {
  active?: boolean;
  samples: readonly number[];
};

export type NetworkQualityMiniGraphProps = VisualProps & {
  qualityScore: number;
  samples: readonly number[];
};

export type ConfettiLayerProps = VisualProps & {
  active?: boolean;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function TrustRing({
  confidence,
  size = 120,
  style,
  testID = 'trust-ring',
}: TrustRingProps) {
  const normalizedConfidence = clamp01(confidence);
  const tone =
    normalizedConfidence >= 1
      ? {
          core: ui.color.status.success,
          track: ui.color.status.successSoft,
        }
      : normalizedConfidence >= 0.5
        ? {
            core: ui.color.status.info,
            track: ui.color.brand.primarySoft,
          }
        : {
            core: ui.color.text.tertiary,
            track: ui.color.background.surfaceMuted,
          };

  return (
    <View
      accessibilityLabel={`Trust confidence ${String(Math.round(normalizedConfidence * 100))} percent`}
      accessibilityRole="image"
      style={[
        styles.center,
        styles.ringFallback,
        {
          backgroundColor: tone.track,
          borderRadius: size,
          height: size,
          width: size,
        },
        style,
      ]}
      testID={testID}
    >
      <View
        style={[
          styles.ringCore,
          {
            backgroundColor: tone.core,
            borderRadius: size,
            height: size * 0.58,
            opacity: 0.72 + normalizedConfidence * 0.28,
            width: size * 0.58,
          },
        ]}
      />
    </View>
  );
}

export function VoiceWaveform({
  active = true,
  quality = 'high',
  samples,
  style,
  testID = 'voice-waveform',
}: VoiceWaveformProps) {
  const maxBars = quality === 'low' ? 8 : 18;
  const bars = samples.slice(0, maxBars);

  return (
    <View
      accessibilityLabel={
        active ? 'Voice waveform active' : 'Voice waveform paused'
      }
      accessibilityRole="image"
      style={[styles.waveform, style]}
      testID={testID}
    >
      {bars.map((sample, index) => (
        <View
          key={`${String(index)}-${String(sample)}`}
          style={[
            styles.waveBar,
            {
              height: 10 + clamp01(sample) * 46,
              opacity: active ? 1 : ui.opacity.disabled,
            },
          ]}
        />
      ))}
    </View>
  );
}

export function NetworkQualityMiniGraph({
  qualityScore,
  samples,
  style,
  testID = 'network-quality-mini-graph',
}: NetworkQualityMiniGraphProps) {
  const bars = samples.length > 0 ? samples.slice(0, 5) : [qualityScore / 5];

  return (
    <View
      accessibilityLabel={`Network quality ${String(qualityScore)} out of 5`}
      accessibilityRole="image"
      style={[styles.graph, style]}
      testID={testID}
    >
      {bars.map((sample, index) => (
        <View
          key={`${String(index)}-${String(sample)}`}
          style={[
            styles.graphBar,
            {
              height: 8 + clamp01(sample / 5) * 28,
            },
          ]}
        />
      ))}
    </View>
  );
}

export function ConfettiLayer({
  active = true,
  quality = 'high',
  style,
  testID = 'confetti-layer',
}: ConfettiLayerProps) {
  const count = active ? (quality === 'low' ? 6 : 14) : 0;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.confetti, style]}
      testID={testID}
    >
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={String(index)}
          style={[
            styles.confettiPiece,
            {
              backgroundColor:
                index % 3 === 0
                  ? ui.color.brand.primary
                  : index % 3 === 1
                    ? ui.color.accent.coral
                    : ui.color.status.warning,
              left: (index * 17) % 108,
              top: (index * 23) % 108,
              transform: [{ rotate: `${String((index * 31) % 180)}deg` }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  confetti: {
    minHeight: 120,
    overflow: 'hidden',
    position: 'relative',
  },
  confettiPiece: {
    borderRadius: ui.radii.sm,
    height: 8,
    position: 'absolute',
    width: 14,
  },
  graph: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: ui.spacing[1],
    height: 48,
  },
  graphBar: {
    backgroundColor: ui.color.status.info,
    borderRadius: ui.radii.full,
    width: 8,
  },
  ringCore: {
    backgroundColor: ui.color.status.success,
  },
  ringFallback: {
    backgroundColor: ui.color.status.successSoft,
    borderColor: ui.color.status.success,
    borderWidth: 6,
  },
  waveBar: {
    backgroundColor: ui.color.brand.primary,
    borderRadius: ui.radii.full,
    width: 5,
  },
  waveform: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: ui.spacing[1],
    height: 72,
  },
});
