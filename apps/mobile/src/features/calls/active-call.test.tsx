import { render, screen } from '@testing-library/react-native';
import { act } from 'react';
import { AppState, Text } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  formatActiveCallDuration,
  useActiveCallTicker,
  type ActiveCallClock,
} from './active-call';

function TickerProbe({
  active = true,
  clock,
}: {
  active?: boolean;
  clock: ActiveCallClock;
}) {
  const nowMs = useActiveCallTicker({
    active,
    clock,
    intervalMs: 1_000,
  });

  return <Text testID="ticker-now">{String(nowMs)}</Text>;
}

describe('active call timing helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('formats connected time as a timer string', () => {
    expect(formatActiveCallDuration(0)).toBe('00:00');
    expect(formatActiveCallDuration(181_000)).toBe('03:01');
  });

  it('keeps time paused in the background and cleans AppState listeners on unmount', async () => {
    vi.useFakeTimers();

    let nowMs = 1_000;
    let listener: ((status: string) => void) | null = null;
    const remove = vi.fn(() => {
      listener = null;
    });
    const clock: ActiveCallClock = {
      nowMs: () => nowMs,
    };

    AppState.currentState = 'active';
    vi.spyOn(AppState, 'addEventListener').mockImplementation(
      (_event, nextListener) => {
        listener = nextListener as (status: string) => void;
        return { remove };
      },
    );

    const view = await render(<TickerProbe clock={clock} />);

    expect(screen.getByTestId('ticker-now').props.children).toBe('1000');

    nowMs = 4_000;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(screen.getByTestId('ticker-now').props.children).toBe('4000');

    nowMs = 9_000;
    AppState.currentState = 'background';
    act(() => {
      listener?.('background');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(screen.getByTestId('ticker-now').props.children).toBe('4000');

    AppState.currentState = 'active';
    act(() => {
      listener?.('active');
    });
    expect(screen.getByTestId('ticker-now').props.children).toBe('9000');

    await view.unmount();
    expect(remove).toHaveBeenCalledTimes(1);

    nowMs = 12_000;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    expect(remove).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
