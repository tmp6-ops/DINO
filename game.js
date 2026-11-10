// Chrome T-Rex Runner Game Implementation
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreText = document.getElementById('scoreText');
const hiScoreText = document.getElementById('hiScoreText');
const soundToggle = document.getElementById('soundToggle');

// Sound synthesis using Web Audio API
let soundEnabled = true;
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

// Fun Chicken Cluck Sound on Jump!
function playChickenJumpSound() {
  if (!soundEnabled) return;
  try {
    initAudio();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const t = audioCtx.currentTime;

    // Quick playful double-cluck: "Bawk-bawk!"
    const clucks = [
      { start: 0, dur: 0.08, f1: 520, f2: 680, gain: 0.22 },
      { start: 0.1, dur: 0.12, f1: 600, f2: 850, gain: 0.25 }
    ];

    clucks.forEach(c => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      
      osc.frequency.setValueAtTime(c.f1, t + c.start);
      osc.frequency.exponentialRampToValueAtTime(c.f2, t + c.start + c.dur * 0.4);
      osc.frequency.exponentialRampToValueAtTime(c.f1 * 0.7, t + c.start + c.dur);

      gain.gain.setValueAtTime(0.01, t + c.start);
      gain.gain.linearRampToValueAtTime(c.gain, t + c.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + c.start + c.dur);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(t + c.start);
      osc.stop(t + c.start + c.dur);
    });
  } catch (e) {}
}

// Chicken Squawk / Distress sound when hitting an obstacle!
function playChickenSquawkSound() {
  if (!soundEnabled) return;
  try {
    initAudio();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const t = audioCtx.currentTime;

    // Loud funny squawk: "BWAAAWK!"
    const osc = audioCtx.createOscillator();
    const modOsc = audioCtx.createOscillator();
    const modGain = audioCtx.createGain();
    const gain = audioCtx.createGain();

    osc.type = 'sawtooth';
    modOsc.type = 'square';
    modOsc.frequency.setValueAtTime(30, t); // Vibrato flutter for panicked chicken throat
    modGain.gain.setValueAtTime(100, t);
    modOsc.connect(modGain);
    modGain.connect(osc.frequency);

    osc.frequency.setValueAtTime(450, t);
    osc.frequency.linearRampToValueAtTime(950, t + 0.1);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.38);

    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.38);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    modOsc.start(t);
    osc.start(t);
    modOsc.stop(t + 0.38);
    osc.stop(t + 0.38);
  } catch (e) {}
}

function playScoreSound() {
  if (!soundEnabled) return;
  try {
    initAudio();
    const t = audioCtx.currentTime;
    [0, 0.09, 0.18].forEach((offset, idx) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(650 + idx * 180, t + offset);
      gain.gain.setValueAtTime(0.18, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.08);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(t + offset);
      osc.stop(t + offset + 0.08);
    });
  } catch (e) {}
}

soundToggle.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  soundToggle.textContent = soundEnabled ? '🔊' : '🔇';
});

// Game state constants and vars
const GROUND_Y = 210;
let gameSpeed = 6;
let score = 0;
let hiScore = parseInt(localStorage.getItem('dino_hi_score') || '0', 10);
let isGameOver = false;
let isStarted = false;
let animationFrameId = null;
let lastScoreMilestone = 0;

function formatScore(n) {
  return n.toString().padStart(5, '0');
}
hiScoreText.textContent = `HI ${formatScore(hiScore)}`;

// Ground and horizon details
let groundOffset = 0;
const groundBumps = [];
for (let i = 0; i < 40; i++) {
  groundBumps.push({
    x: Math.random() * canvas.width,
    width: Math.random() * 8 + 2,
    yOffset: Math.random() * 8 + 2
  });
}

// Clouds
const clouds = [];
function spawnCloud() {
  clouds.push({
    x: canvas.width + Math.random() * 50,
    y: Math.random() * 70 + 30,
    speed: 1 + Math.random() * 0.8
  });
}
for (let i = 0; i < 3; i++) {
  clouds.push({
    x: Math.random() * canvas.width,
    y: Math.random() * 70 + 30,
    speed: 1 + Math.random() * 0.8
  });
}

