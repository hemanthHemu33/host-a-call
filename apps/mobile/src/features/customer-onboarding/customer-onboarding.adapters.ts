import {
  createApiError,
  FrontendApiError,
  type Language,
} from '@connecto/domain';

import type {
  CustomerGender,
  CustomerOnboardingImageDraft,
} from '@/store/auth.store';

import {
  customerOnboardingLanguageOptions,
  customerOnboardingPermissionRequirements,
  parseCustomerOnboardingRuntimeConfig,
  type CustomerOnboardingAdapter,
  type CustomerOnboardingDevicePermissionResult,
  type CustomerOnboardingLocationPermissionResult,
  type HostAgreementSubmissionResult,
  type HostVoiceVerificationApprovalResult,
  type HostVoiceVerificationResult,
  type CustomerOnboardingLanguageResult,
  type CustomerOnboardingNotificationPermissionResult,
  type CustomerOnboardingProfileResult,
  type OnboardingAsyncMode,
  type OnboardingPermissionRequirement,
} from './customer-onboarding.models';
import {
  requestNativeCameraPermission,
  requestNativeLocationPermission,
  requestNativeMicrophonePermission,
  requestNativeNotificationPermission,
  selectNativeOnboardingProfileImage,
  updateNativeOnboardingProfileImageCrop,
} from './customer-onboarding.native';

const runtimeConfig = parseCustomerOnboardingRuntimeConfig(process.env);

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const asFrontendApiError = (input: {
  code: 'offline' | 'server' | 'validation';
  message: string;
}) =>
  new FrontendApiError(
    createApiError({
      code: input.code,
      message: input.message,
    }),
  );

const simulateMode = async <T>(
  mode: OnboardingAsyncMode | 'failure' | 'offline' | 'success',
  value: T,
  fallback?: {
    empty?: T;
  },
) => {
  await wait(140);

  if (mode === 'offline') {
    throw asFrontendApiError({
      code: 'offline',
      message: 'The device is offline. Reconnect to keep onboarding in sync.',
    });
  }

  if (mode === 'failure') {
    throw asFrontendApiError({
      code: 'server',
      message: 'The onboarding service is temporarily unavailable.',
    });
  }

  if (mode === 'empty') {
    return fallback?.empty ?? value;
  }

  return value;
};

let selectedImageIndex = 0;
let cropPreviewVersion = 0;

