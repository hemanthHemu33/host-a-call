import {
  createFetchHttpClient,
  createFrontendServices,
  createMockDatabase,
} from '@connecto/domain';

import { adminRuntimeConfig } from '@/config/runtime';

const adminMockDatabase = createMockDatabase();

const adminHttpClient = createFetchHttpClient({
  baseUrl: adminRuntimeConfig.apiBaseUrl,
});

export const frontendServices = createFrontendServices(
  adminRuntimeConfig.providerMode,
  {
    database: adminMockDatabase,
    httpClient: adminHttpClient,
  },
);
