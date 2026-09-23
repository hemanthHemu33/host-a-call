import { languageSchema } from '@connecto/domain';

import { secureStorage } from '@/platform/secure-storage';
import {
  authStoreSnapshotSchema,
  hydrateAuthStore,
  initialAuthStore,
  initialCustomerOnboardingDraft,
  type AuthStoreSnapshot,
} from '@/store/auth.store';

const authStorageKey = 'connecto.auth.snapshot';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizePersistedAuthSnapshot = (input: unknown): AuthStoreSnapshot => {
  if (!isRecord(input)) {
    return authStoreSnapshotSchema.parse(input);
  }

  const next = { ...input };
  const rawOnboarding = next.customerOnboarding;

  if (isRecord(rawOnboarding) && !('currentStep' in rawOnboarding)) {
    next.customerOnboarding = {
      ...initialCustomerOnboardingDraft,
      completedAtIso:
        typeof rawOnboarding.completedAtIso === 'string'
          ? rawOnboarding.completedAtIso
          : null,
      currentStep: 'profile',
      displayName:
        typeof rawOnboarding.displayName === 'string'
          ? rawOnboarding.displayName
          : '',
      microphoneEducationSeen: rawOnboarding.microphonePermission !== undefined,
      notificationsPermission:
        rawOnboarding.notificationsPermission === 'granted' ||
        rawOnboarding.notificationsPermission === 'not-now'
          ? rawOnboarding.notificationsPermission
          : 'unknown',
      primaryLanguage: languageSchema.safeParse(rawOnboarding.preferredLanguage)
        .success
        ? rawOnboarding.preferredLanguage
        : null,
    };
  } else if (isRecord(rawOnboarding)) {
    next.customerOnboarding = {
      ...initialCustomerOnboardingDraft,
      ...rawOnboarding,
    };
  }

  return authStoreSnapshotSchema.parse(next);
};

export const loadPersistedAuthSnapshot =
  async (): Promise<AuthStoreSnapshot> => {
    const raw = await secureStorage.getItemAsync(authStorageKey);

    if (raw === null) {
      return initialAuthStore;
    }

    try {
      const parsed = normalizePersistedAuthSnapshot(JSON.parse(raw) as unknown);
      return hydrateAuthStore(parsed);
    } catch {
      await secureStorage.deleteItemAsync(authStorageKey);
      return initialAuthStore;
    }
  };

export const persistAuthSnapshot = async (snapshot: AuthStoreSnapshot) => {
  await secureStorage.setItemAsync(authStorageKey, JSON.stringify(snapshot));
  return snapshot;
};

export const clearPersistedAuthSnapshot = async () => {
  await secureStorage.deleteItemAsync(authStorageKey);
};
