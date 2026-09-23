import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { normalizeApiError } from '@connecto/domain';

import { mobileDataIds } from '@/features/data/mobileDataHooks';

import {
  postCallAdapter,
  type EnsurePostCallRecordInput,
  type SubmitPostCallRatingInput,
  type SubmitPostCallSupportTicketInput,
} from './post-call.adapters';

export const postCallQueryKeys = {
  callRecord: (callId: string) => ['post-call', 'call', callId] as const,
  callRecords: (customerId: string) =>
    ['post-call', 'calls', customerId] as const,
  supportTicket: (ticketId: string) =>
    ['post-call', 'support-ticket', ticketId] as const,
  supportTickets: (customerId: string) =>
    ['post-call', 'support-tickets', customerId] as const,
} as const;

export const invalidatePostCallQueries = async (
  queryClient: ReturnType<typeof useQueryClient>,
  callId?: string | null,
) => {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: [...postCallQueryKeys.callRecords(mobileDataIds.customerId)],
    }),
    queryClient.invalidateQueries({
      queryKey: [...postCallQueryKeys.supportTickets(mobileDataIds.customerId)],
    }),
    ...(callId === undefined || callId === null
      ? []
      : [
          queryClient.invalidateQueries({
            queryKey: [...postCallQueryKeys.callRecord(callId)],
          }),
        ]),
  ]);
};

export const usePostCallRecordsQuery = () =>
  useQuery({
    queryFn: () => postCallAdapter.listCallRecords(mobileDataIds.customerId),
    queryKey: postCallQueryKeys.callRecords(mobileDataIds.customerId),
  });

export const usePostCallRecordQuery = (
  callId: string | null,
  seed?: EnsurePostCallRecordInput | null,
) =>
  useQuery({
    enabled: callId !== null,
    queryFn: async () => {
      if (callId === null) {
        return null;
      }

      if (seed !== undefined && seed !== null) {
        return postCallAdapter.ensureCallRecord(seed);
      }

      return postCallAdapter.getCallRecord(callId);
    },
    queryKey:
      callId === null
        ? ['post-call', 'call', 'missing']
        : postCallQueryKeys.callRecord(callId),
  });

export const usePostCallSupportTicketsQuery = () =>
  useQuery({
    queryFn: () => postCallAdapter.listSupportTickets(mobileDataIds.customerId),
    queryKey: postCallQueryKeys.supportTickets(mobileDataIds.customerId),
  });

export const usePostCallSupportTicketQuery = (ticketId: string | null) =>
  useQuery({
    enabled: ticketId !== null,
    queryFn: () =>
      ticketId === null
        ? Promise.resolve(null)
        : postCallAdapter.getSupportTicket(ticketId),
    queryKey:
      ticketId === null
        ? ['post-call', 'support-ticket', 'missing']
        : postCallQueryKeys.supportTicket(ticketId),
  });

export const useSubmitPostCallRatingMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SubmitPostCallRatingInput) =>
      postCallAdapter.submitRating(input),
    onSuccess: async (_, input) => {
      await invalidatePostCallQueries(queryClient, input.callId);
    },
  });
};

export const useSubmitPostCallSupportTicketMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SubmitPostCallSupportTicketInput) =>
      postCallAdapter.submitSupportTicket(input),
    onSuccess: async (_, input) => {
      await invalidatePostCallQueries(queryClient, input.linkedCallId);
    },
  });
};

export const useCreatePostCallEvidenceMetadata = () =>
  useMutation({
    mutationFn: (input: { callId?: string | undefined }) =>
      postCallAdapter.createEvidenceMetadata(input),
  });

export const normalizePostCallErrorMessage = (error: unknown) =>
  normalizeApiError(error).message;
