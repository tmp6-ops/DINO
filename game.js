// Chrome Dino Game clone in HTML5 Canvas & JavaScript
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const hiScoreEl = document.getElementById('hiScore');
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const finalScoreText = document.getElementById('finalScoreText');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const soundToggle = document.getElementById('soundToggle');

// Canvas dimensions
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 250;
const GROUND_Y = 210;

// Game State
let isPlaying = false;
let isGameOver = false;
let score = 0;
let highScore = localStorage.getItem('dino_hi_score') || 0;
let gameSpeed = 5;
const INITIAL_SPEED = 5;
const MAX_SPEED = 12;
const SPEED_INCREMENT = 0.001;

// Sound toggle handler
soundToggle.addEventListener('click', () => {
  const isMuted = window.soundManager.toggleMute();
  soundToggle.textContent = isMuted ? '🔇 SOUND: OFF' : '🔊 SOUND: ON';
});

// Update High Score Display
function updateHighScoreDisplay() {
  hiScoreEl.textContent = `HI ${String(Math.floor(highScore)).padStart(5, '0')}`;
}
updateHighScoreDisplay();

// Dino Object
const dino = {
  x: 50,
  y: GROUND_Y - 45,
  width: 40,
  height: 45,
  standingHeight: 45,
  standingWidth: 40,
  duckingHeight: 25,
  duckingWidth: 55,
  velocityY: 0,
  gravity: 0.6,
  jumpForce: -11.5,
  isGrounded: true,
  isDucking: false,
  legState: 0, // 0 or 1 for running animation
  animTimer: 0,

  reset() {
    this.x = 50;
    this.standingHeight = 45;
    this.standingWidth = 40;
    this.width = this.standingWidth;
    this.height = this.standingHeight;
    this.y = GROUND_Y - this.height;
    this.velocityY = 0;
    this.isGrounded = true;
    this.isDucking = false;
  },

  jump() {
    if (this.isGrounded && !this.isDucking) {
      this.velocityY = this.jumpForce;
      this.isGrounded = false;
      window.soundManager.playJump();
    }
  },

  duck(down) {
    if (!this.isGrounded) return;
    this.isDucking = down;
    if (down) {
      this.width = this.duckingWidth;
      this.height = this.duckingHeight;
      this.y = GROUND_Y - this.height;
    } else {
      this.width = this.standingWidth;
      this.height = this.standingHeight;
      this.y = GROUND_Y - this.height;
    }
  },

  update() {
    // Jump physics
    if (!this.isGrounded) {
      this.velocityY += this.gravity;
      this.y += this.velocityY;

      if (this.y >= GROUND_Y - this.height) {
        this.y = GROUND_Y - this.height;
        this.velocityY = 0;
        this.isGrounded = true;
      }
    }

    // Animation frame toggle
    this.animTimer++;
    if (this.animTimer > 6) {
      this.legState = 1 - this.legState;
      this.animTimer = 0;
    }
  },

  draw() {
    ctx.fillStyle = '#535353';

    if (this.isDucking) {
      // Ducking Dino Sprite
      ctx.fillRect(this.x, this.y + 6, this.width - 15, this.height - 6); // body
      ctx.fillRect(this.x + this.width - 20, this.y, 20, 16); // head extended
      // Eye
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(this.x + this.width - 12, this.y + 3, 3, 3);
      ctx.fillStyle = '#535353';
      // Feet
      if (this.isGrounded) {
        if (this.legState === 0) {
          ctx.fillRect(this.x + 8, this.y + this.height - 2, 8, 3);
        } else {
          ctx.fillRect(this.x + 28, this.y + this.height - 2, 8, 3);
        }
      }
    } else {
      // Standing/Running Dino Sprite
      // Body & Back
      ctx.fillRect(this.x + 6, this.y + 12, 22, 22);
      // Head & Snout
      ctx.fillRect(this.x + 18, this.y, 22, 16);
      ctx.fillRect(this.x + 34, this.y + 6, 6, 10);
      // Eye
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(this.x + 24, this.y + 3, 3, 3);
      ctx.fillStyle = '#535353';
      // Small arms
      ctx.fillRect(this.x + 30, this.y + 18, 5, 3);
      ctx.fillRect(this.x + 33, this.y + 21, 2, 3);
      // Tail
      ctx.fillRect(this.x, this.y + 18, 6, 8);
      ctx.fillRect(this.x - 3, this.y + 15, 4, 6);

      // Legs
      if (!this.isGrounded) {
        // Jumping legs position
        ctx.fillRect(this.x + 10, this.y + 34, 4, 8);
        ctx.fillRect(this.x + 22, this.y + 34, 4, 8);
      } else {
        // Alternating running legs
        if (this.legState === 0) {
          ctx.fillRect(this.x + 8, this.y + 34, 5, 11);
          ctx.fillRect(this.x + 22, this.y + 34, 8, 7);
        } else {
          ctx.fillRect(this.x + 8, this.y + 34, 8, 7);
          ctx.fillRect(this.x + 22, this.y + 34, 5, 11);
        }
      }
    }
  }
};

