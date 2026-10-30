import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';

import { isUnauthorized, samvadApi } from '@/samvad/api';
import { useSamvadAuthStore } from '@/samvad/auth-state';
import { saveSamvadTokens, withSamvadTokenRefresh } from '@/samvad/session';

import {
  Body,
  Input,
  Notice,
  PrimaryButton,
  SamvadScreen,
  SecondaryButton,
  Title,
} from './ui';

export default function OnboardingScreen() {
  const router = useRouter();
  const session = useSamvadAuthStore((state) => state.session);
  const setSession = useSamvadAuthStore((state) => state.setSession);
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<'caller' | 'host' | null>(null);

  useEffect(() => {
    if (session === null) {
      router.replace('/sign-in');
    }
  }, [router, session]);

  const completeProfile = async (role: 'caller' | 'host') => {
    if (session === null) {
      return;
    }

    const name = displayName.trim();

    if (name.length < 2) {
      setError('Enter the name you want to show on Connecto.');
      return;
    }

    setSubmitting(role);
    setError(null);

    try {
      const { result: nextSession } = await withSamvadTokenRefresh(
        session.tokens,
        (accessToken) =>
          role === 'host'
            ? samvadApi.registerHost(accessToken, name)
            : samvadApi.registerCaller(accessToken, name),
      );
      await saveSamvadTokens(nextSession.tokens);
      setSession(nextSession);
      router.replace(role === 'host' ? '/kyc' : '/account');
    } catch (caught: unknown) {
      if (isUnauthorized(caught)) {
        setSession(null);
        router.replace('/sign-in');
        return;
      }

      setError(
        caught instanceof Error
          ? caught.message
          : 'Could not finish your profile.',
      );
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <SamvadScreen>
      <Title>Finish your profile</Title>
      <Body>
        Samvad created a secure provisional account. Choose how you will use
        Connecto to complete it.
      </Body>
      <Input
        accessibilityLabel="Display name"
        autoComplete="name"
        maxLength={60}
        onChangeText={setDisplayName}
        placeholder="Your display name"
        value={displayName}
      />
      {error === null ? null : <Notice error>{error}</Notice>}
      <PrimaryButton
        loading={submitting === 'caller'}
        onPress={() => void completeProfile('caller')}
      >
        Continue as Caller
      </PrimaryButton>
      <SecondaryButton onPress={() => void completeProfile('host')}>
        {submitting === 'host' ? 'Creating Host profile…' : 'Apply as Host'}
      </SecondaryButton>
      <Notice>
        Samvad currently accepts male callers and female hosts. Host
        applications continue to DigiLocker verification after this step.
      </Notice>
    </SamvadScreen>
  );
}
