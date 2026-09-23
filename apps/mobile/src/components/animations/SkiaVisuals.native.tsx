import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  Line,
  Path,
  Rect,
  RoundedRect,
  Skia,
  vec,
} from '@shopify/react-native-skia';

import { useReducedMotionEnabled } from '@/motion/MotionProvider';

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
  quality = 'high',
  size = 120,
  style,
  testID = 'trust-ring',
}: TrustRingProps) {
  const reducedMotionEnabled = useReducedMotionEnabled();
  const normalizedConfidence = clamp01(confidence);
  const radius = size / 2;
  const ringRadius = radius - 10;
  const strokeWidth = quality === 'low' || reducedMotionEnabled ? 5 : 8;
  const tone =
    normalizedConfidence >= 1
      ? {
          core: ui.color.status.success,
          inner: ui.color.status.success,
          track: ui.color.status.successSoft,
        }
      : normalizedConfidence >= 0.5
        ? {
            core: ui.color.brand.primary,
            inner: ui.color.status.info,
            track: ui.color.brand.primarySoft,
          }
        : {
            core: ui.color.brand.primary,
            inner: ui.color.text.tertiary,
            track: ui.color.background.surfaceMuted,
          };

  return (
    <View
      accessibilityLabel={`Trust confidence ${String(Math.round(normalizedConfidence * 100))} percent`}
      accessibilityRole="image"
      style={[{ height: size, width: size }, style]}
      testID={testID}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        <Circle
          color={tone.track}
          cx={radius}
          cy={radius}
          r={ringRadius}
          strokeWidth={strokeWidth}
          style="stroke"
        />
        <Circle
          color={tone.inner}
          cx={radius}
          cy={radius}
          opacity={0.3 + normalizedConfidence * 0.7}
          r={ringRadius - strokeWidth}
          strokeWidth={strokeWidth}
          style="stroke"
        />
        <Circle
          color={tone.core}
          cx={radius}
          cy={radius}
          r={quality === 'low' ? 7 : 10}
        />
      </Canvas>
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
  const reducedMotionEnabled = useReducedMotionEnabled();
  const maxBars = quality === 'low' || reducedMotionEnabled ? 8 : 18;
  const bars = samples.slice(0, maxBars);
  const width = Math.max(96, bars.length * 9);
  const height = 72;

  return (
    <View
      accessibilityLabel={
        active ? 'Voice waveform active' : 'Voice waveform paused'
      }
      accessibilityRole="image"
      style={[{ height, width }, style]}
      testID={testID}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        {bars.map((sample, index) => {
          const barHeight = 10 + clamp01(sample) * 46;
          const x = 8 + index * 8;

          return (
            <Line
              color={ui.color.brand.primary}
              key={`${String(index)}-${String(sample)}`}
              opacity={active ? 1 : ui.opacity.disabled}
              p1={vec(x, height / 2 - barHeight / 2)}
              p2={vec(x, height / 2 + barHeight / 2)}
              strokeCap="round"
              strokeWidth={5}
            />
          );
        })}
      </Canvas>
    </View>
  );
}

export function NetworkQualityMiniGraph({
  qualityScore,
  samples,
  style,
  testID = 'network-quality-mini-graph',
}: NetworkQualityMiniGraphProps) {
  const reducedMotionEnabled = useReducedMotionEnabled();
  const graphSamples =
    samples.length > 0
      ? samples.slice(0, reducedMotionEnabled ? 5 : 10)
      : [qualityScore];
  const width = 112;
  const height = 48;
  const path = Skia.Path.Make();
  const first = graphSamples[0] ?? qualityScore;

  path.moveTo(0, height - clamp01(first / 5) * height);
  graphSamples.forEach((sample, index) => {
    const x =
      graphSamples.length === 1
        ? width
        : (index / Math.max(1, graphSamples.length - 1)) * width;
    const y = height - clamp01(sample / 5) * height;

    path.lineTo(x, y);
  });

  return (
    <View
      accessibilityLabel={`Network quality ${String(qualityScore)} out of 5`}
      accessibilityRole="image"
      style={[{ height, width }, style]}
      testID={testID}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        <Path
          color={ui.color.status.info}
          end={1}
          path={path}
          start={0}
          strokeCap="round"
          strokeJoin="round"
          strokeWidth={4}
          style="stroke"
        />
      </Canvas>
    </View>
  );
}

export function ConfettiLayer({
  active = true,
  quality = 'high',
  style,
  testID = 'confetti-layer',
}: ConfettiLayerProps) {
  const reducedMotionEnabled = useReducedMotionEnabled();
  const count = active
    ? quality === 'low' || reducedMotionEnabled
      ? 6
      : 14
    : 0;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.confettiFrame, style]}
      testID={testID}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        {Array.from({ length: count }).map((_, index) => {
          const x = 8 + ((index * 19) % 92);
          const y = 8 + ((index * 29) % 92);
          const color =
            index % 3 === 0
              ? ui.color.brand.primary
              : index % 3 === 1
                ? ui.color.accent.coral
                : ui.color.status.warning;

          return index % 2 === 0 ? (
            <RoundedRect
              color={color}
              height={8}
              key={String(index)}
              r={2}
              width={16}
              x={x}
              y={y}
            />
          ) : (
            <Rect
              color={color}
              height={10}
              key={String(index)}
              width={10}
              x={x}
              y={y}
            />
          );
        })}
        <Group opacity={0.16}>
          <Circle color={ui.color.brand.primarySoft} cx={64} cy={64} r={52} />
        </Group>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  confettiFrame: {
    minHeight: 120,
    overflow: 'hidden',
  },
});
