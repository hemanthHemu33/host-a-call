import { render, screen } from '@testing-library/react-native';
import { describe, expect, it } from 'vitest';

import { ConversationOrb } from './ConversationOrb.tsx';
import { LottieIllustration } from './LottieIllustration.tsx';
import {
  ConfettiLayer,
  NetworkQualityMiniGraph,
  TrustRing,
  VoiceWaveform,
} from './SkiaVisuals.tsx';
import {
  conversationOrbStates,
  getLottieAsset,
  getRiveAsset,
  resolveAnimationQuality,
} from './registry';

describe('animation registry', () => {
  it('keeps canonical orb states and safe missing-rive fallback metadata', () => {
    expect(conversationOrbStates).toEqual([
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
    ]);
    expect(getLottieAsset('connectoPulse').source).not.toBeNull();
    expect(getRiveAsset('conversationOrb').source).toBeNull();
    expect(resolveAnimationQuality({ lowEndDevice: true })).toBe('low');
    expect(resolveAnimationQuality({ skiaHeavyVisualsEnabled: false })).toBe(
      'low',
    );
    expect(LottieIllustration).toBeTypeOf('function');
  });

  it('renders the default Lottie fallback wrapper', () => {
    void render(
      <LottieIllustration
        assetId="connectoPulse"
        fallbackLabel="Connecto pulse placeholder"
        testID="test-lottie"
      />,
    );

    expect(screen.getByTestId('test-lottie-fallback')).toBeTruthy();
  });

  it('renders ConversationOrb fallback when no rive asset is registered', () => {
    void render(<ConversationOrb state="videoRequested" testID="test-orb" />);

    expect(screen.getByTestId('test-orb-fallback')).toBeTruthy();
  });

  it('renders Skia visual fallbacks for non-native tests and web builds', () => {
    void render(
      <>
        <TrustRing confidence={0.8} testID="test-trust-ring" />
        <VoiceWaveform
          quality="low"
          samples={[0.2, 0.8, 0.4]}
          testID="test-waveform"
        />
        <NetworkQualityMiniGraph
          qualityScore={4}
          samples={[3, 4, 5]}
          testID="test-network"
        />
        <ConfettiLayer quality="low" testID="test-confetti" />
      </>,
    );

    expect(screen.getByTestId('test-trust-ring')).toBeTruthy();
    expect(screen.getByTestId('test-waveform')).toBeTruthy();
    expect(screen.getByTestId('test-network')).toBeTruthy();
    expect(screen.getByTestId('test-confetti')).toBeTruthy();
  });
});
