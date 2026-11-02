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

const LEN = 260, ACROSS = 28;   // grid resolution of each ribbon surface
const PER_SIDE = 3;            // overlapping ribbons per side, woven with different phases

// Each vertex carries (t along the ribbon 0..1, s across it 0..1, side -1|1, phase). The surface is computed on the GPU,
// and its normal comes from two nearby points, so the CPU does nothing per frame.
const VERT = /* glsl */ `
uniform float uTime; uniform float uEdge; uniform vec2 uTilt;
attribute vec4 aRib; varying vec3 vN; varying vec3 vView; varying float vS; varying float vT; varying float vPh;
vec3 ribbon(float t, float s, float side, float ph){
  float k = uTime * 0.12 + ph * 2.1 + side * 1.3;          // slow, organic drift
  float y = mix(-4.2, 4.2, t);
  // spine: an S-curve hugging the screen edge, now and then reaching further in
  float cx = side * (uEdge - 1.3 - 0.4 * ph + 0.8 * sin(t * 2.6 + k) + 0.35 * sin(t * 5.3 - k * 1.4));
  float cz = -0.6 * ph + 0.9 * sin(t * 2.1 + k * 0.8);
  // twists and folds; width swells and narrows along the length
  float a = t * 3.2 + k * 0.9 + 0.6 * sin(t * 4.0 - k);
  float w = 0.9 + 1.3 * pow(0.5 + 0.5 * sin(t * 3.4 + k * 1.1 + ph), 1.5);
  float off = (s - 0.5) * w;
  vec3 p = vec3(cx + off * cos(a), y + off * 0.35 * sin(a), cz + off * sin(a));
  p.xy += uTilt * vec2(0.12, 0.08) * side;
  return p;
}
void main(){
  vec3 p = ribbon(aRib.x, aRib.y, aRib.z, aRib.w);
  vec3 dt = ribbon(aRib.x + 0.002, aRib.y, aRib.z, aRib.w) - p;
  vec3 ds = ribbon(aRib.x, aRib.y + 0.02, aRib.z, aRib.w) - p;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * cross(dt, ds)); vView = normalize(-mv.xyz);
  vS = aRib.y; vT = aRib.x; vPh = aRib.w;
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
uniform vec3 uMint; uniform vec3 uTeal; uniform vec3 uDeep;
varying vec3 vN; varying vec3 vView; varying float vS; varying float vT; varying float vPh;
void main(){
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  float facing = max(dot(n, vView), 0.0);
  float fres = pow(1.0 - facing, 2.5);                               // glassy edge glow
  vec3 L = normalize(vec3(-0.5, 0.8, 0.6));
  float diff = 0.35 + 0.65 * max(dot(n, L), 0.0);
  float spec = pow(max(dot(reflect(-L, n), vView), 0.0), 40.0);     // highlight along the curves
  // mint → cyan → deep teal along and across the surface
  float g = clamp(vT * 0.7 + vS * 0.3 + 0.15 * sin(vT * 9.0 + vPh * 2.0), 0.0, 1.0);
  vec3 col = g < 0.5 ? mix(uMint, uTeal, g * 2.0) : mix(uTeal, uDeep, g * 2.0 - 1.0);
  float rim = smoothstep(0.0, 0.12, vS) * smoothstep(1.0, 0.88, vS);  // darker, softer ribbon borders
  vec3 c = col * diff * mix(0.6, 1.25, rim) + col * fres * 1.6 + vec3(spec) * 0.8;
  float fade = smoothstep(0.0, 0.15, vT) * smoothstep(1.0, 0.85, vT);
  gl_FragColor = vec4(c, (0.45 + 0.5 * fres + 0.4 * spec) * mix(0.4, 1.0, rim) * fade);
}`;

function ribbonGeometry() {
  const rib: number[] = [], index: number[] = [];
  for (const side of [-1, 1])
    for (let r = 0; r < PER_SIDE; r++) {
      const base = rib.length / 4;
      for (let i = 0; i <= LEN; i++)
        for (let j = 0; j <= ACROSS; j++) rib.push(i / LEN, j / ACROSS, side, r);
      for (let i = 0; i < LEN; i++)
        for (let j = 0; j < ACROSS; j++) {
          const a = base + i * (ACROSS + 1) + j, b = a + ACROSS + 1;
          index.push(a, b, a + 1, b, b + 1, a + 1);
        }
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('aRib', new THREE.Float32BufferAttribute(rib, 4));
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array((rib.length / 4) * 3), 3));   // unused; three needs it
  g.setIndex(index);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);
  return g;
}

/**
 * Decorative hero backdrop (landing page only): translucent glass-like 3D ribbons twisting and folding down both
 * sides of the headline in the theme's teal, drifting slowly and a little with the mouse. Returns a cleanup function.
 */
export function createDataScene(canvas: HTMLCanvasElement, { still = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  camera.position.z = 11;

  const uniforms = {
    uTime: { value: 0 }, uEdge: { value: 5 }, uTilt: { value: new THREE.Vector2() },
    uMint: { value: cssColor('color-mix(in oklab, var(--chart-2) 55%, white)') },
    uTeal: { value: cssColor('var(--chart-2)') },
    uDeep: { value: cssColor('color-mix(in oklab, var(--chart-2) 70%, black)') },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const ribbons = new THREE.Mesh(ribbonGeometry(), material);
  scene.add(ribbons);

  const pointer = { x: 0, y: 0 };
  function update(t: number) {
    uniforms.uTime.value = t;
    const tilt = uniforms.uTilt.value;
    tilt.x += (pointer.x - tilt.x) * 0.04;     // ease towards the mouse
    tilt.y += (-pointer.y - tilt.y) * 0.04;
    renderer.render(scene, camera);
  }

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // half the visible width at z=0, so the ribbons hug the screen edges at any size (narrow screens: pushed further out)
    const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z * camera.aspect;
    uniforms.uEdge.value = camera.aspect < 1 ? half + 0.4 : half;
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
    let last = 0;   // ~30 fps is plenty for a slow drift and halves the GPU work
    renderer.setAnimationLoop((now) => { if (visible && now - last > 32) { last = now; update(clock.getElapsedTime()); } });
  }

  return () => {
    renderer.setAnimationLoop(null);
    window.removeEventListener('pointermove', onPointer);
    ro.disconnect();
    io.disconnect();
    ribbons.geometry.dispose();
    material.dispose();
    renderer.dispose();
  };
}
