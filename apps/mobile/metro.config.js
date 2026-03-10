// Metro config for Expo monorepo
// Resolves workspace packages (@skids/shared) from repo root
// Forces single React instance to prevent "useRef of null" hook errors

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch all files in the monorepo
config.watchFolders = [monorepoRoot];

// Let Metro resolve packages from both the project and monorepo root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// CRITICAL: Force all React-related imports to resolve from one location
// The monorepo has multiple React copies (web deps use 19.2.4, mobile needs 19.1.0)
// Without this, Metro may bundle duplicate React instances causing hooks to crash
const rootNodeModules = path.resolve(monorepoRoot, 'node_modules');
config.resolver.extraNodeModules = {
  'react': path.resolve(rootNodeModules, 'react'),
  'react-native': path.resolve(rootNodeModules, 'react-native'),
  'react/jsx-runtime': path.resolve(rootNodeModules, 'react/jsx-runtime'),
  'react/jsx-dev-runtime': path.resolve(rootNodeModules, 'react/jsx-dev-runtime'),
};

// Block nested React copies from web packages being pulled into the bundle
config.resolver.blockList = [
  // Block all nested react copies (react-dom/node_modules/react, etc.)
  new RegExp(`${monorepoRoot}/node_modules/.+/node_modules/react/.*`),
  // Block web-only packages from being resolved
  new RegExp(`${monorepoRoot}/apps/web/.*`),
  new RegExp(`${monorepoRoot}/apps/worker/.*`),
];

module.exports = config;
