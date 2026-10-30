import {
  getAuth,
  signInWithPhoneNumber,
  signOut,
} from '@react-native-firebase/auth';

let confirmation: Awaited<ReturnType<typeof signInWithPhoneNumber>> | null =
  null;

export const requestFirebasePhoneOtp = async (phoneNumber: string) => {
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
  await signOut(getAuth());
};
