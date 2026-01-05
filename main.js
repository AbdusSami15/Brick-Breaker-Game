// Breakout - Week 2 (Mouse + Touch)
// Features: states, lives, score, paddle-hit angle, speed-up every 5 paddle hits,
// 2D brick array, brick removal, simple web-audio SFX, update/draw separation.

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const uiOverlay = document.getElementById("uiOverlay");
const panel = document.getElementById("panel");
const titleEl = document.getElementById("title");
const descEl = document.getElementById("desc");
const btnEl = document.getElementById("btn");

const pauseOverlay = document.getElementById("pauseOverlay");
const resumeBtn = document.getElementById("resumeBtn");
const restartBtn = document.getElementById("restartBtn");
const quitBtn = document.getElementById("quitBtn");

// --------------------
// Game Constants
// --------------------
const GAME_STATE = {
  START: "START",
  PLAYING: "PLAYING",
  PAUSED: "PAUSED",
  GAME_OVER: "GAME_OVER",
  WIN: "WIN",
};

const WORLD = {
  w: canvas.width,
  h: canvas.height,
};

const HUD = {
  padding: 14,
};

const PADDLE = {
  w: 120,
  h: 14,
  yOffset: 40,
  speed: 900, // px/sec for keyboard fallback (optional)
};

const BALL = {
  r: 8,
  baseSpeed: 330,
  maxSpeed: 820,
  speedUpEveryHits: 5,
  speedUpIncrement: 20,
};

const BRICKS = {
  padding: 10,
  offsetTop: 70,
  offsetLeft: 55,
  h: 22,
  colors: ["#60a5fa", "#34d399", "#fbbf24", "#f87171", "#a78bfa"],
};

const POWERUPS = {
  dropChance: 0.22,
  fallSpeed: 170,
  size: 16,
  duration: 10, // seconds for timed effects
};

const BG = {
  starCount: 70,
  dustCount: 22,
};

// Levels: pattern 0=empty, 1=normal, 2=strong
const LEVELS = [
  {
    rows: 5,
    cols: 8,
    palette: ["#60a5fa", "#34d399", "#fbbf24", "#f87171", "#a78bfa"],
    pattern: [
      [1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1],
    ],
  },
  {
    rows: 6,
    cols: 10,
    palette: ["#34d399", "#60a5fa", "#fbbf24", "#a78bfa", "#f87171"],
    pattern: [
      [1,0,1,0,1,0,1,0,1,0],
      [0,1,0,1,0,1,0,1,0,1],
      [1,0,1,0,1,0,1,0,1,0],
      [0,1,0,2,0,2,0,1,0,1],
      [1,0,1,0,1,0,1,0,1,0],
      [0,1,0,1,0,1,0,1,0,1],
    ],
  },
  {
    rows: 7,
    cols: 12,
    palette: ["#fbbf24", "#f59e0b", "#ef4444", "#a78bfa", "#60a5fa"],
    pattern: [
      [2,2,2,2,2,2,2,2,2,2,2,2],
      [0,1,1,1,1,1,1,1,1,1,1,0],
      [0,0,1,1,1,1,1,1,1,1,0,0],
      [0,0,0,1,1,1,1,1,1,0,0,0],
      [0,0,1,1,1,1,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,1,1,1,1,0],
      [2,0,0,0,0,0,0,0,0,0,0,2],
    ],
  },
  {
    rows: 6,
    cols: 10,
    palette: ["#a78bfa", "#60a5fa", "#34d399", "#fbbf24", "#f87171"],
    pattern: [
      [1,1,1,2,2,2,1,1,1,1],
      [1,0,1,0,0,0,1,0,1,1],
      [1,0,1,1,1,1,1,0,1,2],
      [2,0,1,0,0,0,1,0,1,1],
      [1,0,1,1,1,1,1,0,1,1],
      [1,1,1,2,2,2,1,1,1,1],
    ],
  },
  {
    rows: 8,
    cols: 12,
    palette: ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6"],
    pattern: [
      [0,0,0,0,2,2,2,2,0,0,0,0],
      [0,0,0,1,1,1,1,1,1,0,0,0],
      [0,0,1,1,0,0,0,0,1,1,0,0],
      [0,1,1,0,0,2,2,0,0,1,1,0],
      [0,1,1,0,0,2,2,0,0,1,1,0],
      [0,0,1,1,0,0,0,0,1,1,0,0],
      [0,0,0,1,1,1,1,1,1,0,0,0],
      [0,0,0,0,2,2,2,2,0,0,0,0],
    ],
  },
];

// --------------------
// Game State
// --------------------
let state = GAME_STATE.START;

let score = 0;
let lives = 3;
let level = 1;
let highScore = 0;
const HS_KEY = "bb2_highscore";
try {
  const savedHS = localStorage.getItem(HS_KEY);
  if (savedHS != null) highScore = parseInt(savedHS, 10) || 0;
} catch (e) {}

let currentLevelDef = LEVELS[0];
let levelGeom = { rows: 0, cols: 0, brickW: 0 };

// Paddle
const paddle = {
  x: (WORLD.w - PADDLE.w) * 0.5,
  y: WORLD.h - PADDLE.yOffset,
  w: PADDLE.w,
  h: PADDLE.h,
};
let p1Left = false;
let p1Right = false;

// Balls (vx/vy are in px/sec)
let balls = [];

function createBall(x, y, speed, dirX, dirY) {
  const dir = normalize(dirX, dirY);
  return {
    x,
    y,
    r: BALL.r,
    vx: dir.x * speed,
    vy: dir.y * speed,
    speed,
    paddleHitCount: 0,
    trail: [],
    color: "#ffffff",
  };
}

// Bricks: 2D array
let bricks = []; // bricks[row][col] => null | {x,y,w,h,alive,color,hp,maxHp}

// Timing
let lastTime = 0;

// Input
let pointerX = paddle.x + paddle.w * 0.5;
let isPointerDown = false;
let pointerTargetX = pointerX;
let pointerIsTouch = false;
let touchDragging = false;

