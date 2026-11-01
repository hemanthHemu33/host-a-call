const fs = require('node:fs');
const path = require('node:path');

const MAX_DIRECT_ANDROID_PACKAGE_ROOT_LENGTH = 90;

const windowsFallbackAndroidSourceDirs = {
  '@react-native-async-storage/async-storage':
    'C:/connecto-async-storage/android',
  '@react-native-community/netinfo': 'C:/connecto-netinfo/android',
  '@rive-app/react-native': 'C:/connecto-rive/android',
  '@shopify/react-native-skia':
    'C:/csk/node_modules/@shopify/react-native-skia/android',
  'lottie-react-native': 'C:/connecto-lottie/android',
  'react-native-gesture-handler': 'C:/connecto-rngh/android',
  'react-native-nitro-modules': 'C:/connecto-nitro/android',
  'react-native-reanimated': 'C:/connecto-rna/android',
  'react-native-safe-area-context': 'C:/connecto-safe-area/android',
  'react-native-screens': 'C:/connecto-screens/android',
  'react-native-svg': 'C:/connecto-svg/android',
  'react-native-worklets': 'C:/connecto-rnw/android',
};

function getPackageRoot(packageName) {
  try {
    return path.dirname(require.resolve(`${packageName}/package.json`));
  } catch {
    return null;
  }
}

function getDirectAndroidSourceDir(packageRoot) {
  const directAndroidSourceDir = path.join(packageRoot, 'android');

  if (!fs.existsSync(directAndroidSourceDir)) {
    return null;
  }

  return path.relative(packageRoot, directAndroidSourceDir);
}

function getAndroidSourceDir(packageName, fallbackAndroidSourceDir) {
  if (process.platform !== 'win32') {
    return null;
  }

  const packageRoot = getPackageRoot(packageName);
  if (!packageRoot) {
    return null;
  }

  const fallbackRoot = path.parse(fallbackAndroidSourceDir).root;
  const packageRootDrive = path.parse(packageRoot).root;
  const fallbackAndroidSourceDirOnPackageDrive = path.join(
    packageRootDrive,
    path.relative(fallbackRoot, fallbackAndroidSourceDir),
  );

  const directAndroidSourceDir = getDirectAndroidSourceDir(packageRoot);
  if (
    directAndroidSourceDir &&
    packageRoot.length <= MAX_DIRECT_ANDROID_PACKAGE_ROOT_LENGTH
  ) {
    return directAndroidSourceDir;
  }

  if (fs.existsSync(fallbackAndroidSourceDirOnPackageDrive)) {
    return path.relative(packageRoot, fallbackAndroidSourceDirOnPackageDrive);
  }

  return directAndroidSourceDir;
}

const dependencies = {};

for (const [packageName, fallbackAndroidSourceDir] of Object.entries(
  windowsFallbackAndroidSourceDirs,
)) {
  const sourceDir = getAndroidSourceDir(packageName, fallbackAndroidSourceDir);

  if (sourceDir) {
    dependencies[packageName] = {
      platforms: {
        android: {
          sourceDir,
        },
      },
    };
  }
}

module.exports = { dependencies };
