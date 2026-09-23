# Animation Asset Contract

Date: 2026-07-16

## Ownership

Use `apps/mobile/src/components/animations/registry.ts` as the only mobile animation asset registry. Feature screens should import wrapper components from `@/components/animations`, not raw animation runtimes.

## Lottie

Allowed use: one-time or looped illustrative assets such as success moments, empty states, and onboarding explainers.

Disallowed use: live timers, audio-reactive visuals, network-quality graphs, and call-state visuals that need frame-perfect runtime input.

Current placeholder: `apps/mobile/src/assets/lottie/connecto-pulse.placeholder.json`.

Rules:

- Placeholder assets must be hand-authored or licensed for commercial use and clearly named for replacement.
- Corrupt or missing Lottie sources must render a static fallback.
- Reduced motion must render a static frame instead of looping movement.
- Recoloring may use Lottie `colorFilters` only where the asset exposes stable keypaths.

## Rive Conversation Orb

Registry ID: `conversationOrb`.

Future asset path: `apps/mobile/src/assets/rive/conversation-orb.riv`.

Rive runtime: `@rive-app/react-native` with `react-native-nitro-modules`.

Artboard: `ConversationOrb`.

State machine: `ConversationOrbMachine`.

Required states:

- `idle`
- `ringing`
- `connecting`
- `voice`
- `videoUnlocked`
- `videoRequested`
- `video`
- `reconnecting`
- `ended`
- `error`

Required behavior:

- The asset must expose one state-machine input named `state` or a documented equivalent mapping for every state above.
- If the Rive feature flag is disabled, the source is missing, the source is corrupt, or runtime loading fails, `ConversationOrbFallback` remains the production fallback.
- Screens must pass semantic states to `ConversationOrb`; they must not call Rive APIs directly.

Current source status: no final `.riv` file is present in this repository. Do not add an empty or hand-written `.riv`; Rive files must be exported from Rive with the artboard and state machine above.

## Skia

Skia owns live or data-driven visuals:

- `TrustRing`
- `VoiceWaveform`
- `NetworkQualityMiniGraph`
- `ConfettiLayer`

Rules:

- Low-end profile must reduce geometry count.
- Reduced motion must remove repeated or decorative movement while preserving state clarity.
- Web export uses lightweight React Native fallbacks until CanvasKit hosting is explicitly configured.

## Low-End Android Profile

The `/animation-lab` route includes a low-end Android profile switch. It forces `quality="low"`, caps waveform bars and particle count, and uses the same code path that feature screens can pass on memory-constrained devices.

No Android platform tools, physical low-end Android device, or emulator command is attached to this workspace. Device-frame measurements remain a release QA task once an Android development build is available. See `docs/animation-performance.md`.
