import { create } from 'zustand';
import { z } from 'zod';

import { languageSchema, type Language, type Role } from '@connecto/domain';

export type MobileAuthRole = Exclude<Role, 'admin'>;
export type AgeGateStatus = 'confirmed' | 'underage-blocked' | 'unknown';
export type AuthAccountStatus = 'active' | 'blocked' | 'suspended';
export type CustomerRouteTarget = 'home' | 'onboarding';
export type CustomerPermissionStatus = 'granted' | 'not-now' | 'unknown';
export type CustomerOnboardingStep =
  | 'hostAgreement'
  | 'hostApproval'
  | 'language'
  | 'matchTags'
  | 'permissions'
  | 'profile'
  | 'voiceVerification';
export type CustomerGender =
  'man' | 'non-binary' | 'prefer-not-to-say' | 'woman';
export type CustomerMatchTag =
  | 'advice'
  | 'emotional-support'
  | 'friendship'
  | 'fun-talk'
  | 'love'
  | 'marriage'
  | 'relationship'
  | 'time-pass';
export type HostVoiceVerificationStatus =
  'not-started' | 'pending' | 'verified';

export type CustomerOnboardingImageDraft = {
  cropLabel: string;
  localUri: string;
  previewUri: string;
  sourceName: string;
};

export type CustomerOnboardingLocationDraft = {
  accuracyMeters: number | null;
  latitude: number | null;
  longitude: number | null;
  placeLabel: string | null;
  requestedAtIso: string | null;
  status: CustomerPermissionStatus;
};

export type CustomerOnboardingDraft = {
  cameraEducationSeen: boolean;
  completedAtIso: string | null;
  currentStep: CustomerOnboardingStep;
  dateOfBirthInput: string;
  displayName: string;
  gender: CustomerGender | null;
  hostAgreementAcceptedAtIso: string | null;
  hostApplicationSubmittedAtIso: string | null;
  hostVoiceVerificationRecordingUri: string | null;
  hostVoiceVerificationStatus: HostVoiceVerificationStatus;
  hostVoiceVerificationSubmittedAtIso: string | null;
  location: CustomerOnboardingLocationDraft;
  matchTags: CustomerMatchTag[];
  profileImage: CustomerOnboardingImageDraft | null;
  primaryLanguage: Language | null;
  microphoneEducationSeen: boolean;
  notificationRequestedAtIso: string | null;
  notificationsPermission: CustomerPermissionStatus;
  secondaryLanguage: Language | null;
};

export type AuthStoreSnapshot = {
  accountStatus: AuthAccountStatus | null;
  ageGateStatus: AgeGateStatus;
  customerOnboarding: CustomerOnboardingDraft;
  customerRouteTarget: CustomerRouteTarget | null;
  phoneNumber: string | null;
  role: MobileAuthRole | null;
  sessionId: string | null;
};

export type AuthSessionInput = {
  customerRouteTarget?: CustomerRouteTarget | null;
  phoneNumber: string;
  role: MobileAuthRole;
  sessionId: string;
};

export type AuthAccountStatusInput = {
  phoneNumber: string;
  status: Exclude<AuthAccountStatus, 'active'>;
};

const ageGateStatusSchema = z.enum([
  'confirmed',
  'underage-blocked',
  'unknown',
]);
const authAccountStatusSchema = z.enum(['active', 'blocked', 'suspended']);
const customerRouteTargetSchema = z.enum(['home', 'onboarding']);
const customerPermissionStatusSchema = z.enum([
  'granted',
  'not-now',
  'unknown',
]);
export const customerOnboardingStepSchema = z.enum([
  'hostAgreement',
  'hostApproval',
  'language',
  'matchTags',
  'permissions',
  'profile',
  'voiceVerification',
]);
export const customerGenderSchema = z.enum([
  'man',
  'non-binary',
  'prefer-not-to-say',
  'woman',
]);
export const customerMatchTagSchema = z.enum([
  'advice',
  'emotional-support',
  'friendship',
  'fun-talk',
  'love',
  'marriage',
  'relationship',
  'time-pass',
]);
export const customerOnboardingImageDraftSchema = z.object({
  cropLabel: z.string().min(1),
  localUri: z.string().min(1),
  previewUri: z.string().min(1),
  sourceName: z.string().min(1),
});
export const customerOnboardingLocationDraftSchema = z.object({
  accuracyMeters: z.number().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  placeLabel: z.string().min(1).nullable(),
  requestedAtIso: z.iso.datetime().nullable(),
  status: customerPermissionStatusSchema,
});
export const hostVoiceVerificationStatusSchema = z.enum([
  'not-started',
  'pending',
  'verified',
]);
const mobileAuthRoleSchema = z.enum(['customer', 'host']);

