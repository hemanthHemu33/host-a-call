import auth from '@react-native-firebase/auth';

type FirebasePhoneConfirmation = {
  confirm: (code: string) => Promise<{
    user: {
      getIdToken: (forceRefresh?: boolean) => Promise<string>;
    };
  }>;
};

let confirmation: FirebasePhoneConfirmation | null = null;

export const requestFirebasePhoneOtp = async (phoneNumber: string) => {
  confirmation = (await auth().signInWithPhoneNumber(
    phoneNumber,
  )) as FirebasePhoneConfirmation;

  return {
    requestId: `firebase-${Date.now().toString(36)}`,
  };
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
  await auth().signOut();
};
