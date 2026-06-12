import React, { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber/native';
import * as THREE from 'three';

import { loadCat } from './loadCat';
import { step, tantrumLevel } from './engine';
import { theme } from '../theme';

// The cat sits on a pivot; we roll the pivot about Y so the cat spins around
// its long (lying) axis like a turntable.
function CatRig({ game, catId, reduceMotion, onScore, onMood }) {
  const pivot = useRef();
  const [model, setModel] = useState(null);
  const loadToken = useRef(0);
  const lastLevel = useRef(0);

  // (Re)load the selected cat. A token guards against out-of-order async loads.
  useEffect(() => {
    const myToken = ++loadToken.current;
    let alive = true;
    loadCat(catId)
      .then((scene) => {
        if (!alive || myToken !== loadToken.current) return;
        scene.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        // center on the spin (Y) axis and rest the cat on the cushion
        const box = new THREE.Box3().setFromObject(scene);
        const center = box.getCenter(new THREE.Vector3());
        scene.position.x -= center.x;
        scene.position.z -= center.z;
        scene.position.y -= box.min.y; // bottom sits on y = 0
        setModel(scene);
      })
      .catch((err) => console.warn('GLB load failed:', err?.message || err));
    return () => {
      alive = false;
    };
  }, [catId]);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const now = Date.now();
    const p = pivot.current;
    if (!p) return;

    // physics-driven roll + scoring
    const gained = step(game, dt);
    p.rotation.y = game.angle;
    if (gained > 0) onScore(game.score);

    // tantrum (떼쓰기) when ignored
    const level = tantrumLevel(game, now);
    if (level !== lastLevel.current) {
      lastLevel.current = level;
      onMood(level);
    }
    if (level === 0) {
      // gentle idle wobble back to rest
      p.position.x *= 0.85;
      p.position.y *= 0.85;
      p.rotation.z *= 0.85;
    } else if (!reduceMotion) {
      const t = now / 1000;
      const intensity = 0.04 * level;
      p.position.x = Math.sin(t * 22) * intensity;
      p.position.y = Math.abs(Math.sin(t * 9)) * 0.05 * level; // little hops
      p.rotation.z = Math.sin(t * 26) * intensity * 1.5;
    }
  });

  return <group ref={pivot}>{model ? <primitive object={model} /> : null}</group>;
}

export default function CatStage(props) {
  return (
    <Canvas
      shadows
      gl={{ antialias: true }}
      camera={{ position: [0, 2.2, 5.4], fov: 42, near: 0.1, far: 100 }}
      onCreated={({ camera, gl }) => {
        camera.lookAt(0, 0.6, 0);
        gl.setClearColor(0x000000, 0); // transparent → RN background shows through
      }}
    >
      <hemisphereLight args={[0xfff1d6, 0x3a2f5a, 0.9]} />
      <directionalLight
        position={[3, 6, 4]}
        intensity={1.4}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={20}
      />
      {/* soft ground (a cushion for the lying cat) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <circleGeometry args={[3.2, 48]} />
        <meshStandardMaterial color={theme.ground} roughness={1} />
      </mesh>
      <CatRig {...props} />
    </Canvas>
  );
}