// Dino object
const dino = {
  x: 50,
  y: GROUND_Y - 47,
  normalWidth: 44,
  normalHeight: 47,
  duckWidth: 55,
  duckHeight: 30,
  width: 44,
  height: 47,
  vy: 0,
  gravity: 0.65,
  jumpStrength: -12,
  isJumping: false,
  isDucking: false,
  legStep: 0,
  animTick: 0,

  reset() {
    this.y = GROUND_Y - this.normalHeight;
    this.width = this.normalWidth;
    this.height = this.normalHeight;
    this.vy = 0;
    this.isJumping = false;
    this.isDucking = false;
    this.legStep = 0;
    this.animTick = 0;
  },

  jump() {
    if (!this.isJumping) {
      this.vy = this.jumpStrength;
      this.isJumping = true;
      this.isDucking = false;
      this.width = this.normalWidth;
      this.height = this.normalHeight;
      playChickenJumpSound();
    }
  },

  duck(state) {
    if (this.isJumping) return;
    this.isDucking = state;
    if (state) {
      this.width = this.duckWidth;
      this.height = this.duckHeight;
      this.y = GROUND_Y - this.duckHeight;
    } else {
      this.width = this.normalWidth;
      this.height = this.normalHeight;
      this.y = GROUND_Y - this.normalHeight;
    }
  },

  update() {
    if (this.isJumping) {
      this.vy += this.gravity;
      this.y += this.vy;

      const groundBase = this.isDucking ? (GROUND_Y - this.duckHeight) : (GROUND_Y - this.normalHeight);
      if (this.y >= groundBase) {
        this.y = groundBase;
        this.vy = 0;
        this.isJumping = false;
      }
    }

    this.animTick++;
    if (this.animTick % 6 === 0) {
      this.legStep = (this.legStep + 1) % 2;
    }
  },

  draw() {
    const x = this.x;
    const y = this.y;

    if (this.isDucking && !this.isJumping) {
      // Ducking Dino / Chicken
      // Main body (Vibrant Emerald / Dino Green)
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(x + 10, y + 10, 36, 14);
      ctx.fillRect(x + 2, y + 12, 10, 8); // tail

      // Belly highlight (soft lime/yellow)
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(x + 16, y + 18, 20, 6);

      // Head
      ctx.fillStyle = '#27ae60';
      ctx.fillRect(x + 36, y + 4, 18, 14);
      // Snout / Beak (Bright orange)
      ctx.fillStyle = '#e67e22';
      ctx.fillRect(x + 44, y + 10, 10, 4);

      // Chicken Comb / Crest on head (Crimson Red)
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(x + 38, y, 10, 4);
      ctx.fillRect(x + 42, y - 3, 5, 4);

      // Eye
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 42, y + 6, 4, 4);
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(x + 44, y + 7, 2, 2);

      // Legs & Claws (Warm orange)
      ctx.fillStyle = '#d35400';
      if (this.legStep === 0) {
        ctx.fillRect(x + 16, y + 24, 6, 6);
        ctx.fillRect(x + 30, y + 24, 6, 4);
      } else {
        ctx.fillRect(x + 16, y + 24, 6, 4);
        ctx.fillRect(x + 30, y + 24, 6, 6);
      }
    } else {
      // Standing / Jumping Dino
      // Head
      ctx.fillStyle = '#27ae60';
      ctx.fillRect(x + 22, y, 22, 16);

      // Snout / Beak (Bright Orange)
      ctx.fillStyle = '#e67e22';
      ctx.fillRect(x + 26, y + 14, 18, 6);

      // Chicken Comb / Crest (Crimson Red)
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(x + 24, y - 6, 16, 6);
      ctx.fillRect(x + 28, y - 9, 8, 4);

      // Wattle under neck (Red)
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(x + 30, y + 20, 5, 5);

      // Eye
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 26, y + 3, 5, 5);
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(x + 28, y + 4, 2, 2);

      // Body & Back (Vibrant Green)
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(x + 12, y + 16, 16, 20);
      ctx.fillRect(x + 8, y + 20, 8, 14); // lower back
      ctx.fillRect(x, y + 24, 8, 8);      // tail

      // Belly patch (Soft yellow)
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(x + 18, y + 22, 8, 12);

      // Little Wing / Arm (Teal-green accent)
      ctx.fillStyle = '#1abc9c';
      ctx.fillRect(x + 28, y + 22, 8, 6);
      ctx.fillRect(x + 32, y + 26, 4, 3);

      // Legs & Claws (Warm orange)
      ctx.fillStyle = '#d35400';
      if (this.isJumping || isGameOver) {
        ctx.fillRect(x + 14, y + 36, 5, 11);
        ctx.fillRect(x + 24, y + 36, 5, 11);
        ctx.fillRect(x + 14, y + 45, 8, 2);
        ctx.fillRect(x + 24, y + 45, 8, 2);
      } else {
        if (this.legStep === 0) {
          ctx.fillRect(x + 14, y + 36, 5, 11);
          ctx.fillRect(x + 14, y + 45, 8, 2);
          ctx.fillRect(x + 24, y + 36, 5, 6);
        } else {
          ctx.fillRect(x + 14, y + 36, 5, 6);
          ctx.fillRect(x + 24, y + 36, 5, 11);
          ctx.fillRect(x + 24, y + 45, 8, 2);
        }
      }
    }
  }
};

