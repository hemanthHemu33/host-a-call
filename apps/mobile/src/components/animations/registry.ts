import type { AnimationObject, LottieViewProps } from 'lottie-react-native';

import callNowPulse from '@/assets/lottie/call-now-pulse.json';
import connectoPulse from '@/assets/lottie/connecto-pulse.placeholder.json';

export type AnimationQuality = 'high' | 'medium' | 'low';
export type LottieAssetId =
  'callNowPulse' | 'connectoCalling' | 'connectoPulse';
export type RiveAssetId = 'conversationOrb';
type AnimationUsage = 'illustration' | 'stateMachine' | 'liveVisual';

export const conversationOrbStates = [
  'idle',
  'ringing',
  'connecting',
  'voice',
  'videoUnlocked',
  'videoRequested',
  'video',
  'reconnecting',
  'ended',
  'error',
] as const;

export type ConversationOrbState = (typeof conversationOrbStates)[number];

type LottieAsset = {
  description: string;
  id: LottieAssetId;
  loop: boolean;
  source: NonNullable<LottieViewProps['source']> | null;
  staticFrame: number;
  usage: Extract<AnimationUsage, 'illustration'>;
};

type RiveAsset = {
  artboardName: string;
  contractPath: string;
  description: string;
  id: RiveAssetId;
  source: number | null;
  stateMachineName: string;
  states: readonly ConversationOrbState[];
  usage: Extract<AnimationUsage, 'stateMachine'>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseLottieAnimation = (value: unknown): AnimationObject | null => {
  if (!isRecord(value)) {
    return null;
  }

  const hasRequiredShape =
    typeof value.v === 'string' &&
    typeof value.fr === 'number' &&
    typeof value.ip === 'number' &&
    typeof value.op === 'number' &&
    typeof value.w === 'number' &&
    typeof value.h === 'number' &&
    Array.isArray(value.assets) &&
    Array.isArray(value.layers);

  return hasRequiredShape ? (value as unknown as AnimationObject) : null;
};

const lottieAssets: Record<LottieAssetId, LottieAsset> = {
  callNowPulse: {
    description: 'LottieFiles animated phone pulse for high-intent call CTAs.',
    id: 'callNowPulse',
    loop: true,
    source: parseLottieAnimation(callNowPulse),
    staticFrame: 30,
    usage: 'illustration',
  },
  connectoCalling: {
    description:
      'Remote Connecto outgoing-call animation for the calling stage.',
    id: 'connectoCalling',
    loop: true,
    source: {
      uri: 'https://lottie.host/cc6f2d13-87ba-41df-a4ad-3564beb263f6/N73rhERGHA.json',
    },
    staticFrame: 0,
    usage: 'illustration',
  },
  connectoPulse: {
    description:
      'Hand-authored placeholder pulse for one-time or looped illustrative states.',
    id: 'connectoPulse',
    loop: true,
    source: parseLottieAnimation(connectoPulse),
    staticFrame: 30,
    usage: 'illustration',
  },
};

const riveAssets: Record<RiveAssetId, RiveAsset> = {
  conversationOrb: {
    artboardName: 'ConversationOrb',
    contractPath: 'docs/animation-asset-contract.md',
    description:
      'Future authored Rive state machine for the live call conversation orb.',
    id: 'conversationOrb',
    source: null,
    stateMachineName: 'ConversationOrbMachine',
    states: conversationOrbStates,
    usage: 'stateMachine',
  },
};

export const getLottieAsset = (id: LottieAssetId) => lottieAssets[id];

export const getRiveAsset = (id: RiveAssetId) => riveAssets[id];

export const resolveAnimationQuality = ({
  lowEndDevice = false,
  skiaHeavyVisualsEnabled = true,
}: {
  lowEndDevice?: boolean;
  skiaHeavyVisualsEnabled?: boolean;
}): AnimationQuality =>
  lowEndDevice || !skiaHeavyVisualsEnabled ? 'low' : 'high';