// Audio
let audioCtx = null;
let audioDest = null; // master destination (e.g., compressor)
let reverbNode = null; // global convolver (small room)
let noiseBuffer = null; // white noise buffer cache

// Visual feedback
let missFlashT = 0; // seconds remaining for miss flash

// Power-ups
let powerUps = []; // {x,y,vy,type,alive}
let paddleWTimer = 0;
let speedBoostTimer = 0;

// Background
let bgStars = [];
let bgDust = [];
let nowT = 0;

// --------------------
// Helpers
// --------------------
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function rectCircleCollide(rx, ry, rw, rh, cx, cy, cr) {
  // Find closest point on rect to circle center
  const closestX = clamp(cx, rx, rx + rw);
  const closestY = clamp(cy, ry, ry + rh);
  const dx = cx - closestX;
  const dy = cy - closestY;
  return (dx * dx + dy * dy) <= (cr * cr);
}

function normalize(vx, vy) {
  const len = Math.hypot(vx, vy) || 1;
  return { x: vx / len, y: vy / len };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function initBackground() {
  bgStars = [];
  bgDust = [];

  for (let i = 0; i < BG.starCount; i++) {
    bgStars.push({
      x: Math.random() * WORLD.w,
      y: Math.random() * WORLD.h,
      r: 0.6 + Math.random() * 1.4,
      a: 0.12 + Math.random() * 0.35,
      s: 6 + Math.random() * 24,
    });
  }

  for (let i = 0; i < BG.dustCount; i++) {
    bgDust.push({
      x: Math.random() * WORLD.w,
      y: Math.random() * WORLD.h,
      r: 18 + Math.random() * 70,
      a: 0.03 + Math.random() * 0.06,
    });
  }
}

function drawBackground(t) {
  // Base gradient
  const g = ctx.createLinearGradient(0, 0, 0, WORLD.h);
  g.addColorStop(0, "#070a12");
  g.addColorStop(0.45, "#0b1221");
  g.addColorStop(1, "#071827");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);

  // Soft moving glows
  const glow1 = ctx.createRadialGradient(WORLD.w * 0.15, WORLD.h * 0.2, 10, WORLD.w * 0.15, WORLD.h * 0.2, WORLD.w * 0.7);
  glow1.addColorStop(0, "rgba(96,165,250,0.14)");
  glow1.addColorStop(1, "rgba(96,165,250,0)");
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);

  const gx = WORLD.w * (0.75 + 0.06 * Math.sin(t * 0.25));
  const gy = WORLD.h * (0.35 + 0.06 * Math.cos(t * 0.22));
  const glow2 = ctx.createRadialGradient(gx, gy, 10, gx, gy, WORLD.w * 0.6);
  glow2.addColorStop(0, "rgba(167,139,250,0.12)");
  glow2.addColorStop(1, "rgba(167,139,250,0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);

  // Dust blobs
  for (let i = 0; i < bgDust.length; i++) {
    const d = bgDust[i];
    const x = d.x + Math.sin(t * 0.15 + i) * 6;
    const y = d.y + Math.cos(t * 0.13 + i * 1.7) * 6;
    const dg = ctx.createRadialGradient(x, y, 0, x, y, d.r);
    dg.addColorStop(0, `rgba(255,255,255,${d.a})`);
    dg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = dg;
    ctx.fillRect(x - d.r, y - d.r, d.r * 2, d.r * 2);
  }

  // Stars (subtle vertical drift)
  ctx.fillStyle = "#e5e7eb";
  for (let i = 0; i < bgStars.length; i++) {
    const s = bgStars[i];
    const yy = (s.y + t * s.s) % (WORLD.h + 10) - 5;
    ctx.globalAlpha = s.a;
    ctx.beginPath();
    ctx.arc(s.x, yy, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Subtle vignette
  const v = ctx.createRadialGradient(WORLD.w * 0.5, WORLD.h * 0.5, WORLD.h * 0.2, WORLD.w * 0.5, WORLD.h * 0.5, WORLD.h * 0.85);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);

  // Very subtle scanlines
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = "#ffffff";
  for (let y = 0; y < WORLD.h; y += 22) {
    ctx.fillRect(0, y, WORLD.w, 1);
  }
  ctx.globalAlpha = 1;
}

function roundRectPath(x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) * 0.5));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawPaddleBody(p, style = "P1") {
  const r = Math.min(10, p.h * 0.75);

  const isP2 = style === "P2";
  const t = nowT || 0;
  const shift = 0.04 * Math.sin(t * 0.9);

  // Soft glow (tinted)
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = isP2 ? "rgba(250,204,21,0.85)" : "rgba(34,211,238,0.85)";
  roundRectPath(p.x - 2, p.y - 2, p.w + 4, p.h + 4, r + 2);
  ctx.fill();
  ctx.restore();

  // Main body gradient (colorful)
  const g = ctx.createLinearGradient(p.x, p.y, p.x + p.w, p.y + p.h);
  if (!isP2) {
    g.addColorStop(0.0, "#22d3ee");        // cyan
    g.addColorStop(0.45 + shift, "#3b82f6"); // blue
    g.addColorStop(1.0, "#a78bfa");        // purple
  } else {
    g.addColorStop(0.0, "#fbbf24");        // amber
    g.addColorStop(0.45 + shift, "#fb7185"); // rose
    g.addColorStop(1.0, "#60a5fa");        // sky
  }
  ctx.fillStyle = g;
  roundRectPath(p.x, p.y, p.w, p.h, r);
  ctx.fill();

  // Specular highlight strip
  ctx.save();
  roundRectPath(p.x, p.y, p.w, p.h, r);
  ctx.clip();
  const hg = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
  hg.addColorStop(0, "rgba(255,255,255,0.75)");
  hg.addColorStop(0.35, "rgba(255,255,255,0.18)");
  hg.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = hg;
  ctx.fillRect(p.x, p.y, p.w, p.h * 0.55);

  // Inner shadow near bottom
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(p.x, p.y + p.h * 0.72, p.w, p.h * 0.28);
  ctx.restore();

  // Outline
  ctx.strokeStyle = "rgba(15,23,42,0.6)";
  ctx.lineWidth = 1;
  roundRectPath(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1, r);
  ctx.stroke();
}

