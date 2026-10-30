# UI Backend Traceability

> **Historical traceability map.** Its `/v1` routes and `backend/apps` owners
> refer to the retired PostgreSQL backend. Map UI work to Samvad's Swagger and
> controllers instead; see [API source of truth](./api-source-of-truth.md).

Date: 2026-08-21

Source manifest:
`C:\Users\heman\Desktop\connecto-backend-flow-screenshots-20260817-235953\manifest.csv`

The manifest contains 151 captured states across 80 unique deep-link routes.
Every production-facing state below maps to a backend endpoint, event,
background job, provider callback, client-owned behavior, or typed
unavailable/empty/error state. Internal QA and gallery routes are classified as
non-production and are disabled in production by route guards.

Prompt 05 adds generated `/v1` contract artifacts for this traceability map:
`docs/contracts/openapi-v1.json`, `docs/contracts/contract-manifest.json`, and
`docs/contracts/v1-client.ts`. The screenshot rows keep their product-level
owners below; exact REST paths, WebSocket event names, webhook paths,
idempotency requirements, and ETag rules are now enforced by
`@connecto/api-contracts`.

Prompt 06 adds canonical backend aggregate schemas, immutable pricing/ledger/rank
snapshots, and command state machines in `@connecto/domain`, plus migration
`0006_canonical_domain_state_machines.sql` for transition definitions and
history. Production state changes must move through those named commands and
then into the transactional outbox.

## V1 Runtime Ownership

- HTTP routes, public commands, admin commands, and future Socket.IO event entry
  all terminate in `backend/apps/api`.
- Outbox dispatch, reconciliation, moderation, notification fan-out, and payout
  follow-up jobs terminate in `backend/apps/worker`.
- Runtime liveness/readiness is now implemented through API `/livez`, `/readyz`,
  `/healthz`, and worker health endpoints on `WORKER_HEALTH_PORT`.
- App bootstrap/config states are now owned by `GET /v1/app/bootstrap`; the server
  computes minimum-build, blocked-build, maintenance, legal-version, language,
  and feature availability decisions.
- Deep-link states are owned by `POST /v1/deep-links/resolve` with a server
  allowlist and resource authorization at open time.
- `@connecto/backend-runtime` owns shared redacted logging, provider fakes and
  provider registry selection, PostgreSQL/Redis readiness, migration
  validation/application, deterministic seed data, and transactional outbox
  polling primitives.
- Mutating `/v1` routes reserve/replay idempotency keys through
  `idempotency_records`; admin commands also write `admin_audit_log` when the
  API runtime is backed by PostgreSQL.
- DB-backed `/v1` handlers now own call intents/sessions/finalization,
  host ranks/earnings, payments, wallet balances, withdrawals, refunds,
  reports, support tickets, media upload intents, push-token persistence,
  notification read state, and admin dashboard/queues.
- Canonical state machines now own account, account deletion, host application,
  voice verification, call intent, live call/media, payment, refund, earning
  settlement, withdrawal, referral qualification, and report transitions.
- DB-backed call, payment, withdrawal, refund, report, host review, account
  deletion, host verification, match-tag, self-introduction, and daily-status
  `/v1` handlers now execute named canonical command helpers where they mutate
  domain state and record the transition with `recordDomainTransitionWithOutbox`.
- Signed upload assets now persist owner, expiry, redaction classification, and
  review status. Redacted admin media review screens are owned by
  `GET /v1/admin/media-reviews`, `GET /v1/admin/media-reviews/{reviewId}`, and
  `POST /v1/admin/media-reviews/{reviewId}/decision`.
- Worker dispatch now processes `call.billing_tick_due`, `media.asset_completed`,
  `host.self_introduction_changed`, `host.daily_status_changed`, and
  `matching.tags_changed` from PostgreSQL outbox rows into billing
  reconciliation, media review, and discovery invalidation records.
- Provider callback finalization for RTC, Razorpay, payout, object storage, and
  FCM now requires `X-Provider-Event-Id` plus `X-Provider-Signature`; fake mode
  accepts deterministic signatures and sandbox/live modes resolve server-only
  webhook secrets from the configured secret store boundary.
- Immutable pricing, commission, rank, configuration, participant, call, and
  ledger snapshots are now modeled so historical call and money rows do not
  change when profiles or runtime configuration change later.
