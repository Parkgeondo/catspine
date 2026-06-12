// Metro must treat .glb/.gltf as bundled assets so require('./assets/cats/*.glb')
// resolves to a file URI we can read at runtime.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('glb', 'gltf');

module.exports = config;