function setPauseButtonText() {
  const pauseBtn = document.getElementById("pauseBtn");
  if (!pauseBtn) return;
  pauseBtn.textContent = state === GAME_STATE.PAUSED ? "Resume" : "Pause";
}

function setPauseOverlayVisible(show) {
  if (!pauseOverlay) return;
  pauseOverlay.style.display = show ? "grid" : "none";
  pauseOverlay.style.pointerEvents = show ? "auto" : "none";
}

function spawnPowerUp(x, y) {
  const r = Math.random();
  let type = "WIDE";
  if (r < 0.34) type = "WIDE";
  else if (r < 0.67) type = "SPEED";
  else type = "MULTI";

  powerUps.push({
    x,
    y,
    vy: POWERUPS.fallSpeed,
    type,
    alive: true,
  });
}

function applyPowerUp(type) {
  if (type === "WIDE") {
    paddleWTimer = POWERUPS.duration;
    paddle.w = 170;
  } else if (type === "SPEED") {
    speedBoostTimer = POWERUPS.duration;
    for (let i = 0; i < balls.length; i++) {
      balls[i].speed = clamp(balls[i].speed + 90, BALL.baseSpeed, BALL.maxSpeed);
      const n = normalize(balls[i].vx, balls[i].vy);
      balls[i].vx = n.x * balls[i].speed;
      balls[i].vy = n.y * balls[i].speed;
    }
  } else if (type === "MULTI") {
    // Add one extra ball from the first ball
    if (!balls.length) return;
    const b0 = balls[0];
    const n = normalize(b0.vx, b0.vy);
    const angle = (Math.random() < 0.5 ? -1 : 1) * (12 * Math.PI / 180);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = n.x * cos - n.y * sin;
    const dy = n.x * sin + n.y * cos;
    const b = createBall(b0.x, b0.y, b0.speed, dx, dy);
    b.color = "#fbbf24";
    balls.push(b);
  }
}

function pauseGame() {
  if (state !== GAME_STATE.PLAYING) return;
  state = GAME_STATE.PAUSED;
  sfxPause();
  setPauseButtonText();
  setPauseOverlayVisible(true);
}

function resumeGame() {
  if (state !== GAME_STATE.PAUSED) return;
  state = GAME_STATE.PLAYING;
  sfxResume();
  setPauseButtonText();
  setPauseOverlayVisible(false);
}

function setOverlay(show, title, desc, btnText) {
  uiOverlay.style.display = show ? "grid" : "none";
  titleEl.textContent = title ?? "";
  descEl.textContent = desc ?? "";
  btnEl.textContent = btnText ?? "Start";
}

// Simple beep SFX without external files
function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // Master gain and gentle compressor for a more polished sound
    const masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.6;

    const comp = audioCtx.createDynamicsCompressor();
    comp.threshold.setValueAtTime(-24, audioCtx.currentTime);
    comp.knee.setValueAtTime(30, audioCtx.currentTime);
    comp.ratio.setValueAtTime(8, audioCtx.currentTime);
    comp.attack.setValueAtTime(0.003, audioCtx.currentTime);
    comp.release.setValueAtTime(0.25, audioCtx.currentTime);

    // Light room reverb (generated impulse)
    reverbNode = audioCtx.createConvolver();
    reverbNode.buffer = buildImpulseResponse(0.22, 2.8);

    masterGain.connect(comp);
    reverbNode.connect(comp);
    comp.connect(audioCtx.destination);
    audioDest = masterGain;
  }
}

function playBeep(freq = 440, duration = 0.05, type = "sine", gainValue = 0.04) {
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);

  gain.gain.setValueAtTime(gainValue, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  osc.connect(gain);
  gain.connect(audioDest || audioCtx.destination);

  osc.start(t0);
  osc.stop(t0 + duration);
}

// Versatile tone with ADSR and optional pitch glide for more professional sounds
function playTone(options = {}) {
  if (!audioCtx) return;
  const {
    startFreq = 440,
    endFreq = null,
    duration = 0.12,
    type = "sine",
    peakGain = 0.05,
    attack = 0.005,
    decay = 0.04,
    sustain = 0.4, // proportion of peak
    release = 0.04,
    detune = 0, // cents
    wet = 0.12,
  } = options;

  const t0 = audioCtx.currentTime;
  const t1 = t0 + duration;

  const osc = audioCtx.createOscillator();
  const pre = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(startFreq, t0);
  if (endFreq != null) {
    osc.frequency.linearRampToValueAtTime(endFreq, t1);
  }
  if (detune) osc.detune.setValueAtTime(detune, t0);

  // ADSR
  pre.gain.setValueAtTime(0.0001, t0);
  pre.gain.linearRampToValueAtTime(peakGain, t0 + attack);
  pre.gain.linearRampToValueAtTime(peakGain * sustain, t0 + attack + decay);
  pre.gain.setTargetAtTime(0.0001, t1 - release, release);

  osc.connect(pre);
  connectDryWet(pre, wet);

  osc.start(t0);
  osc.stop(t1 + release * 1.5);
}

// Connect a node to dry master and reverb with wet level
function connectDryWet(src, wet = 0.12) {
  if (!audioCtx) return;
  const dryG = audioCtx.createGain();
  dryG.gain.value = 1;
  src.connect(dryG);
  dryG.connect(audioDest || audioCtx.destination);

  if (reverbNode) {
    const wetG = audioCtx.createGain();
    wetG.gain.value = wet;
    src.connect(wetG);
    wetG.connect(reverbNode);
  }
}

// Build a small room impulse response procedurally
function buildImpulseResponse(seconds = 0.25, decay = 2.5) {
  const rate = audioCtx.sampleRate;
  const length = Math.max(1, Math.floor(seconds * rate));
  const buffer = audioCtx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
    }
  }
  return buffer;
}

function ensureNoiseBuffer() {
  if (noiseBuffer && noiseBuffer.sampleRate === audioCtx.sampleRate) return noiseBuffer;
  const rate = audioCtx.sampleRate;
  const length = Math.floor(rate * 1.0);
  const buffer = audioCtx.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buffer;
  return buffer;
}