- Prompt 07 database safeguards now enforce one active refresh-token family per
  device hash, one published audio status per host per India date, one rating
  per connected customer call, globally unique provider event IDs, unique
  referral attribution, balanced ledger entries, private/public host profile
  separation, and indexed access paths documented in
  `docs/backend-query-plans-and-constraints.md`.
- PostgreSQL-backed admin requests are authorized through persisted
  `admin_sessions`, `admin_users`, role grants, and `admin_permissions`; the
  audit viewer is `GET /v1/admin/audit-log`.
- Provider fakes remain deterministic locally. Sandbox/live OTP, Agora,
  Razorpay, payout, object storage, moderation, tagging, and FCM boundaries are
  selected centrally through runtime configuration and server-only secrets.
- PostgreSQL remains the source of truth for every production-facing state in
  the table below.
- Redis is limited to ephemeral presence, locks, throttles, cache, Socket.IO
  coordination, and worker queue coordination. Key namespace, TTL ownership,
  maximum cache staleness, and degraded behavior are specified in
  `docs/backend-redis-coordination.md`.

## Captured State Map

| #   | Section             | Screen                                 | Route                                                           | State     | Owner                                               | Classification                                 |
| --- | ------------------- | -------------------------------------- | --------------------------------------------------------------- | --------- | --------------------------------------------------- | ---------------------------------------------- |
| 1   | public              | login_initial_after_clean_launch       | `connecto://expo-development-client/?url=http://127.0.0.1:8081` | top       | App bootstrap/config                                | endpoint                                       |
| 2   | public              | age_confirmation                       | `connecto:///(auth)/age-confirmation`                           | top       | Auth, age gate, account status, referral validation | endpoint                                       |
| 3   | public              | referral_code_entry                    | `connecto:///(auth)/referral-code`                              | top       | Auth, age gate, account status, referral validation | endpoint                                       |
| 4   | public              | blocked_account                        | `connecto:///(auth)/blocked-account`                            | top       | Auth, age gate, account status, referral validation | endpoint                                       |
| 5   | public              | suspended_account                      | `connecto:///(auth)/suspended-account`                          | top       | Auth, age gate, account status, referral validation | endpoint                                       |
| 6   | public              | underage_block                         | `connecto:///(auth)/underage-block`                             | top       | Auth, age gate, account status, referral validation | endpoint                                       |
| 7   | public              | mandatory_update                       | `connecto://mandatory-update`                                   | top       | App bootstrap/config                                | endpoint                                       |
| 8   | public              | invalid_link                           | `connecto://invalid-link`                                       | top       | Deep-link validation boundary                       | typed unavailable/error state                  |
| 9   | public              | legal_terms                            | `connecto://legal/terms`                                        | top       | Legal content/version acceptance                    | endpoint                                       |
| 10  | public              | legal_terms                            | `connecto://legal/terms`                                        | scroll1   | Legal content/version acceptance                    | endpoint                                       |
| 11  | public              | legal_privacy                          | `connecto://legal/privacy`                                      | top       | Legal content/version acceptance                    | endpoint                                       |
| 12  | public              | legal_privacy                          | `connecto://legal/privacy`                                      | scroll1   | Legal content/version acceptance                    | endpoint                                       |
| 13  | public              | legal_community_guidelines             | `connecto://legal/community-guidelines`                         | top       | Legal content/version acceptance                    | endpoint                                       |
| 14  | public              | legal_community_guidelines             | `connecto://legal/community-guidelines`                         | scroll1   | Legal content/version acceptance                    | endpoint                                       |
| 15  | public_links        | referral_link                          | `connecto://referral/CONNECTO100`                               | top       | Referral invite resolution                          | endpoint                                       |
| 16  | public_links        | support_ticket_link                    | `connecto://link/support-ticket/ticket_1`                       | top       | Support ticket lookup/deep link                     | endpoint                                       |
| 17  | public_links        | payment_result_link                    | `connecto://link/payment-result`                                | top       | Payment callback/result verification                | provider callback + endpoint                   |
| 18  | public_links        | notification_link                      | `connecto://link/notification/calls`                            | top       | Notification deep-link routing                      | event + endpoint                               |
| 19  | public_links        | call_invitation_link                   | `connecto://link/call-invitation/invitation_1`                  | top       | Call invitation resolution                          | event + endpoint                               |
| 20  | auth_flow           | login_empty                            | `connecto:///(auth)/login`                                      | top       | Auth, age gate, account status, referral validation | endpoint                                       |
| 21  | auth_flow           | login_filled_new_customer              | `connecto:///(auth)/login`                                      | filled    | Auth, age gate, account status, referral validation | endpoint                                       |
| 22  | auth_flow           | otp_entry                              | `connecto:///(auth)/otp`                                        | top       | Auth, age gate, account status, referral validation | endpoint                                       |
| 23  | auth_flow           | otp_filled                             | `connecto:///(auth)/otp`                                        | filled    | Auth, age gate, account status, referral validation | endpoint                                       |
| 24  | customer_onboarding | profile_setup_empty                    | `connecto:///(customer-onboarding)/profile-setup`               | top       | Customer onboarding and host-applicant conversion   | endpoint + job                                 |
| 25  | customer_onboarding | profile_setup_filled_host_applicant    | `connecto:///(customer-onboarding)/profile-setup`               | filled    | Customer onboarding and host-applicant conversion   | endpoint + job                                 |
| 26  | customer_onboarding | language_selection                     | `connecto:///(customer-onboarding)/language`                    | top       | Customer onboarding and host-applicant conversion   | endpoint + job                                 |
| 27  | customer_onboarding | language_selection_telugu              | `connecto:///(customer-onboarding)/language`                    | selected  | Customer onboarding and host-applicant conversion   | endpoint + job                                 |
| 28  | customer_onboarding | match_tags                             | `connecto:///(customer-onboarding)/match-tags`                  | top       | Customer onboarding and host-applicant conversion   | endpoint + job                                 |
| 29  | customer_onboarding | match_tags_selected                    | `connecto:///(customer-onboarding)/match-tags`                  | selected  | Customer onboarding and host-applicant conversion   | endpoint + job                                 |
| 30  | customer_onboarding | permissions_review                     | `connecto:///(customer-onboarding)/permissions`                 | top       | Customer onboarding and host-applicant conversion   | endpoint + job                                 |
| 31  | customer_onboarding | voice_verification_initial             | `connecto:///(customer-onboarding)/voice-verification`          | top       | Customer onboarding and host-applicant conversion   | endpoint + job                                 |
| 32  | customer_onboarding | voice_verification_recording           | `connecto:///(customer-onboarding)/voice-verification`          | recording | Customer onboarding and host-applicant conversion   | endpoint + job                                 |
| 33  | customer_onboarding | voice_verification_recorded            | `connecto:///(customer-onboarding)/voice-verification`          | recorded  | Customer onboarding and host-applicant conversion   | endpoint + job                                 |
| 34  | customer_onboarding | host_approval_pending                  | `connecto:///(customer-onboarding)/host-approval`               | top       | Customer onboarding and host-applicant conversion   | endpoint + job                                 |
| 35  | customer_onboarding | host_agreement                         | `connecto:///(customer-onboarding)/host-agreement`              | top       | Customer onboarding and host-applicant conversion   | endpoint + job                                 |
| 36  | customer_onboarding | host_agreement_accepted                | `connecto:///(customer-onboarding)/host-agreement`              | accepted  | Customer onboarding and host-applicant conversion   | endpoint + job                                 |
| 37  | host_flow           | post_application_host_dashboard        | `connecto:///(host)/dashboard`                                  | top       | Host dashboard/availability/earnings                | endpoint + event                               |
| 38  | internal            | developer_scenarios_before_seed        | `connecto://developer-scenarios`                                | top       | Client-only QA tooling                              | non-production                                 |
| 39  | customer            | home                                   | `connecto:///(customer)/home`                                   | top       | Discovery, wallet, host ranking                     | endpoint                                       |
| 40  | customer            | home                                   | `connecto:///(customer)/home`                                   | scroll1   | Discovery, wallet, host ranking                     | endpoint                                       |
| 41  | customer            | filters                                | `connecto:///(customer)/filters`                                | top       | Discovery filter metadata/preferences               | client-owned + endpoint                        |
| 42  | customer            | calls                                  | `connecto:///(customer)/calls`                                  | top       | Call history/detail/post-call summary               | endpoint                                       |
| 43  | customer            | calls                                  | `connecto:///(customer)/calls`                                  | scroll1   | Call history/detail/post-call summary               | endpoint                                       |
| 44  | customer            | call_detail                            | `connecto:///(customer)/calls/call_1`                           | top       | Call history/detail/post-call summary               | endpoint                                       |
| 45  | customer            | call_detail                            | `connecto:///(customer)/calls/call_1`                           | scroll1   | Call history/detail/post-call summary               | endpoint                                       |
| 46  | customer            | profile                                | `connecto:///(customer)/profile`                                | top       | Profile and media upload                            | endpoint                                       |
| 47  | customer            | profile                                | `connecto:///(customer)/profile`                                | scroll1   | Profile and media upload                            | endpoint                                       |
| 48  | customer            | profile_edit                           | `connecto:///(customer)/profile-edit`                           | top       | Profile and media upload                            | endpoint                                       |
| 49  | customer            | profile_edit                           | `connecto:///(customer)/profile-edit`                           | scroll1   | Profile and media upload                            | endpoint                                       |
| 50  | customer            | profile_edit                           | `connecto:///(customer)/profile-edit`                           | scroll2   | Profile and media upload                            | endpoint                                       |
| 51  | customer            | settings                               | `connecto:///(customer)/settings`                               | top       | Settings/preferences                                | endpoint or client-owned                       |
| 52  | customer            | settings                               | `connecto:///(customer)/settings`                               | scroll1   | Settings/preferences                                | endpoint or client-owned                       |
| 53  | customer            | language_settings                      | `connecto:///(customer)/language-settings`                      | top       | Settings/preferences                                | endpoint or client-owned                       |
| 54  | customer            | language_settings                      | `connecto:///(customer)/language-settings`                      | scroll1   | Settings/preferences                                | endpoint or client-owned                       |
| 55  | customer            | motion_settings                        | `connecto:///(customer)/motion-settings`                        | top       | Settings/preferences                                | endpoint or client-owned                       |
| 56  | customer            | motion_settings                        | `connecto:///(customer)/motion-settings`                        | scroll1   | Settings/preferences                                | endpoint or client-owned                       |
| 57  | customer            | notifications                          | `connecto:///(customer)/notifications`                          | top       | Notification deep-link routing                      | event + endpoint                               |
| 58  | customer            | notifications                          | `connecto:///(customer)/notifications`                          | scroll1   | Notification deep-link routing                      | event + endpoint                               |
| 59  | customer            | notification_preferences               | `connecto:///(customer)/notification-preferences`               | top       | Notification deep-link routing                      | event + endpoint                               |
| 60  | customer            | notification_preferences               | `connecto:///(customer)/notification-preferences`               | scroll1   | Notification deep-link routing                      | event + endpoint                               |
| 61  | customer            | privacy_safety                         | `connecto:///(customer)/privacy-safety`                         | top       | Safety, reports, block list                         | endpoint                                       |
| 62  | customer            | privacy_safety                         | `connecto:///(customer)/privacy-safety`                         | scroll1   | Safety, reports, block list                         | endpoint                                       |
| 63  | customer            | blocked_users                          | `connecto:///(customer)/blocked-users`                          | top       | Safety, reports, block list                         | endpoint                                       |
| 64  | customer            | report_history                         | `connecto:///(customer)/report-history`                         | top       | Safety, reports, block list                         | endpoint                                       |
| 65  | customer            | report_history                         | `connecto:///(customer)/report-history`                         | scroll1   | Safety, reports, block list                         | endpoint                                       |
| 66  | customer            | delete_account                         | `connecto:///(customer)/delete-account`                         | top       | Delete-account eligibility/request                  | endpoint + job                                 |
| 67  | customer            | delete_account                         | `connecto:///(customer)/delete-account`                         | scroll1   | Delete-account eligibility/request                  | endpoint + job                                 |
| 68  | customer            | add_money                              | `connecto:///(customer)/add-money`                              | top       | Wallet, payments, ledger                            | endpoint + provider callback + job             |
| 69  | customer            | payment_states                         | `connecto:///(customer)/payment-states`                         | top       | Wallet, payments, ledger                            | endpoint + provider callback + job             |
| 70  | customer            | payment_states                         | `connecto:///(customer)/payment-states`                         | scroll1   | Wallet, payments, ledger                            | endpoint + provider callback + job             |
| 71  | customer            | referrals                              | `connecto:///(customer)/referrals`                              | top       | Referral overview/history/rewards                   | endpoint + job                                 |
| 72  | customer            | referrals                              | `connecto:///(customer)/referrals`                              | scroll1   | Referral overview/history/rewards                   | endpoint + job                                 |
| 73  | customer            | referral_detail                        | `connecto:///(customer)/referrals/referral_1`                   | top       | Referral overview/history/rewards                   | endpoint + job                                 |
| 74  | customer            | referral_detail                        | `connecto:///(customer)/referrals/referral_1`                   | scroll1   | Referral overview/history/rewards                   | endpoint + job                                 |
| 75  | customer            | support                                | `connecto:///(customer)/support`                                | top       | Support tickets/messages                            | endpoint + job                                 |
| 76  | customer            | support                                | `connecto:///(customer)/support`                                | scroll1   | Support tickets/messages                            | endpoint + job                                 |
| 77  | customer            | support_ticket                         | `connecto:///(customer)/support-ticket/ticket_1`                | top       | Support ticket lookup/deep link                     | endpoint                                       |
| 78  | customer            | support_ticket                         | `connecto:///(customer)/support-ticket/ticket_1`                | scroll1   | Support ticket lookup/deep link                     | endpoint                                       |
| 79  | customer            | transaction_detail                     | `connecto:///(customer)/transaction/transaction_1`              | top       | Wallet, payments, ledger                            | endpoint + provider callback + job             |
| 80  | customer            | transaction_detail                     | `connecto:///(customer)/transaction/transaction_1`              | scroll1   | Wallet, payments, ledger                            | endpoint + provider callback + job             |
| 81  | customer_calls      | outgoing_call                          | `connecto://call/outgoing`                                      | top       | Call intent/ringing dispatch                        | endpoint + WebSocket event                     |
| 82  | customer_calls      | voice_call                             | `connecto://call/voice`                                         | top       | Active call session, RTC, billing                   | endpoint + WebSocket event + provider callback |
| 83  | customer_calls      | video_request                          | `connecto://call/video-request`                                 | top       | Active call session, RTC, billing                   | endpoint + WebSocket event + provider callback |
| 84  | customer_calls      | video_call                             | `connecto://call/video`                                         | top       | Active call session, RTC, billing                   | endpoint + WebSocket event + provider callback |
| 85  | customer_calls      | reconnecting                           | `connecto://call/reconnecting`                                  | top       | Active call session, RTC, billing                   | endpoint + WebSocket event + provider callback |
| 86  | customer_calls      | report_call                            | `connecto://call/report`                                        | top       | Call safety report/evidence                         | endpoint + job                                 |
| 87  | customer_calls      | report_call                            | `connecto://call/report`                                        | scroll1   | Call safety report/evidence                         | endpoint + job                                 |
| 88  | customer_calls      | call_summary                           | `connecto://call/summary`                                       | top       | Post-call finalization/rating/refund context        | endpoint + job                                 |
| 89  | customer_calls      | call_summary                           | `connecto://call/summary`                                       | scroll1   | Post-call finalization/rating/refund context        | endpoint + job                                 |
| 90  | internal            | developer_scenarios_before_seed        | `connecto://developer-scenarios`                                | top       | Client-only QA tooling                              | non-production                                 |
| 91  | internal            | developer_scenarios_before_host_toggle | `connecto://developer-scenarios`                                | top       | Client-only QA tooling                              | non-production                                 |
| 92  | host_onboarding     | profile_setup                          | `connecto:///(host-onboarding)/host-profile-setup`              | top       | Host application, verification, payout onboarding   | endpoint + job                                 |
| 93  | host_onboarding     | profile_setup                          | `connecto:///(host-onboarding)/host-profile-setup`              | scroll1   | Host application, verification, payout onboarding   | endpoint + job                                 |
| 94  | host_onboarding     | photo                                  | `connecto:///(host-onboarding)/photo`                           | top       | Host application, verification, payout onboarding   | endpoint + job                                 |
| 95  | host_onboarding     | photo                                  | `connecto:///(host-onboarding)/photo`                           | scroll1   | Host application, verification, payout onboarding   | endpoint + job                                 |
| 96  | host_onboarding     | rules                                  | `connecto:///(host-onboarding)/rules`                           | top       | Host application, verification, payout onboarding   | endpoint + job                                 |
| 97  | host_onboarding     | rules                                  | `connecto:///(host-onboarding)/rules`                           | scroll1   | Host application, verification, payout onboarding   | endpoint + job                                 |
| 98  | host_onboarding     | verification                           | `connecto:///(host-onboarding)/verification`                    | top       | Host application, verification, payout onboarding   | endpoint + job                                 |
| 99  | host_onboarding     | verification                           | `connecto:///(host-onboarding)/verification`                    | scroll1   | Host application, verification, payout onboarding   | endpoint + job                                 |
| 100 | host_onboarding     | payout                                 | `connecto:///(host-onboarding)/payout`                          | top       | Host application, verification, payout onboarding   | endpoint + job                                 |
| 101 | host_onboarding     | payout                                 | `connecto:///(host-onboarding)/payout`                          | scroll1   | Host application, verification, payout onboarding   | endpoint + job                                 |
| 102 | host_onboarding     | agreement                              | `connecto:///(host-onboarding)/agreement`                       | top       | Host application, verification, payout onboarding   | endpoint + job                                 |
| 103 | host_onboarding     | agreement                              | `connecto:///(host-onboarding)/agreement`                       | scroll1   | Host application, verification, payout onboarding   | endpoint + job                                 |
| 104 | host_onboarding     | application_states                     | `connecto:///(host-onboarding)/application-states`              | top       | Host application, verification, payout onboarding   | endpoint + job                                 |
| 105 | host_onboarding     | application_states                     | `connecto:///(host-onboarding)/application-states`              | scroll1   | Host application, verification, payout onboarding   | endpoint + job                                 |
| 106 | host                | dashboard                              | `connecto:///(host)/dashboard`                                  | top       | Host dashboard/availability/earnings                | endpoint + event                               |
| 107 | host                | dashboard                              | `connecto:///(host)/dashboard`                                  | scroll1   | Host dashboard/availability/earnings                | endpoint + event                               |
| 108 | host                | calls                                  | `connecto:///(host)/calls`                                      | top       | Call history/detail/post-call summary               | endpoint                                       |
| 109 | host                | calls                                  | `connecto:///(host)/calls`                                      | scroll1   | Call history/detail/post-call summary               | endpoint                                       |
| 110 | host                | recent                                 | `connecto:///(host)/recent`                                     | top       | Host recent call activity                           | endpoint                                       |
| 111 | host                | recent                                 | `connecto:///(host)/recent`                                     | scroll1   | Host recent call activity                           | endpoint                                       |
| 112 | host                | earnings                               | `connecto:///(host)/earnings`                                   | top       | Host earnings ledger                                | endpoint                                       |
| 113 | host                | earnings                               | `connecto:///(host)/earnings`                                   | scroll1   | Host earnings ledger                                | endpoint                                       |
| 114 | host                | withdrawal                             | `connecto:///(host)/withdrawal`                                 | top       | Withdrawal request/history                          | endpoint + job + provider callback             |
| 115 | host                | withdrawal                             | `connecto:///(host)/withdrawal`                                 | scroll1   | Withdrawal request/history                          | endpoint + job + provider callback             |
| 116 | host                | profile                                | `connecto:///(host)/profile`                                    | top       | Profile and media upload                            | endpoint                                       |
| 117 | host                | profile                                | `connecto:///(host)/profile`                                    | scroll1   | Profile and media upload                            | endpoint                                       |
| 118 | host                | profile_edit                           | `connecto:///(host)/profile-edit`                               | top       | Profile and media upload                            | endpoint                                       |
| 119 | host                | profile_edit                           | `connecto:///(host)/profile-edit`                               | scroll1   | Profile and media upload                            | endpoint                                       |
| 120 | host                | profile_edit                           | `connecto:///(host)/profile-edit`                               | scroll2   | Profile and media upload                            | endpoint                                       |
| 121 | host                | bank_account_add                       | `connecto:///(host)/bank-account-add`                           | top       | Payout method tokenization                          | endpoint + provider callback                   |
| 122 | host                | bank_account_add                       | `connecto:///(host)/bank-account-add`                           | scroll1   | Payout method tokenization                          | endpoint + provider callback                   |
| 123 | host                | referrals                              | `connecto:///(host)/referrals`                                  | top       | Referral overview/history/rewards                   | endpoint + job                                 |
| 124 | host                | referrals                              | `connecto:///(host)/referrals`                                  | scroll1   | Referral overview/history/rewards                   | endpoint + job                                 |
| 125 | host                | settings                               | `connecto:///(host)/settings`                                   | top       | Settings/preferences                                | endpoint or client-owned                       |
| 126 | host                | settings                               | `connecto:///(host)/settings`                                   | scroll1   | Settings/preferences                                | endpoint or client-owned                       |
| 127 | host                | leaderboard                            | `connecto:///(host)/leaderboard`                                | top       | Ranking/leaderboard                                 | endpoint + job                                 |
| 128 | host                | leaderboard                            | `connecto:///(host)/leaderboard`                                | scroll1   | Ranking/leaderboard                                 | endpoint + job                                 |
| 129 | host_calls          | incoming_call                          | `connecto://call/incoming`                                      | top       | Call intent/ringing dispatch                        | endpoint + WebSocket event                     |
| 130 | host_calls          | voice_call                             | `connecto://call/voice`                                         | top       | Active call session, RTC, billing                   | endpoint + WebSocket event + provider callback |
| 131 | host_calls          | video_request                          | `connecto://call/video-request`                                 | top       | Active call session, RTC, billing                   | endpoint + WebSocket event + provider callback |
| 132 | host_calls          | video_call                             | `connecto://call/video`                                         | top       | Active call session, RTC, billing                   | endpoint + WebSocket event + provider callback |
| 133 | host_calls          | reconnecting                           | `connecto://call/reconnecting`                                  | top       | Active call session, RTC, billing                   | endpoint + WebSocket event + provider callback |
| 134 | host_calls          | report_call                            | `connecto://call/report`                                        | top       | Call safety report/evidence                         | endpoint + job                                 |
| 135 | host_calls          | report_call                            | `connecto://call/report`                                        | scroll1   | Call safety report/evidence                         | endpoint + job                                 |
| 136 | host_calls          | call_summary                           | `connecto://call/summary`                                       | top       | Post-call finalization/rating/refund context        | endpoint + job                                 |
| 137 | host_calls          | call_summary                           | `connecto://call/summary`                                       | scroll1   | Post-call finalization/rating/refund context        | endpoint + job                                 |
| 138 | internal            | developer_scenarios                    | `connecto://developer-scenarios`                                | top       | Client-only QA tooling                              | non-production                                 |
| 139 | internal            | developer_scenarios                    | `connecto://developer-scenarios`                                | scroll1   | Client-only QA tooling                              | non-production                                 |
| 140 | internal            | developer_scenarios                    | `connecto://developer-scenarios`                                | scroll2   | Client-only QA tooling                              | non-production                                 |
| 141 | internal            | component_gallery                      | `connecto://component-gallery`                                  | top       | Client-only QA tooling                              | non-production                                 |
| 142 | internal            | component_gallery                      | `connecto://component-gallery`                                  | scroll1   | Client-only QA tooling                              | non-production                                 |
| 143 | internal            | token_gallery                          | `connecto://token-gallery`                                      | top       | Client-only QA tooling                              | non-production                                 |
| 144 | internal            | token_gallery                          | `connecto://token-gallery`                                      | scroll1   | Client-only QA tooling                              | non-production                                 |
| 145 | internal            | layout_qa                              | `connecto://layout-qa`                                          | top       | Client-only QA tooling                              | non-production                                 |
| 146 | internal            | layout_qa                              | `connecto://layout-qa`                                          | scroll1   | Client-only QA tooling                              | non-production                                 |
| 147 | internal            | motion_lab                             | `connecto://motion-lab`                                         | top       | Client-only QA tooling                              | non-production                                 |
| 148 | internal            | motion_lab                             | `connecto://motion-lab`                                         | scroll1   | Client-only QA tooling                              | non-production                                 |
| 149 | internal            | animation_lab                          | `connecto://animation-lab`                                      | top       | Client-only QA tooling                              | non-production                                 |
| 150 | internal            | animation_lab                          | `connecto://animation-lab`                                      | scroll1   | Client-only QA tooling                              | non-production                                 |
| 151 | internal            | account_status_redirect                | `connecto://account-status`                                     | top       | Account status API                                  | typed empty/error state                        |

## Production-Disabled Internal Routes

Mobile route IDs now blocked when `EXPO_PUBLIC_CONNECTO_ENV=production`:

- `animationLab`
- `componentGallery`
- `developerScenarios`
- `layoutQa`
- `motionLab`
- `tokenGallery`

Admin `/token-gallery` now returns `notFound()` when
`NEXT_PUBLIC_CONNECTO_ENV=production`.
