import { mockHealthAdapter } from '@connecto/domain';

import { mobileRuntimeConfig } from '@/config/runtime';

export const getMobileProviderMode = () => mobileRuntimeConfig.providerMode;

export const getMobileHealth = () =>
  mockHealthAdapter('Connecto Mobile', getMobileProviderMode()).getHealth();