// Filtered noise burst with ADSR and optional wet send
function playNoiseBurst(options = {}) {
  if (!audioCtx) return;
  const {
    duration = 0.06,
    filterType = "highpass",
    filterFreq = 1500,
    filterQ = 0.8,
    peakGain = 0.04,
    attack = 0.001,
    decay = 0.03,
    sustain = 0.0,
    release = 0.02,
    wet = 0.08,
  } = options;

  const t0 = audioCtx.currentTime;
  const t1 = t0 + duration;

  const src = audioCtx.createBufferSource();
  src.buffer = ensureNoiseBuffer();
  src.loop = true;

  const biq = audioCtx.createBiquadFilter();
  biq.type = filterType;
  biq.frequency.setValueAtTime(filterFreq, t0);
  biq.Q.setValueAtTime(filterQ, t0);

  const pre = audioCtx.createGain();
  pre.gain.setValueAtTime(0.0001, t0);
  pre.gain.linearRampToValueAtTime(peakGain, t0 + attack);
  pre.gain.linearRampToValueAtTime(peakGain * sustain, t0 + attack + decay);
  pre.gain.setTargetAtTime(0.0001, t1 - release, release);

  src.connect(biq);
  biq.connect(pre);
  connectDryWet(pre, wet);

  src.start(t0);
  src.stop(t1 + release * 1.5);
}
// Impact intensity helper (0..1) from current speed
function impactFromSpeed(speed) {
  return clamp((speed - BALL.baseSpeed) / Math.max(1, (BALL.maxSpeed - BALL.baseSpeed)), 0, 1);
}

// SFX set (polished using playTone/noise with envelopes and light pitch glides)
function sfxWall(intensity = 0.5) {
  const t = clamp(intensity, 0, 1);
  const clickGain = 0.02 + t * 0.02;
  const toneGain = 0.02 + t * 0.025;
  const base = 420 + t * 120;
  playNoiseBurst({ duration: 0.026 + t * 0.02, filterType: "bandpass", filterFreq: 1400 + t * 600, filterQ: 1.1, peakGain: clickGain, wet: 0.06 });
  playTone({ startFreq: base + 80, endFreq: base, duration: 0.05 + t * 0.03, type: "triangle", peakGain: toneGain, attack: 0.0015, decay: 0.03, sustain: 0.2, release: 0.03, wet: 0.08 });
}
function sfxPaddle(intensity = 0.5) {
  const t = clamp(intensity, 0, 1);
  const clickGain = 0.025 + t * 0.03;
  const toneGain = 0.03 + t * 0.03;
  const base = 520 + t * 180;
  playNoiseBurst({ duration: 0.04 + t * 0.02, filterType: "bandpass", filterFreq: 1300 + t * 800, filterQ: 1.2, peakGain: clickGain, wet: 0.1 });
  playTone({ startFreq: base, endFreq: base + 120, duration: 0.06 + t * 0.04, type: "square", peakGain: toneGain, attack: 0.0015, decay: 0.04, sustain: 0.25, release: 0.04, wet: 0.12 });
}
function sfxBrickHit(intensity = 0.5, strong = false) {
  const t = clamp(intensity, 0, 1);
  // Snappy "tile tick": bright transient + short clean tone (less ring)
  const bandFreq = (strong ? 2300 : 2800) + t * 700;
  const clickGain = 0.028 + t * 0.03;
  const toneGain = 0.03 + t * 0.03;
  const base = (strong ? 920 : 1180) + t * 120;
  playNoiseBurst({ duration: 0.028 + t * 0.018, filterType: "bandpass", filterFreq: bandFreq, filterQ: 1.6, peakGain: clickGain, wet: 0.1 });
  playTone({ startFreq: base, endFreq: base * 0.88, duration: 0.045 + t * 0.02, type: "sine", peakGain: toneGain, attack: 0.001, decay: 0.025, sustain: 0.12, release: 0.02, wet: 0.12 });
  setTimeout(() => playTone({ startFreq: base * 1.35, endFreq: base * 1.15, duration: 0.035, type: "sine", peakGain: toneGain * 0.45, attack: 0.001, decay: 0.02, sustain: 0.1, release: 0.02, wet: 0.12 }), 8);
}
function sfxBrickBreak(intensity = 0.7, strong = false) {
  const t = clamp(intensity, 0, 1);
  // Glass break: NO crack/noise, only bright shatter pings
  const gain = 0.06 + t * 0.08;
  const base = (strong ? 1150 : 1450) + t * 240;

  // Main shatter cluster
  playTone({ startFreq: base * 1.15, endFreq: base * 0.9, duration: 0.06, type: "sine", peakGain: gain, attack: 0.001, decay: 0.025, sustain: 0.08, release: 0.03, wet: 0.16 });
  setTimeout(() => playTone({ startFreq: base * 1.55, endFreq: base * 1.2, duration: 0.05, type: "triangle", peakGain: gain * 0.75, attack: 0.001, decay: 0.022, sustain: 0.07, release: 0.028, wet: 0.18 }), 8);
  setTimeout(() => playTone({ startFreq: base * 1.95, endFreq: base * 1.55, duration: 0.045, type: "sine", peakGain: gain * 0.55, attack: 0.001, decay: 0.02, sustain: 0.06, release: 0.025, wet: 0.2 }), 16);

  // Tiny sparkle tail
  setTimeout(() => playTone({ startFreq: base * 2.35, endFreq: base * 2.0, duration: 0.04, type: "sine", peakGain: gain * 0.35, attack: 0.001, decay: 0.018, sustain: 0.05, release: 0.02, wet: 0.22 }), 26);
}
function sfxLevel()  {
  playTone({ startFreq: 660, endFreq: 820, duration: 0.09, type: "sine", peakGain: 0.045, attack: 0.003, decay: 0.05, sustain: 0.3, release: 0.05, wet: 0.2 });
  setTimeout(() => playTone({ startFreq: 880, endFreq: 1040, duration: 0.1, type: "sine", peakGain: 0.045, attack: 0.003, decay: 0.05, sustain: 0.3, release: 0.05, wet: 0.22 }), 70);
}
function sfxPause()  { playTone({ startFreq: 420, endFreq: 360, duration: 0.07, type: "sine", peakGain: 0.03, attack: 0.002, decay: 0.03, sustain: 0.25, release: 0.03, wet: 0.12 }); }
function sfxResume() { playTone({ startFreq: 360, endFreq: 520, duration: 0.07, type: "sine", peakGain: 0.03, attack: 0.002, decay: 0.03, sustain: 0.25, release: 0.03, wet: 0.12 }); }
function sfxLifeLost() {
  playNoiseBurst({ duration: 0.18, filterType: "lowpass", filterFreq: 500, filterQ: 0.5, peakGain: 0.04, wet: 0.2 });
  playTone({ startFreq: 300, endFreq: 140, duration: 0.28, type: "sawtooth", peakGain: 0.06, attack: 0.003, decay: 0.1, sustain: 0.2, release: 0.14, wet: 0.15 });
}
function sfxLose()   {
  playTone({ startFreq: 280, endFreq: 160, duration: 0.22, type: "sawtooth", peakGain: 0.06, attack: 0.004, decay: 0.1, sustain: 0.25, release: 0.12, wet: 0.18 });
  setTimeout(() => playTone({ startFreq: 200, endFreq: 100, duration: 0.28, type: "triangle", peakGain: 0.05, attack: 0.004, decay: 0.1, sustain: 0.25, release: 0.16, wet: 0.2 }), 120);
}
function sfxWin()    {
  playTone({ startFreq: 660, endFreq: 880, duration: 0.12, type: "sine", peakGain: 0.05, attack: 0.003, decay: 0.06, sustain: 0.35, release: 0.06, wet: 0.22 });
  setTimeout(() => playTone({ startFreq: 880, endFreq: 1040, duration: 0.12, type: "sine", peakGain: 0.05, attack: 0.003, decay: 0.06, sustain: 0.35, release: 0.06, wet: 0.25 }), 110);
  setTimeout(() => playTone({ startFreq: 1040, endFreq: 1320, duration: 0.14, type: "sine", peakGain: 0.05, attack: 0.003, decay: 0.06, sustain: 0.35, release: 0.06, wet: 0.28 }), 220);
}

