import {
  createFetchHttpClient,
  createFrontendServices,
  createMockDatabase,
  seedMockDatabase,
  type DevelopmentScenario,
} from '@connecto/domain';

import { mobileRuntimeConfig } from '@/config/runtime';
import { useDevelopmentScenarioStore } from '@/store/development.store';

const mobileMockDatabase = createMockDatabase(
  useDevelopmentScenarioStore.getState().scenario,
);

export const applyMobileDevelopmentScenario = (
  scenario: DevelopmentScenario = useDevelopmentScenarioStore.getState()
    .scenario,
) => seedMockDatabase(mobileMockDatabase, scenario);

const mobileHttpClient = createFetchHttpClient({
  baseUrl: mobileRuntimeConfig.apiBaseUrl,
});

export const frontendServices = createFrontendServices(
  mobileRuntimeConfig.providerMode,
  {
    database: mobileMockDatabase,
    getSimulationControls: () =>
      useDevelopmentScenarioStore.getState().simulation,
    httpClient: mobileHttpClient,
  },
);
