const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

config.cacheStores =
  process.env.CONNECTO_METRO_FILE_CACHE === '1'
    ? ({ FileStore }) => [
        new FileStore({ root: path.join(__dirname, '.metro-cache') }),
      ]
    : [];

const getDefaultTransformOptions = config.transformer.getTransformOptions;
config.transformer.getTransformOptions = async (...args) => {
  const options =
    typeof getDefaultTransformOptions === 'function'
      ? await getDefaultTransformOptions(...args)
      : { transform: {} };

  return {
    ...options,
    transform: {
      ...options.transform,
      inlineRequires: true,
    },
  };
};

const nativeWindTypePath =
  path.relative(process.cwd(), path.join(__dirname, 'nativewind-env.d.ts')) ||
  'nativewind-env.d.ts';

for (const extension of ['lottie', 'riv']) {
  if (!config.resolver.assetExts.includes(extension)) {
    config.resolver.assetExts.push(extension);
  }
}

/** @type {ReturnType<typeof getDefaultConfig>} */
const metroConfig = withNativeWind(config, {
  configPath: path.join(__dirname, 'tailwind.config.ts'),
  input: path.join(__dirname, 'global.css'),
  typescriptEnvPath: nativeWindTypePath,
});

module.exports = metroConfig;
