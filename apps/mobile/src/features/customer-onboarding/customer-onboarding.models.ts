import { z } from 'zod';

import { providerModeSchema, type Language } from '@connecto/domain';

import type {
  CustomerGender,
  CustomerOnboardingDraft,
  CustomerOnboardingImageDraft,
  CustomerOnboardingStep,
  CustomerMatchTag,
  CustomerPermissionStatus,
  HostVoiceVerificationStatus,
} from '@/store/auth.store';

export type LanguageOption = {
  aliases: readonly string[];
  description: string;
  label: string;
  language: Language;
};

export type MatchTagOption = {
  description: string;
  label: string;
  value: CustomerMatchTag;
};

export const onboardingAsyncModeSchema = z.enum([
  'empty',
  'failure',
  'offline',
  'success',
]);
export type OnboardingAsyncMode = z.infer<typeof onboardingAsyncModeSchema>;

const onboardingMutationModeSchema = z.enum(['failure', 'offline', 'success']);

export const onboardingPermissionKindSchema = z.enum([
  'camera',
  'location',
  'microphone',
  'notifications',
]);
export type OnboardingPermissionKind = z.infer<
  typeof onboardingPermissionKindSchema
>;

export const onboardingPermissionDecisionSchema = z.enum([
  'granted',
  'not-now',
]);
export type OnboardingPermissionDecision = z.infer<
  typeof onboardingPermissionDecisionSchema
>;

export const onboardingNotificationOutcomeSchema = z.enum([
  'granted',
  'not-now',
]);
export type OnboardingNotificationOutcome = z.infer<
  typeof onboardingNotificationOutcomeSchema
>;

export const onboardingPermissionRequirementSchema = z.object({
  body: z.string().min(1),
  callout: z.string().min(1),
  kind: onboardingPermissionKindSchema,
  requestDuringOnboarding: z.boolean(),
  title: z.string().min(1),
});
export type OnboardingPermissionRequirement = z.infer<
  typeof onboardingPermissionRequirementSchema
>;

export type CustomerOnboardingProfileResult = {
  dateOfBirthInput: string;
  displayName: string;
  gender: CustomerGender;
  profileImage: CustomerOnboardingImageDraft | null;
};

export type CustomerOnboardingLanguageResult = {
  primaryLanguage: Language;
  secondaryLanguage: Language | null;
};

export type CustomerOnboardingNotificationPermissionResult = {
  requestedAtIso: string;
  status: Exclude<CustomerPermissionStatus, 'unknown'>;
};

export type CustomerOnboardingDevicePermissionResult =
  CustomerOnboardingNotificationPermissionResult;

export type CustomerOnboardingLocationPermissionResult = {
  accuracyMeters: number | null;
  latitude: number | null;
  longitude: number | null;
  placeLabel: string | null;
  requestedAtIso: string;
  status: Exclude<CustomerPermissionStatus, 'unknown'>;
};

export type HostVoiceVerificationResult = {
  recordingUri: string;
  status: Extract<HostVoiceVerificationStatus, 'pending' | 'verified'>;
  submittedAtIso: string;
};

export type HostVoiceVerificationApprovalResult = {
  reviewedAtIso: string | null;
  status: HostVoiceVerificationStatus;
};

export type HostAgreementSubmissionResult = {
  acceptedAtIso: string;
  submittedAtIso: string;
};

export interface CustomerOnboardingAdapter {
  getHostVoiceVerificationApproval(input: {
    submittedAtIso: string;
  }): Promise<HostVoiceVerificationApprovalResult>;
  listLanguages(): Promise<LanguageOption[]>;
  listPermissionRequirements(): Promise<OnboardingPermissionRequirement[]>;
  requestCameraPermission(): Promise<CustomerOnboardingDevicePermissionResult>;
  requestLocationPermission(): Promise<CustomerOnboardingLocationPermissionResult>;
  requestMicrophonePermission(): Promise<CustomerOnboardingDevicePermissionResult>;
  requestNotificationPermission(): Promise<CustomerOnboardingNotificationPermissionResult>;
  submitHostAgreement(input: {
    accepted: boolean;
  }): Promise<HostAgreementSubmissionResult>;
  submitHostVoiceVerification(input: {
    recordingUri: string;
    sentence: string;
  }): Promise<HostVoiceVerificationResult>;
  saveLanguages(input: {
    primaryLanguage: Language;
    secondaryLanguage: Language | null;
  }): Promise<CustomerOnboardingLanguageResult>;
  saveProfile(input: {
    dateOfBirthInput: string;
    displayName: string;
    gender: CustomerGender;
    profileImage: CustomerOnboardingImageDraft | null;
  }): Promise<CustomerOnboardingProfileResult>;
  selectProfileImage(): Promise<CustomerOnboardingImageDraft | null>;
  updateProfileImageCrop(input: {
    image: CustomerOnboardingImageDraft;
  }): Promise<CustomerOnboardingImageDraft | null>;
}

