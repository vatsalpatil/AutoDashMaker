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

// 3D simplex noise (Ashima Arts, MIT) used to morph the orb's surface.
const NOISE = /* glsl */ `
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x,289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+2.0*C.xxx; vec3 x3=x0-1.0+3.0*C.xxx;
  i=mod(i,289.0);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=1.0/7.0; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const VERT = /* glsl */ `${NOISE}
uniform float uTime; varying vec3 vNormal; varying vec3 vView; varying float vNoise; varying vec3 vPos;
void main(){
  float n = snoise(normal * 1.4 + uTime * 0.25) * 0.5 + snoise(normal * 3.0 - uTime * 0.18) * 0.18;
  vNoise = n;
  vec3 p = position + normal * n * 0.42;
  vPos = position;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vNormal = normalize(normalMatrix * normal); vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
uniform vec3 uA; uniform vec3 uB; varying vec3 vNormal; varying vec3 vView; varying float vNoise; varying vec3 vPos;
void main(){
  float fres = pow(1.0 - max(dot(vNormal, vView), 0.0), 2.2);
  vec3 col = mix(uA, uB, smoothstep(-0.4, 0.5, vNoise));
  vec3 rim = mix(uB, vec3(1.0), 0.3) * 1.4;
  // thin-line look: no filled surface, only fine strands wrapping the shape, brightest towards the edge
  float x = (vPos.y + vNoise * 0.35) * 28.0, d = min(fract(x), 1.0 - fract(x));
  float line = 1.0 - smoothstep(0.0, fwidth(x) * 1.1, d);   // ~1px wide at any size
  gl_FragColor = vec4(mix(col, rim, fres), line * (0.25 + 0.75 * fres));
}`;

/**
 * Decorative hero centrepiece (landing page only): one glowing orb whose surface morphs slowly like liquid,
 * in the theme's colours, turning a little with the mouse. Returns a cleanup function.
 */
export function createDataScene(canvas: HTMLCanvasElement, { still = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  camera.position.z = 7;

  const uniforms = { uTime: { value: 0 }, uA: { value: cssColor('var(--primary)') }, uB: { value: cssColor('var(--chart-2)') } };
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 96), new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false }));
  scene.add(orb);

  const pointer = { x: 0, y: 0 }, tilt = { x: 0, y: 0 };
  function update(t: number) {
    uniforms.uTime.value = t;
    tilt.x += (pointer.y * 0.5 - tilt.x) * 0.04;     // ease towards the mouse
    tilt.y += (pointer.x * 0.7 - tilt.y) * 0.04;
    orb.rotation.set(tilt.x, t * 0.12 + tilt.y, 0);
    renderer.render(scene, camera);
  }

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    // full screen sharpness (users saw anything lower as blurry); the 30fps cap and idle start keep it light
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
    let last = 0;   // ~30 fps is plenty for a slow morph and halves the GPU work
    renderer.setAnimationLoop((now) => { if (visible && now - last > 32) { last = now; update(clock.getElapsedTime()); } });
  }

  return () => {
    renderer.setAnimationLoop(null);
    window.removeEventListener('pointermove', onPointer);
    ro.disconnect();
    io.disconnect();
    orb.geometry.dispose();
    (orb.material as THREE.Material).dispose();
    renderer.dispose();
  };
}
