import Animated from 'react-native-reanimated';

import { usePulseStyle } from '@/motion/reanimated';

import {
  ConversationOrbFallback,
  type ConversationOrbProps,
} from './ConversationOrbFallback';
import type { ConversationOrbState } from './registry';

const pulsingStates = new Set<ConversationOrbState>([
  'ringing',
  'connecting',
  'voice',
  'videoUnlocked',
  'videoRequested',
  'video',
  'reconnecting',
]);

export function ConversationOrb(props: ConversationOrbProps) {
  const pulseStyle = usePulseStyle(
    pulsingStates.has(props.state) && props.quality !== 'low',
  );

  return (
    <Animated.View style={pulseStyle}>
      <ConversationOrbFallback {...props} />
    </Animated.View>
  );
}