export const initialCustomerOnboardingDraft = {
  cameraEducationSeen: false,
  completedAtIso: null,
  currentStep: 'profile',
  dateOfBirthInput: '',
  displayName: '',
  gender: null,
  hostAgreementAcceptedAtIso: null,
  hostApplicationSubmittedAtIso: null,
  hostVoiceVerificationRecordingUri: null,
  hostVoiceVerificationStatus: 'not-started',
  hostVoiceVerificationSubmittedAtIso: null,
  location: {
    accuracyMeters: null,
    latitude: null,
    longitude: null,
    placeLabel: null,
    requestedAtIso: null,
    status: 'unknown',
  },
  matchTags: [] as CustomerMatchTag[],
  profileImage: null,
  primaryLanguage: null,
  microphoneEducationSeen: false,
  notificationRequestedAtIso: null,
  notificationsPermission: 'unknown',
  secondaryLanguage: null,
} as const satisfies CustomerOnboardingDraft;

export const customerOnboardingDraftSchema = z.object({
  cameraEducationSeen: z.boolean(),
  completedAtIso: z.iso.datetime().nullable(),
  currentStep: customerOnboardingStepSchema,
  dateOfBirthInput: z.string(),
  displayName: z.string(),
  gender: customerGenderSchema.nullable(),
  hostAgreementAcceptedAtIso: z.iso.datetime().nullable(),
  hostApplicationSubmittedAtIso: z.iso.datetime().nullable(),
  hostVoiceVerificationRecordingUri: z.string().min(1).nullable(),
  hostVoiceVerificationStatus: hostVoiceVerificationStatusSchema,
  hostVoiceVerificationSubmittedAtIso: z.iso.datetime().nullable(),
  location: customerOnboardingLocationDraftSchema.default(
    initialCustomerOnboardingDraft.location,
  ),
  matchTags: z.array(customerMatchTagSchema).max(4),
  profileImage: customerOnboardingImageDraftSchema.nullable(),
  primaryLanguage: languageSchema.nullable(),
  microphoneEducationSeen: z.boolean(),
  notificationRequestedAtIso: z.iso.datetime().nullable(),
  notificationsPermission: customerPermissionStatusSchema,
  secondaryLanguage: languageSchema.nullable(),
});

export const authStoreSnapshotSchema = z.object({
  accountStatus: authAccountStatusSchema.nullable(),
  ageGateStatus: ageGateStatusSchema,
  customerOnboarding: customerOnboardingDraftSchema.default(
    initialCustomerOnboardingDraft,
  ),
  customerRouteTarget: customerRouteTargetSchema.nullable(),
  phoneNumber: z.string().min(1).nullable(),
  role: mobileAuthRoleSchema.nullable(),
  sessionId: z.string().min(1).nullable(),
});

export const initialAuthStore: AuthStoreSnapshot = {
  accountStatus: null,
  ageGateStatus: 'unknown',
  customerOnboarding: { ...initialCustomerOnboardingDraft },
  customerRouteTarget: null,
  phoneNumber: null,
  role: null,
  sessionId: null,
};

const trimRequired = (value: string, fieldName: string) => {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new Error(`${fieldName} is required.`);
  }

  return normalized;
};

type AuthStoreState = AuthStoreSnapshot & {
  clearAll: () => AuthStoreSnapshot;
  clearSession: () => AuthStoreSnapshot;
  completeCustomerOnboarding: (
    patch?: Partial<CustomerOnboardingDraft>,
  ) => AuthStoreSnapshot;
  completeHostApplication: (
    patch?: Partial<CustomerOnboardingDraft>,
  ) => AuthStoreSnapshot;
  replaceSnapshot: (snapshot: AuthStoreSnapshot) => AuthStoreSnapshot;
  setAccountStatus: (input: AuthAccountStatusInput) => AuthStoreSnapshot;
  setAgeGateStatus: (ageGateStatus: AgeGateStatus) => AuthStoreSnapshot;
  setCustomerOnboardingDraft: (
    patch: Partial<CustomerOnboardingDraft>,
  ) => AuthStoreSnapshot;
  setSession: (input: AuthSessionInput) => AuthStoreSnapshot;
};