// --------------------
// Level / Bricks
// --------------------
function buildBricks() {
  bricks = [];
  currentLevelDef = LEVELS[level - 1];
  const rows = currentLevelDef.rows;
  const cols = currentLevelDef.cols;
  const palette = currentLevelDef.palette || BRICKS.colors;
  const pattern = currentLevelDef.pattern;

  const brickW = (WORLD.w - BRICKS.offsetLeft * 2 - (cols - 1) * BRICKS.padding) / cols;
  levelGeom = { rows, cols, brickW };

  for (let r = 0; r < rows; r++) {
    bricks[r] = [];
    for (let c = 0; c < cols; c++) {
      const cell = pattern[r] && pattern[r][c] ? pattern[r][c] : 0;
      if (cell <= 0) {
        bricks[r][c] = null;
        continue;
      }
      const x = BRICKS.offsetLeft + c * (brickW + BRICKS.padding);
      const y = BRICKS.offsetTop + r * (BRICKS.h + BRICKS.padding);
      const hp = cell === 2 ? 2 : 1;
      bricks[r][c] = {
        x, y,
        w: brickW,
        h: BRICKS.h,
        alive: true,
        color: palette[r % palette.length],
        hp,
        maxHp: hp,
      };
    }
  }
}

function countAliveBricks() {
  let alive = 0;
  for (let r = 0; r < bricks.length; r++) {
    for (let c = 0; c < bricks[r].length; c++) {
      const b = bricks[r][c];
      if (b && b.alive) alive++;
    }
  }
  return alive;
}

// --------------------
// Ball Reset / Launch
// --------------------
function resetBallOnPaddle() {
  // Slight speed progression + small variation per level for freshness
  const base = BALL.baseSpeed + (level - 1) * 14;
  const variance = 8 + level * 1.5;
  const speed = clamp(base + (Math.random() * 2 - 1) * variance, BALL.baseSpeed, BALL.maxSpeed);

  const x = paddle.x + paddle.w * 0.5;
  const y = paddle.y - BALL.r - 2;

  // launch upwards with some horizontal randomness
  const dirX = (Math.random() * 2 - 1) * 0.35;
  balls = [createBall(x, y, speed, dirX, -1)];
  balls[0].color = "#ffffff";
}

// --------------------
// State Control
// --------------------
function startGame(resetAll = true) {
  ensureAudio();

  if (resetAll) {
    score = 0;
    lives = 3;
    level = 1;
  }

  paddle.x = (WORLD.w - PADDLE.w) * 0.5;
  paddle.w = PADDLE.w;
  pointerX = paddle.x + paddle.w * 0.5;

  powerUps = [];
  paddleWTimer = 0;
  speedBoostTimer = 0;

  buildBricks();
  resetBallOnPaddle();

  state = GAME_STATE.PLAYING;
  setOverlay(false);
  setPauseButtonText();
  setPauseOverlayVisible(false);
}

function gameOver() {
  state = GAME_STATE.GAME_OVER;
  setOverlay(true, "Game Over", `Score: ${score}  |  Best: ${highScore}`, "Restart");
  sfxLose();
  setPauseButtonText();
  setPauseOverlayVisible(false);
}

function winGame() {
  state = GAME_STATE.WIN;
  setOverlay(true, "You Win!", `Final Score: ${score}  |  Best: ${highScore}`, "Play Again");
  sfxWin();
  setPauseButtonText();
  setPauseOverlayVisible(false);
}

function nextLevel() {
  level++;
  // Slightly harder: more speed, optionally more rows later if you want
  buildBricks();
  resetBallOnPaddle();
  sfxLevel();
}

// --------------------
// Input (Mouse + Touch)
// --------------------
function getCanvasRelativeX(clientX) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  return (clientX - rect.left) * scaleX;
}

