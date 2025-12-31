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

// --------------------
// Game Constants
// --------------------
const GAME_STATE = {
  START: "START",
  PLAYING: "PLAYING",
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
  speedUpFactor: 1.08,
};

const BRICKS = {
  rows: 5,
  cols: 8,
  padding: 10,
  offsetTop: 70,
  offsetLeft: 55,
  h: 22,
  colors: ["#60a5fa", "#34d399", "#fbbf24", "#f87171", "#a78bfa"],
};

// --------------------
// Game State
// --------------------
let state = GAME_STATE.START;

let score = 0;
let lives = 3;
let level = 1;

// Paddle
const paddle = {
  x: (WORLD.w - PADDLE.w) * 0.5,
  y: WORLD.h - PADDLE.yOffset,
  w: PADDLE.w,
  h: PADDLE.h,
};

// Ball (vx/vy are in px/sec)
const ball = {
  x: WORLD.w * 0.5,
  y: paddle.y - BALL.r - 2,
  r: BALL.r,
  vx: 0,
  vy: 0,
  speed: BALL.baseSpeed,
  paddleHitCount: 0,
};

// Bricks: 2D array
let bricks = []; // bricks[row][col] => {x,y,w,h,alive,color}

// Timing
let lastTime = 0;

// Input
let pointerX = paddle.x + paddle.w * 0.5;
let isPointerDown = false;

// Audio
let audioCtx = null;

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

function setOverlay(show, title, desc, btnText) {
  uiOverlay.style.display = show ? "grid" : "none";
  titleEl.textContent = title ?? "";
  descEl.textContent = desc ?? "";
  btnEl.textContent = btnText ?? "Start";
}

// Simple beep SFX without external files
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
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
  gain.connect(audioCtx.destination);

  osc.start(t0);
  osc.stop(t0 + duration);
}

function sfxBounce() { playBeep(520, 0.04, "square", 0.035); }
function sfxBrick()  { playBeep(760, 0.06, "triangle", 0.04); }
function sfxLose()   { playBeep(180, 0.15, "sawtooth", 0.05); }
function sfxWin()    { playBeep(980, 0.12, "sine", 0.04); }

// --------------------
// Level / Bricks
// --------------------
function buildBricks() {
  bricks = [];
  const brickW =
    (WORLD.w - BRICKS.offsetLeft * 2 - (BRICKS.cols - 1) * BRICKS.padding) / BRICKS.cols;

  for (let r = 0; r < BRICKS.rows; r++) {
    bricks[r] = [];
    for (let c = 0; c < BRICKS.cols; c++) {
      const x = BRICKS.offsetLeft + c * (brickW + BRICKS.padding);
      const y = BRICKS.offsetTop + r * (BRICKS.h + BRICKS.padding);
      bricks[r][c] = {
        x, y,
        w: brickW,
        h: BRICKS.h,
        alive: true,
        color: BRICKS.colors[r % BRICKS.colors.length],
      };
    }
  }
}

function countAliveBricks() {
  let alive = 0;
  for (let r = 0; r < bricks.length; r++) {
    for (let c = 0; c < bricks[r].length; c++) {
      if (bricks[r][c].alive) alive++;
    }
  }
  return alive;
}

// --------------------
// Ball Reset / Launch
// --------------------
function resetBallOnPaddle() {
  ball.speed = BALL.baseSpeed + (level - 1) * 30;
  ball.speed = clamp(ball.speed, BALL.baseSpeed, BALL.maxSpeed);

  ball.x = paddle.x + paddle.w * 0.5;
  ball.y = paddle.y - ball.r - 2;

  // launch upwards with some horizontal randomness
  const dirX = (Math.random() * 2 - 1) * 0.35;
  const dir = normalize(dirX, -1);

  ball.vx = dir.x * ball.speed;
  ball.vy = dir.y * ball.speed;

  ball.paddleHitCount = 0;
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
  pointerX = paddle.x + paddle.w * 0.5;

  buildBricks();
  resetBallOnPaddle();

  state = GAME_STATE.PLAYING;
  setOverlay(false);
}

function gameOver() {
  state = GAME_STATE.GAME_OVER;
  setOverlay(true, "Game Over", `Score: ${score}`, "Restart");
  sfxLose();
}

function winGame() {
  state = GAME_STATE.WIN;
  setOverlay(true, "You Win!", `Final Score: ${score}`, "Play Again");
  sfxWin();
}

function nextLevel() {
  level++;
  // Slightly harder: more speed, optionally more rows later if you want
  buildBricks();
  resetBallOnPaddle();
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
  pointerX = getCanvasRelativeX(e.clientX);
});

canvas.addEventListener("mousedown", (e) => {
  isPointerDown = true;
  pointerX = getCanvasRelativeX(e.clientX);
});

window.addEventListener("mouseup", () => {
  isPointerDown = false;
});

canvas.addEventListener("touchstart", (e) => {
  isPointerDown = true;
  const t = e.changedTouches[0];
  pointerX = getCanvasRelativeX(t.clientX);
  e.preventDefault();
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
  const t = e.changedTouches[0];
  pointerX = getCanvasRelativeX(t.clientX);
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
});

// Button overlay
btnEl.addEventListener("click", async () => {
  // iOS requires resume on user gesture
  ensureAudio();
  if (audioCtx && audioCtx.state !== "running") await audioCtx.resume();

  if (state === GAME_STATE.START) startGame(true);
  else if (state === GAME_STATE.GAME_OVER || state === GAME_STATE.WIN) startGame(true);
});

