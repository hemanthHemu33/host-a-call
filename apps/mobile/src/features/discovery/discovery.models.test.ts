import { describe, expect, it } from 'vitest';

import { fixtureHosts, type HostSummary } from '@connecto/domain';

import {
  applyDiscoveryFilters,
  defaultDiscoveryFilters,
  formatFilterCountLabel,
  getDiscoveryPriceStrip,
  hasPreferredLanguageOnlineHosts,
  sortDiscoveryHosts,
} from './discovery.models';

const hostAt = (index: number): HostSummary => {
  const host = fixtureHosts[index];

  if (host === undefined) {
    throw new Error(`Missing host fixture at index ${String(index)}.`);
  }

  return host;
};

describe('discovery models', () => {
  it('prioritizes preferred-language online hosts before other results', () => {
    const hosts: HostSummary[] = [
      {
        ...hostAt(1),
        availability: 'online',
        displayName: 'Hindi Host',
        id: 'host_hindi',
        language: 'Hindi',
      },
      {
        ...hostAt(2),
        availability: 'busy',
        displayName: 'Busy Telugu Host',
        id: 'host_telugu_busy',
        language: 'Telugu',
      },
      {
        ...hostAt(3),
        availability: 'online',
        displayName: 'Online Telugu Host',
        id: 'host_telugu_online',
        language: 'Telugu',
      },
    ];

    expect(
      sortDiscoveryHosts(hosts, ['Telugu']).map((host) => host.id),
    ).toEqual(['host_telugu_online', 'host_telugu_busy', 'host_hindi']);
  });

  it('filters blocked, paused, and unmatched hosts deterministically', () => {
    const results = applyDiscoveryFilters(
      fixtureHosts.slice(0, 10),
      {
        ...defaultDiscoveryFilters,
        language: 'Telugu',
        onlineOnly: true,
        topRated: true,
      },
      ['host_007'],
    );

    expect(results.every((host) => host.availability === 'online')).toBe(true);
    expect(results.every((host) => host.language === 'Telugu')).toBe(true);
    expect(results.every((host) => host.rating >= 4.7)).toBe(true);
    expect(results.some((host) => host.id === 'host_007')).toBe(false);
  });

  it('detects fallback-language situations and derives pricing labels', () => {
    const otherLanguageHosts: HostSummary[] = [
      {
        ...hostAt(4),
        availability: 'online',
        id: 'host_other_1',
        language: 'Hindi',
        videoAvailableAfterMinutes: 5,
        videoRate: { amountPaise: 1900, currency: 'INR' },
        voiceRate: { amountPaise: 900, currency: 'INR' },
      },
      {
        ...hostAt(5),
        availability: 'busy',
        id: 'host_other_2',
        language: 'Tamil',
        videoAvailableAfterMinutes: 3,
        videoRate: { amountPaise: 1600, currency: 'INR' },
        voiceRate: { amountPaise: 800, currency: 'INR' },
      },
    ];

    expect(
      hasPreferredLanguageOnlineHosts(otherLanguageHosts, ['Telugu']),
    ).toBe(false);
    expect(getDiscoveryPriceStrip(otherLanguageHosts)).toEqual({
      earliestVideoMinute: 3,
      videoFloor: { amountPaise: 1600, currency: 'INR' },
      voiceFloor: { amountPaise: 800, currency: 'INR' },
    });
    expect(formatFilterCountLabel(1)).toBe('1 host shown');
    expect(formatFilterCountLabel(18)).toBe('18 hosts shown');
  });
});
