import { describe, expect, it } from 'vitest';

import {
  initialCustomerOnboardingDraft,
  type CustomerOnboardingDraft,
} from '@/store/auth.store';

import {
  buildHostVoiceVerificationSentence,
  buildCustomerPreferredLanguages,
  calculateAgeFromDateOfBirthInput,
  dateOfBirthInputToIsoDate,
  formatCustomerMatchTags,
  validateCustomerOnboardingProfileDraft,
  resolveCustomerOnboardingStep,
  validateDateOfBirthInput,
} from './customer-onboarding.models';

describe('customer onboarding models', () => {
  it('rejects invalid and future dates of birth', () => {
    const referenceDate = new Date('2026-07-16T00:00:00.000Z');

    expect(validateDateOfBirthInput('01/01/2010', referenceDate)).toBeNull();
    expect(validateDateOfBirthInput('01/01/2027', referenceDate)).toBe(
      'Date of birth cannot be in the future.',
    );
    expect(validateDateOfBirthInput('31/02/2000', referenceDate)).toBe(
      'Use the date format DD/MM/YYYY.',
    );
    expect(validateDateOfBirthInput('01/01/2000', referenceDate)).toBeNull();
  });

  it('resolves onboarding resume steps from the saved draft', () => {
    const referenceDate = new Date('2026-07-16T00:00:00.000Z');

    expect(
      resolveCustomerOnboardingStep(
        initialCustomerOnboardingDraft,
        referenceDate,
      ),
    ).toBe('profile');

    expect(
      resolveCustomerOnboardingStep(
        {
          ...initialCustomerOnboardingDraft,
          currentStep: 'language',
          dateOfBirthInput: '01/01/2000',
          displayName: 'Customer Two',
          gender: 'woman',
        },
        referenceDate,
      ),
    ).toBe('language');

    expect(
      resolveCustomerOnboardingStep(
        {
          ...initialCustomerOnboardingDraft,
          currentStep: 'permissions',
          dateOfBirthInput: '01/01/2000',
          displayName: 'Customer Two',
          gender: 'woman',
          primaryLanguage: 'English',
        },
        referenceDate,
      ),
    ).toBe('matchTags');

    expect(
      resolveCustomerOnboardingStep(
        {
          ...initialCustomerOnboardingDraft,
          currentStep: 'permissions',
          dateOfBirthInput: '01/01/2000',
          displayName: 'Customer Two',
          gender: 'woman',
          matchTags: ['friendship'],
          primaryLanguage: 'English',
        },
        referenceDate,
      ),
    ).toBe('permissions');

    expect(
      resolveCustomerOnboardingStep(
        {
          ...initialCustomerOnboardingDraft,
          currentStep: 'voiceVerification',
          dateOfBirthInput: '01/01/2000',
          displayName: 'Customer Two',
          gender: 'woman',
          matchTags: ['friendship'],
          primaryLanguage: 'English',
        },
        referenceDate,
      ),
    ).toBe('voiceVerification');

    expect(
      resolveCustomerOnboardingStep(
        {
          ...initialCustomerOnboardingDraft,
          currentStep: 'hostApproval',
          dateOfBirthInput: '01/01/2000',
          displayName: 'Customer Two',
          gender: 'woman',
          hostVoiceVerificationRecordingUri: 'file:///voice.m4a',
          hostVoiceVerificationStatus: 'pending',
          hostVoiceVerificationSubmittedAtIso: '2026-07-16T00:00:00.000Z',
          matchTags: ['friendship'],
          primaryLanguage: 'English',
        },
        referenceDate,
      ),
    ).toBe('hostApproval');

    expect(
      resolveCustomerOnboardingStep(
        {
          ...initialCustomerOnboardingDraft,
          currentStep: 'hostAgreement',
          dateOfBirthInput: '01/01/2000',
          displayName: 'Customer Two',
          gender: 'woman',
          hostVoiceVerificationRecordingUri: 'file:///voice.m4a',
          hostVoiceVerificationStatus: 'verified',
          hostVoiceVerificationSubmittedAtIso: '2026-07-16T00:00:00.000Z',
          matchTags: ['friendship'],
          primaryLanguage: 'English',
        },
        referenceDate,
      ),
    ).toBe('hostAgreement');
  });

  it('returns profile form field errors for invalid draft values', () => {
    expect(
      validateCustomerOnboardingProfileDraft(
        {
          dateOfBirthInput: '16/07/2010',
          displayName: ' ',
          gender: null,
        },
        new Date('2026-07-16T00:00:00.000Z'),
      ),
    ).toEqual({
      dateOfBirthInput: null,
      displayName: 'Enter the name you want hosts and support to use.',
      gender: 'Choose a gender option.',
    });
  });

  it('converts valid date input and preferred languages into persisted profile fields', () => {
    expect(dateOfBirthInputToIsoDate('16/07/1995')).toBe('1995-07-16');
    expect(dateOfBirthInputToIsoDate('31/02/1995')).toBeNull();
    expect(buildCustomerPreferredLanguages('English', null)).toEqual([
      'English',
    ]);
    expect(buildCustomerPreferredLanguages('English', 'Hindi')).toEqual([
      'English',
      'Hindi',
    ]);
  });

  it('builds the dynamic host voice verification sentence from onboarding details', () => {
    const draft = {
      ...initialCustomerOnboardingDraft,
      dateOfBirthInput: '01/01/2000',
      displayName: '  Kavya Rao  ',
      location: {
        accuracyMeters: 18,
        latitude: 17.6868,
        longitude: 83.2185,
        placeLabel: 'Hyderabad Telangana',
        requestedAtIso: '2026-07-16T00:00:00.000Z',
        status: 'granted',
      },
      matchTags: ['friendship', 'love', 'time-pass'],
      primaryLanguage: 'Telugu',
      secondaryLanguage: 'English',
    } satisfies CustomerOnboardingDraft;

    expect(
      calculateAgeFromDateOfBirthInput(
        draft.dateOfBirthInput,
        new Date('2026-07-16T00:00:00.000Z'),
      ),
    ).toBe(26);
    expect(formatCustomerMatchTags(draft.matchTags)).toBe(
      'Friendship, Love, and Time pass',
    );
    expect(
      buildHostVoiceVerificationSentence(
        draft,
        new Date('2026-07-16T00:00:00.000Z'),
      ),
    ).toBe(
      'Hello Connecto, my name is Kavya Rao. I am 26 years old from Hyderabad Telangana. I am new to Connecto. My tags are Friendship, Love, and Time pass. I can host in Telugu and English and will keep every call respectful, safe, and genuine.',
    );
  });
});
