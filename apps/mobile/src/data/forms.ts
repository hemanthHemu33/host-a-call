import { zodResolver } from '@hookform/resolvers/zod';
import type { FieldError, FieldValues, Resolver } from 'react-hook-form';

export const createZodFormResolver = <TFieldValues extends FieldValues>(
  schema: Parameters<typeof zodResolver>[0],
): Resolver<TFieldValues> => zodResolver(schema) as Resolver<TFieldValues>;

export const getAccessibleFieldError = (error: FieldError | undefined) => ({
  accessibilityHint: error?.message,
  errorText: error?.message,
});
