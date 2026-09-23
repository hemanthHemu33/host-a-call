import { adminRuntimeConfig } from './runtime';

type AdminEnvironment = typeof adminRuntimeConfig.environment;

export const isAdminInternalRouteAvailable = (
  environment: AdminEnvironment = adminRuntimeConfig.environment,
) => environment !== 'production';
