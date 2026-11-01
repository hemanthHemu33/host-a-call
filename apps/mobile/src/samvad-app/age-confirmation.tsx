import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';

import { ageForDateOfBirth } from '@/samvad/auth-flow';
import { useSamvadAuthStore } from '@/samvad/auth-state';
import { clearFirebasePhoneSession } from '@/samvad/firebase-phone';
import { clearSamvadTokens } from '@/samvad/session';

import {
  Body,
  Input,
  Notice,
  PrimaryButton,
  SamvadScreen,
  SecondaryButton,
  Title,
} from '@/samvad/ui';

export default function AgeConfirmationScreen() {
  const router = useRouter();
  const session = useSamvadAuthStore((state) => state.session);
  const setDateOfBirth = useSamvadAuthStore((state) => state.setDateOfBirth);
  const setSession = useSamvadAuthStore((state) => state.setSession);
  const [dateOfBirth, setDateOfBirthInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session === null) router.replace('/sign-in');
  }, [router, session]);

  const confirm = () => {
    const age = ageForDateOfBirth(dateOfBirth);
    if (age === null) {
      setError('Enter your date of birth as YYYY-MM-DD.');
      return;
    }
    if (age < 18) {
      setError('Connecto is available only to people who are 18 or older.');
      return;
    }
    setDateOfBirth(dateOfBirth);
    router.replace('/onboarding');
  };

  const leave = async () => {
    await Promise.allSettled([
      clearSamvadTokens(),
      clearFirebasePhoneSession(),
    ]);
    setSession(null);
    setDateOfBirth(null);
    router.replace('/sign-in');
  };

  return (
    <SamvadScreen>
      <Title>Confirm that you are 18 or older</Title>
      <Body>
        Enter your real date of birth. Samvad stores the date so the server can
        enforce the age requirement; the app no longer confirms your age
        silently.
      </Body>
      <Input
        accessibilityLabel="Date of birth"
        autoComplete="birthdate-full"
        maxLength={10}
        onChangeText={(value) => {
          setDateOfBirthInput(value);
          setError(null);
        }}
        placeholder="YYYY-MM-DD"
        value={dateOfBirth}
      />
      {error === null ? null : <Notice error>{error}</Notice>}
      <PrimaryButton onPress={confirm}>
        I confirm my date of birth
      </PrimaryButton>
      <SecondaryButton onPress={() => void leave()}>
        I am not eligible / sign out
      </SecondaryButton>
    </SamvadScreen>
  );
}
