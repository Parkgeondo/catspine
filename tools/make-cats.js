/*
 * make-cats.js
 * ----------------------------------------------------------------------------
 * Generates valid low-poly .glb (binary glTF 2.0) cat models with no external
 * dependencies. Each cat is built from colored boxes (vertex colors) and is
 * modeled "lying down" with its body length along the X axis, so the game can
 * roll it 360° about X for a satisfying "barrel roll".
 *
 * Run: node tools/make-cats.js
 * Output: client/assets/cats/<id>.glb
 */
const fs = require('fs');
const path = require('path');

// ---- geometry helpers -------------------------------------------------------

// Build a single axis-aligned box centered at `center` with half-extents `h`.
// Returns flat vertex data for 24 verts (4 per face) with outward normals and
// a per-box solid color applied to every vertex.
function box(center, size, color) {
  const [cx, cy, cz] = center;
  const [sx, sy, sz] = size.map((v) => v / 2);
  // 6 faces: normal + 4 corner offsets (CCW when viewed from outside)
  const faces = [
    { n: [0, 0, 1], c: [[-sx, -sy, sz], [sx, -sy, sz], [sx, sy, sz], [-sx, sy, sz]] }, // +Z
    { n: [0, 0, -1], c: [[sx, -sy, -sz], [-sx, -sy, -sz], [-sx, sy, -sz], [sx, sy, -sz]] }, // -Z
    { n: [1, 0, 0], c: [[sx, -sy, sz], [sx, -sy, -sz], [sx, sy, -sz], [sx, sy, sz]] }, // +X
    { n: [-1, 0, 0], c: [[-sx, -sy, -sz], [-sx, -sy, sz], [-sx, sy, sz], [-sx, sy, -sz]] }, // -X
    { n: [0, 1, 0], c: [[-sx, sy, sz], [sx, sy, sz], [sx, sy, -sz], [-sx, sy, -sz]] }, // +Y
    { n: [0, -1, 0], c: [[-sx, -sy, -sz], [sx, -sy, -sz], [sx, -sy, sz], [-sx, -sy, sz]] }, // -Y
  ];
  const positions = [];
  const normals = [];
  const colors = [];
  const indices = [];
  let base = 0;
  const [r, g, b] = color;
  for (const f of faces) {
    for (const corner of f.c) {
      positions.push(cx + corner[0], cy + corner[1], cz + corner[2]);
      normals.push(f.n[0], f.n[1], f.n[2]);
      colors.push(r, g, b, 1);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    base += 4;
  }
  return { positions, normals, colors, indices };
}

// Rotate the whole cat +90° about the X axis so it LIES ON ITS SIDE (90°).
// The game spins it about the vertical Y axis, like a cat on a turntable.
// X by +90°: (y, z) -> (-z, y)
function layOnSide(geom) {
  const rot = (arr) => {
    for (let i = 0; i < arr.length; i += 3) {
      const y = arr[i + 1];
      const z = arr[i + 2];
      arr[i + 1] = -z;
      arr[i + 2] = y;
    }
  };
  rot(geom.positions);
  rot(geom.normals);
  return geom;
}

// Merge several box parts into one geometry.
function merge(parts) {
  const positions = [];
  const normals = [];
  const colors = [];
  const indices = [];
  let vertexOffset = 0;
  for (const p of parts) {
    positions.push(...p.positions);
    normals.push(...p.normals);
    colors.push(...p.colors);
    for (const i of p.indices) indices.push(i + vertexOffset);
    vertexOffset += p.positions.length / 3;
  }
  return { positions, normals, colors, indices };
}

// ---- cat model --------------------------------------------------------------
// Colors are linear-ish 0..1 RGB. A cat is described by a small palette so each
// "breed" looks distinct.
function buildCat({ fur, belly, ear, nose }) {
  const dark = [0.12, 0.1, 0.1]; // eyes / paws accents
  const parts = [
    // body (long, lying along X)
    box([0, 0.45, 0], [1.7, 0.75, 0.9], fur),
    // belly patch (slightly below, lighter)
    box([0, 0.18, 0], [1.5, 0.3, 0.78], belly),
    // head
    box([1.05, 0.7, 0], [0.7, 0.7, 0.75], fur),
    // muzzle / cheeks
    box([1.42, 0.55, 0], [0.18, 0.4, 0.55], belly),
    // nose
    box([1.54, 0.6, 0], [0.08, 0.12, 0.16], nose),
    // ears (left/right) + inner ears
    box([1.0, 1.15, 0.28], [0.28, 0.34, 0.06], fur),
    box([1.0, 1.15, -0.28], [0.28, 0.34, 0.06], fur),
    box([1.0, 1.12, 0.28], [0.16, 0.2, 0.05], ear),
    box([1.0, 1.12, -0.28], [0.16, 0.2, 0.05], ear),
    // eyes
    box([1.34, 0.78, 0.22], [0.06, 0.12, 0.12], dark),
    box([1.34, 0.78, -0.22], [0.06, 0.12, 0.12], dark),
    // tail (curls back along -X, raised)
    box([-0.95, 0.7, 0], [0.55, 0.18, 0.18], fur),
    box([-1.2, 1.0, 0], [0.18, 0.55, 0.18], fur),
    // tucked paws (lying pose)
    box([0.55, 0.08, 0.42], [0.5, 0.16, 0.22], belly),
    box([0.55, 0.08, -0.42], [0.5, 0.16, 0.22], belly),
  ];
  return layOnSide(merge(parts));
}

// ---- GLB writer -------------------------------------------------------------
function alignTo(n, align) {
  const r = n % align;
  return r === 0 ? n : n + (align - r);
}

function toGLB(geom) {
  const indices = Uint16Array.from(geom.indices);
  const positions = Float32Array.from(geom.positions);
  const normals = Float32Array.from(geom.normals);
  const colors = Float32Array.from(geom.colors);

  // min/max for POSITION accessor (required by spec)
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = positions[i + k];
      if (v < min[k]) min[k] = v;
      if (v > max[k]) max[k] = v;
    }
  }

  // Assemble a single binary buffer: indices | positions | normals | colors
  // with 4-byte alignment between views.
  const chunks = [];
  let offset = 0;
  const views = [];
  function addView(typedArray, target) {
    const byteLength = typedArray.byteLength;
    const padded = alignTo(offset, 4);
    if (padded !== offset) {
      chunks.push(Buffer.alloc(padded - offset));
      offset = padded;
    }
    views.push({ byteOffset: offset, byteLength, target });
    chunks.push(Buffer.from(typedArray.buffer, typedArray.byteOffset, byteLength));
    offset += byteLength;
    return views.length - 1;
  }

  const ELEMENT_ARRAY_BUFFER = 34963;
  const ARRAY_BUFFER = 34962;
  const idxView = addView(indices, ELEMENT_ARRAY_BUFFER);
  const posView = addView(positions, ARRAY_BUFFER);
  const nrmView = addView(normals, ARRAY_BUFFER);
  const colView = addView(colors, ARRAY_BUFFER);

  const bin = Buffer.concat(chunks);

  const gltf = {
    asset: { version: '2.0', generator: 'make-cats.js' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'cat' }],
    materials: [
      {
        name: 'fur',
        pbrMetallicRoughness: {
          baseColorFactor: [1, 1, 1, 1],
          metallicFactor: 0,
          roughnessFactor: 0.85,
        },
      },
    ],
    meshes: [
      {
        primitives: [
          {
            attributes: { POSITION: 1, NORMAL: 2, COLOR_0: 3 },
            indices: 0,
            material: 0,
          },
        ],
      },
    ],
    accessors: [
      { bufferView: idxView, componentType: 5123, count: indices.length, type: 'SCALAR' },
      {
        bufferView: posView,
        componentType: 5126,
        count: positions.length / 3,
        type: 'VEC3',
        min,
        max,
      },
      { bufferView: nrmView, componentType: 5126, count: normals.length / 3, type: 'VEC3' },
      { bufferView: colView, componentType: 5126, count: colors.length / 4, type: 'VEC4' },
    ],
    bufferViews: views.map((v) => ({
      buffer: 0,
      byteOffset: v.byteOffset,
      byteLength: v.byteLength,
      target: v.target,
    })),
    buffers: [{ byteLength: bin.length }],
  };

  // JSON chunk (padded with spaces to 4 bytes)
  let json = Buffer.from(JSON.stringify(gltf), 'utf8');
  if (json.length % 4 !== 0) {
    json = Buffer.concat([json, Buffer.alloc(4 - (json.length % 4), 0x20)]);
  }
  // BIN chunk (padded with zeros to 4 bytes)
  let binChunk = bin;
  if (binChunk.length % 4 !== 0) {
    binChunk = Buffer.concat([binChunk, Buffer.alloc(4 - (binChunk.length % 4), 0)]);
  }

  const header = Buffer.alloc(12);
  const totalLength = 12 + 8 + json.length + 8 + binChunk.length;
  header.writeUInt32LE(0x46546c67, 0); // 'glTF'
  header.writeUInt32LE(2, 4); // version
  header.writeUInt32LE(totalLength, 8);

  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(json.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4); // 'JSON'

  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binChunk.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4); // 'BIN\0'

  return Buffer.concat([header, jsonHeader, json, binHeader, binChunk]);
}

