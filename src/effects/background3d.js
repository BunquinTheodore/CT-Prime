/**
 * Aurora ribbon background: one full screen quad with a fragment shader that
 * echoes the brand banners (blurred Prime blue ribbon on Night, Ember glow
 * bottom right). Raw WebGL1 (one buffer, one program), no library. Degrades to
 * the static CSS rendition (.bg-fallback) before any GL work, and again at
 * runtime if the measured FPS is low.
 */
const MAX_DPR = 1.5
const RENDER_SCALE = 0.5
const MOBILE_FPS_CAP = 30
const MEASURE_MS = 2000
const MIN_FPS = 24
const RESIZE_DEBOUNCE_MS = 150
const FADE_OUT_MS = 700
const GLOW_HOME = { x: 0.82, y: 0.2 }
const GLOW_PULL = 0.28
const GLOW_EASE = 0.035
const HAS_CLASS = 'has-bg3d'

const VERTEX = /* glsl */ `
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`

const FRAGMENT = /* glsl */ `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
  #else
  precision mediump float;
  #endif
  uniform float uTime;
  uniform vec2 uRes;
  uniform vec2 uGlow;
  varying vec2 vUv;

  const vec3 NIGHT = vec3(0.035, 0.043, 0.063);
  const vec3 DEEP = vec3(0.051, 0.102, 0.227);
  const vec3 PRIME = vec3(0.337, 0.514, 0.855);
  const vec3 EMBER = vec3(0.816, 0.549, 0.439);
  const vec3 STREAK = vec3(0.663, 0.757, 0.949);

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x);
    float b = mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x);
    return mix(a, b, u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      v += amp * noise(p);
      p = p * 2.03 + 17.1;
      amp *= 0.5;
    }
    return v;
  }

  void main() {
    float aspect = uRes.x / uRes.y;
    vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
    float t = uTime * 0.04;

    // Ribbon space: q.x runs along the 45 degree CT slash, q.y across it.
    vec2 q = vec2(p.x + p.y, p.y - p.x) * 0.7071;
    vec2 w = vec2(fbm(q * 1.3 + vec2(t, -t)), fbm(q * 1.3 + vec2(-t * 0.8, t) + 5.2));
    float s = q.y + (w.x - 0.5) * 0.55 + 0.18 * sin(q.x * 1.7 + t * 6.0);

    float core = exp(-s * s * 10.0);
    float halo = exp(-s * s * 3.8);
    float b2 = (s - 0.42 + (w.y - 0.5) * 0.3) * 4.5;
    float band2 = exp(-b2 * b2);
    float k = (s + 0.06 + (w.y - 0.5) * 0.12) * 30.0;
    float streak = exp(-k * k) * smoothstep(0.9, 0.0, abs(q.x));

    vec3 col = mix(NIGHT, DEEP, halo * 0.7);
    col += PRIME * (core * 0.2 + band2 * 0.05);
    col += STREAK * streak * 0.05;

    vec2 gp = (uGlow - 0.5) * vec2(aspect, 1.0) + 0.04 * vec2(sin(t * 5.0), cos(t * 4.0));
    float gd = length(p - gp);
    col += EMBER * exp(-gd * gd * 4.5) * 0.18;

    float vig = smoothstep(1.25, 0.35, length(p));
    col = mix(NIGHT, col, 0.4 + 0.6 * vig);
    col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0;
    gl_FragColor = vec4(col, 1.0);
  }
`

let session = null

function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2') || c.getContext('webgl')
    if (!gl) return false
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}

/** Decided before any GL setup. Returns a reason, or '' when 3D may run. */
function degradeReason() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'reduced-motion'
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) return 'low-cpu'
  if (navigator.deviceMemory && navigator.deviceMemory <= 4) return 'low-memory'
  if (!hasWebGL()) return 'no-webgl'
  return ''
}

const isMobile = () => window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768

const QUAD = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])

function compile(gl, type, src) {
  const sh = gl.createShader(type)
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || 'shader compile')
  return sh
}

function buildScene(canvas, mobile) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power' })
  if (!gl) throw new Error('no webgl')
  const shaders = [compile(gl, gl.VERTEX_SHADER, VERTEX), compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)]
  const program = gl.createProgram()
  shaders.forEach((sh) => gl.attachShader(program, sh))
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'program link')
  gl.useProgram(program)

  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW)
  const pos = gl.getAttribLocation(program, 'position')
  gl.enableVertexAttribArray(pos)
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0)

  const loc = {
    time: gl.getUniformLocation(program, 'uTime'),
    res: gl.getUniformLocation(program, 'uRes'),
    glow: gl.getUniformLocation(program, 'uGlow'),
  }
  const ratio = Math.min(window.devicePixelRatio || 1, MAX_DPR) * RENDER_SCALE
  return { gl, canvas, program, buffer, shaders, loc, ratio, mobile, glow: { ...GLOW_HOME } }
}

/** Sizes the drawing buffer from the element (CSS height is 100lvh, not innerHeight). */
function resize(gfx) {
  const r = gfx.canvas.getBoundingClientRect()
  const w = Math.max(1, Math.round(r.width * gfx.ratio))
  const h = Math.max(1, Math.round(r.height * gfx.ratio))
  if (gfx.canvas.width !== w) gfx.canvas.width = w
  if (gfx.canvas.height !== h) gfx.canvas.height = h
  gfx.gl.viewport(0, 0, w, h)
  gfx.gl.uniform2f(gfx.loc.res, w, h)
}

