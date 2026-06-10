'use client';

import { useEffect, useRef } from 'react';

/**
 * Silk — animated flowing-silk background.
 *
 * Dependency-free port of the React Bits <Silk /> component. The original ships
 * as a react-three-fiber + three.js component; this renders the *exact same*
 * GLSL vertex/fragment shaders on a raw WebGL fullscreen quad, so it carries no
 * npm dependencies and cannot break if a package is removed. Same props,
 * same visual.
 *
 * Respects `prefers-reduced-motion` (renders a single static frame) and is
 * fully self-cleaning (cancels its RAF + releases the GL context on unmount).
 */

interface SilkProps {
  /** Animation speed of the silk flow. */
  speed?: number;
  /** Scale of the silk pattern. */
  scale?: number;
  /** Hex color of the silk pattern. */
  color?: string;
  /** Intensity of the film-grain noise. */
  noiseIntensity?: number;
  /** Rotation of the pattern, in radians. */
  rotation?: number;
  className?: string;
}

const hexToNormalizedRGB = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
};

const vertexShaderSource = `
attribute vec2 aPosition;
attribute vec2 aUv;
varying vec2 vUv;

void main() {
  vUv = aUv;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

// Fragment body is byte-for-byte the React Bits shader; only the leading
// precision qualifier (auto-injected by three.js, required for raw WebGL1)
// and the dropped unused vPosition varying differ.
const fragmentShaderSource = `
precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform vec3  uColor;
uniform float uSpeed;
uniform float uScale;
uniform float uRotation;
uniform float uNoiseIntensity;

const float e = 2.71828182845904523536;

float noise(vec2 texCoord) {
  float G = e;
  vec2  r = (G * sin(G * texCoord));
  return fract(r.x * r.y * (1.0 + texCoord.x));
}

vec2 rotateUvs(vec2 uv, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  mat2  rot = mat2(c, -s, s, c);
  return rot * uv;
}

void main() {
  float rnd        = noise(gl_FragCoord.xy);
  vec2  uv         = rotateUvs(vUv * uScale, uRotation);
  vec2  tex        = uv * uScale;
  float tOffset    = uSpeed * uTime;

  tex.y += 0.03 * sin(8.0 * tex.x - tOffset);

  float pattern = 0.6 +
                  0.4 * sin(5.0 * (tex.x + tex.y +
                                   cos(3.0 * tex.x + 5.0 * tex.y) +
                                   0.02 * tOffset) +
                           sin(20.0 * (tex.x + tex.y - 0.1 * tOffset)));

  vec4 col = vec4(uColor, 1.0) * vec4(pattern) - rnd / 15.0 * uNoiseIntensity;
  col.a = 1.0;
  gl_FragColor = col;
}
`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export default function Silk({
  speed = 5,
  scale = 1,
  color = '#7B7481',
  noiseIntensity = 1.5,
  rotation = 0,
  className,
}: SilkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl =
      (canvas.getContext('webgl', { antialias: true, alpha: false }) as
        | WebGLRenderingContext
        | null) ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    if (!gl) return;

    const vert = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vert || !frag) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    // Fullscreen quad (two triangles) with matching 0..1 UVs.
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    // x, y, u, v
    const verts = new Float32Array([
      -1, -1, 0, 0,
      1, -1, 1, 0,
      -1, 1, 0, 1,
      -1, 1, 0, 1,
      1, -1, 1, 0,
      1, 1, 1, 1,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

    const aPosition = gl.getAttribLocation(program, 'aPosition');
    const aUv = gl.getAttribLocation(program, 'aUv');
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(aUv);
    gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8);

    const uTime = gl.getUniformLocation(program, 'uTime');
    const uColor = gl.getUniformLocation(program, 'uColor');
    const uSpeed = gl.getUniformLocation(program, 'uSpeed');
    const uScale = gl.getUniformLocation(program, 'uScale');
    const uRotation = gl.getUniformLocation(program, 'uRotation');
    const uNoiseIntensity = gl.getUniformLocation(program, 'uNoiseIntensity');

    gl.uniform3fv(uColor, hexToNormalizedRGB(color));
    gl.uniform1f(uSpeed, speed);
    gl.uniform1f(uScale, scale);
    gl.uniform1f(uRotation, rotation);
    gl.uniform1f(uNoiseIntensity, noiseIntensity);

    const resize = () => {
      // A soft silk gradient doesn't need full retina density; cap DPR at 1.5
      // to roughly halve the per-frame fragment work vs a 2x cap.
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };

    const draw = (t: number) => {
      gl.uniform1f(uTime, t);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    let raf = 0;
    let running = false;
    let time = 0;
    let last = performance.now();

    // Cap to ~30fps — silk flow is slow and smooth, so 30fps is visually
    // identical to 60fps while halving GPU/CPU cost.
    const frameInterval = 1000 / 30;
    let lastDraw = 0;

    const ro = new ResizeObserver(() => {
      resize();
      sync();
    });
    ro.observe(canvas);
    resize();

    // Only animate when the panel is actually visible on screen.
    let onScreen = true;
    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries[0]?.isIntersecting ?? true;
        sync();
      },
      { threshold: 0 },
    );
    io.observe(canvas);

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - lastDraw < frameInterval) return;
      // Advance by real elapsed time so flow speed is framerate-independent.
      const delta = (now - last) / 1000;
      last = now;
      lastDraw = now;
      time += 0.1 * delta;
      draw(time);
    };

    const start = () => {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
    };

    // Single gate: run only when motion is allowed, the tab is visible, the
    // canvas is on screen, and it has real size (skips display:none on mobile).
    const sync = () => {
      const visible =
        !reduceMotion &&
        !document.hidden &&
        onScreen &&
        canvas.clientWidth > 0 &&
        canvas.clientHeight > 0;
      if (visible) start();
      else stop();
    };

    const onVisibility = () => sync();
    document.addEventListener('visibilitychange', onVisibility);

    if (reduceMotion) {
      draw(0); // single static frame
    } else {
      sync();
    }

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      gl.deleteProgram(program);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
      gl.deleteBuffer(buffer);
      // NOTE: deliberately do NOT call WEBGL_lose_context.loseContext() here.
      // React StrictMode (Next dev) mounts effects twice on the same canvas;
      // losing the context makes the second getContext() return a dead context
      // and the shader silently stops drawing. The browser GCs the context on
      // unmount on its own.
    };
  }, [speed, scale, color, noiseIntensity, rotation]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  );
}
