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

const STRANDS = 90;     // thin lines per ribbon
const POINTS = 220;     // points along each line

// Each vertex is (t along the line 0..1, s across the ribbon 0..1, side -1|1); the shape is computed here, so the CPU does nothing per frame.
const VERT = /* glsl */ `
uniform float uTime; uniform float uEdge; uniform vec2 uTilt;
attribute vec3 aRib; varying float vS; varying float vT; varying float vFace;
void main(){
  float t = aRib.x, s = aRib.y, side = aRib.z, k = uTime * 0.35 + side * 1.7;
  float y = mix(-3.6, 3.6, t);
  // the ribbon's spine sweeps in an S-curve near the screen edge
  float cx = side * (uEdge - 1.9 + 0.9 * sin(t * 3.4 + k) + 0.3 * sin(t * 7.0 - k * 1.3));
  // it twists along its length; strands fan out across the width
  float a = t * 4.0 + k * 1.2, w = 1.5 + 0.6 * sin(t * 3.0 + k);
  float off = (s - 0.5) * w;
  vec3 p = vec3(cx + off * cos(a), y + off * 0.25 * sin(a * 0.5), off * sin(a));
  p.xy += uTilt * vec2(0.15, 0.1) * side;
  vS = s; vT = t; vFace = abs(cos(a));   // facing the viewer = brighter, edge-on = dimmer
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const FRAG = /* glsl */ `
uniform vec3 uA; uniform vec3 uB; varying float vS; varying float vT; varying float vFace;
void main(){
  vec3 col = mix(uA, uB, smoothstep(0.15, 0.85, vS * 0.6 + vT * 0.4 + 0.15 * sin(vT * 12.0)));
  float edge = smoothstep(0.0, 0.08, vS) * smoothstep(1.0, 0.92, vS);      // soft ribbon borders
  float fade = smoothstep(0.0, 0.12, vT) * smoothstep(1.0, 0.88, vT);      // fade at top and bottom
  float glow = 0.25 + 0.75 * pow(1.0 - vFace, 2.0) + 0.2 * vFace;           // bright where the ribbon turns
  gl_FragColor = vec4(col * (0.6 + glow), (0.12 + 0.5 * glow) * edge * fade);
}`;

function ribbonGeometry() {
  const rib: number[] = [], index: number[] = [];
  for (const side of [-1, 1])
    for (let i = 0; i < STRANDS; i++) {
      const base = rib.length / 3;
      for (let j = 0; j < POINTS; j++) {
        rib.push(j / (POINTS - 1), i / (STRANDS - 1), side);
        if (j) index.push(base + j - 1, base + j);
      }
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('aRib', new THREE.Float32BufferAttribute(rib, 3));
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(rib.length), 3));   // unused; three needs it
  g.setIndex(index);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);
  return g;
}

/**
 * Decorative hero backdrop (landing page only): two silk-like ribbons of thin glowing strands twisting down both
 * sides of the headline, in the theme's colours, drifting a little with the mouse. Returns a cleanup function.
 */
export function createDataScene(canvas: HTMLCanvasElement, { still = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  camera.position.z = 10;

  const uniforms = {
    uTime: { value: 0 }, uEdge: { value: 5 }, uTilt: { value: new THREE.Vector2() },
    uA: { value: cssColor('var(--primary)') }, uB: { value: cssColor('var(--chart-2)') },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const ribbons = new THREE.LineSegments(ribbonGeometry(), material);
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
