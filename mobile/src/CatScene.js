// 3D 고양이 무대 — expo-gl(GLView) 위에 Three.js 씬을 직접 구성한다.
// 웹(main.js)의 씬/물리/점수/떼쓰기 로직을 그대로 포팅했고, 회전은 세로 Y축 기준.
import React, { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CAT_ASSETS } from './cats';

const TWO_PI = Math.PI * 2;
const SPIN_IMPULSE = 9; // 탭 1회가 더하는 각속도(rad/s)
const MAX_VELOCITY = 34; // 연타 상한
const FRICTION = 6; // 감속(rad/s^2)
const TANTRUM_AFTER_MS = 4500;

const TANTRUM_LINES = [
  '냐옹… 심심해요 🐾',
  '야옹!! 빨리 돌려줘요 😾',
  '흥! 더 무시하면 할퀼 거예요 🙀',
];

// base64 → ArrayBuffer (RN에는 atob/Buffer가 없어 직접 디코드)
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64ToArrayBuffer(b64) {
  const lookup = new Uint8Array(256);
  for (let i = 0; i < B64.length; i++) lookup[B64.charCodeAt(i)] = i;
  let len = b64.length;
  let bufferLength = (len * 3) / 4;
  if (b64[len - 1] === '=') bufferLength--;
  if (b64[len - 2] === '=') bufferLength--;
  const bytes = new Uint8Array(bufferLength);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const e1 = lookup[b64.charCodeAt(i)];
    const e2 = lookup[b64.charCodeAt(i + 1)];
    const e3 = lookup[b64.charCodeAt(i + 2)];
    const e4 = lookup[b64.charCodeAt(i + 3)];
    bytes[p++] = (e1 << 2) | (e2 >> 4);
    if (p < bufferLength) bytes[p++] = ((e2 & 15) << 4) | (e3 >> 2);
    if (p < bufferLength) bytes[p++] = ((e3 & 3) << 6) | (e4 & 63);
  }
  return bytes.buffer;
}

async function loadCatScene(catId) {
  const asset = Asset.fromModule(CAT_ASSETS[catId]);
  await asset.downloadAsync();
  const uri = asset.localUri || asset.uri;
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const buffer = base64ToArrayBuffer(base64);
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(buffer, '', (gltf) => resolve(gltf.scene), reject);
  });
}

function disposeObject(obj) {
  obj.traverse((o) => {
    if (o.isMesh) {
      o.geometry && o.geometry.dispose();
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
      else o.material && o.material.dispose();
    }
  });
}

const CatScene = forwardRef(function CatScene({ catId, onScore, onMood }, ref) {
  // 모든 가변 상태는 ref에 담아 렌더 루프(클로저)와 공유
  const s = useRef({
    angle: 0,
    angularVelocity: 0,
    awardedTurns: 0,
    score: 0,
    settling: false,
    lastInteraction: Date.now(),
    tantrumLevel: 0,
    loadedCatId: null,
    pendingCatId: catId,
    loading: false,
    pivot: null,
    catModel: null,
  });

  useImperativeHandle(ref, () => ({
    spin() {
      const st = s.current;
      st.angularVelocity = Math.min(MAX_VELOCITY, st.angularVelocity + SPIN_IMPULSE);
      st.settling = false;
      st.lastInteraction = Date.now();
      if (st.tantrumLevel !== 0) {
        st.tantrumLevel = 0;
        onMood && onMood({ text: '좋아요! 한 번 더? 🌀', angry: false });
      }
    },
  }));

  // 고양이 종류 변경 → 다음 프레임에 모델 교체
  useEffect(() => {
    s.current.pendingCatId = catId;
  }, [catId]);

  const onContextCreate = async (gl) => {
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;

    const renderer = new Renderer({ gl });
    renderer.setSize(width, height);
    renderer.setClearColor(0x191333, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 2.2, 5.4);
    camera.lookAt(0, 0.6, 0);

    scene.add(new THREE.HemisphereLight(0xfff1d6, 0x3a2f5a, 0.95));
    const key = new THREE.DirectionalLight(0xffffff, 1.3);
    key.position.set(3, 6, 4);
    scene.add(key);

    // 쿠션(바닥) + 가짜 그림자 원반
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(3.2, 48),
      new THREE.MeshStandardMaterial({ color: 0x3a2f63, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    scene.add(ground);
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.4, 32),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.001;
    scene.add(shadow);

    const pivot = new THREE.Group();
    scene.add(pivot);
    s.current.pivot = pivot;

    async function swapModel(id) {
      const st = s.current;
      if (st.loading || id === st.loadedCatId) return;
      st.loading = true;
      try {
        const model = await loadCatScene(id);
        if (st.catModel) {
          pivot.remove(st.catModel);
          disposeObject(st.catModel);
        }
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.x -= center.x;
        model.position.z -= center.z;
        model.position.y -= box.min.y; // 바닥에 안착
        pivot.add(model);
        st.catModel = model;
        st.loadedCatId = id;
      } catch (e) {
        // 모델 로드 실패는 조용히 무시(다음 시도에서 재시도)
      } finally {
        st.loading = false;
      }
    }

    let last = Date.now();
    const render = () => {
      const st = s.current;
      const now = Date.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      if (st.pendingCatId !== st.loadedCatId) swapModel(st.pendingCatId);

      // 물리: 각속도 → 각도, 마찰 감속, 한 바퀴마다 +1
      if (st.angularVelocity > 0) {
        st.angle += st.angularVelocity * dt;
        st.angularVelocity = Math.max(0, st.angularVelocity - FRICTION * dt);
        pivot.rotation.y = st.angle;
        scoreTurns(st);
        if (st.angularVelocity === 0) st.settling = true;
      } else if (st.settling) {
        const target = Math.round(st.angle / TWO_PI) * TWO_PI;
        st.angle += (target - st.angle) * Math.min(1, dt * 8);
        if (Math.abs(target - st.angle) < 1e-3) {
          st.angle = target;
          st.settling = false;
        }
        pivot.rotation.y = st.angle;
        scoreTurns(st);
      }

      updateTantrum(st, now);

      renderer.render(scene, camera);
      gl.endFrameEXP();
      requestAnimationFrame(render);
    };

    function scoreTurns(st) {
      const completed = Math.floor(st.angle / TWO_PI + 1e-9);
      if (completed > st.awardedTurns) {
        st.score += completed - st.awardedTurns;
        st.awardedTurns = completed;
        onScore && onScore(st.score);
      }
    }

    function updateTantrum(st, now) {
      const idle = now - st.lastInteraction;
      const spinning = st.angularVelocity > 0 || st.settling;
      if (spinning || idle < TANTRUM_AFTER_MS) {
        if (st.tantrumLevel === 0) {
          pivot.position.x *= 0.85;
          pivot.position.y *= 0.85;
          pivot.rotation.z *= 0.85;
        }
        return;
      }
      const level = Math.min(3, 1 + Math.floor((idle - TANTRUM_AFTER_MS) / 3500));
      if (level !== st.tantrumLevel) {
        st.tantrumLevel = level;
        onMood && onMood({ text: TANTRUM_LINES[level - 1], angry: true });
      }
      const t = now / 1000;
      const intensity = 0.04 * level;
      pivot.position.x = Math.sin(t * 22) * intensity;
      pivot.position.y = Math.abs(Math.sin(t * 9)) * 0.05 * level;
      pivot.rotation.z = Math.sin(t * 26) * intensity * 1.5;
    }

    render();
  };

  return <GLView style={{ flex: 1 }} onContextCreate={onContextCreate} />;
});

export default CatScene;
