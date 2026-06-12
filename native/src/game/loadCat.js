import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Bundled models. Metro turns each require() into an asset we can resolve to a
// local file URI at runtime (see metro.config.js, which whitelists .glb).
const MODULES = {
  cheese: require('../../assets/cats/cheese.glb'),
  tuxedo: require('../../assets/cats/tuxedo.glb'),
  gray: require('../../assets/cats/gray.glb'),
  calico: require('../../assets/cats/calico.glb'),
};

// Decode base64 → ArrayBuffer without pulling a dependency. RN's XHR is flaky
// reading binary file:// URIs, so we read the .glb as base64 and parse it from
// memory instead, which is reliable across iOS/Android.
function base64ToArrayBuffer(base64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;

  let len = base64.length;
  let padding = 0;
  if (base64[len - 1] === '=') padding++;
  if (base64[len - 2] === '=') padding++;

  const byteLength = (len * 3) / 4 - padding;
  const bytes = new Uint8Array(byteLength);

  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const e1 = lookup[base64.charCodeAt(i)];
    const e2 = lookup[base64.charCodeAt(i + 1)];
    const e3 = lookup[base64.charCodeAt(i + 2)];
    const e4 = lookup[base64.charCodeAt(i + 3)];
    if (p < byteLength) bytes[p++] = (e1 << 2) | (e2 >> 4);
    if (p < byteLength) bytes[p++] = ((e2 & 15) << 4) | (e3 >> 2);
    if (p < byteLength) bytes[p++] = ((e3 & 3) << 6) | e4;
  }
  return bytes.buffer;
}

// Resolve, read, and parse a cat model. Returns the loaded gltf.scene (Group).
export async function loadCat(catId) {
  const mod = MODULES[catId] || MODULES.cheese;
  const asset = Asset.fromModule(mod);
  if (!asset.downloaded) await asset.downloadAsync();
  const uri = asset.localUri || asset.uri;

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const buffer = base64ToArrayBuffer(base64);

  const loader = new GLTFLoader();
  const gltf = await new Promise((resolve, reject) =>
    loader.parse(buffer, '', resolve, reject)
  );
  return gltf.scene;
}
