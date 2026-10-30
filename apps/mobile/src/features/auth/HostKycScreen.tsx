import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react-native';

import { Screen } from '@/components/layout';
import { Button } from '@/components/ui/controls';
import { Banner } from '@/components/ui/feedback';
import { Card, StatusBadge } from '@/components/ui/surfaces';
import { ui } from '@/components/ui/theme';
import { mobileRuntimeConfig } from '@/config/runtime';
import { appRoutes } from '@/navigation/routes';
import { getAuthSnapshot, setAuthSession } from '@/store/auth.store';

import { persistAuthSnapshot } from './auth.storage';
import {
  getSamvadKycStatus,
  initiateSamvadKyc,
  simulateSamvadKyc,
  type SamvadKycResult,
} from './samvad-auth.api';
import { loadSamvadTokens } from './samvad-session.storage';

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong. Please try again.';

const isVerified = (result: SamvadKycResult | null) =>
  result?.isDigilockerVerified === true;

export function HostKycScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<SamvadKycResult | null>(null);
  const [isSandbox, setIsSandbox] = useState(false);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const persistKycStatus = useCallback(async (result: SamvadKycResult) => {
    const snapshot = getAuthSnapshot();

    if (
      snapshot.role !== 'host' ||
      snapshot.phoneNumber === null ||
      snapshot.sessionId === null
    ) {
      throw new Error('Sign in as a host before starting identity verification.');
    }

    setAuthSession({
      hostKycStatus: result.isDigilockerVerified
        ? 'verified'
        : result.kycStatus === 'KYC_PENDING'
          ? 'pending'
          : 'not-started',
      phoneNumber: snapshot.phoneNumber,
      role: 'host',
      sessionId: snapshot.sessionId,
    });
    await persistAuthSnapshot(getAuthSnapshot());
  }, []);

  const refresh = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      }

      try {
        const tokens = await loadSamvadTokens();

        if (tokens === null) {
          throw new Error('Your sign-in session expired. Please sign in again.');
        }

        const result = await getSamvadKycStatus(tokens.accessToken);
        setStatus(result);
        await persistKycStatus(result);
        setError(null);
      } catch (caught: unknown) {
        if (!silent) {
          setError(errorMessage(caught));
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [persistKycStatus],
  );

  useEffect(() => {
    void refresh();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void refresh(true);
      }
    });

    return () => subscription.remove();
  }, [refresh]);

  const startDigiLocker = async () => {
    setStarting(true);
    setError(null);
    setNotice(null);

    try {
      const tokens = await loadSamvadTokens();

      if (tokens === null) {
        throw new Error('Your sign-in session expired. Please sign in again.');
      }

      const initiation = await initiateSamvadKyc(tokens.accessToken);
      setIsSandbox(initiation.isSandbox);
      await Linking.openURL(initiation.authUrl);
      setNotice(
        'Complete the DigiLocker consent in your browser, then return here. This screen will refresh when the app becomes active.',
      );
    } catch (caught: unknown) {
      setError(errorMessage(caught));
    } finally {
      setStarting(false);
    }
  };

  const simulate = async () => {
    setSimulating(true);
    setError(null);

    try {
      const tokens = await loadSamvadTokens();

      if (tokens === null) {
        throw new Error('Your sign-in session expired. Please sign in again.');
      }

      await simulateSamvadKyc(tokens.accessToken);
      await refresh(true);
      setNotice('Sandbox identity verification completed.');
    } catch (caught: unknown) {
      setError(errorMessage(caught));
    } finally {
      setSimulating(false);
    }
  };

  const verified = isVerified(status);
  const allowSimulation =
    isSandbox && mobileRuntimeConfig.environment === 'development';

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <ShieldCheck color={ui.color.brand.primary} size={32} />
        </View>
        <Text style={styles.title}>Verify your identity</Text>
        <Text style={styles.body}>
          DigiLocker confirms the identity and age requirements for a Host account. Samvad only receives masked document details.
        </Text>
      </View>

      <Card style={styles.card} variant="strong">
        <View style={styles.statusRow}>
          <Text style={styles.cardTitle}>DigiLocker status</Text>
          <StatusBadge
            label={verified ? 'Verified' : loading ? 'Checking' : 'Not verified'}
            tone={verified ? 'success' : loading ? 'info' : 'warning'}
          />
        </View>
        <Text style={styles.body}>
          {status?.message ??
            (verified
              ? 'Your identity verification is complete.'
              : 'Start secure DigiLocker verification to continue your Host application.')}
        </Text>
        {status?.verifiedAt === undefined ? null : (
          <Text style={styles.meta}>
            Verified {new Date(status.verifiedAt).toLocaleString()}
          </Text>
        )}
      </Card>

      {error === null ? null : (
        <Banner message={error} title="Verification could not be completed" tone="error" />
      )}
      {notice === null ? null : (
        <Banner message={notice} title="DigiLocker" tone="info" />
      )}

      <View style={styles.actions}>
        {verified ? (
          <Button
            onPress={() => {
              router.replace(appRoutes.hostOnboardingProfile.path);
            }}
            title="Continue Host application"
          />
        ) : (
          <Button
            icon={ExternalLink}
            loading={starting}
            onPress={() => {
              void startDigiLocker();
            }}
            title="Verify with DigiLocker"
          />
        )}
        <Button
          icon={RefreshCw}
          loading={loading}
          onPress={() => {
            void refresh();
          }}
          title="Refresh status"
          variant="secondary"
        />
        {allowSimulation && !verified ? (
          <Button
            loading={simulating}
            onPress={() => {
              void simulate();
            }}
            title="Complete sandbox check"
            variant="ghost"
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: ui.spacing[3],
    width: '100%',
  },
  body: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
    textAlign: 'center',
  },
  card: {
    gap: ui.spacing[3],
    width: '100%',
  },
  cardTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  header: {
    alignItems: 'center',
    gap: ui.spacing[3],
    width: '100%',
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: ui.color.brand.primarySoft,
    borderRadius: ui.radii.full,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  meta: {
    color: ui.color.text.tertiary,
    fontFamily: ui.font.medium,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
    textAlign: 'center',
  },
  screen: {
    alignItems: 'center',
    flexGrow: 1,
    gap: ui.spacing[5],
    justifyContent: 'center',
    maxWidth: 480,
  },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.title.fontSize,
    lineHeight: ui.type.title.lineHeight,
    textAlign: 'center',
  },
});
