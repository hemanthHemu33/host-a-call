import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';

import { samvadApi } from '@/samvad/api';
import { useSamvadAuthStore } from '@/samvad/auth-state';
import { withSamvadTokenRefresh } from '@/samvad/session';

import {
  Body,
  Input,
  Notice,
  PrimaryButton,
  SamvadScreen,
  SecondaryButton,
  Title,
} from '@/samvad/ui';

const profileText = (profile: Record<string, unknown> | null, key: string) =>
  typeof profile?.[key] === 'string' ? profile[key] : '';

export default function EditProfileScreen() {
  const router = useRouter();
  const session = useSamvadAuthStore((state) => state.session);
  const setSession = useSamvadAuthStore((state) => state.setSession);
  const [displayName, setDisplayName] = useState(() =>
    profileText(session?.profile ?? null, 'displayName'),
  );
  const [bio, setBio] = useState(() =>
    profileText(session?.profile ?? null, 'bio'),
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session === null) router.replace('/sign-in');
  }, [router, session]);

  const save = async () => {
    if (session === null || displayName.trim().length < 2) {
      setError('Enter a display name with at least 2 characters.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { result, tokens } = await withSamvadTokenRefresh(
        session.tokens,
        (accessToken) =>
          samvadApi.updateProfile(accessToken, {
            displayName: displayName.trim(),
            ...(session.user.role === 'HOST' ? { bio: bio.trim() } : {}),
          }),
      );
      setSession({ ...result, tokens });
      router.replace('/account');
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Could not update your profile.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SamvadScreen>
      <Title>Edit profile</Title>
      <Body>Update the fields permitted for your Samvad role.</Body>
      <Input
        accessibilityLabel="Display name"
        maxLength={60}
        onChangeText={setDisplayName}
        placeholder="Display name"
        value={displayName}
      />
      {session?.user.role === 'HOST' ? (
        <Input
          accessibilityLabel="Host bio"
          maxLength={500}
          multiline
          onChangeText={setBio}
          placeholder="Host bio"
          value={bio}
        />
      ) : null}
      {error === null ? null : <Notice error>{error}</Notice>}
      <PrimaryButton loading={loading} onPress={() => void save()}>
        Save profile
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
