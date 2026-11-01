import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';

import { samvadApi } from '@/samvad/api';
import { useSamvadAuthStore } from '@/samvad/auth-state';
import { clearFirebasePhoneSession } from '@/samvad/firebase-phone';
import { clearSamvadTokens, withSamvadTokenRefresh } from '@/samvad/session';

import {
  Body,
  Input,
  Notice,
  PrimaryButton,
  SamvadScreen,
  SecondaryButton,
  Title,
} from '@/samvad/ui';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const session = useSamvadAuthStore((state) => state.session);
  const setAccountState = useSamvadAuthStore((state) => state.setAccountState);
  const setSession = useSamvadAuthStore((state) => state.setSession);
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session === null) router.replace('/sign-in');
  }, [router, session]);

  const deleteAccount = async () => {
    if (session === null || confirmation !== 'DELETE') return;
    setLoading(true);
    setError(null);
    try {
      const { result } = await withSamvadTokenRefresh(
        session.tokens,
        (accessToken) => samvadApi.deleteAccount(accessToken),
      );
      await Promise.allSettled([
        clearSamvadTokens(),
        clearFirebasePhoneSession(),
      ]);
      setSession(null);
      setAccountState(result.accountState);
      router.replace('/account-status');
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Could not request account deletion.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SamvadScreen>
      <Title>Delete your account</Title>
      <Body>
        This signs out every device and schedules deletion after the configured
        grace period. Wallet or earnings balances must be resolved first.
      </Body>
      <Input
        accessibilityLabel="Type DELETE to confirm"
        autoCapitalize="characters"
        onChangeText={setConfirmation}
        placeholder="Type DELETE"
        value={confirmation}
      />
      {error === null ? null : <Notice error>{error}</Notice>}
      <PrimaryButton
        disabled={confirmation !== 'DELETE'}
        loading={loading}
        onPress={() => void deleteAccount()}
      >
        Request account deletion
      </PrimaryButton>
      <SecondaryButton
        onPress={() => {
          router.back();
        }}
      >
        Cancel
      </SecondaryButton>
    </SamvadScreen>
  );
}