export const customerOnboardingRuntimeConfigSchema = z.object({
  languageMode: onboardingAsyncModeSchema,
  mediaMode: onboardingMutationModeSchema,
  notificationOutcome: onboardingNotificationOutcomeSchema,
  permissionMode: onboardingAsyncModeSchema,
  profileMode: onboardingMutationModeSchema,
  providerMode: providerModeSchema.catch('mock'),
});
export type CustomerOnboardingRuntimeConfig = z.infer<
  typeof customerOnboardingRuntimeConfigSchema
>;

export const parseCustomerOnboardingRuntimeConfig = (
  input: Record<string, string | undefined>,
): CustomerOnboardingRuntimeConfig =>
  customerOnboardingRuntimeConfigSchema.parse({
    languageMode: onboardingAsyncModeSchema
      .catch('success')
      .parse(input.EXPO_PUBLIC_CONNECTO_ONBOARDING_LANGUAGE_MODE),
    mediaMode: onboardingMutationModeSchema
      .catch('success')
      .parse(input.EXPO_PUBLIC_CONNECTO_ONBOARDING_MEDIA_MODE),
    notificationOutcome: onboardingNotificationOutcomeSchema
      .catch('granted')
      .parse(input.EXPO_PUBLIC_CONNECTO_ONBOARDING_NOTIFICATION_OUTCOME),
    permissionMode: onboardingAsyncModeSchema
      .catch('success')
      .parse(input.EXPO_PUBLIC_CONNECTO_ONBOARDING_PERMISSION_MODE),
    profileMode: onboardingMutationModeSchema
      .catch('success')
      .parse(input.EXPO_PUBLIC_CONNECTO_ONBOARDING_PROFILE_MODE),
    providerMode: providerModeSchema.parse(
      input.EXPO_PUBLIC_CONNECTO_ONBOARDING_PROVIDER ?? 'mock',
    ),
  });

export const customerOnboardingLanguageOptions = [
  {
    aliases: ['eng', 'global', 'support'],
    description: 'Best for broad host discovery and support follow-up.',
    label: 'English (India and global support)',
    language: 'English',
  },
  {
    aliases: ['bangla', 'bengali', 'kolkata'],
    description: 'Good for Bangla-speaking hosts and support.',
    label: 'Bangla (Bengali conversations)',
    language: 'Bangla',
  },
  {
    aliases: ['hin', 'north india', 'hindi'],
    description: 'Useful for wider India-language matching.',
    label: 'Hindi (wider India matching)',
    language: 'Hindi',
  },
  {
    aliases: ['telugu', 'andhra', 'tel'],
    description: 'Recommended for Telugu-first host discovery.',
    label: 'Telugu (Andhra Pradesh and Telangana)',
    language: 'Telugu',
  },
  {
    aliases: ['tamil', 'tn', 'tam'],
    description: 'Good for Tamil-speaking hosts and support.',
    label: 'Tamil (Tamil Nadu and diaspora support)',
    language: 'Tamil',
  },
  {
    aliases: ['kannada', 'ka', 'bengaluru'],
    description: 'Balances host discovery across Karnataka cities.',
    label: 'Kannada (Karnataka local conversations)',
    language: 'Kannada',
  },
  {
    aliases: ['punjabi', 'punjab', 'panjabi'],
    description: 'Useful for Punjabi-speaking hosts and support.',
    label: 'Punjabi (Punjab conversations)',
    language: 'Punjabi',
  },
  {
    aliases: ['odia', 'odisha', 'oriya'],
    description: 'Good for Odia-speaking hosts and support.',
    label: 'Odia (Odisha conversations)',
    language: 'Odia',
  },
  {
    aliases: ['gujarati', 'gujarat', 'guj'],
    description: 'Useful for Gujarati-speaking hosts and support.',
    label: 'Gujarati (Gujarat conversations)',
    language: 'Gujarati',
  },
  {
    aliases: ['malayalam', 'kerala', 'mal'],
    description: 'Useful for Malayalam-speaking support and hosts.',
    label: 'Malayalam (Kerala and long-form support)',
    language: 'Malayalam',
  },
] as const satisfies readonly LanguageOption[];

