import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import { adminSummarySchema, type AdminSummary } from '@connecto/domain';

import { createZodFormResolver, getAccessibleFieldError } from './forms';

describe('admin form helpers', () => {
  it('creates typed Zod resolvers and field error metadata', () => {
    expect(typeof useForm).toBe('function');
    expect(typeof createZodFormResolver<AdminSummary>(adminSummarySchema)).toBe(
      'function',
    );
    expect(
      getAccessibleFieldError({ message: 'Required', type: 'manual' }),
    ).toEqual({
      ariaDescribedBy: 'Required',
      errorText: 'Required',
    });
  });
});
