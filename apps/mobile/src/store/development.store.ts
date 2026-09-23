import { create } from 'zustand';

import {
  defaultDataSimulationControls,
  defaultDevelopmentScenario,
  type DataSimulationControls,
  type DevelopmentScenario,
} from '@connecto/domain';

export type DevelopmentScenarioStore = {
  reset: () => void;
  scenario: DevelopmentScenario;
  setScenario: (patch: Partial<DevelopmentScenario>) => DevelopmentScenario;
  setSimulation: (
    patch: Partial<DataSimulationControls>,
  ) => DataSimulationControls;
  simulation: DataSimulationControls;
};

export const useDevelopmentScenarioStore = create<DevelopmentScenarioStore>(
  (set, get) => ({
    reset: () => {
      set({
        scenario: defaultDevelopmentScenario,
        simulation: defaultDataSimulationControls,
      });
    },
    scenario: defaultDevelopmentScenario,
    setScenario: (patch) => {
      const scenario = { ...get().scenario, ...patch };
      set({ scenario });
      return scenario;
    },
    setSimulation: (patch) => {
      const simulation = { ...get().simulation, ...patch };
      set({ simulation });
      return simulation;
    },
    simulation: defaultDataSimulationControls,
  }),
);
