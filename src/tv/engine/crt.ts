'use client';

/**
 * The CRT pass.
 *
 * Takes the composited 2D canvas as a texture and runs it through one fullscreen
 * fragment shader: barrel warp, aperture grille, scanlines, chromatic
 * aberration, phosphor bloom, static, rolling bar, vignette, and the power-off
 * collapse. This is "Path B" — one shader, no 3D scene, ~90% of the payoff.
 *
 * If WebGL is unavailable or the context is lost, `Crt.ok` goes false and the
 * caller falls back to showing the source canvas directly. The picture goes
 * flat; the site keeps working.
 */

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `
// highp is optional in WebGL1 fragment shaders. Older mobile GPUs will fail to
// compile the whole program rather than degrade, so ask before using it.
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform sampler2D uTex;
uniform vec2  uRes;        // output resolution in device pixels
uniform float uTime;
uniform float uWarp;       // barrel distortion amount
uniform float uStatic;     // 0..1 static mix, driven by the tuner
uniform vec2  uScale;      // picture geometry; (1,1) is a normal raster
uniform float uFlash;      // additive phosphor bloom during power transitions
uniform float uBloom;
uniform float uScan;       // scanline depth
uniform float uBright;
uniform vec3  uTint;       // per-channel colour cast
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

vec2 warp(vec2 uv, float amount) {
  uv = uv * 2.0 - 1.0;
  vec2 offset = abs(uv.yx) / vec2(6.0, 4.5);
  uv += uv * offset * offset * amount;
  return uv * 0.5 + 0.5;
}

// Cheap bright-pass bloom: a few taps of the neighbourhood, keeping only the
// parts already bright. A real two-pass gaussian is better; at 640x480 behind
// scanlines nobody can tell.
vec3 bloomTap(vec2 uv, float r) {
  vec3 sum = vec3(0.0);
  sum += texture2D(uTex, uv + vec2( r,  0.0)).rgb;
  sum += texture2D(uTex, uv + vec2(-r,  0.0)).rgb;
  sum += texture2D(uTex, uv + vec2( 0.0,  r)).rgb;
  sum += texture2D(uTex, uv + vec2( 0.0, -r)).rgb;
  sum += texture2D(uTex, uv + vec2( r,  r) * 0.7).rgb;
  sum += texture2D(uTex, uv + vec2(-r,  r) * 0.7).rgb;
  sum += texture2D(uTex, uv + vec2( r, -r) * 0.7).rgb;
  sum += texture2D(uTex, uv + vec2(-r, -r) * 0.7).rgb;
  return sum / 8.0;
}

void main() {
  vec2 uv = vUv;

  // ---- raster geometry ----
  // Driven by a keyframe timeline in JS, so the same two uniforms cover the
  // power-off collapse to a line and then a dot, and the power-on snap open
  // with its overshoot. Deflection is a physical thing that can overshoot, so
  // uScale is allowed above 1.
  if (uScale.x != 1.0 || uScale.y != 1.0) {
    uv = vec2(0.5, 0.5) + (uv - 0.5) / max(uScale, vec2(0.0015));
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }
  }

  uv = warp(uv, uWarp);

  // outside the tube face is bezel, not picture
  if (uv.x < -0.002 || uv.x > 1.002 || uv.y < -0.002 || uv.y > 1.002) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  uv = clamp(uv, 0.0, 1.0);

  // ---- chromatic aberration, stronger toward the edges ----
  float edge = length(uv - 0.5);
  float ca = (0.0012 + edge * 0.0028) * (1.0 + uStatic * 2.0);
  vec3 col = vec3(
    texture2D(uTex, uv + vec2( ca, 0.0)).r,
    texture2D(uTex, uv).g,
    texture2D(uTex, uv + vec2(-ca, 0.0)).b
  );

  // ---- phosphor bloom ----
  vec3 b = bloomTap(uv, 0.0022);
  b = max(b - 0.28, 0.0);
  col += b * uBloom;

  // ---- horizontal jitter while tuning ----
  if (uStatic > 0.001) {
    float rowNoise = hash(vec2(floor(uv.y * 240.0), floor(uTime * 24.0)));
    float shift = (rowNoise - 0.5) * 0.06 * uStatic;
    col = mix(col, texture2D(uTex, clamp(uv + vec2(shift, 0.0), 0.0, 1.0)).rgb, uStatic * 0.85);
  }

  // ---- scanlines ----
  // Tied to the *signal*, not to output pixels. A 480-line picture has 480
  // scanlines whether it is displayed on a phone or a 5K monitor. Drawing one
  // per device pixel instead produces a moire mess on any high-DPR screen.
  // Below ~2 device pixels per line they stop resolving, so fade them out
  // rather than alias.
  float lineCount = min(480.0, uRes.y * 0.5);
  float lineFade = smoothstep(120.0, 300.0, uRes.y);
  float lines = sin(uv.y * lineCount * 3.14159265);
  col *= 1.0 - uScan * lineFade * 0.5 * (1.0 - lines * lines);

  // ---- aperture grille: R,G,B on a 3px horizontal cycle ----
  float m = mod(gl_FragCoord.x, 3.0);
  vec3 mask = vec3(0.86);
  if (m < 1.0)      mask.r = 1.22;
  else if (m < 2.0) mask.g = 1.22;
  else              mask.b = 1.22;
  col *= mask;

  // ---- rolling bar: a soft band of extra brightness drifting up ----
  float bar = fract(uv.y + uTime * 0.06);
  col *= 1.0 + 0.05 * smoothstep(0.0, 0.06, bar) * (1.0 - smoothstep(0.06, 0.14, bar));

  // ---- static ----
  // Snapped to a fixed grid so the grain is the size of a signal pixel rather
  // than a device pixel — otherwise static looks finer on better screens, which
  // is exactly backwards.
  if (uStatic > 0.001) {
    float n = hash(floor(uv * vec2(440.0, 330.0)) + uTime * 91.7);
    col = mix(col, vec3(n) * vec3(1.0, 1.0, 1.02), uStatic * 0.92);
  }

  // ---- always-present film grain, so flat areas are never dead ----
  col += (hash(uv * 900.0 + uTime * 13.0) - 0.5) * 0.035;

  // ---- channel tint ----
  col *= uTint;
  col *= uBright;

  // ---- vignette ----
  vec2 v = vUv * (1.0 - vUv.yx);
  float vig = pow(clamp(v.x * v.y * 22.0, 0.0, 1.0), 0.22);
  col *= vig;

  // ---- phosphor bloom during a power transition ----
  // As the raster collapses, the same beam energy is concentrated into a
  // smaller and smaller area, so the picture does not just shrink — it blows
  // out to white on the way. Squeezing the geometry without this reads as a
  // CSS transform; with it, it reads as a tube.
  col += uFlash;

  // the glass itself is never perfectly black
  col = max(col, vec3(0.008, 0.010, 0.013));

  gl_FragColor = vec4(col, 1.0);
}
`;