// Obstacles (Cactus & Pterodactyl Birds)
let obstacles = [];
let obstacleSpawnTimer = 0;

class Cactus {
  constructor(x, type) {
    this.x = x;
    this.type = type; // 0: single small, 1: double small, 2: large
    if (type === 0) {
      this.width = 16;
      this.height = 36;
    } else if (type === 1) {
      this.width = 30;
      this.height = 36;
    } else {
      this.width = 24;
      this.height = 46;
    }
    this.y = GROUND_Y - this.height;
  }

  update() {
    this.x -= gameSpeed;
  }

  draw() {
    ctx.fillStyle = '#535353';
    if (this.type === 0) {
      // Single small cactus
      ctx.fillRect(this.x + 5, this.y, 6, this.height);
      ctx.fillRect(this.x, this.y + 8, 5, 12);
      ctx.fillRect(this.x + 11, this.y + 12, 5, 10);
    } else if (this.type === 1) {
      // Double cactus
      ctx.fillRect(this.x + 4, this.y, 6, this.height);
      ctx.fillRect(this.x, this.y + 10, 4, 10);
      ctx.fillRect(this.x + 18, this.y + 4, 6, this.height - 4);
      ctx.fillRect(this.x + 24, this.y + 12, 5, 10);
    } else {
      // Tall cactus
      ctx.fillRect(this.x + 8, this.y, 8, this.height);
      ctx.fillRect(this.x, this.y + 12, 8, 14);
      ctx.fillRect(this.x + 16, this.y + 16, 8, 12);
    }
  }
}

class Bird {
  constructor(x, heightMode) {
    this.x = x;
    this.width = 40;
    this.height = 25;
    // heightMode 0: low (must jump), 1: mid (must duck or jump high)
    this.y = heightMode === 0 ? GROUND_Y - 35 : GROUND_Y - 60;
    this.wingState = 0;
    this.wingTimer = 0;
  }

  update() {
    this.x -= gameSpeed * 1.08;
    this.wingTimer++;
    if (this.wingTimer > 10) {
      this.wingState = 1 - this.wingState;
      this.wingTimer = 0;
    }
  }

  draw() {
    ctx.fillStyle = '#535353';
    // Bird Body
    ctx.fillRect(this.x + 10, this.y + 8, 22, 10);
    // Head and Beak
    ctx.fillRect(this.x, this.y + 10, 10, 6);
    ctx.fillRect(this.x - 4, this.y + 12, 4, 3);
    // Eye
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(this.x + 4, this.y + 11, 2, 2);
    ctx.fillStyle = '#535353';

    // Wings Flapping
    if (this.wingState === 0) {
      // Wing Up
      ctx.fillRect(this.x + 14, this.y, 8, 8);
    } else {
      // Wing Down
      ctx.fillRect(this.x + 14, this.y + 18, 8, 8);
    }
  }
}

// Background Ground & Clouds
let groundOffset = 0;
let clouds = [
  { x: 200, y: 50, speed: 0.6 },
  { x: 500, y: 35, speed: 0.5 },
  { x: 750, y: 65, speed: 0.7 }
];

function drawGround() {
  ctx.strokeStyle = '#535353';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
  ctx.stroke();

  // Little pebbles / ground dots
  ctx.fillStyle = '#888888';
  for (let i = 0; i < CANVAS_WIDTH; i += 40) {
    let px = (i - (groundOffset % 40) + CANVAS_WIDTH) % CANVAS_WIDTH;
    ctx.fillRect(px, GROUND_Y + 8, 4, 2);
    ctx.fillRect((px + 18) % CANVAS_WIDTH, GROUND_Y + 16, 2, 2);
  }
}

