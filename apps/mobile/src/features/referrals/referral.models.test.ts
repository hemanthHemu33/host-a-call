import { describe, expect, it } from 'vitest';

import {
  buildReferralDeepLink,
  normalizeReferralCode,
  resolveRetroactiveReferralMessage,
} from './referral.models';

describe('referral models', () => {
  it('normalizes referral codes before deep-link creation', () => {
    expect(normalizeReferralCode(' connecto100 ')).toBe('CONNECTO100');
    expect(buildReferralDeepLink(' connecto100 ')).toBe(
      'connecto://referral/CONNECTO100',
    );
  });

  it('explains that existing users cannot apply codes retroactively', () => {
    expect(resolveRetroactiveReferralMessage('usedonce')).toBe(
      'You are already signed in, so USEDONCE cannot be applied retroactively. Referral codes only lock in before the first verified login.',
    );
  });
});
