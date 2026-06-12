// Metro 설정: .glb를 에셋으로 인식시켜 require()로 번들에 포함되게 함.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 3D 모델/추가 바이너리 확장자
config.resolver.assetExts.push('glb', 'gltf', 'bin');

module.exports = config;
