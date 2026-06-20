import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

const ORBIT_TEXT = 'GOLDEN  SIF   \u2726   ';

// Holographic shader: orange base, Fresnel rim glow, drifting scanlines.
const HOLO_VERT = `
varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const HOLO_FRAG = `
uniform vec3 uColor; uniform float uTime; uniform float uOpacity;
varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main() {
  float f = pow(1.0 - clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0), 2.0);
  float scan = 0.6 + 0.4 * sin(vW.y * 6.0 - uTime * 3.0);
  vec3 col = uColor * (0.18 + f * 1.7);
  float a = (0.10 + f * 0.85) * scan * uOpacity;
  gl_FragColor = vec4(col, clamp(a, 0.0, 0.95));
}`;

/**
 * Public landing page (web): a glowing orange holographic Sif rendered as a
 * volumetric WebGL point cloud (brightness -> cloud, wrapped around a cylinder
 * for real roundness), with "GOLDEN SIF" orbiting her vertical axis edge-on.
 * Every effect is a live toggle. The Enter button heads to /login.
 */
export default function Landing() {
  const router = useRouter();
  const [fx, setFx] = useState({
    scanlines: true,
    glitch: true,
    grid: true,
    vignette: true,
  });
  const [panelOpen, setPanelOpen] = useState(false);
  const mountRef = useRef<HTMLDivElement | null>(null);

  const onEnter = useCallback(() => router.push('/login'), [router]);

  const orbit = useMemo(() => {
    const chars = ORBIT_TEXT.repeat(2).split('');
    const step = 360 / chars.length;
    return chars.map((ch, i) => ({ ch, angle: i * step, key: `${ch}-${i}` }));
  }, []);

  // ---- Three.js low-poly holographic Sif (fully 360-rotatable) ----
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let frame = 0;

    const scene = new THREE.Scene();
    const fov = 45;
    const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 5000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const timeUniform = { value: 0 };
    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.ShaderMaterial[] = [];
    const makeMat = (hex: number, opacity = 1) => {
      const m = new THREE.ShaderMaterial({
        uniforms: {
          uTime: timeUniform,
          uColor: { value: new THREE.Color(hex) },
          uOpacity: { value: opacity },
        },
        vertexShader: HOLO_VERT,
        fragmentShader: HOLO_FRAG,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      materials.push(m);
      return m;
    };

    const sif = new THREE.Group();
    const add = (
      geo: THREE.BufferGeometry,
      mat: THREE.ShaderMaterial,
      pos: [number, number, number],
      rot: [number, number, number] = [0, 0, 0],
      scale: [number, number, number] = [1, 1, 1],
    ) => {
      geometries.push(geo);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...pos);
      mesh.rotation.set(...rot);
      mesh.scale.set(...scale);
      sif.add(mesh);
      return mesh;
    };

    const bodyMat = makeMat(0xff6a3d);
    const skinMat = makeMat(0xffb27a);
    const hairMat = makeMat(0xff8a4d);
    const metalMat = makeMat(0xffd9a0);

    // Legs + boots
    add(new THREE.CylinderGeometry(6, 5, 52, 10), bodyMat, [-11, -62, 0]);
    add(new THREE.CylinderGeometry(6, 5, 52, 10), bodyMat, [11, -62, 0]);
    add(new THREE.BoxGeometry(13, 12, 18), bodyMat, [-11, -90, 3]);
    add(new THREE.BoxGeometry(13, 12, 18), bodyMat, [11, -90, 3]);
    // Tunic / skirt (open cone) + torso
    add(new THREE.CylinderGeometry(16, 30, 42, 16, 1, true), bodyMat, [0, -22, 0]);
    add(new THREE.CylinderGeometry(14, 18, 46, 14), bodyMat, [0, 8, 0]);
    // Shoulders / fur mantle
    add(new THREE.SphereGeometry(21, 16, 12), bodyMat, [0, 28, 0], [0, 0, 0], [1, 0.6, 0.9]);
    // Arms
    add(new THREE.CylinderGeometry(4.5, 4, 46, 10), bodyMat, [-23, 6, 2], [0, 0, 0.14]);
    add(new THREE.CylinderGeometry(4.5, 4, 46, 10), bodyMat, [23, 6, 2], [0, 0, -0.14]);
    // Neck + head
    add(new THREE.CylinderGeometry(5, 5, 8, 10), skinMat, [0, 40, 0]);
    add(new THREE.SphereGeometry(12, 16, 12), skinMat, [0, 51, 0]);
    // Winged helm: dome + two swept wings
    add(
      new THREE.SphereGeometry(13, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      metalMat,
      [0, 53, 0],
    );
    add(new THREE.ConeGeometry(5, 20, 6), metalMat, [-14, 61, 0], [0, 0, Math.PI / 4], [1, 1, 0.4]);
    add(new THREE.ConeGeometry(5, 20, 6), metalMat, [14, 61, 0], [0, 0, -Math.PI / 4], [1, 1, 0.4]);
    // Long flowing hair (back + sides)
    add(new THREE.CylinderGeometry(10, 3, 78, 8), hairMat, [0, 14, -11]);
    add(new THREE.CylinderGeometry(7, 2, 72, 8), hairMat, [-13, 16, -7], [0, 0, 0.06]);
    add(new THREE.CylinderGeometry(7, 2, 72, 8), hairMat, [13, 16, -7], [0, 0, -0.06]);
    // Spear (her right hand) + tip
    add(new THREE.CylinderGeometry(1.4, 1.4, 156, 8), metalMat, [-27, 2, 6]);
    add(new THREE.ConeGeometry(3, 11, 8), metalMat, [-27, 84, 6]);
    // Round shield (her left) facing forward, with center boss
    add(new THREE.CylinderGeometry(21, 21, 4, 28), metalMat, [28, -6, 11], [Math.PI / 2, 0, 0]);
    add(
      new THREE.SphereGeometry(5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      skinMat,
      [28, -6, 13.5],
      [-Math.PI / 2, 0, 0],
    );

    scene.add(sif);

    camera.position.set(0, 6, 300);
    camera.lookAt(0, 4, 0);

    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    let t = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      t += 0.016;
      timeUniform.value = t;
      sif.rotation.y += 0.005; // slow full 360 spin
      sif.position.y = Math.sin(t * 0.6) * 3; // gentle float
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  const rootClass = [
    'gs-root',
    fx.scanlines && 'fx-scanlines',
    fx.glitch && 'fx-glitch',
    fx.grid && 'fx-grid',
    fx.vignette && 'fx-vignette',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClass}>
      <style>{CSS}</style>

      {fx.grid ? <div className="gs-grid" aria-hidden /> : null}

      <div className="gs-scene">
        <div className="gs-figure3d" ref={mountRef} aria-hidden />

        <div className="gs-haloWrap" aria-hidden>
          <div className="gs-halo">
            {orbit.map((o) => (
              <span
                key={o.key}
                className="gs-halo-ch"
                style={{ transform: `rotateY(${o.angle}deg) translateZ(var(--halo-r))` }}>
                {o.ch === ' ' ? '\u00A0' : o.ch}
              </span>
            ))}
          </div>
        </div>

        <div className="gs-tagline" aria-hidden>
          GODDESS OF THE GOLDEN HAIR
        </div>

        <button className="gs-enter" onClick={onEnter} aria-label="Enter Golden Sif">
          <span className="gs-enter-txt">ENTER</span>
        </button>
      </div>

      {fx.scanlines ? <div className="gs-scanlines" aria-hidden /> : null}
      {fx.vignette ? <div className="gs-vignette" aria-hidden /> : null}

      <div className={`gs-controls ${panelOpen ? 'open' : ''}`}>
        <button
          className="gs-controls-toggle"
          onClick={() => setPanelOpen((o) => !o)}
          aria-label="Toggle effect controls">
          {panelOpen ? '\u00D7' : 'FX'}
        </button>
        {panelOpen ? (
          <div className="gs-controls-body">
            {(['scanlines', 'glitch', 'grid', 'vignette'] as const).map((k) => (
              <label key={k} className="gs-check">
                <input
                  type="checkbox"
                  checked={fx[k]}
                  onChange={(e) => setFx((s) => ({ ...s, [k]: e.target.checked }))}
                />
                <span>{k}</span>
              </label>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const CSS = `