export const useAuthStore = create<AuthStoreState>((set) => ({
  ...initialAuthStore,
  clearAll: () => {
    set({
      ...initialAuthStore,
      customerOnboarding: { ...initialCustomerOnboardingDraft },
    });
    return getAuthSnapshot();
  },
  clearSession: () => {
    set((state) => ({
      ...state,
      accountStatus: null,
      customerOnboarding: { ...initialCustomerOnboardingDraft },
      customerRouteTarget: null,
      phoneNumber: null,
      role: null,
      sessionId: null,
    }));

    return getAuthSnapshot();
  },
  completeCustomerOnboarding: (patch = {}) => {
    set((state) => {
      const completedAtIso = new Date().toISOString();

      return {
        ...state,
        customerOnboarding: {
          ...initialCustomerOnboardingDraft,
          ...patch,
          completedAtIso,
        },
        customerRouteTarget: 'home',
      };
    });

    return getAuthSnapshot();
  },
  completeHostApplication: (patch = {}) => {
    set((state) => {
      const completedAtIso = new Date().toISOString();

      return {
        ...state,
        customerOnboarding: {
          ...initialCustomerOnboardingDraft,
          ...state.customerOnboarding,
          ...patch,
          completedAtIso,
        },
        customerRouteTarget: null,
        role: 'host',
      };
    });

    return getAuthSnapshot();
  },
  replaceSnapshot: (snapshot) => {
    set(snapshot);
    return getAuthSnapshot();
  },
  setAccountStatus: ({ phoneNumber, status }) => {
    set((state) => ({
      ...state,
      accountStatus: status,
      customerOnboarding: { ...initialCustomerOnboardingDraft },
      customerRouteTarget: null,
      phoneNumber: trimRequired(phoneNumber, 'Phone number'),
      role: null,
      sessionId: null,
    }));

    return getAuthSnapshot();
  },
  setAgeGateStatus: (ageGateStatus) => {
    set({ ageGateStatus });
    return getAuthSnapshot();
  },
  setCustomerOnboardingDraft: (patch) => {
    set((state) => ({
      ...state,
      customerOnboarding: {
        ...state.customerOnboarding,
        ...patch,
      },
    }));
    return getAuthSnapshot();
  },
  setSession: ({ customerRouteTarget, phoneNumber, role, sessionId }) => {
    set((state) => ({
      ...state,
      accountStatus: 'active',
      ageGateStatus: 'confirmed',
      customerOnboarding:
        role === 'customer'
          ? (customerRouteTarget ?? 'home') === 'onboarding'
            ? {
                ...state.customerOnboarding,
                completedAtIso: null,
              }
            : { ...initialCustomerOnboardingDraft }
          : { ...initialCustomerOnboardingDraft },
      customerRouteTarget:
        role === 'customer' ? (customerRouteTarget ?? 'home') : null,
      phoneNumber: trimRequired(phoneNumber, 'Phone number'),
      role,
      sessionId: trimRequired(sessionId, 'Auth session id'),
    }));

    return getAuthSnapshot();
  },
}));

export const getAuthSnapshot = (): AuthStoreSnapshot => ({
  accountStatus: useAuthStore.getState().accountStatus,
  ageGateStatus: useAuthStore.getState().ageGateStatus,
  customerOnboarding: useAuthStore.getState().customerOnboarding,
  customerRouteTarget: useAuthStore.getState().customerRouteTarget,
  phoneNumber: useAuthStore.getState().phoneNumber,
  role: useAuthStore.getState().role,
  sessionId: useAuthStore.getState().sessionId,
});

export const setAuthSession = (input: AuthSessionInput): AuthStoreSnapshot => {
  useAuthStore.getState().setSession(input);
  return getAuthSnapshot();
};

export const setAuthAccountStatus = (
  input: AuthAccountStatusInput,
): AuthStoreSnapshot => {
  useAuthStore.getState().setAccountStatus(input);
  return getAuthSnapshot();
};

export const setAuthAgeGateStatus = (
  ageGateStatus: AgeGateStatus,
): AuthStoreSnapshot => {
  useAuthStore.getState().setAgeGateStatus(ageGateStatus);
  return getAuthSnapshot();
};

export const hydrateAuthStore = (
  snapshot: AuthStoreSnapshot,
): AuthStoreSnapshot => {
  useAuthStore.getState().replaceSnapshot(snapshot);
  return getAuthSnapshot();
};

export const clearAuthSession = (): AuthStoreSnapshot => {
  useAuthStore.getState().clearSession();
  return getAuthSnapshot();
};

export const resetAuthStore = (): AuthStoreSnapshot => {
  useAuthStore.getState().clearAll();
  return getAuthSnapshot();
};

export const updateCustomerOnboardingDraft = (
  patch: Partial<CustomerOnboardingDraft>,
): AuthStoreSnapshot => {
  useAuthStore.getState().setCustomerOnboardingDraft(patch);
  return getAuthSnapshot();
};

export const completeCustomerOnboardingState = (
  patch?: Partial<CustomerOnboardingDraft>,
): AuthStoreSnapshot => {
  useAuthStore.getState().completeCustomerOnboarding(patch);
  return getAuthSnapshot();
};

export const completeHostApplicationState = (
  patch?: Partial<CustomerOnboardingDraft>,
): AuthStoreSnapshot => {
  useAuthStore.getState().completeHostApplication(patch);
  return getAuthSnapshot();
};
