import * as THREE from "three"

type AuroraState = {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.Camera
  mesh: THREE.Mesh
  material: THREE.ShaderMaterial
  clock: THREE.Clock
  rafId: number
  onResize: () => void
  onMouseMove: (event: MouseEvent) => void
  themeObserver: MutationObserver
}

let state: AuroraState | null = null

function getAccent(): THREE.Color {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--accent")
    .trim()
  return new THREE.Color(raw || "#5eebff")
}

// A complementary tint (accent hue nudged toward violet) for the second band.
function getSecondary(): THREE.Color {
  return getAccent().offsetHSL(0.12, 0.05, -0.05)
}

function isDarkTheme(): boolean {
  return document.documentElement.classList.contains("dark")
}

// Fullscreen quad: PlaneGeometry(2,2) spans clip space directly.
const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform vec2 uMouse;       // smoothed, -1..1
  uniform vec2 uResolution;
  uniform vec3 uColor;       // accent
  uniform vec3 uColor2;      // complementary band
  uniform float uOpacity;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.0;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    float aspect = uResolution.x / uResolution.y;
    vec2 p = vec2(vUv.x * aspect, vUv.y);

    float t = uTime * 0.08;
    vec2 m = uMouse * 0.18;

    // Domain warp: feed noise into noise so the field flows like curtains.
    vec2 q = vec2(fbm(p * 1.5 + t + m), fbm(p * 1.5 - t + 4.0));
    float n = fbm(p * 2.0 + q * 1.8 + vec2(0.0, t * 2.0));

    // Vertical curtains streaking upward — higher x-frequency = finer ribbons.
    float bands = fbm(vec2(p.x * 4.5 + q.x * 2.5, p.y * 0.5 - t * 1.6));
    bands = pow(bands, 1.6); // sharpen the ribbons so they read as curtains

    float aurora = smoothstep(0.16, 0.85, n * 0.55 + bands * 0.7);

    // Concentrate the glow toward the top, fade out near the bottom.
    float vgrad = smoothstep(0.0, 1.0, vUv.y);
    aurora *= mix(0.1, 1.0, vgrad);

    // Mix the two band colors by noise, with a hot core where it's brightest.
    vec3 col = mix(uColor2, uColor, smoothstep(0.3, 1.0, aurora));
    col += uColor * pow(aurora, 3.0) * 0.6;

    float alpha = aurora * uOpacity;
    gl_FragColor = vec4(col, alpha);
  }
`

function disposeAurora() {
  if (!state) return

  cancelAnimationFrame(state.rafId)
  window.removeEventListener("resize", state.onResize)
  document.removeEventListener("mousemove", state.onMouseMove)
  state.themeObserver.disconnect()

  state.mesh.geometry.dispose()
  state.material.dispose()
  state.renderer.dispose()
  state.scene.clear()

  const canvas = state.renderer.domElement
  canvas.parentNode?.removeChild(canvas)

  state = null
}

export function initAurora() {
  const container = document.getElementById("three-container")
  if (!container) return

  // ViewTransitions persists the container; bail if we already rendered.
  if (container.querySelector("canvas")) return

  disposeAurora()

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches

  const scene = new THREE.Scene()
  const camera = new THREE.Camera() // unused by the fullscreen quad

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  container.appendChild(renderer.domElement)

  let dark = isDarkTheme()

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uResolution: {
        value: new THREE.Vector2(window.innerWidth, window.innerHeight),
      },
      uColor: { value: getAccent() },
      uColor2: { value: getSecondary() },
      uOpacity: { value: dark ? 0.82 : 0.5 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: dark ? THREE.AdditiveBlending : THREE.NormalBlending,
  })

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
  scene.add(mesh)

  // --- Interaction -----------------------------------------------------------
  let mouseTargetX = 0
  let mouseTargetY = 0

  const onMouseMove = (event: MouseEvent) => {
    mouseTargetX = (event.clientX / window.innerWidth) * 2 - 1
    mouseTargetY = -(event.clientY / window.innerHeight) * 2 + 1
  }

  const onResize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight)
    material.uniforms.uResolution.value.set(
      window.innerWidth,
      window.innerHeight
    )
  }

  const themeObserver = new MutationObserver(() => {
    dark = isDarkTheme()
    material.uniforms.uColor.value = getAccent()
    material.uniforms.uColor2.value = getSecondary()
    material.uniforms.uOpacity.value = dark ? 0.82 : 0.5
    material.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending
    material.needsUpdate = true
  })
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  })

  const clock = new THREE.Clock()
  let time = 0

  const animate = () => {
    if (!state) return

    const dt = Math.min(clock.getDelta(), 0.05)
    if (!reduceMotion) time += dt
    material.uniforms.uTime.value = time

    // Ease the mouse uniform toward its target for a fluid trailing feel.
    const mouse = material.uniforms.uMouse.value as THREE.Vector2
    mouse.x += (mouseTargetX - mouse.x) * 0.05
    mouse.y += (mouseTargetY - mouse.y) * 0.05

    renderer.render(scene, camera)
    state.rafId = requestAnimationFrame(animate)
  }

  document.addEventListener("mousemove", onMouseMove)
  window.addEventListener("resize", onResize)

  state = {
    renderer,
    scene,
    camera,
    mesh,
    material,
    clock,
    rafId: 0,
    onResize,
    onMouseMove,
    themeObserver,
  }

  animate()
}
