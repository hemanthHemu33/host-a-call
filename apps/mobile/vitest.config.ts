import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

const srcPath = fileURLToPath(new URL('./src', import.meta.url));
const reactNativeMock = fileURLToPath(
  new URL('./test/react-native.tsx', import.meta.url),
);
const reactNativeSubpathMock = fileURLToPath(
  new URL('./test/react-native-subpath.ts', import.meta.url),
);
const rntlMock = fileURLToPath(new URL('./test/rntl.ts', import.meta.url));
const reanimatedMock = fileURLToPath(
  new URL('./test/react-native-reanimated.tsx', import.meta.url),
);
const workletsMock = fileURLToPath(
  new URL('./test/react-native-worklets.ts', import.meta.url),
);

export default defineConfig({
  resolve: {
    alias: [
      { find: '@', replacement: srcPath },
      { find: '@testing-library/react-native', replacement: rntlMock },
      { find: /^react-native$/, replacement: reactNativeMock },
      { find: /^react-native-reanimated$/, replacement: reanimatedMock },
      { find: /^react-native-worklets$/, replacement: workletsMock },
      { find: /^react-native\/.+$/, replacement: reactNativeSubpathMock },
    ],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    server: {
      deps: {
        inline: ['@testing-library/react-native'],
      },
    },
    setupFiles: ['./vitest.setup.ts'],
  },
});
