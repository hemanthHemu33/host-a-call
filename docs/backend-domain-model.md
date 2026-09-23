# Backend Domain Model

Date: 2026-08-21

Prompt 06 establishes the backend-owned canonical domain layer before adding
more feature controllers. Frontend DTOs remain available from `@connecto/domain`;
backend aggregates are exported separately as `canonicalModels` and
`canonicalStateMachines` to avoid name collisions.

## Aggregate Catalog

`canonicalModels` defines these production aggregates:

| Aggregate            | Backend ownership                                                  |
| -------------------- | ------------------------------------------------------------------ |
| Account              | Role, lifecycle state, deletion state, phone hash, version         |
| CustomerProfile      | DOB, gender, languages, notification permission, wallet link       |
| HostProfile          | Application link, availability, rank, rating, public profile       |
| HostApplication      | Application state, required actions, terms version                 |
| VoiceVerification    | Upload/review/decision state for host voice proof                  |
| SelfIntroduction     | Versioned intro media/text hash and moderation state               |
| AudioStatus          | Host audio availability, rejection/mute/suspension reason          |
| MindPost             | Text hash, language, moderation state, matching tags               |
| Tag                  | Normalized matching taxonomy with active/deprecated/blocked state  |
| Availability         | Host availability state and source                                 |
| Call                 | Intent state, live state, RTC channel, timer and pricing snapshots |
| CallParticipant      | Immutable participant snapshot at call time                        |
| MediaSegment         | Voice/video media lifecycle segment                                |
| PricingSnapshot      | Immutable rates, commission, rank, and configuration version       |
| LedgerTransaction    | Immutable double-entry transaction snapshot                        |
| Payment              | Provider order and payment lifecycle                               |
| Earning              | Host earning lifecycle tied to call and ledger entry               |
| RankSnapshot         | Rank score and input snapshot                                      |
| Withdrawal           | Payout request/provider lifecycle                                  |
| Referral             | Qualification/reward lifecycle                                     |
| Refund               | Request/decision/provider settlement lifecycle                     |
| Report               | Safety/moderation lifecycle with text hash/evidence ids            |
| SupportTicket        | Ticket lifecycle and attachment ids                                |
| Notification         | Delivery/read lifecycle and template payload                       |
| ConfigurationVersion | Active feature, pricing, rank, and legal policy snapshot           |
| AuditEvent           | Redacted domain audit envelope                                     |

All money is represented as integer paise through the shared `Money` schema.
Free-text report/support/audio material is represented by hashes or asset ids in
canonical fixtures and audit events.

## State Machines

Named command machines are implemented for:

- account
- account deletion
- host application
- voice verification
- call intent
- live call/media
- payment
- refund
- earning settlement
- withdrawal
- referral qualification
- report

Invalid commands throw `DomainCommandError`. Duplicate `commandId` values return
the existing aggregate state without emitting another domain event. Rejected
security-sensitive commands include a redacted `AuditEvent` payload for callers
to persist.

## Persistence

Migration `0006_canonical_domain_state_machines.sql` adds canonical aggregate
tables, immutable pricing/ledger/rank snapshot tables, `audit_events`,
`domain_transition_definitions`, and `aggregate_state_transitions`. It also
widens earlier status/rank checks to match the canonical enums.

`recordDomainTransitionWithOutbox` inserts `aggregate_state_transitions` and the
matching `outbox_events` row using one PostgreSQL transaction client. The worker
is still the only publisher, so domain events are observable only after the
transaction commits.

## Adoption Rule

New mutating routes, provider webhooks, Socket.IO handlers, and worker jobs must
execute the canonical command first, persist the aggregate update and transition
history in the same transaction, and publish follow-up work only through the
transactional outbox.
