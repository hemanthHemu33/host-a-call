import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { type AnimationQuality, type ConversationOrbState } from './registry';
import { ui } from '../ui/theme';

export type ConversationOrbProps = {
  accessibilityLabel?: string;
  quality?: AnimationQuality;
  size?: number;
  state: ConversationOrbState;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const stateTone = {
  connecting: {
    background: ui.color.status.infoSoft,
    foreground: ui.color.status.info,
    label: 'Connecting',
  },
  ended: {
    background: ui.color.background.surfaceMuted,
    foreground: ui.color.text.tertiary,
    label: 'Ended',
  },
  error: {
    background: ui.color.status.errorSoft,
    foreground: ui.color.status.error,
    label: 'Error',
  },
  idle: {
    background: ui.color.brand.primarySoft,
    foreground: ui.color.brand.primary,
    label: 'Idle',
  },
  reconnecting: {
    background: ui.color.status.warningSoft,
    foreground: ui.color.status.warning,
    label: 'Reconnecting',
  },
  ringing: {
    background: ui.color.accent.coralSoft,
    foreground: ui.color.accent.coral,
    label: 'Ringing',
  },
  video: {
    background: ui.color.call.backgroundStart,
    foreground: ui.color.text.inverse,
    label: 'Video',
  },
  videoRequested: {
    background: ui.color.status.infoSoft,
    foreground: ui.color.status.info,
    label: 'Video request',
  },
  videoUnlocked: {
    background: ui.color.status.successSoft,
    foreground: ui.color.status.success,
    label: 'Video unlocked',
  },
  voice: {
    background: ui.color.brand.primarySoft,
    foreground: ui.color.brand.primary,
    label: 'Voice',
  },
} as const satisfies Record<
  ConversationOrbState,
  { background: string; foreground: string; label: string }
>;

export function ConversationOrbFallback({
  accessibilityLabel,
  quality = 'high',
  size = 160,
  state,
  style,
  testID = 'conversation-orb',
}: ConversationOrbProps) {
  const tone = stateTone[state];
  const innerSize = Math.round(size * 0.56);
  const ringSize = quality === 'low' ? innerSize : size;

  return (
    <View
      accessibilityLabel={
        accessibilityLabel ?? `Conversation state: ${tone.label}`
      }
      accessibilityRole="image"
      style={[styles.wrapper, { height: size, width: size }, style]}
      testID={`${testID}-fallback`}
    >
      <View
        style={[
          styles.ring,
          {
            backgroundColor: tone.background,
            borderRadius: ringSize,
            height: ringSize,
            width: ringSize,
          },
        ]}
      />
      <View
        style={[
          styles.core,
          {
            backgroundColor: tone.foreground,
            borderRadius: innerSize,
            height: innerSize,
            width: innerSize,
          },
        ]}
      >
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.72}
          numberOfLines={2}
          style={styles.label}
        >
          {tone.label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  core: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: ui.spacing[2],
    position: 'absolute',
  },
  label: {
    color: ui.color.text.inverse,
    fontFamily: ui.font.bold,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
    textAlign: 'center',
  },
  ring: {
    opacity: 0.7,
    position: 'absolute',
  },
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
