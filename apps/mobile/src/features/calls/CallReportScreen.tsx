import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';

import { ScrollScreen } from '@/components/layout';
import { BackHeader } from '@/components/ui';
import { EmptyState } from '@/components/ui/surfaces';
import { mobileDataIds } from '@/features/data/mobileDataHooks';
import { appRoutes } from '@/navigation/routes';
import {
  getActiveCallConnectedDurationMs,
  readMonotonicNowMs,
  useActiveCallStore,
} from '@/store/call.store';

import { CallReportComposer } from './CallReportComposer';
import {
  parseCallReportRouteParams,
  type CallReportContext,
} from './call-safety';

export function CallReportScreen() {
  const params = useLocalSearchParams<{
    callId?: string;
    connectedDurationMs?: string;
    hostId?: string;
    hostName?: string;
    mediaMode?: string;
    remainingBalancePaise?: string;
    returnTo?: string | string[];
    sessionId?: string;
  }>();
  const router = useRouter();
  const activeCall = useActiveCallStore();
  const parsedParams = useMemo(
    () => parseCallReportRouteParams(params),
    [params],
  );
  const activeSession = activeCall.activeSession;
  const activeState = activeCall.activeState;
  const returnTo = Array.isArray(params.returnTo)
    ? params.returnTo[0]
    : params.returnTo;
  const backTarget =
    returnTo ??
    (activeState === 'video'
      ? appRoutes.callVideo.path
      : activeState === 'voice'
        ? appRoutes.callVoice.path
        : appRoutes.customerCalls.path);
  const connectedDurationMs =
    activeCall.activeRuntime === null
      ? 0
      : getActiveCallConnectedDurationMs(activeCall, readMonotonicNowMs());

  const activeContext: CallReportContext | null =
    activeSession === null
      ? null
      : {
          callId: activeSession.callId,
          connectedDurationMs,
          customerId: activeSession.customerId,
          hostId: activeSession.hostId,
          hostName: activeSession.hostName,
          mediaMode: activeState === 'video' ? 'video' : 'voice',
          remainingBalancePaise: parsedParams.remainingBalancePaise,
          sessionId: activeSession.id,
        };

  const reportContext: CallReportContext | null =
    activeContext ??
    (parsedParams.callId === undefined ||
    parsedParams.hostId === undefined ||
    parsedParams.hostName === undefined ||
    parsedParams.sessionId === undefined
      ? null
      : {
          callId: parsedParams.callId,
          connectedDurationMs: parsedParams.connectedDurationMs,
          customerId: mobileDataIds.customerId,
          hostId: parsedParams.hostId,
          hostName: parsedParams.hostName,
          mediaMode: parsedParams.mediaMode,
          remainingBalancePaise: parsedParams.remainingBalancePaise,
          sessionId: parsedParams.sessionId,
        });

  return (
    <ScrollScreen testID="call-report-screen">
      <BackHeader
        onPress={() => {
          router.replace(backTarget);
        }}
        title="Report call"
      />
      {reportContext === null ? (
        <EmptyState
          message="Open this screen from an active or recently completed call to send a safety report."
          title="No call context"
        />
      ) : (
        <CallReportComposer
          context={reportContext}
          onCancel={() => {
            router.replace(backTarget);
          }}
          onSubmitted={() => {
            router.replace(backTarget);
          }}
          showSubmitAndEnd={false}
        />
      )}
    </ScrollScreen>
  );
}