// Obstacles (Cactus & Pterodactyl Birds)
const obstacles = [];
let nextObstacleSpawn = 80;

function spawnObstacle() {
  const allowBird = score > 350;
  const isBird = allowBird && Math.random() < 0.28;

  if (isBird) {
    const flightHeights = [GROUND_Y - 32, GROUND_Y - 55, GROUND_Y - 75];
    const birdY = flightHeights[Math.floor(Math.random() * flightHeights.length)];
    obstacles.push({
      type: 'bird',
      x: canvas.width + 20,
      y: birdY,
      width: 40,
      height: 28,
      wingState: 0,
      animTick: 0
    });
  } else {
    const cactusTypes = [
      { width: 16, height: 35, y: GROUND_Y - 35, branches: 1 },
      { width: 30, height: 45, y: GROUND_Y - 45, branches: 2 },
      { width: 48, height: 42, y: GROUND_Y - 42, branches: 3 }
    ];
    const chosen = cactusTypes[Math.floor(Math.random() * cactusTypes.length)];
    obstacles.push({
      type: 'cactus',
      x: canvas.width + 20,
      y: chosen.y,
      width: chosen.width,
      height: chosen.height,
      branches: chosen.branches
    });
  }

  // Set random gap for next obstacle
  const minGap = 65;
  const maxGap = 130;
  nextObstacleSpawn = Math.floor(Math.random() * (maxGap - minGap) + minGap);
}

function drawCactus(ob) {
  // Vibrant Desert Cacti with darker outline effect
  ctx.fillStyle = '#27ae60';
  if (ob.branches === 1) {
    ctx.fillRect(ob.x + 5, ob.y, 6, ob.height);
    ctx.fillRect(ob.x, ob.y + 10, 5, 4);
    ctx.fillRect(ob.x, ob.y + 6, 3, 5);
    ctx.fillRect(ob.x + 11, ob.y + 14, 5, 4);
    ctx.fillRect(ob.x + 13, ob.y + 8, 3, 8);
    // Flower top!
    ctx.fillStyle = '#e84393';
    ctx.fillRect(ob.x + 6, ob.y - 3, 4, 3);
  } else if (ob.branches === 2) {
    ctx.fillRect(ob.x + 6, ob.y + 4, 6, ob.height - 4);
    ctx.fillRect(ob.x + 18, ob.y, 7, ob.height);
    ctx.fillRect(ob.x + 1, ob.y + 14, 6, 4);
    ctx.fillRect(ob.x + 1, ob.y + 9, 3, 7);
    ctx.fillRect(ob.x + 24, ob.y + 18, 6, 4);
    ctx.fillRect(ob.x + 27, ob.y + 12, 3, 8);
    // Yellow flower top!
    ctx.fillStyle = '#fdcb6e';
    ctx.fillRect(ob.x + 19, ob.y - 3, 5, 3);
  } else {
    ctx.fillRect(ob.x + 4, ob.y + 8, 6, ob.height - 8);
    ctx.fillRect(ob.x + 18, ob.y, 8, ob.height);
    ctx.fillRect(ob.x + 34, ob.y + 6, 7, ob.height - 6);
    ctx.fillRect(ob.x, ob.y + 16, 5, 4);
    ctx.fillRect(ob.x + 11, ob.y + 20, 7, 4);
    ctx.fillRect(ob.x + 40, ob.y + 16, 6, 4);
    // Coral flower
    ctx.fillStyle = '#ff7675';
    ctx.fillRect(ob.x + 20, ob.y - 4, 4, 4);
  }
}