function render(gfx, seconds) {
  const { gl, loc, glow } = gfx
  gl.uniform1f(loc.time, seconds)
  gl.uniform2f(loc.glow, glow.x, glow.y)
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
}

/** Ember glow drifts a little toward the pointer, smoothed per frame. */
function stepGlow(gfx, target) {
  const g = gfx.glow
  g.x += (target.x - g.x) * GLOW_EASE
  g.y += (target.y - g.y) * GLOW_EASE
}

function createLoop(gfx, s) {
  const gap = 1000 / MOBILE_FPS_CAP
  const frame = (now) => {
    s.raf = requestAnimationFrame(frame)
    if (gfx.mobile && now - s.last < gap - 2) return
    s.last = now
    stepGlow(gfx, s.glowTarget)
    render(gfx, now / 1000)
    measure(s, now)
  }
  return frame
}

/** Counts frames for the first 2s of visible time; too slow means fall back. */
function measure(s, now) {
  if (s.measured) return
  if (!s.measureStart) {
    s.measureStart = now
    s.frames = 0
    document.documentElement.classList.add(HAS_CLASS)
    return
  }
  s.frames += 1
  const elapsed = now - s.measureStart
  if (elapsed < MEASURE_MS) return
  s.measured = true
  if ((s.frames * 1000) / elapsed < MIN_FPS) s.dispose()
}

function bindEvents(gfx, s, run, stop) {
  let resizeTimer = 0
  let scrollRaf = 0
  const hero = document.getElementById('top')
  const { canvas } = gfx

  const onResize = () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => resize(gfx), RESIZE_DEBOUNCE_MS)
  }
  const onPointer = (e) => {
    const tx = e.clientX / window.innerWidth
    const ty = 1 - e.clientY / window.innerHeight
    s.glowTarget.x = GLOW_HOME.x + (tx - GLOW_HOME.x) * GLOW_PULL
    s.glowTarget.y = GLOW_HOME.y + (ty - GLOW_HOME.y) * GLOW_PULL
  }
  const applyDim = () => {
    scrollRaf = 0
    const span = hero ? hero.offsetHeight : window.innerHeight
    const dim = Math.min(1, Math.max(0, window.scrollY / Math.max(1, span)))
    canvas.style.setProperty('--bg3d-dim', dim.toFixed(3))
  }
  const onScroll = () => {
    if (!scrollRaf) scrollRaf = requestAnimationFrame(applyDim)
  }
  const onVisibility = () => {
    if (!document.hidden) return run()
    if (!s.measured) s.measureStart = 0
    stop()
  }
  const onLost = (e) => {
    e.preventDefault()
    s.dispose()
  }

  window.addEventListener('resize', onResize, { passive: true })
  window.addEventListener('pointermove', onPointer, { passive: true })
  window.addEventListener('scroll', onScroll, { passive: true })
  document.addEventListener('visibilitychange', onVisibility)
  canvas.addEventListener('webglcontextlost', onLost)
  applyDim()

  return () => {
    clearTimeout(resizeTimer)
    cancelAnimationFrame(scrollRaf)
    window.removeEventListener('resize', onResize)
    window.removeEventListener('pointermove', onPointer)
    window.removeEventListener('scroll', onScroll)
    document.removeEventListener('visibilitychange', onVisibility)
    canvas.removeEventListener('webglcontextlost', onLost)
  }
}

function releaseGpu(gfx) {
  const { gl } = gfx
  gl.deleteBuffer(gfx.buffer)
  gfx.shaders.forEach((sh) => gl.deleteShader(sh))
  gl.deleteProgram(gfx.program)
  gl.getExtension('WEBGL_lose_context')?.loseContext()
}

async function start(canvas) {
  const gfx = buildScene(canvas, isMobile())
  const s = { raf: 0, last: 0, frames: 0, measureStart: 0, measured: false, disposed: false, glowTarget: { ...GLOW_HOME } }

  const frame = createLoop(gfx, s)
  const run = () => {
    if (!s.disposed && !document.hidden && !s.raf) s.raf = requestAnimationFrame(frame)
  }
  const stop = () => {
    cancelAnimationFrame(s.raf)
    s.raf = 0
  }
  let unbind = () => {}

  s.dispose = () => {
    if (s.disposed) return
    s.disposed = true
    stop()
    unbind()
    document.documentElement.classList.remove(HAS_CLASS)
    session = null
    setTimeout(() => releaseGpu(gfx), FADE_OUT_MS)
  }
  session = s
  resize(gfx)
  unbind = bindEvents(gfx, s, run, stop)
  run()
}

export function initBackground3D() {
  const canvas = document.getElementById('bg3d')
  if (!canvas || session || canvas.dataset.bg3d) return
  canvas.dataset.bg3d = 'init'
  if (degradeReason() || isMobile()) return // phones keep the static CSS aurora: no long shader compile task
  start(canvas).catch(() => {
    if (session) session.dispose()
    document.documentElement.classList.remove(HAS_CLASS)
  })
}

export function disposeBackground3D() {
  if (session) session.dispose()
}