function updateAndDrawClouds() {
  ctx.fillStyle = '#d5d5d5';
  clouds.forEach(cloud => {
    if (isPlaying) {
      cloud.x -= cloud.speed;
      if (cloud.x < -60) {
        cloud.x = CANVAS_WIDTH + Math.random() * 80;
        cloud.y = 30 + Math.random() * 50;
      }
    }
    // Cloud Shape
    ctx.fillRect(cloud.x, cloud.y, 45, 12);
    ctx.fillRect(cloud.x + 10, cloud.y - 7, 25, 7);
    ctx.fillRect(cloud.x + 20, cloud.y - 12, 12, 5);
  });
}

function spawnObstacle() {
  obstacleSpawnTimer++;
  // Minimum separation distance
  const minInterval = Math.max(50, 110 - Math.floor(gameSpeed * 3));
  if (obstacleSpawnTimer > minInterval) {
    if (Math.random() < 0.04) {
      // Score > 250 allows Birds to spawn
      if (score > 250 && Math.random() < 0.35) {
        const heightMode = Math.random() > 0.5 ? 1 : 0;
        obstacles.push(new Bird(CANVAS_WIDTH + 20, heightMode));
      } else {
        const type = Math.floor(Math.random() * 3);
        obstacles.push(new Cactus(CANVAS_WIDTH + 20, type));
      }
      obstacleSpawnTimer = 0;
    }
  }
}

// Axis-Aligned Bounding Box (AABB) Collision Detection with tight margins
function checkCollision(dino, obstacle) {
  const marginX = 6;
  const marginY = 5;

  return (
    dino.x + marginX < obstacle.x + obstacle.width - marginX &&
    dino.x + dino.width - marginX > obstacle.x + marginX &&
    dino.y + marginY < obstacle.y + obstacle.height - marginY &&
    dino.y + dino.height > obstacle.y + marginY
  );
}

// Main Game Loop
let lastScoreMilestone = 0;

function gameLoop() {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Background
  updateAndDrawClouds();
  drawGround();

  if (isPlaying && !isGameOver) {
    groundOffset += gameSpeed;
    gameSpeed = Math.min(MAX_SPEED, gameSpeed + SPEED_INCREMENT);

    // Score handling
    score += 0.15;
    const currentIntScore = Math.floor(score);
    scoreEl.textContent = String(currentIntScore).padStart(5, '0');

    // Milestone sound every 100 points
    if (currentIntScore > 0 && currentIntScore % 100 === 0 && currentIntScore !== lastScoreMilestone) {
      window.soundManager.playScore();
      lastScoreMilestone = currentIntScore;
    }

    // High Score tracking
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('dino_hi_score', highScore);
      updateHighScoreDisplay();
    }

    // Dino update
    dino.update();

    // Spawning and updating obstacles
    spawnObstacle();

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      obs.update();
      obs.draw();

      // Check Collision
      if (checkCollision(dino, obs)) {
        triggerGameOver();
        break;
      }

      // Remove offscreen
      if (obs.x + obs.width < 0) {
        obstacles.splice(i, 1);
      }
    }
  } else {
    // Render obstacles when game over or paused
    obstacles.forEach(obs => obs.draw());
  }

  // Draw Dino
  dino.draw();

  requestAnimationFrame(gameLoop);
}

function startGame() {
  window.soundManager.init();
  score = 0;
  gameSpeed = INITIAL_SPEED;
  lastScoreMilestone = 0;
  obstacles = [];
  dino.reset();
  isGameOver = false;
  isPlaying = true;

  startScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
}

function triggerGameOver() {
  isGameOver = true;
  isPlaying = false;
  window.soundManager.playHit();

  finalScoreText.textContent = `SCORE: ${String(Math.floor(score)).padStart(5, '0')}`;
  gameOverScreen.classList.remove('hidden');
}

// Keyboard controls
const activeKeys = {};

window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) {
    e.preventDefault();
    if (!isPlaying && !isGameOver) {
      startGame();
    } else if (isGameOver) {
      startGame();
    } else {
      dino.jump();
    }
  } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
    e.preventDefault();
    if (isPlaying && !isGameOver) {
      dino.duck(true);
    }
  } else if (e.code === 'KeyM') {
    soundToggle.click();
  }
});

window.addEventListener('keyup', (e) => {
  if (['ArrowDown', 'KeyS'].includes(e.code)) {
    if (isPlaying && !isGameOver) {
      dino.duck(false);
    }
  }
});

// UI Button Clicks
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// Touch / Mouse click on canvas for jumps
canvas.addEventListener('pointerdown', (e) => {
  if (!isPlaying && !isGameOver) {
    startGame();
  } else if (isGameOver) {
    startGame();
  } else {
    dino.jump();
  }
});

// Initial render
dino.reset();
requestAnimationFrame(gameLoop);