export type CrtUniforms = {
  warp: number;
  static: number;
  /** Raster geometry. [1, 1] is a normal picture; may exceed 1 on overshoot. */
  scale: [number, number];
  /** Additive white bloom, for the power transitions. */
  flash: number;
  bloom: number;
  scan: number;
  bright: number;
  tint: [number, number, number];
};

export const DEFAULT_UNIFORMS: CrtUniforms = {
  warp: 0.42,
  static: 0,
  scale: [1, 1],
  flash: 0,
  bloom: 0.5,
  scan: 0.75,
  bright: 1.06,
  tint: [1, 1, 1],
};

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`CRT shader compile failed: ${log}`);
  }
  return sh;
}

export class Crt {
  ok = false;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private tex: WebGLTexture | null = null;
  private buf: WebGLBuffer | null = null;
  private shaders: WebGLShader[] = [];
  private loc: Record<string, WebGLUniformLocation | null> = {};
  private onLost = (e: Event) => {
    e.preventDefault();
    this.ok = false;
  };
  private onRestored = () => {
    try {
      this.init();
    } catch {
      this.ok = false;
    }
  };

  private canvas: HTMLCanvasElement;

  /** Why the shader is unavailable, if it is. Surfaced for debugging on device. */
  failure: string | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    canvas.addEventListener('webglcontextlost', this.onLost as EventListener);
    canvas.addEventListener('webglcontextrestored', this.onRestored);
    try {
      this.init();
    } catch (err) {
      this.ok = false;
      this.failure = err instanceof Error ? err.message : String(err);
      // Falling back is the designed behaviour, not a crash — but silently
      // swallowing the reason makes "why is my TV flat?" unanswerable.
      console.warn('[crt] falling back to simple picture mode:', this.failure);
    }
  }

  private init() {
    const gl = (this.canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      powerPreference: 'low-power',
    }) ||
      this.canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) {
      throw new Error('no WebGL context available');
    }
    if (gl.isContextLost()) {
      // Nothing can be created on a lost context; every createShader would
      // return null and fail with an empty log, which is baffling to debug.
      throw new Error('WebGL context is lost');
    }
    this.gl = gl;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    this.shaders = [vs, fs];

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`CRT link failed: ${gl.getProgramInfoLog(prog)}`);
    }
    gl.useProgram(prog);
    this.program = prog;

    const buf = gl.createBuffer();
    this.buf = buf;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]), // one oversized triangle
      gl.STATIC_DRAW,
    );
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    for (const name of [
      'uTex', 'uRes', 'uTime', 'uWarp', 'uStatic',
      'uScale', 'uFlash', 'uBloom', 'uScan', 'uBright', 'uTint',
    ]) {
      this.loc[name] = gl.getUniformLocation(prog, name);
    }

    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);

    this.ok = true;
  }

  resize(w: number, h: number) {
    if (!this.gl) return;
    if (this.canvas.width === w && this.canvas.height === h) return;
    this.canvas.width = w;
    this.canvas.height = h;
    this.gl.viewport(0, 0, w, h);
  }

  render(source: HTMLCanvasElement, time: number, u: CrtUniforms) {
    const gl = this.gl;
    if (!gl || !this.ok || !this.program) return;

    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);

    gl.uniform1i(this.loc.uTex, 0);
    gl.uniform2f(this.loc.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.loc.uTime, time);
    gl.uniform1f(this.loc.uWarp, u.warp);
    gl.uniform1f(this.loc.uStatic, u.static);
    gl.uniform2f(this.loc.uScale, u.scale[0], u.scale[1]);
    gl.uniform1f(this.loc.uFlash, u.flash);
    gl.uniform1f(this.loc.uBloom, u.bloom);
    gl.uniform1f(this.loc.uScan, u.scan);
    gl.uniform1f(this.loc.uBright, u.bright);
    gl.uniform3f(this.loc.uTint, u.tint[0], u.tint[1], u.tint[2]);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose() {
    this.canvas.removeEventListener('webglcontextlost', this.onLost as EventListener);
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored);
    const gl = this.gl;
    this.ok = false;
    if (!gl) return;

    // Free the resources, but do NOT call WEBGL_lose_context. A canvas element
    // only ever hands out one context; deliberately losing it poisons the
    // element for good, so any remount on the same node (React StrictMode does
    // exactly this in development) gets a dead context where every createShader
    // returns null and the failure is unreadable.
    if (!gl.isContextLost()) {
      for (const sh of this.shaders) gl.deleteShader(sh);
      if (this.program) gl.deleteProgram(this.program);
      if (this.buf) gl.deleteBuffer(this.buf);
      if (this.tex) gl.deleteTexture(this.tex);
    }
    this.shaders = [];
    this.program = null;
    this.buf = null;
    this.tex = null;
    this.gl = null;
  }
}

/** #rrggbb -> a gentle multiplicative tint, kept close to white. */
export function tintFromHex(hex: string, strength = 0.16): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return [1, 1, 1];
  const rgb = [1, 2, 3].map((i) => parseInt(m[i], 16) / 255);
  const mean = (rgb[0] + rgb[1] + rgb[2]) / 3 || 1;
  return rgb.map((c) => 1 + (c / mean - 1) * strength) as [number, number, number];
}
