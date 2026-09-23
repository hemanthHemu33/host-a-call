import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import { customerSchema, type Customer } from '@connecto/domain';

import { createZodFormResolver, getAccessibleFieldError } from './forms';

describe('mobile form helpers', () => {
  it('creates typed Zod resolvers and accessible field errors', () => {
    expect(typeof useForm).toBe('function');
    expect(typeof createZodFormResolver<Customer>(customerSchema)).toBe(
      'function',
    );
    expect(
      getAccessibleFieldError({ message: 'Required', type: 'manual' }),
    ).toEqual({
      accessibilityHint: 'Required',
      errorText: 'Required',
    });
  });
});
