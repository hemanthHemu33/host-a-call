import { Settings } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import {
  defaultDevelopmentScenario,
  type DataSimulationControls,
  type DevelopmentScenario,
  type HostAvailability,
  type HostRank,
  type HostVerificationStatus,
  type PaymentResultScenario,
  type ReportHistoryScenario,
  type SimulationMode,
} from '@connecto/domain';

import { mobileRuntimeConfig } from '@/config/runtime';
import { ScrollScreen } from '@/components/layout';
import { AppHeader, SectionHeader } from '@/components/ui/navigation';
import { Button } from '@/components/ui/controls';
import { Card, ErrorState, StatusBadge } from '@/components/ui/surfaces';
import { ui } from '@/components/ui/theme';
import { completeAuthSession } from '@/navigation/navigation-store';
import { applyMobileDevelopmentScenario } from '@/services/data';
import { persistAuthSnapshot } from '@/features/auth/auth.storage';
import { getAuthSnapshot } from '@/store/auth.store';
import { useDevelopmentScenarioStore } from '@/store/development.store';

type ScenarioRole = DevelopmentScenario['role'];

const roles = ['customer', 'host'] as const satisfies readonly ScenarioRole[];
const availabilityOptions = [
  'online',
  'busy',
  'offline',
  'paused',
] as const satisfies readonly HostAvailability[];
const rankOptions = [
  'bronze',
  'silver',
  'gold',
  'platinum',
  'diamond',
] as const satisfies readonly HostRank[];
const networkOptions = [
  'excellent',
  'good',
  'poor',
  'reconnecting',
  'offline',
] as const satisfies readonly DevelopmentScenario['networkQuality'][];
const paymentOptions = [
  'success',
  'failure',
  'pending',
  'user-cancelled',
  'timeout',
  'duplicate-callback',
] as const satisfies readonly PaymentResultScenario[];
const reportOptions = [
  'open',
  'resolved',
  'empty',
] as const satisfies readonly ReportHistoryScenario[];
const applicationOptions = [
  'not-started',
  'draft',
  'submitted',
  'under-review',
  'changes-requested',
  'verified',
  'rejected',
  'suspended',
] as const satisfies readonly HostVerificationStatus[];
const simulationOptions = [
  'success',
  'empty',
  'partial-data',
  'offline',
  'failure',
] as const satisfies readonly SimulationMode[];

const nextValue = <T extends string>(options: readonly T[], value: T) => {
  const first = options[0];
  if (first === undefined) {
    throw new Error('Scenario options cannot be empty.');
  }

  const index = options.findIndex((option) => option === value);
  return options[(index + 1) % options.length] ?? first;
};

function ScenarioCard({
  children,
  label,
  value,
}: {
  children: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardCopy}>
          <Text style={styles.cardTitle}>{label}</Text>
          <Text style={styles.cardBody}>
            This setting updates the central mock data layer used by future
            feature screens.
          </Text>
        </View>
        <StatusBadge label={value} tone="info" />
      </View>
      <View style={styles.actions}>{children}</View>
    </Card>
  );
}