canvas.addEventListener("mousemove", (e) => {
  pointerIsTouch = false;
  pointerX = getCanvasRelativeX(e.clientX);
  pointerTargetX = pointerX;
});

canvas.addEventListener("mousedown", (e) => {
  isPointerDown = true;
  pointerIsTouch = false;
  // Don't update target on click — only on move
});

window.addEventListener("mouseup", () => {
  isPointerDown = false;
});

canvas.addEventListener("touchstart", (e) => {
  isPointerDown = true;
  pointerIsTouch = true;
  touchDragging = false; // Not dragging yet, just touched
  e.preventDefault();
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
  const t = e.changedTouches[0];
  pointerIsTouch = true;
  touchDragging = true; // Now actively dragging
  pointerX = getCanvasRelativeX(t.clientX);
  pointerTargetX = pointerX;
  e.preventDefault();
}, { passive: false });

canvas.addEventListener("touchend", () => {
  isPointerDown = false;
});

// Optional: Space to start/restart quickly
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    if (state === GAME_STATE.START) startGame(true);
    else if (state === GAME_STATE.GAME_OVER || state === GAME_STATE.WIN) startGame(true);
  }
  if (e.code === "ArrowLeft") p1Left = true;
  if (e.code === "ArrowRight") p1Right = true;
  if (e.code === "Escape") {
    if (state === GAME_STATE.PLAYING) pauseGame();
    else if (state === GAME_STATE.PAUSED) resumeGame();
  }
  if (e.code === "KeyP") {
    if (state === GAME_STATE.PLAYING) pauseGame();
    else if (state === GAME_STATE.PAUSED) resumeGame();
  }
});

window.addEventListener("keyup", (e) => {
  if (e.code === "ArrowLeft") p1Left = false;
  if (e.code === "ArrowRight") p1Right = false;
});

// Button overlay
btnEl.addEventListener("click", async () => {
  // iOS requires resume on user gesture
  ensureAudio();
  if (audioCtx && audioCtx.state !== "running") await audioCtx.resume();

  if (state === GAME_STATE.START) {
    requestFullscreen(); // Go fullscreen when starting
    startGame(true);
  } else if (state === GAME_STATE.GAME_OVER || state === GAME_STATE.WIN) {
    startGame(true);
  }
});

// Initial overlay
setOverlay(true, "Breakout", `Press Start. Use mouse/touch to move the paddle.  Best: ${highScore}`, "Start");
initBackground();

// Pause button
const pauseBtn = document.getElementById("pauseBtn");
pauseBtn.addEventListener("click", () => {
  if (state === GAME_STATE.PLAYING) pauseGame();
  else if (state === GAME_STATE.PAUSED) resumeGame();
});
setPauseButtonText();
setPauseOverlayVisible(false);

resumeBtn.addEventListener("click", () => resumeGame());
restartBtn.addEventListener("click", () => {
  if (state !== GAME_STATE.PAUSED) return;
  startGame(true);
});
quitBtn.addEventListener("click", () => {
  if (state !== GAME_STATE.PAUSED) return;
  state = GAME_STATE.START;
  exitFullscreenMode(); // Exit fullscreen when quitting to start
  setPauseOverlayVisible(false);
  setPauseButtonText();
  setOverlay(true, "Breakout", `Press Start. Use mouse/touch to move the paddle.  Best: ${highScore}`, "Start");
});

// Track if game is in fullscreen playing mode
let isFullscreenMode = false;

// Lock screen to landscape (cross-browser, must be called from user gesture)
async function lockLandscape() {
  // Method 1: Modern Screen Orientation API
  if (screen.orientation && screen.orientation.lock) {
    try {
      await screen.orientation.lock("landscape");
      return true;
    } catch (e) {
      // Try specific landscape type
      try {
        await screen.orientation.lock("landscape-primary");
        return true;
      } catch (e2) {}
    }
  }
  
  // Method 2: Older lockOrientation API (some Android browsers)
  const lockFn = screen.lockOrientation || screen.mozLockOrientation || screen.msLockOrientation;
  if (lockFn) {
    try {
      lockFn.call(screen, "landscape");
      return true;
    } catch (e) {}
  }
  
  return false;
}

// Request fullscreen + lock to landscape (cross-browser)
async function requestFullscreen() {
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
  
  // Must enter fullscreen FIRST, then lock orientation (browser requirement)
  try {
    if (req) {
      await req.call(el);
      // Small delay to ensure fullscreen is active before locking
      await new Promise(r => setTimeout(r, 100));
    }
  } catch (e) {
    // Fullscreen denied - still try to lock orientation
  }
  
  // Now try to lock to landscape
  await lockLandscape();
  
  isFullscreenMode = true;
  resizeCanvasCSS();
}

// Exit fullscreen mode (for quit)
async function exitFullscreenMode() {
  isFullscreenMode = false;
  
  // Unlock orientation (all methods)
  try {
    if (screen.orientation && screen.orientation.unlock) {
      screen.orientation.unlock();
    }
    const unlockFn = screen.unlockOrientation || screen.mozUnlockOrientation || screen.msUnlockOrientation;
    if (unlockFn) unlockFn.call(screen);
  } catch (e) {}
  
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
    if (exit) {
      try {
        await exit.call(document);
      } catch (e) {}
    }
  }
  resizeCanvasCSS();
}

