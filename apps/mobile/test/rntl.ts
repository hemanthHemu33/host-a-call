import { act, type ReactElement } from 'react';
import { createRoot, type TestInstance } from 'test-renderer';

type RenderResult = {
  findByText: (text: string) => Promise<TestInstance>;
  getByDisplayValue: (value: string) => TestInstance;
  getByRole: (role: string) => TestInstance;
  getByTestId: (testID: string) => TestInstance;
  getByText: (text: string) => TestInstance;
  unmount: () => void;
};

type EventHandler = (...args: unknown[]) => void;

let activeResult: RenderResult | null = null;

const propsOf = (instance: TestInstance): Record<string, unknown> =>
  instance.props as Record<string, unknown>;

const isEventHandler = (value: unknown): value is EventHandler =>
  typeof value === 'function';

const isTestInstance = (value: string | TestInstance): value is TestInstance =>
  typeof value !== 'string';

const getTextContent = (instance: TestInstance): string =>
  instance.children
    .map((child) => (isTestInstance(child) ? getTextContent(child) : child))
    .join('');

const findSingle = (
  root: TestInstance,
  predicate: (instance: TestInstance) => boolean,
  errorMessage: string,
) => {
  const match = root.queryAll(predicate)[0];

  if (match === undefined) {
    throw new Error(errorMessage);
  }

  return match;
};

export const waitFor = async <TResult>(
  assertion: () => TResult,
  options?: { intervalMs?: number; timeoutMs?: number },
) => {
  const timeoutMs = options?.timeoutMs ?? 1_000;
  const intervalMs = options?.intervalMs ?? 0;
  const startedAt = Date.now();
  let lastError: unknown = null;

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      return assertion();
    } catch (error: unknown) {
      lastError = error;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, intervalMs);
    });
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('waitFor timed out.');
};

export const render = (element: ReactElement): RenderResult => {
  const root = createRoot({
    textComponentTypes: ['Text', 'span', 'div'],
  });

  act(() => {
    root.render(element);
  });

  const result: RenderResult = {
    findByText: (text) => waitFor(() => result.getByText(text)),
    getByDisplayValue: (value) =>
      findSingle(
        root.container,
        (instance) => propsOf(instance).value === value,
        `Unable to find input with value "${value}".`,
      ),
    getByRole: (role) =>
      findSingle(
        root.container,
        (instance) => {
          const props = propsOf(instance);

          return props.accessibilityRole === role || props.role === role;
        },
        `Unable to find role "${role}".`,
      ),
    getByTestId: (testID) =>
      testID === '__root__'
        ? root.container
        : findSingle(
            root.container,
            (instance) => propsOf(instance).testID === testID,
            `Unable to find testID "${testID}".`,
          ),
    getByText: (text) =>
      findSingle(
        root.container,
        (instance) => getTextContent(instance) === text,
        `Unable to find text "${text}".`,
      ),
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };

  activeResult = result;

  return result;
};

export const screen = {
  findByText: (text: string) => {
    if (activeResult === null) {
      throw new Error('No component is currently rendered.');
    }

    return activeResult.findByText(text);
  },
  getByDisplayValue: (value: string) => {
    if (activeResult === null) {
      throw new Error('No component is currently rendered.');
    }

    return activeResult.getByDisplayValue(value);
  },
  getByRole: (role: string) => {
    if (activeResult === null) {
      throw new Error('No component is currently rendered.');
    }

    return activeResult.getByRole(role);
  },
  getByTestId: (testID: string) => {
    if (activeResult === null) {
      throw new Error('No component is currently rendered.');
    }

    return activeResult.getByTestId(testID);
  },
  getByText: (text: string) => {
    if (activeResult === null) {
      throw new Error('No component is currently rendered.');
    }

    return activeResult.getByText(text);
  },
};

export const fireEvent = {
  changeText: (instance: TestInstance, value: string) => {
    const handler = propsOf(instance).onChangeText;

    if (isEventHandler(handler)) {
      act(() => {
        handler(value);
      });
    }
  },
  press: (instance: TestInstance) => {
    const props = propsOf(instance);

    if (props.disabled === true) {
      return;
    }

    const handler = props.onPress;

    if (isEventHandler(handler)) {
      act(() => {
        handler({ nativeEvent: {} });
      });
    }
  },
};

export const within = () => ({
  findByText: screen.findByText,
  getByDisplayValue: screen.getByDisplayValue,
  getByRole: screen.getByRole,
  getByTestId: screen.getByTestId,
  getByText: screen.getByText,
});