// ---- cat catalog ------------------------------------------------------------
const CATS = {
  cheese: {
    fur: [0.95, 0.6, 0.2],
    belly: [0.99, 0.93, 0.82],
    ear: [0.96, 0.7, 0.72],
    nose: [0.85, 0.45, 0.5],
  },
  tuxedo: {
    fur: [0.13, 0.13, 0.15],
    belly: [0.97, 0.97, 0.98],
    ear: [0.8, 0.5, 0.55],
    nose: [0.3, 0.22, 0.25],
  },
  gray: {
    fur: [0.55, 0.58, 0.62],
    belly: [0.88, 0.9, 0.92],
    ear: [0.92, 0.66, 0.68],
    nose: [0.7, 0.45, 0.5],
  },
  calico: {
    fur: [0.93, 0.85, 0.75],
    belly: [0.99, 0.97, 0.94],
    ear: [0.9, 0.55, 0.4],
    nose: [0.8, 0.4, 0.45],
  },
};

function main() {
  const outDir = path.join(__dirname, '..', 'client', 'assets', 'cats');
  fs.mkdirSync(outDir, { recursive: true });
  for (const [id, palette] of Object.entries(CATS)) {
    const geom = buildCat(palette);
    const glb = toGLB(geom);
    const file = path.join(outDir, `${id}.glb`);
    fs.writeFileSync(file, glb);
    console.log(`wrote ${file} (${glb.length} bytes)`);
  }
  console.log('done.');
}

main();
