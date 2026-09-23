# Animation Performance

Date: 2026-07-16

## Low-End Android Profiling Attempt

Target route: `/animation-lab`.

Low-end profile behavior is implemented in app code:

- `resolveAnimationQuality({ lowEndDevice: true })` returns `low`.
- `VoiceWaveform` caps bars to 8 in low quality.
- `ConfettiLayer` caps particles to 6 in low quality.
- `TrustRing` uses simpler stroke geometry in low quality.
- Reduced motion removes decorative repeated motion.

Local device status:

```text
adb not found
emulator not found
```

Result: physical Android frame profiling cannot be completed from this workspace until Android SDK platform tools and a connected low-end device or emulator profile are available.

Required command once available:

```sh
adb shell dumpsys gfxinfo com.connecto.mobile framestats
```

Acceptance target for this route: no jank burst while toggling low-end profile, cycling ConversationOrb states, and enabling waveform/confetti for 60 seconds on the selected low-end Android target.