.gs-root {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: radial-gradient(120% 90% at 50% 18%, #1a0a04 0%, #0a0402 45%, #000 100%);
  font-family: "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;
  --orange: #FF5733;
  --orange-lt: #ffb27a;
  --orange-dp: #b4220c;
  user-select: none;
}

.gs-scene {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  perspective: 1200px;
  z-index: 2;
}

/* ---- WebGL hologram canvas ---- */
.gs-figure3d {
  position: absolute;
  inset: 0;
  z-index: 2;
}
.gs-figure3d canvas { display: block; }
.fx-glitch .gs-figure3d {
  animation: gs-canvas-glitch 5s steps(30) infinite;
}
@keyframes gs-canvas-glitch {
  0%, 90%, 100% { transform: translate(0,0); filter: none; }
  92% { transform: translate(-3px, 1px); filter: drop-shadow(3px 0 #25f4ee) drop-shadow(-3px 0 #ff2bd6); }
  94% { transform: translate(2px, -1px); filter: drop-shadow(-2px 0 #25f4ee) drop-shadow(2px 0 #ff2bd6); }
  96% { transform: translate(-1px, 0); filter: none; }
}

/* ---- orbiting GOLDEN SIF (edge-on horizontal ring around vertical axis) ---- */
.gs-haloWrap {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  transform: translate(-50%, -50%);
  transform-style: preserve-3d;
  z-index: 3;
  pointer-events: none;
}
.gs-halo {
  position: absolute;
  transform-style: preserve-3d;
  animation: gs-orbit 16s linear infinite;
  --halo-r: 280px;
  will-change: transform;
}
.gs-halo-ch {
  position: absolute;
  font-size: 30px;
  font-weight: 800;
  letter-spacing: 2px;
  color: #ffe2c4;
  text-shadow: 0 0 6px var(--orange-lt), 0 0 14px var(--orange), 0 0 30px rgba(255,87,51,0.7);
  backface-visibility: visible;
  transform-origin: center;
  white-space: pre;
}
@keyframes gs-orbit {
  from { transform: rotateY(0deg); }
  to   { transform: rotateY(360deg); }
}

/* ---- tagline + enter ---- */
.gs-tagline {
  position: absolute;
  bottom: 17%;
  letter-spacing: 6px;
  font-size: 11px;
  color: rgba(255,150,110,0.7);
  text-shadow: 0 0 8px rgba(255,87,51,0.5);
  z-index: 4;
}
.gs-enter {
  position: absolute;
  bottom: 8%;
  appearance: none;
  cursor: pointer;
  background: rgba(255,87,51,0.06);
  border: 1px solid var(--orange);
  border-radius: 2px;
  padding: 12px 38px;
  color: var(--orange-lt);
  box-shadow: 0 0 14px rgba(255,87,51,0.5), inset 0 0 14px rgba(255,87,51,0.18);
  transition: background 0.2s, box-shadow 0.2s, color 0.2s, transform 0.1s;
  animation: gs-pulse 2.6s ease-in-out infinite;
  z-index: 4;
}
.gs-enter-txt { letter-spacing: 10px; font-size: 14px; font-weight: 700; }
.gs-enter:hover {
  background: var(--orange);
  color: #1a0a04;
  box-shadow: 0 0 26px rgba(255,87,51,0.9), inset 0 0 10px rgba(0,0,0,0.2);
}
.gs-enter:active { transform: scale(0.97); }
@keyframes gs-pulse {
  0%, 100% { box-shadow: 0 0 12px rgba(255,87,51,0.4), inset 0 0 12px rgba(255,87,51,0.15); }
  50%      { box-shadow: 0 0 24px rgba(255,87,51,0.85), inset 0 0 18px rgba(255,87,51,0.3); }
}

/* ---- neon grid floor ---- */
.gs-grid {
  position: absolute;
  left: -50%;
  right: -50%;
  bottom: -10%;
  height: 55%;
  background-image:
    linear-gradient(to right, rgba(255,87,51,0.35) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255,87,51,0.35) 1px, transparent 1px);
  background-size: 42px 42px;
  transform: perspective(420px) rotateX(74deg);
  transform-origin: bottom center;
  animation: gs-gridmove 2.4s linear infinite;
  z-index: 1;
  mask-image: linear-gradient(to bottom, transparent, #000 60%);
  -webkit-mask-image: linear-gradient(to bottom, transparent, #000 60%);
}
@keyframes gs-gridmove {
  from { background-position: 0 0, 0 0; }
  to   { background-position: 0 42px, 0 42px; }
}

/* ---- scanlines ---- */
.gs-scanlines {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 8;
  background: repeating-linear-gradient(
    to bottom,
    rgba(0,0,0,0) 0px,
    rgba(0,0,0,0) 2px,
    rgba(0,0,0,0.28) 3px,
    rgba(0,0,0,0.28) 4px
  );
}
.gs-scanlines::after {
  content: "";
  position: absolute;
  left: 0; right: 0; height: 22%;
  background: linear-gradient(to bottom, transparent, rgba(255,120,60,0.07), transparent);
  animation: gs-scan 6s linear infinite;
}
@keyframes gs-scan {
  from { top: -22%; }
  to   { top: 100%; }
}

/* ---- vignette + bloom ---- */
.gs-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 7;
  background:
    radial-gradient(60% 50% at 50% 45%, rgba(255,87,51,0.10), transparent 70%),
    radial-gradient(120% 120% at 50% 50%, transparent 55%, rgba(0,0,0,0.85) 100%);
}

/* ---- controls ---- */
.gs-controls {
  position: absolute;
  right: 14px;
  bottom: 14px;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}
.gs-controls-toggle {
  width: 38px; height: 38px;
  cursor: pointer;
  border-radius: 50%;
  border: 1px solid rgba(255,87,51,0.6);
  background: rgba(10,4,2,0.8);
  color: var(--orange-lt);
  font-family: inherit;
  font-size: 13px;
  letter-spacing: 1px;
  box-shadow: 0 0 10px rgba(255,87,51,0.3);
}
.gs-controls-body {
  background: rgba(10,4,2,0.92);
  border: 1px solid rgba(255,87,51,0.4);
  border-radius: 8px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 150px;
  box-shadow: 0 0 20px rgba(0,0,0,0.6);
}
.gs-check span {
  color: rgba(255,170,130,0.85);
  font-family: inherit;
  font-size: 11px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
}
.gs-check { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.gs-check input { accent-color: var(--orange); width: 14px; height: 14px; cursor: pointer; }

@media (max-width: 560px) {
  .gs-halo-ch { font-size: 19px; }
  .gs-halo { --halo-r: 190px; }
  .gs-enter-txt { letter-spacing: 7px; font-size: 12px; }
}
`;