// Responsive canvas CSS scaling
function resizeCanvasCSS() {
  const vvW = window.visualViewport?.width || window.innerWidth;
  const vvH = window.visualViewport?.height || window.innerHeight;
  const isMobile = "ontouchstart" in window || Math.min(vvW, vvH) < 600;
  const isLandscape = vvW > vvH;

  let cssW, cssH, borderRadius;

  if (isFullscreenMode || (isMobile && isLandscape)) {
    // FULLSCREEN / MOBILE LANDSCAPE: Fill entire screen
    cssW = vvW;
    cssH = vvH;
    borderRadius = "0px";
  } else if (!isMobile) {
    // DESKTOP (not fullscreen): Contain with margins
    const margin = 40;
    const maxW = vvW - margin * 2;
    const maxH = vvH - margin * 2;
    const scale = Math.min(maxW / canvas.width, maxH / canvas.height);
    cssW = Math.floor(canvas.width * scale);
    cssH = Math.floor(canvas.height * scale);
    borderRadius = "16px";
  } else {
    // MOBILE PORTRAIT (start screen): Show rotate prompt handles this
    // But just in case, fill width
    cssW = vvW - 32;
    cssH = Math.floor(cssW * (canvas.height / canvas.width));
    borderRadius = "12px";
  }

  canvas.style.position = "fixed";
  canvas.style.left = "50%";
  canvas.style.top = "50%";
  canvas.style.transform = "translate(-50%, -50%)";
  canvas.style.width = cssW + "px";
  canvas.style.height = cssH + "px";
  canvas.style.borderRadius = borderRadius;
  canvas.style.boxShadow = (isFullscreenMode || (isMobile && isLandscape)) ? "none" : "0 8px 40px rgba(0,0,0,0.6)";
}
window.addEventListener("resize", resizeCanvasCSS);
window.addEventListener("orientationchange", resizeCanvasCSS);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", resizeCanvasCSS);
  window.visualViewport.addEventListener("scroll", resizeCanvasCSS);
}

// Handle manual fullscreen exit (e.g., user presses Escape)
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    isFullscreenMode = false;
    resizeCanvasCSS();
  }
});
document.addEventListener("webkitfullscreenchange", () => {
  if (!document.webkitFullscreenElement) {
    isFullscreenMode = false;
    resizeCanvasCSS();
  }
});

resizeCanvasCSS();

// --------------------
// Update / Physics
// --------------------
function update(dt) {
  if (state !== GAME_STATE.PLAYING) return;

  if (missFlashT > 0) missFlashT = Math.max(0, missFlashT - dt);
  if (paddleWTimer > 0) {
    paddleWTimer = Math.max(0, paddleWTimer - dt);
    if (paddleWTimer === 0) {
      paddle.w = PADDLE.w;
    }
  }
  if (speedBoostTimer > 0) {
    speedBoostTimer = Math.max(0, speedBoostTimer - dt);
  }

  // Paddle 1: keyboard overrides pointer while held
  const p1Dir = (p1Right ? 1 : 0) - (p1Left ? 1 : 0);
  if (p1Dir !== 0) {
    paddle.x = clamp(paddle.x + p1Dir * PADDLE.speed * dt, 0, WORLD.w - paddle.w);
  } else if (pointerIsTouch) {
    // Touch: only move paddle while actively dragging (finger moved after touch)
    if (touchDragging) {
      const desiredX = pointerTargetX - paddle.w * 0.5;
      const clampedDesired = clamp(desiredX, 0, WORLD.w - paddle.w);
      const follow = 10;
      const a = 1 - Math.exp(-follow * dt);
      paddle.x = clamp(lerp(paddle.x, clampedDesired, a), 0, WORLD.w - paddle.w);
    }
    // else: just touched without moving — paddle stays put
  } else {
    // Mouse: always follow pointer
    const desiredX = pointerTargetX - paddle.w * 0.5;
    const clampedDesired = clamp(desiredX, 0, WORLD.w - paddle.w);
    paddle.x = clampedDesired;
  }


  // Power-ups fall and collect
  for (let i = powerUps.length - 1; i >= 0; i--) {
    const p = powerUps[i];
    if (!p.alive) {
      powerUps.splice(i, 1);
      continue;
    }
    p.y += p.vy * dt;
    const px = p.x - POWERUPS.size * 0.5;
    const py = p.y - POWERUPS.size * 0.5;
    if (rectCircleCollide(paddle.x, paddle.y, paddle.w, paddle.h, p.x, p.y, POWERUPS.size * 0.5)) {
      p.alive = false;
      applyPowerUp(p.type);
      sfxLevel(); // pleasant pickup chime
      powerUps.splice(i, 1);
      continue;
    }
    if (py > WORLD.h + 40) {
      powerUps.splice(i, 1);
    }
  }

  for (let bIdx = balls.length - 1; bIdx >= 0; bIdx--) {
    const ball = balls[bIdx];
    const steps = clamp(Math.ceil(ball.speed / 450), 1, 5);
    const stepDt = dt / steps;

    for (let i = 0; i < steps; i++) {
      const prevX = ball.x;
      const prevY = ball.y;

      // Move
      ball.x += ball.vx * stepDt;
      ball.y += ball.vy * stepDt;

      // Trail
      ball.trail.push({ x: ball.x, y: ball.y });
      if (ball.trail.length > 18) ball.trail.shift();

      // Walls
      if (ball.x - ball.r <= 0) {
        ball.x = ball.r;
        ball.vx *= -1;
        sfxWall(impactFromSpeed(ball.speed));
      } else if (ball.x + ball.r >= WORLD.w) {
        ball.x = WORLD.w - ball.r;
        ball.vx *= -1;
        sfxWall(impactFromSpeed(ball.speed));
      }
      if (ball.y - ball.r <= 0) {
        ball.y = ball.r;
        ball.vy *= -1;
        sfxWall(impactFromSpeed(ball.speed));
      }

      // Bottom: lose ball
      if (ball.y - ball.r > WORLD.h) {
        balls.splice(bIdx, 1);
        if (balls.length === 0) {
          lives--;
          if (lives <= 0) {
            gameOver();
            return;
          }
          missFlashT = 0.25;
          sfxLifeLost();
          resetBallOnPaddle();
        }
        break;
      }

      // Paddle collision (angle control)
      if (rectCircleCollide(paddle.x, paddle.y, paddle.w, paddle.h, ball.x, ball.y, ball.r)) {
        ball.y = paddle.y - ball.r - 0.5;

        const hit = (ball.x - (paddle.x + paddle.w * 0.5)) / (paddle.w * 0.5);
        const clampedHit = clamp(hit, -1, 1);
        const maxAngle = (60 * Math.PI) / 180;
        const angle = clampedHit * maxAngle;

        ball.paddleHitCount++;
        if (ball.paddleHitCount % BALL.speedUpEveryHits === 0) {
          ball.speed = clamp(ball.speed + BALL.speedUpIncrement, BALL.baseSpeed, BALL.maxSpeed);
        }

        const dir = normalize(Math.sin(angle), -Math.cos(angle));
        ball.vx = dir.x * ball.speed;
        ball.vy = dir.y * ball.speed;

        sfxPaddle(impactFromSpeed(ball.speed));
      }


      // Brick collisions: check only nearby cells
      const bw = levelGeom.brickW;
      const colSpan = bw + BRICKS.padding;
      const rowSpan = BRICKS.h + BRICKS.padding;
      const approxCol = Math.floor((ball.x - BRICKS.offsetLeft) / colSpan);
      const approxRow = Math.floor((ball.y - BRICKS.offsetTop) / rowSpan);

      for (let rr = approxRow - 1; rr <= approxRow + 1; rr++) {
        if (rr < 0 || rr >= bricks.length) continue;
        for (let cc = approxCol - 1; cc <= approxCol + 1; cc++) {
          if (cc < 0 || cc >= bricks[rr].length) continue;
          const brick = bricks[rr][cc];
          if (!brick || !brick.alive) continue;
          if (!rectCircleCollide(brick.x, brick.y, brick.w, brick.h, ball.x, ball.y, ball.r)) continue;

          // Damage
          brick.hp--;
          if (brick.hp <= 0) {
            brick.alive = false;
            score += 10;

            // Drop chance on destroy
            if (Math.random() < POWERUPS.dropChance) {
              spawnPowerUp(brick.x + brick.w * 0.5, brick.y + brick.h * 0.5);
            }
          } else {
            score += 5;
          }

          if (score > highScore) {
            highScore = score;
            try { localStorage.setItem(HS_KEY, String(highScore)); } catch (e) {}
          }

          // Bounce depending on where we came from
          const wasLeft  = prevX + ball.r <= brick.x;
          const wasRight = prevX - ball.r >= brick.x + brick.w;
          const wasAbove = prevY + ball.r <= brick.y;
          const wasBelow = prevY - ball.r >= brick.y + brick.h;
          if (wasLeft || wasRight) ball.vx *= -1;
          else if (wasAbove || wasBelow) ball.vy *= -1;
          else ball.vy *= -1;

          if (brick.hp <= 0) sfxBrickBreak(impactFromSpeed(ball.speed), brick.maxHp === 2);
          else sfxBrickHit(impactFromSpeed(ball.speed), brick.maxHp === 2);

          if (countAliveBricks() === 0) {
            if (level < LEVELS.length) nextLevel();
            else winGame();
            return;
          }

          rr = Infinity;
          break;
        }
      }
    }
  }
}

