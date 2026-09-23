# ADR-005: Provider Adapters

Status: Accepted
Date: 2026-08-18

## Context

OTP, RTC, payments, payouts, object storage, moderation, tagging, and
notifications all need local deterministic fakes and production adapters.
Scattered provider conditionals would make safety review and failure handling
hard to reason about.

## Decision

Each provider boundary is selected by configuration and hidden behind a module
adapter. Local development uses deterministic fake adapters. Production selects
real adapters through validated backend environment variables.

## Consequences

- Frontend and backend tests can run against stable fakes.
- Secrets stay inside backend runtime configuration.
- Swapping providers remains a bounded infrastructure change instead of an
  application rewrite.
