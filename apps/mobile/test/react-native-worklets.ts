export const scheduleOnRN = <TArgs extends readonly unknown[]>(
  callback: (...args: TArgs) => void,
  ...args: TArgs
) => {
  callback(...args);
};
