const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

if (process.env.CONNECTO_METRO_FILE_CACHE === '0') {
  config.cacheStores = [];
} else if (process.env.CONNECTO_METRO_FILE_CACHE === '1') {
  config.cacheStores = ({ FileStore }) => [
    new FileStore({ root: path.join(__dirname, '.metro-cache') }),
  ];
}

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

for (const extension of ['lottie', 'riv']) {
  if (!config.resolver.assetExts.includes(extension)) {
    config.resolver.assetExts.push(extension);
  }
}

// The active Samvad route tree uses native styles. The previous NativeWind
// setup remains with the archived fixture UI and is not part of this bundle.
/** @type {ReturnType<typeof getDefaultConfig>} */
const metroConfig = config;

module.exports = metroConfig;
