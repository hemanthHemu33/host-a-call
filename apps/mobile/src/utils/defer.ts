type DeferredTask = {
  cancel: () => void;
};

export const runAfterInitialRender = (callback: () => void): DeferredTask => {
  if (process.env.NODE_ENV === 'test') {
    callback();

    return {
      cancel: () => undefined,
    };
  }

  let cancelled = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const run = () => {
    if (cancelled) {
      return;
    }

    timeoutId = setTimeout(() => {
      if (!cancelled) {
        callback();
      }
    }, 0);
  };

  const animationFrame =
    typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null;

  if (animationFrame === null) {
    timeoutId = setTimeout(run, 0);

    return {
      cancel: () => {
        cancelled = true;

        if (timeoutId !== null) {
          clearTimeout(timeoutId);
        }
      },
    };
  }

  const frameId = animationFrame(run);

  return {
    cancel: () => {
      cancelled = true;
      cancelAnimationFrame(frameId);

      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    },
  };
};
