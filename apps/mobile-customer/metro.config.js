const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Monorepo: watch files outside the mobile app directory
config.watchFolders = [monorepoRoot];

// Tell Metro where to find node_modules (pnpm hoists to monorepo root)
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Follow symlinks for pnpm workspace packages
config.resolver.unstable_enableSymlinks = true;

// Prevent duplicate React / React Native instances
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