function drawBird(ob) {
  ob.animTick++;
  if (ob.animTick % 10 === 0) {
    ob.wingState = (ob.wingState + 1) % 2;
  }

  // Colorful Pterodactyl Bird: Crimson red body, golden beak, purple wings
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(ob.x + 12, ob.y + 10, 20, 9);
  ctx.fillRect(ob.x + 4, ob.y + 8, 10, 6);  // tail

  // Golden Beak
  ctx.fillStyle = '#f39c12';
  ctx.fillRect(ob.x + 30, ob.y + 13, 10, 4);

  // Eye
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(ob.x + 26, ob.y + 11, 3, 3);
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(ob.x + 27, ob.y + 12, 2, 2);

  // Wings (Violet / Purple)
  ctx.fillStyle = '#9b59b6';
  if (ob.wingState === 0) {
    // Wing up
    ctx.fillRect(ob.x + 14, ob.y, 8, 11);
    ctx.fillRect(ob.x + 18, ob.y - 6, 5, 7);
  } else {
    // Wing down
    ctx.fillRect(ob.x + 14, ob.y + 17, 8, 10);
    ctx.fillRect(ob.x + 18, ob.y + 25, 5, 5);
  }
}

function checkCollision(a, b) {
  // Margin padding for forgiving pixel hitboxes
  const paddingX = 6;
  const paddingTop = 4;
  const paddingBottom = 4;

  return (
    a.x + paddingX < b.x + b.width &&
    a.x + a.width - paddingX > b.x &&
    a.y + paddingTop < b.y + b.height &&
    a.y + a.height - paddingBottom > b.y
  );
}

function drawCloud(c) {
  // Soft fluffy white clouds with blueish shadow
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.fillRect(c.x + 12, c.y, 24, 6);
  ctx.fillRect(c.x + 6, c.y + 4, 36, 7);
  ctx.fillRect(c.x, c.y + 8, 48, 6);
  ctx.fillStyle = 'rgba(178, 190, 195, 0.5)';
  ctx.fillRect(c.x + 4, c.y + 13, 40, 2);
}

function drawGround() {
  // Rich warm ground terrain (Green grass stripe + desert sand path)
  ctx.fillStyle = '#27ae60';
  ctx.fillRect(0, GROUND_Y, canvas.width, 3);
  ctx.fillStyle = '#e67e22';
  ctx.fillRect(0, GROUND_Y + 3, canvas.width, 37);

  // Moving ground pebbles / details
  groundOffset = (groundOffset + gameSpeed) % canvas.width;
  ctx.fillStyle = '#d35400';
  for (let bump of groundBumps) {
    const drawX = (bump.x - groundOffset + canvas.width) % canvas.width;
    ctx.fillRect(drawX, GROUND_Y + 3 + bump.yOffset, bump.width, 2);
  }
}

