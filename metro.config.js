// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Allow importing 3D model assets (GLB/GLTF) via require().
config.resolver.assetExts.push('glb', 'gltf', 'bin');

module.exports = config;
