import { spacing } from '@connecto/design-tokens';
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Screen } from '@/components/layout';
import { ui } from '@/components/ui/theme';
import { EnvironmentBadge } from '@/config/EnvironmentBadge';
import { featureFlags } from '@/config/featureFlags';
import { fontFamily } from '@/theme/fonts';

import { getMobileHealth } from './health';

type HealthState =
  | { kind: 'loading' }
  | { kind: 'success'; providerMode: string; status: string }
  | { kind: 'error'; message: string };

export function MobileHealthScreen() {
  const [state, setState] = useState<HealthState>({ kind: 'loading' });

  useEffect(() => {
    let active = true;

    getMobileHealth()
      .then((health) => {
        if (active) {
          setState({
            kind: 'success',
            providerMode: health.providerMode,
            status: health.status,
          });
        }
      })
      .catch(() => {
        if (active) {
          setState({
            kind: 'error',
            message:
              'Health check failed. Retry when the mock provider is available.',
          });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <Screen contentStyle={styles.shell}>
      <View accessibilityLabel="Connecto mobile health screen">
        <EnvironmentBadge />
        <Text style={styles.eyebrow}>Mobile workspace</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Connecto Mobile is healthy
        </Text>

        {state.kind === 'loading' ? (
          <View
            style={styles.statusRow}
            accessibilityLabel="Loading health check"
          >
            <ActivityIndicator color={ui.color.brand.primary} />
            <Text style={styles.statusText}>Checking mock provider</Text>
          </View>
        ) : null}

        {state.kind === 'success' ? (
          <View style={styles.grid}>
            <View style={styles.tile}>
              <Text style={styles.label}>Provider</Text>
              <Text style={styles.value}>{state.providerMode}</Text>
            </View>
            <View style={styles.tile}>
              <Text style={styles.label}>Status</Text>
              <Text style={styles.value}>{state.status}</Text>
            </View>
            <View style={styles.tile}>
              <Text style={styles.label}>Analytics</Text>
              <Text style={styles.value}>
                {featureFlags.analyticsEnabled ? 'enabled' : 'disabled'}
              </Text>
            </View>
          </View>
        ) : null}

        {state.kind === 'error' ? (
          <View style={styles.errorBox} accessibilityRole="alert">
            <Text style={styles.errorText}>{state.message}</Text>
          </View>
        ) : null}

        <Pressable
          accessibilityLabel="Announce Connecto mobile health status"
          accessibilityRole="button"
          onPress={() => {
            AccessibilityInfo.announceForAccessibility(
              'Connecto mobile health screen',
            );
          }}
          style={({ pressed }) => [
            styles.button,
            pressed ? styles.buttonPressed : null,
          ]}
        >
          <Text style={styles.buttonText}>Announce status</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: ui.color.brand.primary,
    borderRadius: ui.radii.full,
    minHeight: 44,
    justifyContent: 'center',
    marginTop: spacing[8],
    paddingHorizontal: spacing[5],
  },
  buttonPressed: {
    backgroundColor: ui.color.brand.primaryPressed,
  },
  buttonText: {
    color: ui.color.text.inverse,
    fontFamily: fontFamily.bold,
    fontSize: 16,
  },
  errorBox: {
    backgroundColor: ui.color.status.errorSoft,
    borderColor: ui.color.status.error,
    borderRadius: ui.radii.xl,
    borderWidth: 1,
    marginTop: spacing[5],
    padding: spacing[4],
  },
  errorText: {
    color: ui.color.status.error,
    fontFamily: fontFamily.regular,
    fontSize: 16,
  },
  eyebrow: {
    color: ui.color.accent.coral,
    fontFamily: fontFamily.bold,
    fontSize: 14,
    marginBottom: spacing[3],
    textTransform: 'uppercase',
  },
  grid: {
    gap: spacing[3],
    marginTop: spacing[8],
  },
  label: {
    color: ui.color.text.secondary,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    marginBottom: spacing[2],
  },
  shell: {
    flex: 1,
    justifyContent: 'center',
  },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[8],
  },
  statusText: {
    color: ui.color.text.secondary,
    fontFamily: fontFamily.regular,
    fontSize: 16,
  },
  tile: {
    ...ui.shadow.card,
    backgroundColor: ui.glass.surface,
    borderColor: ui.glass.borderStrong,
    borderRadius: ui.radii.xxl,
    borderWidth: 1,
    padding: spacing[4],
  },
  title: {
    color: ui.color.text.primary,
    fontFamily: fontFamily.bold,
    fontSize: 40,
    letterSpacing: 0,
    lineHeight: 44,
  },
  value: {
    color: ui.color.text.primary,
    fontFamily: fontFamily.bold,
    fontSize: 18,
  },
});