export const customerOnboardingMatchTagOptions = [
  {
    description: 'Easy everyday conversations and new social connections.',
    label: 'Friendship',
    value: 'friendship',
  },
  {
    description: 'Warm conversations about attraction, dating, and feelings.',
    label: 'Love',
    value: 'love',
  },
  {
    description:
      'Marriage-focused conversations, compatibility, and next steps.',
    label: 'Marriage',
    value: 'marriage',
  },
  {
    description: 'Light, casual chats when the goal is simply to pass time.',
    label: 'Time pass',
    value: 'time-pass',
  },
  {
    description: 'Relationship questions, clarity, and communication advice.',
    label: 'Relationship',
    value: 'relationship',
  },
  {
    description: 'A calmer listener for mood, loneliness, or personal stress.',
    label: 'Emotional support',
    value: 'emotional-support',
  },
  {
    description: 'Practical suggestions before making a personal decision.',
    label: 'Advice',
    value: 'advice',
  },
  {
    description:
      'Playful conversations, jokes, and low-pressure entertainment.',
    label: 'Fun talk',
    value: 'fun-talk',
  },
] as const satisfies readonly MatchTagOption[];

const customerMatchTagLabelByValue = new Map<CustomerMatchTag, string>(
  customerOnboardingMatchTagOptions.map((option) => [
    option.value,
    option.label,
  ]),
);

const normalizeSentenceValue = (value: string) =>
  value.trim().replace(/\s+/g, ' ');

const formatNaturalList = (values: readonly string[]) => {
  if (values.length === 0) {
    return '';
  }

  if (values.length === 1) {
    return values[0] ?? '';
  }

  if (values.length === 2) {
    return `${values[0] ?? ''} and ${values[1] ?? ''}`;
  }

  const last = values[values.length - 1] ?? '';

  return `${values.slice(0, -1).join(', ')}, and ${last}`;
};

export const getCustomerMatchTagLabel = (tag: CustomerMatchTag) =>
  customerMatchTagLabelByValue.get(tag) ?? tag;

export const formatCustomerMatchTags = (tags: readonly CustomerMatchTag[]) => {
  const labels = tags.map(getCustomerMatchTagLabel);

  return labels.length === 0
    ? 'general conversation'
    : formatNaturalList(labels);
};

export const customerOnboardingPermissionRequirements = [
  {
    body: 'Microphone access lets your voice connect during calls.',
    callout: 'Allow now or we will ask again before your first voice call.',
    kind: 'microphone',
    requestDuringOnboarding: true,
    title: 'Microphone',
  },
  {
    body: 'Camera access is needed when you switch from voice to video.',
    callout: 'Allow now or we will ask again before your first video call.',
    kind: 'camera',
    requestDuringOnboarding: true,
    title: 'Camera',
  },
  {
    body: 'Location lets Connecto detect your city or region from this phone for safer matching.',
    callout:
      'Allow once so users and hosts do not need to type a place manually.',
    kind: 'location',
    requestDuringOnboarding: true,
    title: 'Location',
  },
  {
    body: 'Notifications help with OTP reminders, call invitations, wallet updates, and support replies.',
    callout: 'You can allow now or continue without it.',
    kind: 'notifications',
    requestDuringOnboarding: true,
    title: 'Notifications',
  },
] as const satisfies readonly OnboardingPermissionRequirement[];

export const calculateAgeFromDateOfBirthInput = (
  value: string,
  referenceDate: Date = new Date(),
) => {
  const parsed = parseDateOfBirthInput(value);

  if (parsed === null) {
    return null;
  }

  let age = referenceDate.getUTCFullYear() - parsed.year;
  const referenceMonth = referenceDate.getUTCMonth() + 1;
  const referenceDay = referenceDate.getUTCDate();

  if (
    referenceMonth < parsed.month ||
    (referenceMonth === parsed.month && referenceDay < parsed.day)
  ) {
    age -= 1;
  }

  return age >= 0 ? age : null;
};

