/* Breakout Week 2 - Enhanced */
(function () {
  'use strict';

  // Logical canvas resolution (do not change at runtime)
  const WIDTH = 800;
  const HEIGHT = 500;

  // Game states
  const GAME_STATE = {
    START: 'START',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    GAME_OVER: 'GAME_OVER',
    WIN: 'WIN'
  };

  // Canvas and context
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const pauseBtn = document.getElementById('pauseBtn');

  // Input
  const keys = {};
  let pointerActive = false;
  let pointerX = WIDTH / 2;

  // Layout for brick grid
  let brickRows = 0;
  let brickCols = 0;
  let brickW = 64; // computed from cols
  let brickH = 20; // fixed height
  let brickPadding = 8;
  let brickOffsetTop = 50;
  let brickOffsetLeft = 35; // used to compute brickW; may be adjusted for centering
  let cellW = 0; // brickW + padding
  let cellH = 0; // brickH + padding

  // Game objects
  const PADDLE = {
    w: 100,
    h: 16,
    x: WIDTH / 2 - 50,
    y: HEIGHT - 40,
    speed: 600
  };

  const BALL = {
    x: WIDTH / 2,
    y: HEIGHT / 2,
    vx: 220,
    vy: -220,
    speed: 320,
    maxSpeed: 900,
    radius: 8,
    paddleHitCount: 0
  };

  // Score / lives / level
  let score = 0;
  let lives = 3;
  let levelIndex = 0;
  let state = GAME_STATE.START;

  // Bricks storage
  /** @type {(null | {x:number,y:number,w:number,h:number,hp:number,alive:boolean,color:string,type:number})[][]} */
  let bricks = [];
  let bricksRemaining = 0;

  // Levels definition
  // pattern: 0 empty, 1 normal (hp=1), 2 strong (hp=2)
  const LEVELS = [
    {
      rows: 6,
      cols: 11,
      palette: ['#4FC3F7', '#FF7043', '#66BB6A'],
      pattern: [
        [0,1,1,1,1,1,1,1,1,1,0],
        [1,1,2,1,1,2,1,1,2,1,1],
        [1,2,1,1,2,1,1,2,1,2,1],
        [1,1,1,2,1,1,1,2,1,1,1],
        [1,1,2,1,1,2,1,1,2,1,1],
        [0,1,1,1,1,1,1,1,1,1,0]
      ]
    },
    {
      rows: 7,
      cols: 12,
      palette: ['#F06292', '#9575CD', '#FFD54F'],
      pattern: [
        [2,0,2,0,2,0,2,0,2,0,2,0],
        [0,1,0,1,0,1,0,1,0,1,0,1],
        [2,0,2,0,2,0,2,0,2,0,2,0],
        [0,1,0,1,0,1,0,1,0,1,0,1],
        [2,0,2,0,2,0,2,0,2,0,2,0],
        [0,1,0,1,0,1,0,1,0,1,0,1],
        [2,0,2,0,2,0,2,0,2,0,2,0]
      ]
    },
    {
      rows: 8,
      cols: 13,
      palette: ['#80DEEA', '#A5D6A7', '#EF9A9A', '#FFCC80'],
      pattern: [
        [0,0,1,1,1,2,2,2,1,1,1,0,0],
        [0,1,1,2,2,1,1,1,2,2,1,1,0],
        [1,1,2,2,1,1,2,1,1,2,2,1,1],
        [1,2,2,1,1,2,2,2,1,1,2,2,1],
        [1,1,2,2,1,1,2,1,1,2,2,1,1],
        [0,1,1,2,2,1,1,1,2,2,1,1,0],
        [0,0,1,1,1,2,2,2,1,1,1,0,0],
        [0,0,0,1,1,1,2,1,1,1,0,0,0]
      ]
    }
  ];

  // Utility
  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function getCanvasRelativeX(clientX) {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width * WIDTH;
    return clamp(x, 0, WIDTH);
  }

  function vecNormalize(x, y) {
    const len = Math.hypot(x, y) || 1;
    return { x: x / len, y: y / len };
  }

  function rectCircleCollide(rx, ry, rw, rh, cx, cy, cr) {
    const closestX = clamp(cx, rx, rx + rw);
    const closestY = clamp(cy, ry, ry + rh);
    const dx = cx - closestX;
    const dy = cy - closestY;
    return (dx * dx + dy * dy) <= (cr * cr);
  }

  function darkenColor(hex, factor) {
    if (!hex || hex[0] !== '#') return hex;
    const v = hex.substring(1);
    const bigint = parseInt(v.length === 3 ? v.split('').map(c => c + c).join('') : v, 16);
    const r = Math.floor(((bigint >> 16) & 255) * factor);
    const g = Math.floor(((bigint >> 8) & 255) * factor);
    const b = Math.floor((bigint & 255) * factor);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  // Build bricks from current level pattern
  function buildBricks() {
    const level = LEVELS[levelIndex];
    brickRows = level.rows;
    brickCols = level.cols;

    // Compute brick width from cols and horizontal offsets
    // Center the grid horizontally using offset left/right margins
    const leftMargin = brickOffsetLeft;
    const rightMargin = brickOffsetLeft;
    brickW = (WIDTH - leftMargin - rightMargin - (brickCols - 1) * brickPadding) / brickCols;
    brickW = Math.max(24, brickW);
    cellW = brickW + brickPadding;
    cellH = brickH + brickPadding;

    // Recompute offsetLeft to center precisely
    const totalGridWidth = brickCols * brickW + (brickCols - 1) * brickPadding;
    brickOffsetLeft = Math.max(16, Math.floor((WIDTH - totalGridWidth) / 2));

    bricks = new Array(brickRows);
    bricksRemaining = 0;
    for (let r = 0; r < brickRows; r++) {
      bricks[r] = new Array(brickCols);
      for (let c = 0; c < brickCols; c++) {
        const cell = (level.pattern[r] && level.pattern[r][c]) || 0;
        if (cell === 0) {
          bricks[r][c] = null;
          continue;
        }
        const x = brickOffsetLeft + c * (brickW + brickPadding);
        const y = brickOffsetTop + r * (brickH + brickPadding);
        const isStrong = cell === 2;
        const hp = isStrong ? 2 : 1;
        const palette = level.palette || ['#4FC3F7', '#FFA726', '#66BB6A', '#FF7043'];
        const colorIndex = (isStrong ? 1 : 0) % palette.length;
        const color = palette[colorIndex];
        bricks[r][c] = {
          x, y, w: brickW, h: brickH,
          hp,
          alive: true,
          color,
          type: cell
        };
        bricksRemaining++;
      }
    }
  }

  function resetBallAndPaddle(centerBallOnPaddle) {
    PADDLE.x = clamp(PADDLE.x, 0, WIDTH - PADDLE.w);
    PADDLE.y = HEIGHT - 40;
    if (centerBallOnPaddle) {
      BALL.x = PADDLE.x + PADDLE.w / 2;
      BALL.y = PADDLE.y - BALL.radius - 1;
      BALL.vx = 0;
      BALL.vy = -BALL.speed;
    } else {
      BALL.x = WIDTH / 2;
      BALL.y = HEIGHT / 2;
      const dir = vecNormalize(BALL.vx, BALL.vy);
      BALL.vx = dir.x * BALL.speed;
      BALL.vy = dir.y * BALL.speed;
    }
  }

  function startGame() {
    score = 0;
    lives = 3;
    levelIndex = 0;
    BALL.speed = 320;
    BALL.paddleHitCount = 0;
    buildBricks();
    resetBallAndPaddle(true);
    state = GAME_STATE.PLAYING;
    updatePauseButton();
  }

  function nextLevel() {
    levelIndex++;
    if (levelIndex >= LEVELS.length) {
      winGame();
      return;
    }
    // Speed increases by +10 every level
    BALL.speed = Math.min(BALL.maxSpeed, BALL.speed + 10);
    buildBricks();
    resetBallAndPaddle(true);
    state = GAME_STATE.PLAYING;
    updatePauseButton();
  }

  function winGame() {
    state = GAME_STATE.WIN;
    updatePauseButton();
  }

  function gameOver() {
    state = GAME_STATE.GAME_OVER;
    updatePauseButton();
  }

  function togglePause() {
    if (state === GAME_STATE.PLAYING) {
      state = GAME_STATE.PAUSED;
    } else if (state === GAME_STATE.PAUSED) {
      state = GAME_STATE.PLAYING;
    }
    updatePauseButton();
  }

  function updatePauseButton() {
    if (!pauseBtn) return;
    if (state === GAME_STATE.PLAYING) {
      pauseBtn.textContent = 'Pause';
      pauseBtn.disabled = false;
    } else if (state === GAME_STATE.PAUSED) {
      pauseBtn.textContent = 'Resume';
      pauseBtn.disabled = false;
    } else {
      pauseBtn.textContent = 'Pause';
      pauseBtn.disabled = (state !== GAME_STATE.PLAYING && state !== GAME_STATE.PAUSED);
    }
  }

  // Brick collision helper: try to resolve bounce axis
  function resolveBallBrickBounce(brick) {
    // Determine which axis to invert based on relative position
    const prevX = BALL.x - BALL.vx * lastStepDt; // approximate previous position
    const prevY = BALL.y - BALL.vy * lastStepDt;
    const wasAbove = prevY <= brick.y;
    const wasBelow = prevY >= brick.y + brick.h;
    const wasLeft = prevX <= brick.x;
    const wasRight = prevX >= brick.x + brick.w;

    let invertX = false;
    let invertY = false;

    if ((wasAbove && BALL.vy > 0) || (wasBelow && BALL.vy < 0)) {
      invertY = true;
    }
    if ((wasLeft && BALL.vx > 0) || (wasRight && BALL.vx < 0)) {
      invertX = true;
    }

    if (invertX && invertY) {
      // If ambiguous, prefer vertical to keep ball in play
      invertX = false;
    }
    if (invertY) BALL.vy = -BALL.vy;
    else if (invertX) BALL.vx = -BALL.vx;
    else {
      // Fallback: flip vertical
      BALL.vy = -BALL.vy;
    }
  }

  // Main update/draw loop
  let lastTime = performance.now();
  let lastStepDt = 0.016;
  function loop(now) {
    const dt = Math.min(0.033, (now - lastTime) / 1000); // clamp dt
    lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function update(dt) {
    handleInput(dt);
    if (state === GAME_STATE.PAUSED) return;
    if (state !== GAME_STATE.PLAYING) return;

    // Anti-tunneling sub-stepping
    let steps = Math.ceil(BALL.speed / 450);
    steps = clamp(steps, 1, 5);
    const stepDt = dt / steps;

    for (let i = 0; i < steps; i++) {
      lastStepDt = stepDt;
      // Move ball
      BALL.x += BALL.vx * stepDt;
      BALL.y += BALL.vy * stepDt;

      // Walls
      if (BALL.x - BALL.radius < 0) {
        BALL.x = BALL.radius;
        BALL.vx = Math.abs(BALL.vx);
      } else if (BALL.x + BALL.radius > WIDTH) {
        BALL.x = WIDTH - BALL.radius;
        BALL.vx = -Math.abs(BALL.vx);
      }
      if (BALL.y - BALL.radius < 0) {
        BALL.y = BALL.radius;
        BALL.vy = Math.abs(BALL.vy);
      }

      // Bottom (lose life)
      if (BALL.y - BALL.radius > HEIGHT) {
        lives--;
        if (lives > 0) {
          resetBallAndPaddle(true);
          state = GAME_STATE.PLAYING;
        } else {
          gameOver();
        }
        return; // Stop update this frame
      }

      // Paddle collision
      if (rectCircleCollide(PADDLE.x, PADDLE.y, PADDLE.w, PADDLE.h, BALL.x, BALL.y, BALL.radius)) {
        BALL.y = PADDLE.y - BALL.radius - 0.1;
        // Compute bounce angle based on hit position
        const paddleCenter = PADDLE.x + PADDLE.w / 2;
        const rel = clamp((BALL.x - paddleCenter) / (PADDLE.w / 2), -1, 1);
        const maxBounce = 75 * Math.PI / 180;
        const angle = rel * maxBounce;
        BALL.vx = Math.sin(angle);
        BALL.vy = -Math.cos(angle);
        const dir = vecNormalize(BALL.vx, BALL.vy);
        // Speed scaling: +20 every 5 paddle hits
        BALL.paddleHitCount = (BALL.paddleHitCount || 0) + 1;
        if (BALL.paddleHitCount % 5 === 0) {
          BALL.speed = Math.min(BALL.maxSpeed, BALL.speed + 20);
        }
        BALL.vx = dir.x * BALL.speed;
        BALL.vy = dir.y * BALL.speed;
      }

      // Brick collisions - scan neighborhood
      const approxCol = Math.floor((BALL.x - brickOffsetLeft) / cellW);
      const approxRow = Math.floor((BALL.y - brickOffsetTop) / cellH);

      for (let rr = approxRow - 1; rr <= approxRow + 1; rr++) {
        if (rr < 0 || rr >= brickRows) continue;
        for (let cc = approxCol - 1; cc <= approxCol + 1; cc++) {
          if (cc < 0 || cc >= brickCols) continue;
          const brick = bricks[rr][cc];
          if (!brick || !brick.alive) continue;
          if (!rectCircleCollide(brick.x, brick.y, brick.w, brick.h, BALL.x, BALL.y, BALL.radius)) {
            continue;
          }
          // Hit: adjust hp and score
          if (brick.hp > 1) {
            brick.hp -= 1;
            score += 5;
          } else {
            brick.alive = false;
            bricks[rr][cc] = null;
            bricksRemaining--;
            score += 10;
          }
          // Bounce
          resolveBallBrickBounce(brick);
          // After a single brick impact in this substep, break to avoid double-processing
          // (improves stability at high speeds)
          cc = approxCol + 2;
          rr = approxRow + 2;
        }
      }

      // Win condition: if no bricks left, advance
      if (bricksRemaining <= 0) {
        nextLevel();
        return;
      }
    }
  }

  function handleInput(dt) {
    // Keyboard paddle control (in addition to pointer)
    let move = 0;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) move -= 1;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) move += 1;
    if (move !== 0) {
      PADDLE.x += move * PADDLE.speed * dt;
    }
    // Pointer control - smooth direct positioning
    if (pointerActive) {
      const targetX = pointerX - PADDLE.w / 2;
      PADDLE.x = targetX;
    }
    PADDLE.x = clamp(PADDLE.x, 0, WIDTH - PADDLE.w);
  }

  function draw() {
    // Clear
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Draw UI
    ctx.fillStyle = '#fff';
    ctx.font = '16px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${score}`, 14, 22);
    ctx.fillText(`Lives: ${lives}`, 120, 22);
    ctx.fillText(`Level: ${levelIndex + 1}/${LEVELS.length}`, 200, 22);

    // Draw bricks
    for (let r = 0; r < brickRows; r++) {
      for (let c = 0; c < brickCols; c++) {
        const brick = bricks[r][c];
        if (!brick || !brick.alive) continue;
        const baseColor = brick.color || '#4FC3F7';
        const drawColor = (brick.type === 2 && brick.hp === 1) ? darkenColor(baseColor, 0.7) : baseColor;
        ctx.fillStyle = drawColor;
        ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
        // Outline
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.strokeRect(brick.x + 0.5, brick.y + 0.5, brick.w - 1, brick.h - 1);
        // Damage overlay for strong bricks at hp==1
        if (brick.type === 2 && brick.hp === 1) {
          ctx.fillStyle = 'rgba(0,0,0,0.2)';
          ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
        }
      }
    }

    // Draw paddle
    ctx.fillStyle = '#f1f1f1';
    ctx.fillRect(PADDLE.x, PADDLE.y, PADDLE.w, PADDLE.h);

    // Draw ball
    ctx.beginPath();
    ctx.arc(BALL.x, BALL.y, BALL.radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = '#FFEB3B';
    ctx.fill();

    // State overlays
    ctx.textAlign = 'center';
    if (state === GAME_STATE.START) {
      ctx.fillStyle = '#fff';
      ctx.font = '28px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
      ctx.fillText('Breakout', WIDTH / 2, HEIGHT / 2 - 24);
      ctx.font = '16px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
      ctx.fillText('Press Space or Tap to Start', WIDTH / 2, HEIGHT / 2 + 8);
      ctx.fillText('Arrow keys or drag to move. P to Pause.', WIDTH / 2, HEIGHT / 2 + 32);
    } else if (state === GAME_STATE.GAME_OVER) {
      ctx.fillStyle = '#fff';
      ctx.font = '28px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
      ctx.fillText('Game Over', WIDTH / 2, HEIGHT / 2 - 24);
      ctx.font = '16px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
      ctx.fillText('Press Enter or Tap to Restart', WIDTH / 2, HEIGHT / 2 + 8);
    } else if (state === GAME_STATE.WIN) {
      ctx.fillStyle = '#fff';
      ctx.font = '28px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
      ctx.fillText('You Win!', WIDTH / 2, HEIGHT / 2 - 24);
      ctx.font = '16px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
      ctx.fillText('Press Enter or Tap to Play Again', WIDTH / 2, HEIGHT / 2 + 8);
    } else if (state === GAME_STATE.PAUSED) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '28px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
      ctx.fillText('PAUSED', WIDTH / 2, HEIGHT / 2);
    }
  }

  // Events
  window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    if (e.key === ' ' && state === GAME_STATE.START) {
      startGame();
    } else if ((e.key === 'Enter' || e.key === 'Return') && (state === GAME_STATE.GAME_OVER || state === GAME_STATE.WIN)) {
      startGame();
    } else if ((e.key === 'p' || e.key === 'P') && (state === GAME_STATE.PLAYING || state === GAME_STATE.PAUSED)) {
      togglePause();
    }
  });
  window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
  });

  // Pointer / touch
  function onPointerDown(e) {
    if (e.target === pauseBtn) return;
    pointerActive = true;
    pointerX = getCanvasRelativeX(e.clientX ?? (e.touches && e.touches[0] && e.touches[0].clientX) || 0);
    if (state === GAME_STATE.START) {
      startGame();
    } else if (state === GAME_STATE.GAME_OVER || state === GAME_STATE.WIN) {
      startGame();
    }
  }
  function onPointerMove(e) {
    if (!pointerActive) return;
    pointerX = getCanvasRelativeX(e.clientX ?? (e.touches && e.touches[0] && e.touches[0].clientX) || 0);
  }
  function onPointerUp() {
    pointerActive = false;
  }

  canvas.addEventListener('mousedown', onPointerDown);
  canvas.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onPointerUp);
  canvas.addEventListener('touchstart', (e) => { onPointerDown(e); }, { passive: true });
  canvas.addEventListener('touchmove', (e) => { onPointerMove(e); }, { passive: true });
  canvas.addEventListener('touchend', onPointerUp, { passive: true });
  canvas.addEventListener('touchcancel', onPointerUp, { passive: true });

  // Pause button
  pauseBtn.addEventListener('click', () => {
    if (state === GAME_STATE.PLAYING || state === GAME_STATE.PAUSED) {
      togglePause();
    }
  });

  // Responsive canvas sizing (CSS only)
  function resizeCanvasCSS() {
    const margin = 16;
    const availW = Math.max(100, window.innerWidth - margin * 2);
    const availH = Math.max(100, window.innerHeight - margin * 2);
    const aspect = WIDTH / HEIGHT;
    let cssW = availW;
    let cssH = cssW / aspect;
    if (cssH > availH) {
      cssH = availH;
      cssW = cssH * aspect;
    }
    canvas.style.width = `${cssW | 0}px`;
    canvas.style.height = `${cssH | 0}px`;
  }
  window.addEventListener('resize', resizeCanvasCSS);
  resizeCanvasCSS();

  // Initialize first level bricks for start screen
  buildBricks();
  resetBallAndPaddle(true);
  updatePauseButton();
  requestAnimationFrame(loop);
})(); 


