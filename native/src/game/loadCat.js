import { Asset } from 'expo-asset';
// SDK 54 moved the classic read API (readAsStringAsync/EncodingType) to the
// /legacy entry; the new File API replaces it at the package root.
import * as FileSystem from 'expo-file-system/legacy';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Bundled models. Metro turns each require() into an asset we can resolve to a
// local file URI at runtime (see metro.config.js, which whitelists .glb).
const MODULES = {
  cheese: require('../../assets/cats/cheese.glb'),
  tuxedo: require('../../assets/cats/tuxedo.glb'),
  gray: require('../../assets/cats/gray.glb'),
  calico: require('../../assets/cats/calico.glb'),
};

// Decode base64 → ArrayBuffer without pulling a dependency.
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

// Read a bundled .glb as an ArrayBuffer. In dev the asset URI is http(s) (Metro
// server); in a production build it's a local file. Handle both.
async function readGlb(catId) {
  const mod = MODULES[catId] || MODULES.cheese;
  const asset = Asset.fromModule(mod);
  await asset.downloadAsync(); // idempotent; ensures localUri is populated
  const uri = asset.localUri || asset.uri;
  console.log('[loadCat]', catId, '→', uri);

  if (uri.startsWith('http')) {
    const res = await fetch(uri);
    return await res.arrayBuffer();
  }
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return base64ToArrayBuffer(base64);
}

// Resolve, read, and parse a cat model. Returns the loaded gltf.scene (Group).
export async function loadCat(catId) {
  const buffer = await readGlb(catId);
  console.log('[loadCat]', catId, 'bytes:', buffer.byteLength);
  const loader = new GLTFLoader();
  const gltf = await new Promise((resolve, reject) =>
    loader.parse(buffer, '', resolve, reject)
  );
  return gltf.scene;
}