export function DeveloperScenarioScreen() {
  const { reset, scenario, setScenario, setSimulation, simulation } =
    useDevelopmentScenarioStore();

  if (mobileRuntimeConfig.environment === 'production') {
    return (
      <ScrollScreen contentStyle={styles.centered}>
        <ErrorState
          message="Developer scenario controls are disabled in production builds."
          title="Developer tools unavailable"
        />
      </ScrollScreen>
    );
  }

  const updateScenario = (patch: Partial<DevelopmentScenario>) => {
    const next = setScenario(patch);
    applyMobileDevelopmentScenario(next);

    if (patch.role !== undefined) {
      completeAuthSession({
        phoneNumber: `+9190000000${patch.role === 'host' ? '9' : '1'}`,
        role: patch.role,
        sessionId: `dev-${patch.role}-session`,
      });
      void persistAuthSnapshot(getAuthSnapshot());
    }
  };

  const updateSimulation = (patch: Partial<DataSimulationControls>) => {
    setSimulation(patch);
  };

  const resetAll = () => {
    reset();
    applyMobileDevelopmentScenario(defaultDevelopmentScenario);
    completeAuthSession({
      customerRouteTarget: 'home',
      phoneNumber: '+919000000001',
      role: defaultDevelopmentScenario.role,
      sessionId: 'dev-customer-session',
    });
    void persistAuthSnapshot(getAuthSnapshot());
  };

  return (
    <ScrollScreen testID="developer-scenarios-screen">
      <AppHeader
        actionIcon={Settings}
        subtitle="Hidden outside development and preview builds."
        title="Developer scenarios"
      />

      <SectionHeader
        subtitle="Changes are deterministic and require no backend."
        title="Scenario controls"
      />

      <ScenarioCard label="Session role" value={scenario.role}>
        <Button
          onPress={() => {
            updateScenario({ role: nextValue(roles, scenario.role) });
          }}
          testID="scenario-role"
          title="Switch role"
          variant="secondary"
        />
      </ScenarioCard>

      <ScenarioCard
        label="Wallet balance"
        value={`Rs ${String(scenario.walletBalancePaise / 100)}`}
      >
        <Button
          onPress={() => {
            updateScenario({ walletBalancePaise: 0 });
          }}
          testID="scenario-wallet-empty"
          title="Set empty"
          variant="tonal"
        />
        <Button
          onPress={() => {
            updateScenario({ walletBalancePaise: 50000 });
          }}
          testID="scenario-wallet-funded"
          title="Set funded"
          variant="secondary"
        />
      </ScenarioCard>

      <ScenarioCard label="Host availability" value={scenario.hostAvailability}>
        <Button
          onPress={() => {
            updateScenario({
              hostAvailability: nextValue(
                availabilityOptions,
                scenario.hostAvailability,
              ),
            });
          }}
          testID="scenario-availability"
          title="Cycle availability"
          variant="secondary"
        />
      </ScenarioCard>

      <ScenarioCard label="Host rank" value={scenario.hostRank}>
        <Button
          onPress={() => {
            updateScenario({
              hostRank: nextValue(rankOptions, scenario.hostRank),
            });
          }}
          testID="scenario-rank"
          title="Cycle rank"
          variant="secondary"
        />
      </ScenarioCard>

      <ScenarioCard label="Network quality" value={scenario.networkQuality}>
        <Button
          onPress={() => {
            updateScenario({
              networkQuality: nextValue(
                networkOptions,
                scenario.networkQuality,
              ),
            });
          }}
          testID="scenario-network"
          title="Cycle network"
          variant="secondary"
        />
      </ScenarioCard>

      <ScenarioCard label="Payment result" value={scenario.paymentResult}>
        <Button
          onPress={() => {
            updateScenario({
              paymentResult: nextValue(paymentOptions, scenario.paymentResult),
            });
          }}
          testID="scenario-payment"
          title="Cycle payment"
          variant="secondary"
        />
      </ScenarioCard>

      <ScenarioCard label="Report history" value={scenario.reportHistory}>
        <Button
          onPress={() => {
            updateScenario({
              reportHistory: nextValue(reportOptions, scenario.reportHistory),
            });
          }}
          testID="scenario-reports"
          title="Cycle reports"
          variant="secondary"
        />
      </ScenarioCard>

      <ScenarioCard label="Host application" value={scenario.applicationStatus}>
        <Button
          onPress={() => {
            updateScenario({
              applicationStatus: nextValue(
                applicationOptions,
                scenario.applicationStatus,
              ),
            });
          }}
          testID="scenario-application"
          title="Cycle application"
          variant="secondary"
        />
      </ScenarioCard>

      <SectionHeader
        subtitle="Transport simulation is read by mock services at request time."
        title="Network simulation"
      />

      <ScenarioCard label="Mock transport mode" value={simulation.mode}>
        <Button
          onPress={() => {
            updateSimulation({
              mode: nextValue(simulationOptions, simulation.mode),
            });
          }}
          testID="scenario-transport-mode"
          title="Cycle transport"
          variant="secondary"
        />
        <Button
          onPress={() => {
            updateSimulation({
              latencyMs: simulation.latencyMs === 0 ? 600 : 0,
            });
          }}
          testID="scenario-latency"
          title={simulation.latencyMs === 0 ? 'Add latency' : 'Remove latency'}
          variant="tonal"
        />
      </ScenarioCard>

      <Button
        onPress={resetAll}
        testID="scenario-reset"
        title="Reset deterministic mocks"
        variant="primary"
      />
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ui.spacing[3],
  },
  card: {
    gap: ui.spacing[4],
  },
  cardBody: {
    color: ui.color.text.secondary,
    fontFamily: ui.font.regular,
    fontSize: ui.type.caption.fontSize,
    lineHeight: ui.type.caption.lineHeight,
  },
  cardCopy: {
    flex: 1,
    gap: ui.spacing[1],
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: ui.spacing[3],
  },
  cardTitle: {
    color: ui.color.text.primary,
    fontFamily: ui.font.bold,
    fontSize: ui.type.body.fontSize,
    lineHeight: ui.type.body.lineHeight,
  },
  centered: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});
