import { useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ConversationOrb } from '@/components/animations/ConversationOrb';
import { LottieIllustration } from '@/components/animations/LottieIllustration';
import {
  ConfettiLayer,
  NetworkQualityMiniGraph,
  TrustRing,
  VoiceWaveform,
} from '@/components/animations/SkiaVisuals';
import {
  conversationOrbStates,
  resolveAnimationQuality,
  type ConversationOrbState,
} from '@/components/animations/registry';
import { ScrollScreen } from '@/components/layout';
import {
  AppHeader,
  Banner,
  Button,
  Card,
  SectionHeader,
  StatusBadge,
  SwitchRow,
} from '@/components/ui';
import { ui } from '@/components/ui/theme';
import { featureFlags } from '@/config/featureFlags';

function LabSection({
  children,
  subtitle,
  title,
}: {
  children: ReactNode;
  subtitle?: string;
  title: string;
}) {
  return (
    <View style={styles.section}>
      <SectionHeader
        title={title}
        {...(subtitle === undefined ? {} : { subtitle })}
      />
      {children}
    </View>
  );
}

const waveformSamples = [
  0.18, 0.42, 0.72, 0.36, 0.86, 0.58, 0.31, 0.66, 0.92, 0.44, 0.2, 0.74, 0.51,
  0.83, 0.29, 0.61, 0.48, 0.78,
] as const;

const networkSamples = [3.8, 4.4, 3.9, 4.7, 4.1, 3.4, 4.5, 4.8] as const;

export function AnimationLabScreen() {
  const [confettiActive, setConfettiActive] = useState(true);
  const [lottiePlaying, setLottiePlaying] = useState(true);
  const [lowEndProfile, setLowEndProfile] = useState(false);
  const [orbState, setOrbState] = useState<ConversationOrbState>('idle');
  const [waveformActive, setWaveformActive] = useState(true);
  const quality = resolveAnimationQuality({
    lowEndDevice: lowEndProfile,
    skiaHeavyVisualsEnabled: featureFlags.skiaHeavyVisualsEnabled,
  });

  return (
    <ScrollScreen contentStyle={styles.content} testID="animation-lab-screen">
      <AppHeader
        subtitle="Lottie, Rive, and Skia integration checks"
        title="Animation lab"
      />

      <Banner
        message="Illustrative assets use Lottie, authored state machines use Rive when enabled, and live visuals use Skia on native with safe fallbacks for web and reduced motion."
        title="Animation ownership"
      />

      <View style={styles.statusRow}>
        <StatusBadge
          label={featureFlags.riveEnabled ? 'Rive enabled' : 'Rive fallback'}
          tone={featureFlags.riveEnabled ? 'success' : 'warning'}
        />
        <StatusBadge
          label={
            featureFlags.skiaHeavyVisualsEnabled
              ? 'Skia full visuals'
              : 'Skia light visuals'
          }
          tone={featureFlags.skiaHeavyVisualsEnabled ? 'success' : 'warning'}
        />
        <StatusBadge label={`Quality: ${quality}`} tone="info" />
      </View>

      <LabSection
        subtitle="One-time or looped illustrative JSON only; not for timers or live audio."
        title="Lottie wrapper"
      >
        <Card style={styles.demoCard}>
          <LottieIllustration
            assetId="connectoPulse"
            colorFilters={[
              { color: ui.color.accent.coral, keypath: 'dot fill' },
            ]}
            fallbackLabel="Connecto pulse placeholder"
            playing={lottiePlaying}
            style={styles.lottie}
          />
          <Text style={styles.body}>
            Missing or corrupt source data shows a static fallback instead of
            crashing the screen.
          </Text>
          <Button
            compact
            onPress={() => {
              setLottiePlaying((current) => !current);
            }}
            title={lottiePlaying ? 'Pause Lottie' : 'Play Lottie'}
            variant="secondary"
          />
        </Card>
      </LabSection>

      <LabSection
        subtitle="Interface is stable now; final authored asset can drop in later."
        title="Conversation orb"
      >
        <Card style={styles.demoCard}>
          <ConversationOrb quality={quality} size={180} state={orbState} />
          <Text style={styles.body}>
            The Rive runtime is only used when the feature flag is enabled and a
            valid `.riv` source is registered.
          </Text>
          <View style={styles.buttonWrap}>
            {conversationOrbStates.map((state) => (
              <Button
                compact
                key={state}
                onPress={() => {
                  setOrbState(state);
                }}
                title={state}
                variant={orbState === state ? 'primary' : 'secondary'}
              />
            ))}
          </View>
        </Card>
      </LabSection>

      <LabSection
        subtitle="Native Skia for live/reactive visuals, lightweight fallbacks elsewhere."
        title="Skia visual primitives"
      >
        <SwitchRow
          label="Low-end Android profile"
          onValueChange={setLowEndProfile}
          value={lowEndProfile}
        />
        <SwitchRow
          label="Voice waveform active"
          onValueChange={setWaveformActive}
          value={waveformActive}
        />
        <SwitchRow
          label="Confetti active"
          onValueChange={setConfettiActive}
          value={confettiActive}
        />

        <View style={styles.visualGrid}>
          <Card style={styles.visualCard}>
            <Text style={styles.cardTitle}>Trust ring</Text>
            <TrustRing confidence={0.82} quality={quality} />
          </Card>
          <Card style={styles.visualCard}>
            <Text style={styles.cardTitle}>Voice waveform</Text>
            <VoiceWaveform
              active={waveformActive}
              quality={quality}
              samples={waveformSamples}
            />
          </Card>
          <Card style={styles.visualCard}>
            <Text style={styles.cardTitle}>Network quality</Text>
            <NetworkQualityMiniGraph
              quality={quality}
              qualityScore={4}
              samples={networkSamples}
            />
          </Card>
          <Card style={styles.visualCard}>
            <Text style={styles.cardTitle}>Confetti layer</Text>
            <ConfettiLayer active={confettiActive} quality={quality} />
          </Card>
        </View>
      </LabSection>
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  body: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  buttonWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[2],
  },
  cardTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  content: {
    gap: ui.spacing[7],
  },
  demoCard: {
    alignItems: 'center',
    gap: ui.spacing[4],
  },
  lottie: {
    height: 160,
    width: 160,
  },
  section: {
    gap: ui.spacing[4],
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[2],
  },
  visualCard: {
    flex: 1,
    gap: ui.spacing[3],
    minWidth: 156,
  },
  visualGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[3],
  },
});
