import { z } from 'zod';

import {
  type HostRank,
  type HostSummary,
  type Language,
  type Money,
} from '@connecto/domain';

export const discoveryLanguageFilterSchema = z.union([
  z.literal('all'),
  z.enum(['English', 'Hindi', 'Telugu', 'Tamil', 'Kannada', 'Malayalam']),
]);
export type DiscoveryLanguageFilter = z.infer<
  typeof discoveryLanguageFilterSchema
>;

export const discoveryRankFilterSchema = z.union([
  z.literal('all'),
  z.enum(['bronze', 'silver', 'gold', 'platinum', 'diamond']),
]);
export type DiscoveryRankFilter = z.infer<typeof discoveryRankFilterSchema>;

export const discoveryFiltersSchema = z.object({
  language: discoveryLanguageFilterSchema,
  newHostsOnly: z.boolean(),
  onlineOnly: z.boolean(),
  rank: discoveryRankFilterSchema,
  topRated: z.boolean(),
});
export type DiscoveryFilters = z.infer<typeof discoveryFiltersSchema>;

export const defaultDiscoveryFilters: DiscoveryFilters = {
  language: 'all',
  newHostsOnly: false,
  onlineOnly: false,
  rank: 'all',
  topRated: false,
};

export const discoveryPreferencesSchema = z.object({
  blockedHostIds: z.array(z.string().min(1)),
  filters: discoveryFiltersSchema,
});
export type DiscoveryPreferences = z.infer<typeof discoveryPreferencesSchema>;

export const defaultDiscoveryPreferences: DiscoveryPreferences = {
  blockedHostIds: [],
  filters: defaultDiscoveryFilters,
};

const rankWeight: Record<HostRank, number> = {
  bronze: 0,
  diamond: 4,
  gold: 2,
  platinum: 3,
  silver: 1,
};

const availabilityWeight: Record<HostSummary['availability'], number> = {
  busy: 1,
  offline: 3,
  online: 0,
  paused: 2,
};

const preferredWeight = (
  host: HostSummary,
  preferredLanguages: readonly Language[],
) => (preferredLanguages.includes(host.language) ? 0 : 1);

export const supportsDiscoveryAvailability = (
  availability: HostSummary['availability'],
) => availability === 'online' || availability === 'busy';

export const applyDiscoveryFilters = (
  hosts: readonly HostSummary[],
  filters: DiscoveryFilters,
  blockedHostIds: readonly string[],
) =>
  hosts.filter((host) => {
    if (blockedHostIds.includes(host.id)) {
      return false;
    }

    if (!supportsDiscoveryAvailability(host.availability)) {
      return false;
    }

    if (filters.onlineOnly && host.availability !== 'online') {
      return false;
    }

    if (filters.language !== 'all' && host.language !== filters.language) {
      return false;
    }

    if (filters.rank !== 'all' && host.rank !== filters.rank) {
      return false;
    }

    if (filters.topRated && host.rating < 4.7) {
      return false;
    }

    if (filters.newHostsOnly && !host.isNewHost) {
      return false;
    }

    return true;
  });

export const sortDiscoveryHosts = (
  hosts: readonly HostSummary[],
  preferredLanguages: readonly Language[],
) =>
  [...hosts].sort((left, right) => {
    const preferredDelta =
      preferredWeight(left, preferredLanguages) -
      preferredWeight(right, preferredLanguages);

    if (preferredDelta !== 0) {
      return preferredDelta;
    }

    const availabilityDelta =
      availabilityWeight[left.availability] -
      availabilityWeight[right.availability];

    if (availabilityDelta !== 0) {
      return availabilityDelta;
    }

    const rankDelta = rankWeight[right.rank] - rankWeight[left.rank];

    if (rankDelta !== 0) {
      return rankDelta;
    }

    const ratingDelta = right.rating - left.rating;

    if (ratingDelta !== 0) {
      return ratingDelta;
    }

    const completedDelta = right.completedCalls - left.completedCalls;

    if (completedDelta !== 0) {
      return completedDelta;
    }

    return left.displayName.localeCompare(right.displayName);
  });

export const hasPreferredLanguageOnlineHosts = (
  hosts: readonly HostSummary[],
  preferredLanguages: readonly Language[],
) =>
  hosts.some(
    (host) =>
      host.availability === 'online' &&
      preferredLanguages.includes(host.language),
  );

export const paginateDiscoveryHosts = (
  hosts: readonly HostSummary[],
  visibleCount: number,
) => hosts.slice(0, visibleCount);

export const getDiscoveryPriceStrip = (hosts: readonly HostSummary[]) => {
  const voiceFloor = hosts.reduce<Money | null>(
    (lowest, host) =>
      lowest === null || host.voiceRate.amountPaise < lowest.amountPaise
        ? host.voiceRate
        : lowest,
    null,
  );
  const videoFloor = hosts.reduce<Money | null>(
    (lowest, host) =>
      lowest === null || host.videoRate.amountPaise < lowest.amountPaise
        ? host.videoRate
        : lowest,
    null,
  );
  const earliestVideoMinute = hosts.reduce<number | null>(
    (earliest, host) =>
      earliest === null || host.videoAvailableAfterMinutes < earliest
        ? host.videoAvailableAfterMinutes
        : earliest,
    null,
  );

  return {
    earliestVideoMinute,
    videoFloor,
    voiceFloor,
  };
};

export const formatFilterCountLabel = (count: number) =>
  count === 1 ? '1 host shown' : `${String(count)} hosts shown`;
