import { NativeModules, Platform } from 'react-native';

import { createApiError, FrontendApiError } from '@connecto/domain';

type PhoneNumberHintNativeModule = {
  requestPhoneNumberHint: () => Promise<string | null>;
};

const unavailable = () =>
  new FrontendApiError(
    createApiError({
      code: 'server',
      message:
        Platform.OS === 'android'
          ? 'Google Play Services phone number hint is unavailable on this device.'
          : 'Google phone number sign-in is only available on Android.',
      retryable: false,
    }),
  );

const readNativeModule = (): PhoneNumberHintNativeModule | null => {
  if (Platform.OS !== 'android') {
    return null;
  }

  const modules = NativeModules as {
    ConnectoPhoneNumberHint?: Partial<PhoneNumberHintNativeModule>;
  };
  const candidate = modules.ConnectoPhoneNumberHint;

  if (typeof candidate?.requestPhoneNumberHint !== 'function') {
    return null;
  }

  return candidate as PhoneNumberHintNativeModule;
};

export const requestGooglePhoneNumberHint = async () => {
  const module = readNativeModule();

  if (module === null) {
    throw unavailable();
  }

  return module.requestPhoneNumberHint();
};
