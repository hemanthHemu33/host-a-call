type FirebasePhoneConfirmation = {
  confirm: (code: string) => Promise<{
    user: {
      getIdToken: (forceRefresh?: boolean) => Promise<string>;
    };
  }>;
};

let confirmation: FirebasePhoneConfirmation | null = null;

export const requestFirebasePhoneOtp = async (phoneNumber: string) => {
  const { getAuth, signInWithPhoneNumber } =
    await import('@react-native-firebase/auth');
  confirmation = await signInWithPhoneNumber(getAuth(), phoneNumber);
};

export const confirmFirebasePhoneOtp = async (code: string) => {
  if (confirmation === null) {
    throw new Error('The verification session expired. Request a new code.');
  }

  const credential = await confirmation.confirm(code);
  confirmation = null;
  return credential.user.getIdToken(true);
};

export const clearFirebasePhoneSession = async () => {
  confirmation = null;
  const { getAuth, signOut } = await import('@react-native-firebase/auth');
  await signOut(getAuth());
};
