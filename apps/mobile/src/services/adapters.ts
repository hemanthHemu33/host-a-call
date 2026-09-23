import { createFrontendAdapters } from '@connecto/domain';

import { mobileRuntimeConfig } from '@/config/runtime';

export { applyMobileDevelopmentScenario, frontendServices } from './data';

export const frontendAdapters = createFrontendAdapters(
  mobileRuntimeConfig.providerMode,
);
