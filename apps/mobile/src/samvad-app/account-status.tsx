import { useRouter } from 'expo-router';

import { useSamvadAuthStore } from '@/samvad/auth-state';
import { clearFirebasePhoneSession } from '@/samvad/firebase-phone';
import { clearSamvadTokens } from '@/samvad/session';

import { Body, Notice, PrimaryButton, SamvadScreen, Title } from '@/samvad/ui';

export default function AccountStatusScreen() {
  const router = useRouter();
  const accountState = useSamvadAuthStore((state) => state.accountState);
  const setAccountState = useSamvadAuthStore((state) => state.setAccountState);
  const setSession = useSamvadAuthStore((state) => state.setSession);
  const title =
    accountState?.status === 'SUSPENDED'
      ? 'Account suspended'
      : accountState?.status === 'DELETION_PENDING'
        ? 'Account deletion pending'
        : 'Account blocked';

  const signOut = async () => {
    await Promise.allSettled([
      clearSamvadTokens(),
      clearFirebasePhoneSession(),
    ]);
    setSession(null);
    setAccountState(null);
    router.replace('/sign-in');
  };

  return (
    <SamvadScreen>
      <Title>{title}</Title>
      <Body>
        This account cannot open an authenticated session in its current state.
      </Body>
      <Notice error>
        {accountState?.reason ??
          'Contact support if you believe this account state is incorrect.'}
      </Notice>
      {accountState?.statusChangedAt === null ||
      accountState?.statusChangedAt === undefined ? null : (
        <Notice>Status changed: {accountState.statusChangedAt}</Notice>
      )}
      <PrimaryButton onPress={() => void signOut()}>
        Return to sign in
      </PrimaryButton>
    </SamvadScreen>
  );
}