function drawGameOver() {
  ctx.fillStyle = '#c0392b';
  ctx.font = '16px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('G A M E   O V E R', canvas.width / 2, 95);

  // Restart icon
  const cx = canvas.width / 2;
  const cy = 135;
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#e67e22';
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0.25 * Math.PI, 1.75 * Math.PI, false);
  ctx.stroke();

  // Arrowhead
  ctx.fillStyle = '#e67e22';
  ctx.beginPath();
  ctx.moveTo(cx + 8, cy - 14);
  ctx.lineTo(cx + 17, cy - 9);
  ctx.lineTo(cx + 17, cy - 18);
  ctx.fill();

  ctx.fillStyle = '#2c3e50';
  ctx.font = '10px "Press Start 2P", monospace';
  ctx.fillText('PRESS SPACE TO RESTART', canvas.width / 2, 175);
}

function drawStartPrompt() {
  ctx.fillStyle = '#d35400';
  ctx.font = '12px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PRESS SPACE OR TAP TO JUMP', canvas.width / 2, 110);
}

function resetGame() {
  dino.reset();
  obstacles.length = 0;
  nextObstacleSpawn = 80;
  score = 0;
  lastScoreMilestone = 0;
  gameSpeed = 6;
  isGameOver = false;
  isStarted = true;
  scoreText.textContent = formatScore(score);
}

function update() {
  if (!isStarted) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw initial idle state
    clouds.forEach(drawCloud);
    drawGround();
    dino.draw();
    drawStartPrompt();
    animationFrameId = requestAnimationFrame(update);
    return;
  }

  if (isGameOver) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    clouds.forEach(drawCloud);
    drawGround();
    obstacles.forEach(ob => {
      if (ob.type === 'cactus') drawCactus(ob);
      else drawBird(ob);
    });
    dino.draw();
    drawGameOver();
    return;
  }

  // Update Game
  score += 0.15;
  const currentIntScore = Math.floor(score);
  scoreText.textContent = formatScore(currentIntScore);

  // Beep every 100 points
  if (currentIntScore > 0 && currentIntScore % 100 === 0 && currentIntScore !== lastScoreMilestone) {
    playScoreSound();
    lastScoreMilestone = currentIntScore;
  }

  // Slightly accelerate game speed gradually up to maximum cap
  if (gameSpeed < 13) {
    gameSpeed += 0.001;
  }

  // Clouds update
  if (Math.random() < 0.006) {
    spawnCloud();
  }
  for (let i = clouds.length - 1; i >= 0; i--) {
    clouds[i].x -= clouds[i].speed;
    if (clouds[i].x < -60) {
      clouds.splice(i, 1);
    }
  }

  // Dino update
  dino.update();

  // Obstacles update & spawn
  nextObstacleSpawn--;
  if (nextObstacleSpawn <= 0) {
    spawnObstacle();
  }

  for (let i = obstacles.length - 1; i >= 0; i--) {
    const ob = obstacles[i];
    ob.x -= gameSpeed;

    // Collision check
    if (checkCollision(dino, ob)) {
      isGameOver = true;
      playChickenSquawkSound();
      if (currentIntScore > hiScore) {
        hiScore = currentIntScore;
        localStorage.setItem('dino_hi_score', hiScore);
        hiScoreText.textContent = `HI ${formatScore(hiScore)}`;
      }
    }

    if (ob.x + ob.width < -30) {
      obstacles.splice(i, 1);
    }
  }

  // Rendering
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  clouds.forEach(drawCloud);
  drawGround();

  obstacles.forEach(ob => {
    if (ob.type === 'cactus') drawCactus(ob);
    else drawBird(ob);
  });

  dino.draw();

  animationFrameId = requestAnimationFrame(update);
}

// User input controls
function handleJumpAction() {
  if (!isStarted) {
    resetGame();
  } else if (isGameOver) {
    resetGame();
    update();
  } else {
    dino.jump();
  }
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    handleJumpAction();
  } else if (e.code === 'ArrowDown') {
    e.preventDefault();
    if (isStarted && !isGameOver) {
      dino.duck(true);
    }
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowDown') {
    dino.duck(false);
  }
});

// Canvas tap / click for mobile and quick mouse play
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  handleJumpAction();
});

// Start loop
update();

