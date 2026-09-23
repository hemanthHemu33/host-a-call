import {
  transitionAppBootstrap,
  type AppBootstrapEvent,
  type AppBootstrapState,
  type ProviderMode,
} from '@connecto/domain';
import { create } from 'zustand';

export type AppStoreSnapshot = {
  bootstrapState: AppBootstrapState;
  providerMode: ProviderMode;
  reducedMotionEnabled: boolean;
};

export const initialAppStore: AppStoreSnapshot = {
  bootstrapState: 'bootstrapping',
  providerMode: 'mock',
  reducedMotionEnabled: false,
};

export const transitionAppStore = (
  snapshot: AppStoreSnapshot,
  event: AppBootstrapEvent,
): AppStoreSnapshot => ({
  ...snapshot,
  bootstrapState: transitionAppBootstrap(snapshot.bootstrapState, event),
});

type UiPreferencesStoreState = AppStoreSnapshot & {
  nonessentialHapticsEnabled: boolean;
  setNonessentialHapticsEnabled: (enabled: boolean) => void;
  setProviderMode: (providerMode: ProviderMode) => void;
  setReducedMotionEnabled: (enabled: boolean) => void;
  transitionBootstrap: (event: AppBootstrapEvent) => void;
};

export const useUiPreferencesStore = create<UiPreferencesStoreState>(
  (set, get) => ({
    ...initialAppStore,
    nonessentialHapticsEnabled: true,
    setNonessentialHapticsEnabled: (nonessentialHapticsEnabled) => {
      set({ nonessentialHapticsEnabled });
    },
    setProviderMode: (providerMode) => {
      set({ providerMode });
    },
    setReducedMotionEnabled: (reducedMotionEnabled) => {
      set({ reducedMotionEnabled });
    },
    transitionBootstrap: (event) => {
      set(transitionAppStore(get(), event));
    },
  }),
);