export const buildHostVoiceVerificationSentence = (
  draft: Pick<
    CustomerOnboardingDraft,
    | 'dateOfBirthInput'
    | 'displayName'
    | 'location'
    | 'matchTags'
    | 'primaryLanguage'
    | 'secondaryLanguage'
  >,
  referenceDate: Date = new Date(),
) => {
  const name = normalizeSentenceValue(draft.displayName) || 'Connecto host';
  const age = calculateAgeFromDateOfBirthInput(
    draft.dateOfBirthInput,
    referenceDate,
  );
  const tags = formatCustomerMatchTags(draft.matchTags);
  const languageLabels =
    draft.primaryLanguage === null
      ? ['my selected language']
      : buildCustomerPreferredLanguages(
          draft.primaryLanguage,
          draft.secondaryLanguage,
        );
  const ageText =
    age === null ? 'at least 18 years old' : `${String(age)} years old`;
  const placeText =
    draft.location.placeLabel ??
    (draft.location.latitude === null || draft.location.longitude === null
      ? 'the location I allow Connecto to detect'
      : 'my phone-detected location');

  return `Hello Connecto, my name is ${name}. I am ${ageText} from ${placeText}. I am new to Connecto. My tags are ${tags}. I can host in ${formatNaturalList(languageLabels)} and will keep every call respectful, safe, and genuine.`;
};

export const customerGenderOptions = [
  {
    description: 'Used for profile personalisation only.',
    label: 'Female',
    value: 'woman',
  },
  {
    description: 'Used for profile personalisation only.',
    label: 'Male',
    value: 'man',
  },
  {
    description: 'Used for profile personalisation only.',
    label: 'Non-binary',
    value: 'non-binary',
  },
  {
    description: 'Optional. You can skip a specific gender label.',
    label: 'Prefer not to say',
    value: 'prefer-not-to-say',
  },
] as const satisfies readonly {
  description: string;
  label: string;
  value: CustomerGender;
}[];

const normalizeDateDigits = (value: string) =>
  value.replace(/\D/g, '').slice(0, 8);

export const formatDateOfBirthInput = (value: string) => {
  const digits = normalizeDateDigits(value);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

type ParsedDateParts = {
  day: number;
  month: number;
  year: number;
};

const parseDateOfBirthInput = (value: string): ParsedDateParts | null => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());

  if (match === null) {
    return null;
  }

  const day = Number.parseInt(match[1] ?? '', 10);
  const month = Number.parseInt(match[2] ?? '', 10);
  const year = Number.parseInt(match[3] ?? '', 10);

  if (
    !Number.isFinite(day) ||
    !Number.isFinite(month) ||
    !Number.isFinite(year)
  ) {
    return null;
  }

  const candidate = new Date(Date.UTC(year, month - 1, day));

  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return { day, month, year };
};

export const dateOfBirthInputToIsoDate = (value: string) => {
  const parsed = parseDateOfBirthInput(value);

  if (parsed === null) {
    return null;
  }

  return `${String(parsed.year).padStart(4, '0')}-${String(parsed.month).padStart(2, '0')}-${String(parsed.day).padStart(2, '0')}`;
};

export const validateDateOfBirthInput = (
  value: string,
  referenceDate: Date = new Date(),
) => {
  const parsed = parseDateOfBirthInput(value);

  if (parsed === null) {
    return 'Use the date format DD/MM/YYYY.';
  }

  const candidate = new Date(
    Date.UTC(parsed.year, parsed.month - 1, parsed.day),
  );

  if (candidate.getTime() > referenceDate.getTime()) {
    return 'Date of birth cannot be in the future.';
  }

  return null;
};

export const validateDisplayName = (value: string) => {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return 'Enter the name you want hosts and support to use.';
  }

  if (trimmed.length < 2) {
    return 'Use at least 2 characters.';
  }

  return null;
};