// --------------------
// Draw
// --------------------
function draw() {
  drawBackground(nowT);

  // Bricks
  for (let r = 0; r < bricks.length; r++) {
    for (let c = 0; c < bricks[r].length; c++) {
      const b = bricks[r][c];
      if (!b || !b.alive) continue;

      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);

      // simple highlight
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(b.x, b.y, b.w, 5);
      ctx.globalAlpha = 1;

      if (b.maxHp === 2 && b.hp === 1) {
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fillRect(b.x, b.y, b.w, b.h);
      }
    }
  }

  // Paddle
  drawPaddleBody(paddle, "P1");

  // Power-ups
  for (let i = 0; i < powerUps.length; i++) {
    const p = powerUps[i];
    const s = POWERUPS.size;
    let color = "#22c55e";
    let label = "P";
    if (p.type === "WIDE") { color = "#60a5fa"; label = "W"; }
    else if (p.type === "SPEED") { color = "#fbbf24"; label = "S"; }
    else if (p.type === "MULTI") { color = "#fbbf24"; label = "+"; }

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.95;
    ctx.fillRect(p.x - s * 0.5, p.y - s * 0.5, s, s);
    ctx.globalAlpha = 1;

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, p.x, p.y + 4);
  }

  // Balls
  for (let bi = 0; bi < balls.length; bi++) {
    const ball = balls[bi];
    if (ball.trail && ball.trail.length) {
      for (let i = 0; i < ball.trail.length; i++) {
        const p = ball.trail[i];
        const t = (i + 1) / ball.trail.length;
        ctx.globalAlpha = 0.18 * t;
        ctx.beginPath();
        ctx.arc(p.x, p.y, ball.r * (0.65 + 0.2 * t), 0, Math.PI * 2);
        ctx.fillStyle = ball.color || "#9ca3af";
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fillStyle = ball.color || "#ffffff";
    ctx.fill();
  }

  // HUD
  ctx.fillStyle = "#e5e7eb";
  ctx.font = "16px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`Score: ${score}`, HUD.padding, 26);
  ctx.fillText(`Lives: ${lives}`, HUD.padding + 120, 26);
  ctx.fillText(`Level: ${level}`, HUD.padding + 220, 26);
  ctx.fillText(`High: ${highScore}`, HUD.padding + 320, 26);

  // Optional hint while playing
  if (state === GAME_STATE.PLAYING) {
    ctx.globalAlpha = 0.5;
    ctx.textAlign = "right";
    let showSpeed = 0;
    for (let i = 0; i < balls.length; i++) showSpeed = Math.max(showSpeed, balls[i].speed);
    ctx.fillText(`Speed: ${Math.round(showSpeed)}`, WORLD.w - HUD.padding, 26);
    ctx.globalAlpha = 1;
  }

  if (state === GAME_STATE.PAUSED) {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, 0, WORLD.w, WORLD.h);
    ctx.fillStyle = "#e5e7eb";
    ctx.textAlign = "center";
    ctx.font = "28px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText("PAUSED", WORLD.w * 0.5, WORLD.h * 0.5);
  }

  if (missFlashT > 0) {
    const a = clamp(missFlashT / 0.25, 0, 1) * 0.35;
    ctx.fillStyle = `rgba(239,68,68,${a})`;
    ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  }
}

// --------------------
// Main Loop
// --------------------
function loop(ts) {
  const t = ts * 0.001;
  const dt = Math.min(0.033, t - lastTime || 0); // clamp dt for stability
  lastTime = t;
  nowT = t;

  update(dt);
  draw();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
