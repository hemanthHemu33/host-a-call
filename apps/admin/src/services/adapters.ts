import { createFrontendAdapters } from '@connecto/domain';

import { adminRuntimeConfig } from '@/config/runtime';

export { frontendServices } from './data';

export const frontendAdapters = createFrontendAdapters(
  adminRuntimeConfig.providerMode,
);