const squarePreviewSvg = (fill: string, label: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
      <rect width="240" height="240" rx="28" fill="${fill}" />
      <circle cx="120" cy="92" r="38" fill="rgba(255,255,255,0.92)" />
      <rect x="52" y="148" width="136" height="24" rx="12" fill="rgba(255,255,255,0.92)" />
      <text x="120" y="208" text-anchor="middle" font-family="Arial" font-size="18" fill="rgba(255,255,255,0.92)">${label}</text>
    </svg>`,
  )}`;

const imageFixtures = [
  {
    localUri: 'mock://connecto/customer/profile-image-1',
    previewUri: squarePreviewSvg('#D6654F', 'Preview 1'),
    sourceName: 'connecto-profile-1.jpg',
  },
  {
    localUri: 'mock://connecto/customer/profile-image-2',
    previewUri: squarePreviewSvg('#2D6A8E', 'Preview 2'),
    sourceName: 'connecto-profile-2.jpg',
  },
] as const satisfies readonly Omit<CustomerOnboardingImageDraft, 'cropLabel'>[];

const saveProfile = async (input: {
  dateOfBirthInput: string;
  displayName: string;
  gender: CustomerGender;
  profileImage: CustomerOnboardingImageDraft | null;
}) =>
  simulateMode<CustomerOnboardingProfileResult>(runtimeConfig.profileMode, {
    dateOfBirthInput: input.dateOfBirthInput.trim(),
    displayName: input.displayName.trim(),
    gender: input.gender,
    profileImage: input.profileImage,
  });

const saveLanguages = async (
  primaryLanguage: Language,
  secondaryLanguage: Language | null,
) =>
  simulateMode<CustomerOnboardingLanguageResult>(runtimeConfig.languageMode, {
    primaryLanguage,
    secondaryLanguage,
  });

const hostApprovalDelayMs = 1_500;

const submitHostVoiceVerification = async (input: {
  recordingUri: string;
  sentence: string;
}) => {
  if (input.recordingUri.trim().length === 0) {
    throw asFrontendApiError({
      code: 'validation',
      message: 'Record your verification sentence before submitting.',
    });
  }

  if (input.sentence.trim().length === 0) {
    throw asFrontendApiError({
      code: 'validation',
      message: 'Verification sentence is missing.',
    });
  }

  return simulateMode<HostVoiceVerificationResult>(runtimeConfig.profileMode, {
    recordingUri: input.recordingUri,
    status: 'pending',
    submittedAtIso: new Date().toISOString(),
  });
};

const getHostVoiceVerificationApproval = async (input: {
  submittedAtIso: string;
}) => {
  const submittedAtMs = Date.parse(input.submittedAtIso);
  const verified =
    Number.isFinite(submittedAtMs) &&
    Date.now() - submittedAtMs >= hostApprovalDelayMs;

  return simulateMode<HostVoiceVerificationApprovalResult>(
    runtimeConfig.profileMode,
    verified
      ? {
          reviewedAtIso: new Date().toISOString(),
          status: 'verified',
        }
      : {
          reviewedAtIso: null,
          status: 'pending',
        },
  );
};

const submitHostAgreement = async (input: { accepted: boolean }) => {
  if (!input.accepted) {
    throw asFrontendApiError({
      code: 'validation',
      message: 'Accept the host agreement before submitting.',
    });
  }

  const acceptedAtIso = new Date().toISOString();

  return simulateMode<HostAgreementSubmissionResult>(
    runtimeConfig.profileMode,
    {
      acceptedAtIso,
      submittedAtIso: acceptedAtIso,
    },
  );
};

const requestNotificationPermission = async () => {
  if (
    runtimeConfig.permissionMode === 'failure' ||
    runtimeConfig.permissionMode === 'offline'
  ) {
    return simulateMode<CustomerOnboardingNotificationPermissionResult>(
      runtimeConfig.permissionMode,
      {
        requestedAtIso: new Date().toISOString(),
        status: runtimeConfig.notificationOutcome,
      },
    );
  }

  return requestNativeNotificationPermission();
};

const requestDevicePermission = async (
  requestNativePermission: () => Promise<CustomerOnboardingDevicePermissionResult>,
) => {
  if (
    runtimeConfig.permissionMode === 'failure' ||
    runtimeConfig.permissionMode === 'offline'
  ) {
    return simulateMode<CustomerOnboardingDevicePermissionResult>(
      runtimeConfig.permissionMode,
      {
        requestedAtIso: new Date().toISOString(),
        status: runtimeConfig.notificationOutcome,
      },
    );
  }

  return requestNativePermission();
};

const requestLocationPermission = async () => {
  if (
    runtimeConfig.permissionMode === 'failure' ||
    runtimeConfig.permissionMode === 'offline'
  ) {
    return simulateMode<CustomerOnboardingLocationPermissionResult>(
      runtimeConfig.permissionMode,
      {
        accuracyMeters: null,
        latitude: null,
        longitude: null,
        placeLabel: null,
        requestedAtIso: new Date().toISOString(),
        status: runtimeConfig.notificationOutcome,
      },
    );
  }

  return requestNativeLocationPermission();
};

const selectProfileImage = async () => {
  const fixture =
    imageFixtures[selectedImageIndex % imageFixtures.length] ??
    imageFixtures[0];
  selectedImageIndex += 1;

  return simulateMode<CustomerOnboardingImageDraft>(runtimeConfig.mediaMode, {
    cropLabel: 'Square crop preview applied',
    localUri: fixture.localUri,
    previewUri: fixture.previewUri,
    sourceName: fixture.sourceName,
  });
};

const updateProfileImageCrop = async (image: CustomerOnboardingImageDraft) => {
  cropPreviewVersion += 1;

  return simulateMode<CustomerOnboardingImageDraft>(runtimeConfig.mediaMode, {
    ...image,
    cropLabel: `Square crop preview v${String(cropPreviewVersion)}`,
    previewUri: squarePreviewSvg(
      '#1E8B6F',
      `Crop ${String(cropPreviewVersion)}`,
    ),
  });
};

const listLanguages = async () =>
  simulateMode(
    runtimeConfig.languageMode,
    [...customerOnboardingLanguageOptions],
    {
      empty: [],
    },
  );

const listPermissionRequirements = async () =>
  simulateMode(
    runtimeConfig.permissionMode,
    [...customerOnboardingPermissionRequirements],
    {
      empty: [],
    },
  );

const createMockCustomerOnboardingAdapter = (): CustomerOnboardingAdapter => ({
  getHostVoiceVerificationApproval,
  listLanguages,
  listPermissionRequirements,
  requestCameraPermission: () =>
    requestDevicePermission(requestNativeCameraPermission),
  requestLocationPermission,
  requestMicrophonePermission: () =>
    requestDevicePermission(requestNativeMicrophonePermission),
  requestNotificationPermission,
  submitHostAgreement,
  submitHostVoiceVerification,
  saveLanguages: ({ primaryLanguage, secondaryLanguage }) =>
    saveLanguages(primaryLanguage, secondaryLanguage),
  saveProfile,
  selectProfileImage,
  updateProfileImageCrop: ({ image }) => updateProfileImageCrop(image),
});

const createFallbackCustomerOnboardingAdapter =
  (): CustomerOnboardingAdapter => {
    const requirements = [
      ...customerOnboardingPermissionRequirements,
    ] satisfies OnboardingPermissionRequirement[];

    return {
      getHostVoiceVerificationApproval,
      listLanguages: () =>
        Promise.resolve([...customerOnboardingLanguageOptions]),
      listPermissionRequirements: () => Promise.resolve(requirements),
      requestCameraPermission: requestNativeCameraPermission,
      requestLocationPermission: requestNativeLocationPermission,
      requestMicrophonePermission: requestNativeMicrophonePermission,
      requestNotificationPermission: requestNativeNotificationPermission,
      submitHostAgreement,
      submitHostVoiceVerification,
      saveLanguages: ({ primaryLanguage, secondaryLanguage }) =>
        Promise.resolve({
          primaryLanguage,
          secondaryLanguage,
        }),
      saveProfile: ({ dateOfBirthInput, displayName, gender, profileImage }) =>
        Promise.resolve({
          dateOfBirthInput: dateOfBirthInput.trim(),
          displayName: displayName.trim(),
          gender,
          profileImage,
        }),
      selectProfileImage: selectNativeOnboardingProfileImage,
      updateProfileImageCrop: () => updateNativeOnboardingProfileImageCrop(),
    };
  };

export const customerOnboardingAdapter =
  runtimeConfig.providerMode === 'mock'
    ? createMockCustomerOnboardingAdapter()
    : createFallbackCustomerOnboardingAdapter();