export const validateCustomerOnboardingProfileDraft = (
  draft: Pick<
    CustomerOnboardingDraft,
    'dateOfBirthInput' | 'displayName' | 'gender'
  >,
  referenceDate: Date = new Date(),
) => ({
  dateOfBirthInput: validateDateOfBirthInput(
    draft.dateOfBirthInput,
    referenceDate,
  ),
  displayName: validateDisplayName(draft.displayName),
  gender: draft.gender === null ? 'Choose a gender option.' : null,
});

export const isCustomerOnboardingProfileComplete = (
  draft: Pick<
    CustomerOnboardingDraft,
    'dateOfBirthInput' | 'displayName' | 'gender'
  >,
  referenceDate: Date = new Date(),
) => {
  const validation = validateCustomerOnboardingProfileDraft(
    draft,
    referenceDate,
  );

  return Object.values(validation).every((value) => value === null);
};

export const isCustomerOnboardingLanguageComplete = (
  draft: Pick<CustomerOnboardingDraft, 'primaryLanguage'>,
) => draft.primaryLanguage !== null;

export const isCustomerOnboardingMatchTagsComplete = (
  draft: Pick<CustomerOnboardingDraft, 'matchTags'>,
) => draft.matchTags.length > 0;

export const isHostApplicantDraft = (
  draft: Pick<CustomerOnboardingDraft, 'gender'>,
) => draft.gender === 'woman';

export const customerOnboardingStepsForDraft = (
  draft: Pick<CustomerOnboardingDraft, 'gender'>,
) =>
  isHostApplicantDraft(draft)
    ? ([
        'profile',
        'language',
        'matchTags',
        'permissions',
        'voiceVerification',
        'hostApproval',
        'hostAgreement',
      ] as const satisfies readonly CustomerOnboardingStep[])
    : ([
        'profile',
        'language',
        'matchTags',
        'permissions',
      ] as const satisfies readonly CustomerOnboardingStep[]);

const isHostVoiceVerificationSubmitted = (
  draft: Pick<
    CustomerOnboardingDraft,
    | 'hostVoiceVerificationRecordingUri'
    | 'hostVoiceVerificationStatus'
    | 'hostVoiceVerificationSubmittedAtIso'
  >,
) =>
  draft.hostVoiceVerificationRecordingUri !== null &&
  draft.hostVoiceVerificationSubmittedAtIso !== null &&
  (draft.hostVoiceVerificationStatus === 'pending' ||
    draft.hostVoiceVerificationStatus === 'verified');

export const resolveCustomerOnboardingStep = (
  draft: CustomerOnboardingDraft,
  referenceDate: Date = new Date(),
): CustomerOnboardingStep => {
  if (!isCustomerOnboardingProfileComplete(draft, referenceDate)) {
    return 'profile';
  }

  if (draft.currentStep === 'profile') {
    return 'profile';
  }

  if (!isCustomerOnboardingLanguageComplete(draft)) {
    return 'language';
  }

  if (draft.currentStep === 'language') {
    return 'language';
  }

  if (!isCustomerOnboardingMatchTagsComplete(draft)) {
    return 'matchTags';
  }

  if (draft.currentStep === 'matchTags') {
    return 'matchTags';
  }

  if (!isHostApplicantDraft(draft)) {
    return 'permissions';
  }

  if (draft.currentStep === 'permissions') {
    return 'permissions';
  }

  if (
    draft.currentStep === 'voiceVerification' ||
    !isHostVoiceVerificationSubmitted(draft)
  ) {
    return 'voiceVerification';
  }

  if (
    draft.currentStep === 'hostApproval' ||
    draft.hostVoiceVerificationStatus !== 'verified'
  ) {
    return 'hostApproval';
  }

  return 'hostAgreement';
};

export const filterCustomerOnboardingLanguages = (
  options: readonly LanguageOption[],
  query: string,
) => {
  const normalizedQuery = query.trim().toLowerCase();

  if (normalizedQuery.length === 0) {
    return [...options];
  }

  return options.filter((option) => {
    const haystacks = [option.label, option.description, ...option.aliases];

    return haystacks.some((value) =>
      value.toLowerCase().includes(normalizedQuery),
    );
  });
};

export const buildCustomerPreferredLanguages = (
  primaryLanguage: Language,
  secondaryLanguage: Language | null,
) =>
  secondaryLanguage === null || secondaryLanguage === primaryLanguage
    ? [primaryLanguage]
    : [primaryLanguage, secondaryLanguage];
