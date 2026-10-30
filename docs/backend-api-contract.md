# Samvad backend API contract

Status: current as of 2026-10-28. The authoritative route declarations, DTOs,
guards, and response shapes are in
[`backend/samvad-api/src`](../backend/samvad-api/src); a running instance
publishes the generated Swagger UI at `/api/docs`.

All routes below use the default base URL `/api/v1`. Protected routes require a
Bearer access token. Role-restricted routes are marked in the final column.

## Public and authentication

| Method | Path | Access |
| --- | --- | --- |
| `GET` | `/health`, `/ready` | Public |
| `POST` | `/auth/otp/send`, `/auth/otp/verify`, `/auth/refresh-token`, `/auth/admin/login` | Public |
| `POST` | `/auth/register/caller`, `/auth/register/host`, `/auth/logout` | Authenticated |
| `GET`, `PATCH` | `/auth/me` | Authenticated |

## Caller and host operations

| Area | Routes | Access |
| --- | --- | --- |
| Discovery | `GET /discovery/filters`, `GET /discovery/hosts`, `GET /discovery/hosts/:hostId` | Authenticated |
| Calls | `GET /calls/history`, `POST /calls/initiate`, `POST /calls/:sessionId/{accept,rtc-token,reject,grace/start,end}`, `GET /calls/:sessionId` | Authenticated |
| Call media | `POST /calls/:sessionId/video/{request,respond}`, `GET /calls/:sessionId/media-state`, `POST /calls/:sessionId/{media-connection,video/to-voice}` | Authenticated |
| Host onboarding | `POST /hosts/application/{submit,id-document}`, `POST /hosts/voice-intro`, `POST /hosts/presence`, `GET /hosts/dashboard` | Host |
| Wallet | `GET /wallet`, `GET /wallet/transactions` | Caller |
| Payments | `POST /payments/{create-order,verify}`, `POST /payments/webhook` | Caller for first two; webhook is provider-facing |
| Safety | `GET /safety/blocks`, `POST /safety/{blocks,reports}`, `DELETE /safety/blocks/:userId` | Authenticated |
| Connections | `GET /connections`, `POST /connections/{feedback,video-preference}`, `DELETE /connections/:hostId` | Authenticated |
| Referrals | `GET /referrals/stats` | Authenticated |
| Storage | `POST /storage/presigned-upload-url` | Authenticated |
| DigiLocker | `POST /verification/digilocker/{initiate,callback,simulate}`, `GET /verification/digilocker/{callback,status}` | Host; `simulate` is disabled in production |

## Administration and realtime

`/admin/*` requires an authenticated Admin account. It exposes metrics, host
application review and identity-document access, call review, bonus campaigns,
ledger entries, and moderation-report resolution. Consult Swagger for the exact
request and response schemas.

Socket.IO connects to the `/signaling` namespace with the access token in
`auth.token` or an `Authorization: Bearer` header. A valid session receives
`signaling_ready`; invalid or expired credentials receive
`signaling_auth_required` before disconnect. The gateway currently supports
presence heartbeats and call signalling events defined in
`backend/samvad-api/src/modules/calls/calls.gateway.ts`.

## Client-integration rule

Do not reuse the old root `/v1` client or endpoint names. For example, Samvad
starts calls with `POST /api/v1/calls/initiate`, not
`POST /v1/calls/intents`. Map each frontend use case to the Samvad controller
and its Swagger DTO before implementation.

See [API source of truth](./api-source-of-truth.md) for ownership and the
retirement policy.
