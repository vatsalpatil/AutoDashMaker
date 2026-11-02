import * as THREE from 'three';

/** Resolves a CSS colour (any syntax, incl. oklch theme tokens) to a THREE.Color via a 1px canvas. */
function cssColor(expr: string): THREE.Color {
  const probe = document.createElement('div');
  probe.style.color = expr;
  document.body.appendChild(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.fillStyle = value;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
}

const N = 9;          // bars per side
const GAP = 1.25;     // distance between bar centres

/**
 * Landing-page WebGL scene: a 3D bar chart whose bars rise in a wave, a glowing wireframe "data core" above it,
 * orbiting data points and a particle field. Colours follow the theme. Returns a cleanup function.
 */
export function createDataScene(canvas: HTMLCanvasElement, { still = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);

  const primary = cssColor('var(--primary)');
  const accent = cssColor('var(--chart-2)');
  const dark = primary.clone().multiplyScalar(0.12);

  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(8, 14, 6);
  scene.add(sun);
  const glow = new THREE.PointLight(primary, 60, 30);
  glow.position.set(0, 7, 0);
  scene.add(glow);

  // ---- bar chart (one instanced mesh, coloured by height)
  const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 1, 0.9), new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.2 }), N * N);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(N * GAP + 0.6, 0.15, N * GAP + 0.6), new THREE.MeshStandardMaterial({ color: dark, roughness: 0.8 }));
  plate.position.y = -0.08;
  const grid = new THREE.GridHelper(N * GAP + 0.6, N, primary, primary);
  (grid.material as THREE.Material).opacity = 0.25;
  (grid.material as THREE.Material).transparent = true;
  grid.position.y = 0.001;
  const chart = new THREE.Group();
  chart.add(plate, grid, bars);
  scene.add(chart);

  // ---- floating data core
  const core = new THREE.Group();
  core.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 1), new THREE.MeshBasicMaterial({ color: primary, wireframe: true, transparent: true, opacity: 0.55 })));
  core.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 3), new THREE.MeshStandardMaterial({ color: primary, emissive: primary, emissiveIntensity: 1.2 })));
  core.position.y = 7.5;
  scene.add(core);

  // ---- orbiting data points
  const orbit = new THREE.Group();
  const dotGeo = new THREE.SphereGeometry(0.16, 16, 16);
  for (let i = 0; i < 14; i++) {
    const dot = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: i % 3 ? primary : accent }));
    const a = (i / 14) * Math.PI * 2;
    dot.position.set(Math.cos(a) * 3.2, Math.sin(a * 3) * 0.35, Math.sin(a) * 3.2);
    orbit.add(dot);
  }
  orbit.position.y = 7.5;
  orbit.rotation.x = 0.35;
  scene.add(orbit);

  // ---- particle field
  const pts = new Float32Array(600 * 3);
  for (let i = 0; i < pts.length; i++) pts[i] = (Math.random() - 0.5) * (i % 3 === 1 ? 24 : 34) + (i % 3 === 1 ? 6 : 0);
  const particles = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pts, 3)),
    new THREE.PointsMaterial({ color: primary, size: 0.07, transparent: true, opacity: 0.7 }));
  scene.add(particles);

  const m = new THREE.Matrix4(), c = new THREE.Color(), pointer = { x: 0, y: 0 };
  const half = ((N - 1) * GAP) / 2;
  function update(t: number) {
    for (let x = 0; x < N; x++) for (let z = 0; z < N; z++) {
      const hill = 3.2 * Math.exp(-((x - 5.5) ** 2 + (z - 3) ** 2) / 10);
      const wave = 0.9 + 0.8 * Math.sin(t * 1.6 - (x + z) * 0.55);
      const h = Math.max(0.15, hill + wave + ((x * 7 + z * 3) % 4) * 0.25);
      m.makeScale(1, h, 1).setPosition(x * GAP - half, h / 2, z * GAP - half);
      bars.setMatrixAt(x * N + z, m);
      bars.setColorAt(x * N + z, c.copy(dark).lerp(primary, Math.min(h / 4.5, 1)).lerp(accent, Math.max(0, h - 4.2) / 3));
    }
    bars.instanceMatrix.needsUpdate = true;
    bars.instanceColor!.needsUpdate = true;
    chart.rotation.y = t * 0.12;
    core.rotation.set(t * 0.3, t * 0.45, 0);
    core.position.y = 7.5 + Math.sin(t * 1.2) * 0.35;
    orbit.rotation.y = -t * 0.5;
    particles.rotation.y = t * 0.03;
    camera.position.set(17 + pointer.x * 2.5, 13 + pointer.y * 2, 17);
    camera.lookAt(0, 3.4, 0);
    renderer.render(scene, camera);
  }

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const onPointer = (e: PointerEvent) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  // render only while on screen; one still frame when the user prefers reduced motion
  let visible = true;
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
  io.observe(canvas);
  const clock = new THREE.Clock();
  if (still) update(2);
  else {
    window.addEventListener('pointermove', onPointer, { passive: true });
    renderer.setAnimationLoop(() => { if (visible) update(clock.getElapsedTime()); });
  }

  return () => {
    renderer.setAnimationLoop(null);
    window.removeEventListener('pointermove', onPointer);
    ro.disconnect();
    io.disconnect();
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
      (Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []).forEach((mat) => mat.dispose());
    });
    renderer.dispose();
  };
}