// Initial overlay
setOverlay(true, "Breakout", "Press Start. Use mouse/touch to move the paddle.", "Start");

// --------------------
// Update / Physics
// --------------------
function update(dt) {
  if (state !== GAME_STATE.PLAYING) return;

  // Paddle follows pointer
  const targetX = pointerX - paddle.w * 0.5;
  paddle.x = clamp(targetX, 0, WORLD.w - paddle.w);

  // Ball moves
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  // Wall collisions
  if (ball.x - ball.r <= 0) {
    ball.x = ball.r;
    ball.vx *= -1;
    sfxBounce();
  } else if (ball.x + ball.r >= WORLD.w) {
    ball.x = WORLD.w - ball.r;
    ball.vx *= -1;
    sfxBounce();
  }

  if (ball.y - ball.r <= 0) {
    ball.y = ball.r;
    ball.vy *= -1;
    sfxBounce();
  }

  // Bottom: lose life
  if (ball.y - ball.r > WORLD.h) {
    lives--;
    if (lives <= 0) {
      gameOver();
      return;
    }
    // Reset ball, keep bricks/score
    resetBallOnPaddle();
    return;
  }

  // Paddle collision (angle control)
  if (rectCircleCollide(paddle.x, paddle.y, paddle.w, paddle.h, ball.x, ball.y, ball.r)) {
    // Prevent sticking: place ball above paddle
    ball.y = paddle.y - ball.r - 0.5;

    // Hit position: -1 (left) to +1 (right)
    const hit = (ball.x - (paddle.x + paddle.w * 0.5)) / (paddle.w * 0.5);
    const clampedHit = clamp(hit, -1, 1);

    // Angle: max 60 degrees from vertical
    const maxAngle = (60 * Math.PI) / 180;
    const angle = clampedHit * maxAngle;

    // Speed boost every 5 paddle hits
    ball.paddleHitCount++;
    if (ball.paddleHitCount % BALL.speedUpEveryHits === 0) {
      ball.speed = clamp(ball.speed * BALL.speedUpFactor, BALL.baseSpeed, BALL.maxSpeed);
    }

    // Rebuild velocity from angle (upwards)
    const vx = Math.sin(angle);
    const vy = -Math.cos(angle);
    ball.vx = vx * ball.speed;
    ball.vy = vy * ball.speed;

    sfxBounce();
  }

  // Brick collisions
  // Optimization idea: spatial partitioning or only check nearby bricks.
  // For this grid size, brute force is fine.
  let hitBrick = false;

  for (let r = 0; r < bricks.length && !hitBrick; r++) {
    for (let c = 0; c < bricks[r].length && !hitBrick; c++) {
      const b = bricks[r][c];
      if (!b.alive) continue;

      if (rectCircleCollide(b.x, b.y, b.w, b.h, ball.x, ball.y, ball.r)) {
        b.alive = false;
        score += 10;

        // Basic bounce: decide if we hit from side or top/bottom
        const prevX = ball.x - ball.vx * dt;
        const prevY = ball.y - ball.vy * dt;

        const wasLeft   = prevX + ball.r <= b.x;
        const wasRight  = prevX - ball.r >= b.x + b.w;
        const wasAbove  = prevY + ball.r <= b.y;
        const wasBelow  = prevY - ball.r >= b.y + b.h;

        if (wasLeft || wasRight) ball.vx *= -1;
        else if (wasAbove || wasBelow) ball.vy *= -1;
        else ball.vy *= -1; // fallback

        sfxBrick();
        hitBrick = true;

        // Win / next level
        if (countAliveBricks() === 0) {
          // Simple: win at level 1 (or chain levels if you want)
          // Here: advance level once, then win at level 2+
          if (level >= 2) winGame();
          else nextLevel();
        }
      }
    }
  }
}

// --------------------
// Draw
// --------------------
function draw() {
  ctx.clearRect(0, 0, WORLD.w, WORLD.h);

  // Background subtle lines
  ctx.globalAlpha = 0.12;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const y = (WORLD.h / 10) * i;
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD.w, y);
  }
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Bricks
  for (let r = 0; r < bricks.length; r++) {
    for (let c = 0; c < bricks[r].length; c++) {
      const b = bricks[r][c];
      if (!b.alive) continue;

      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);

      // simple highlight
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(b.x, b.y, b.w, 5);
      ctx.globalAlpha = 1;
    }
  }

  // Paddle
  ctx.fillStyle = "#e5e7eb";
  ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);

  // Ball
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  // HUD
  ctx.fillStyle = "#e5e7eb";
  ctx.font = "16px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`Score: ${score}`, HUD.padding, 26);
  ctx.fillText(`Lives: ${lives}`, HUD.padding + 120, 26);
  ctx.fillText(`Level: ${level}`, HUD.padding + 220, 26);

  // Optional hint while playing
  if (state === GAME_STATE.PLAYING) {
    ctx.globalAlpha = 0.5;
    ctx.textAlign = "right";
    ctx.fillText(`Speed: ${Math.round(ball.speed)}`, WORLD.w - HUD.padding, 26);
    ctx.globalAlpha = 1;
  }
}

// --------------------
// Main Loop
// --------------------
function loop(ts) {
  const t = ts * 0.001;
  const dt = Math.min(0.033, t - lastTime || 0); // clamp dt for stability
  lastTime = t;

  update(dt);
  draw();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
