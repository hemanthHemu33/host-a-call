import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  linkSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, parse } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'win32') {
  process.exit(0);
}

const mobileRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const expoPackage = require.resolve('expo/package.json');
const autolinkingPackage = require.resolve(
  'expo-modules-autolinking/package.json',
  { paths: [dirname(expoPackage)] },
);
const autolinkingBin = join(
  dirname(autolinkingPackage),
  'bin',
  'expo-modules-autolinking.js',
);
const shortModulesRoot = join(
  parse(mobileRoot).root,
  'connecto-expo-node-modules',
);
const autolinking = spawnSync(
  process.execPath,
  [autolinkingBin, 'search', '--platform', 'android', '--json'],
  {
    cwd: mobileRoot,
    encoding: 'utf8',
    windowsHide: true,
  },
);

if (autolinking.status !== 0) {
  throw new Error(
    `Could not discover Expo modules.\n${autolinking.stderr || autolinking.stdout}`,
  );
}

const modules = JSON.parse(autolinking.stdout);
mkdirSync(shortModulesRoot, { recursive: true });

let linkedModules = 0;

function copyWithHardLinks(sourcePath, targetPath) {
  mkdirSync(targetPath, { recursive: true });

  for (const entry of readdirSync(sourcePath, { withFileTypes: true })) {
    if (['.cxx', 'build', 'node_modules'].includes(entry.name)) {
      continue;
    }

    const entrySourcePath = join(sourcePath, entry.name);
    const entryTargetPath = join(targetPath, entry.name);

    if (entry.isDirectory()) {
      copyWithHardLinks(entrySourcePath, entryTargetPath);
    } else if (entry.isFile()) {
      try {
        linkSync(entrySourcePath, entryTargetPath);
      } catch (error) {
        if (error.code !== 'EXDEV') {
          throw error;
        }

        copyFileSync(entrySourcePath, entryTargetPath);
      }
    }
  }
}

function prepareExpoModulesCore(sourcePath, targetPath) {
  const sourceMarkerPath = join(targetPath, '.connecto-source-path');

  try {
    if (
      !lstatSync(targetPath).isSymbolicLink() &&
      readFileSync(sourceMarkerPath, 'utf8') === sourcePath
    ) {
      return false;
    }

    rmSync(targetPath, { force: true, recursive: true });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  copyWithHardLinks(sourcePath, targetPath);
  writeFileSync(sourceMarkerPath, sourcePath);
  return true;
}

for (const [packageName, module] of Object.entries(modules)) {
  const sourcePath = realpathSync(module.path);
  const targetPath = join(shortModulesRoot, ...packageName.split('/'));
  mkdirSync(dirname(targetPath), { recursive: true });

  if (packageName === 'expo-modules-core') {
    if (prepareExpoModulesCore(sourcePath, targetPath)) {
      linkedModules += 1;
    }

    continue;
  }

  try {
    lstatSync(targetPath);

    if (realpathSync(targetPath) === sourcePath) {
      continue;
    }

    rmSync(targetPath, { force: true, recursive: true });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  symlinkSync(sourcePath, targetPath, 'junction');
  linkedModules += 1;
}

console.log(
  `Prepared ${Object.keys(modules).length} Expo modules at ${shortModulesRoot} (${linkedModules} updated).`,
);
