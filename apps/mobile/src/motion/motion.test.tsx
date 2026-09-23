import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, useEffect, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Pressable, Text } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MotionProvider, useMotion } from './MotionProvider';
import { createHapticsService } from './haptics';

function MotionProbe() {
  const {
    cameraSessionActive,
    motionPreference,
    nonEssentialHapticsEnabled,
    reducedMotionEnabled,
    setCameraSessionActive,
    setMotionPreference,
    setNonEssentialHapticsEnabled,
    systemReducedMotionEnabled,
  } = useMotion();

  return (
    <>
      <Text testID="system-reduced">{String(systemReducedMotionEnabled)}</Text>
      <Text testID="effective-reduced">{String(reducedMotionEnabled)}</Text>
      <Text testID="motion-preference">{motionPreference}</Text>
      <Text testID="nonessential">{String(nonEssentialHapticsEnabled)}</Text>
      <Text testID="camera-session">{String(cameraSessionActive)}</Text>
      <Pressable
        onPress={() => {
          setMotionPreference('reduced');
        }}
        testID="set-reduced"
      />
      <Pressable
        onPress={() => {
          setMotionPreference('full');
        }}
        testID="set-full"
      />
      <Pressable
        onPress={() => {
          setNonEssentialHapticsEnabled(false);
        }}
        testID="disable-nonessential"
      />
      <Pressable
        onPress={() => {
          setCameraSessionActive(true);
        }}
        testID="activate-camera"
      />
    </>
  );
}

function MotionProviderRemountHarness() {
  const [version, setVersion] = useState(0);

  return (
    <>
      <Pressable
        onPress={() => {
          setVersion((current) => current + 1);
        }}
        testID="remount-provider"
      />
      <MotionProvider key={version}>
        <MotionProbe />
      </MotionProvider>
    </>
  );
}

function CameraSessionLifecycleProbe({ active }: { active: boolean }) {
  const { setCameraSessionActive } = useMotion();

  useEffect(() => {
    setCameraSessionActive(active);

    return () => {
      setCameraSessionActive(false);
    };
  }, [active, setCameraSessionActive]);

  return null;
}

function CameraSessionLifecycleHarness() {
  const [active, setActive] = useState(true);
  const [visible, setVisible] = useState(true);

  return (
    <>
      <Pressable
        onPress={() => {
          setActive((current) => !current);
        }}
        testID="toggle-camera-lifecycle"
      />
      <Pressable
        onPress={() => {
          setVisible(false);
        }}
        testID="hide-camera-lifecycle"
      />
      {visible ? <CameraSessionLifecycleProbe active={active} /> : null}
      <MotionProbe />
    </>
  );
}

describe('motion runtime', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('derives reduced motion from the system setting and app preference', async () => {
    vi.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(
      true,
    );

    void render(
      <MotionProvider>
        <MotionProbe />
      </MotionProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('system-reduced').props.children).toBe('true');
    expect(screen.getByTestId('motion-preference').props.children).toBe('full');
    expect(screen.getByTestId('effective-reduced').props.children).toBe(
      'false',
    );

    void fireEvent.press(screen.getByTestId('set-reduced'));

    expect(screen.getByTestId('motion-preference').props.children).toBe(
      'reduced',
    );
    expect(screen.getByTestId('effective-reduced').props.children).toBe('true');

    void fireEvent.press(screen.getByTestId('set-full'));

    expect(screen.getByTestId('motion-preference').props.children).toBe('full');
    expect(screen.getByTestId('effective-reduced').props.children).toBe(
      'false',
    );
  });

  it('suppresses nonessential haptics and repeated rerender events', () => {
    const adapter = {
      impactAsync: vi.fn(() => Promise.resolve()),
      notificationAsync: vi.fn(() => Promise.resolve()),
      selectionAsync: vi.fn(() => Promise.resolve()),
    };
    const state = {
      cameraHapticsSuppressed: false,
      cameraSessionActive: false,
      nonEssentialHapticsEnabled: false,
      platform: 'ios' as const,
    };
    let currentTime = 0;
    const service = createHapticsService({
      adapter,
      getState: () => state,
      now: () => currentTime,
    });

    service.selection();
    expect(adapter.selectionAsync).not.toHaveBeenCalled();

    service.success();
    service.success();
    expect(adapter.notificationAsync).toHaveBeenCalledTimes(1);

    currentTime = 400;
    service.success();
    expect(adapter.notificationAsync).toHaveBeenCalledTimes(2);
  });

  it('suppresses all haptics during camera use on unreliable platforms', () => {
    const adapter = {
      impactAsync: vi.fn(() => Promise.resolve()),
      notificationAsync: vi.fn(() => Promise.resolve()),
      selectionAsync: vi.fn(() => Promise.resolve()),
    };
    const service = createHapticsService({
      adapter,
      getState: () => ({
        cameraHapticsSuppressed: true,
        cameraSessionActive: true,
        nonEssentialHapticsEnabled: true,
        platform: 'android',
      }),
    });

    service.videoUnlocked();
    service.warning();
    service.lightImpact();

    expect(adapter.notificationAsync).not.toHaveBeenCalled();
    expect(adapter.impactAsync).not.toHaveBeenCalled();
  });

  it('updates the provider preference flags from app controls', () => {
    void render(
      <MotionProvider>
        <MotionProbe />
      </MotionProvider>,
    );

    void fireEvent.press(screen.getByTestId('disable-nonessential'));
    void fireEvent.press(screen.getByTestId('activate-camera'));

    expect(screen.getByTestId('nonessential').props.children).toBe('false');
    expect(screen.getByTestId('camera-session').props.children).toBe('true');
  });

  it('persists motion preferences across provider remounts', async () => {
    void render(<MotionProviderRemountHarness />);

    await act(async () => {
      await Promise.resolve();
    });

    void fireEvent.press(screen.getByTestId('set-full'));
    void fireEvent.press(screen.getByTestId('disable-nonessential'));

    await act(async () => {
      await Promise.resolve();
    });

    void fireEvent.press(screen.getByTestId('remount-provider'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('motion-preference').props.children).toBe('full');
    expect(screen.getByTestId('nonessential').props.children).toBe('false');
  });

  it('clears camera session state when the lifecycle owner unmounts', () => {
    void render(
      <MotionProvider>
        <CameraSessionLifecycleHarness />
      </MotionProvider>,
    );

    expect(screen.getByTestId('camera-session').props.children).toBe('true');

    void fireEvent.press(screen.getByTestId('toggle-camera-lifecycle'));

    expect(screen.getByTestId('camera-session').props.children).toBe('false');

    void fireEvent.press(screen.getByTestId('hide-camera-lifecycle'));

    expect(screen.getByTestId('camera-session').props.children).toBe('false');
  });
});
