const startButton = document.getElementById('startButton');
const gameArea = document.getElementById('gameArea');
const countdownEl = document.getElementById('countdown');
const character = document.getElementById('character');
const characterImageEl = document.getElementById('characterImage');
const jumpButton = document.getElementById('jumpButton');
const scoreEl = document.getElementById('score');
const gameOverEl = document.getElementById('gameOver');
const sky = gameArea.querySelector('.sky');
const ground = gameArea.querySelector('.ground');
const obstacles = Array.from(gameArea.querySelectorAll('.obstacle'));
const starEl = document.getElementById('star');
const goalEl = document.getElementById('goal');
const retryButton = document.getElementById('retryButton');
const stageLabel = document.getElementById('stageLabel');
const stageTransitionEl = document.getElementById('stageTransition');
const stageTransitionMessageEl = document.getElementById('stageTransitionMessage');
const stageTransitionDetailEl = document.getElementById('stageTransitionDetail');
const instructionOverlay = document.getElementById('instructionOverlay');
const instructionStageMessageEl = document.getElementById('instructionStageMessage');
const instructionContinueButton = document.getElementById('instructionContinueButton');
const touchPreventElements = [document, gameArea, jumpButton, startButton, retryButton, instructionOverlay];

if (characterImageEl) {
  characterImageEl.src = 'images/player_run1.png?v=2';
}

const jumpSound = new Audio('jump.wav');
const starSound = new Audio('star.wav');
const goalSound = new Audio('goal.wav');
const clearSound = new Audio('clear.wav');
const gameOverSound = new Audio('gameover.wav');
const soundEffects = [jumpSound, starSound, goalSound, clearSound, gameOverSound];
soundEffects.forEach((sound) => {
  sound.preload = 'auto';
  sound.volume = 0.45;
});

let running = false;
let animationFrameId = null;
let scrollOffset = 0;
let lastTime = 0;
let jumpHeight = 0;
let isJumping = false;
let jumpVelocity = 0;
let lastJumpInputTime = 0;
let jumpSequence = 0;
let obstacleTimer = 0;
let obstacleIndex = 0;
let score = 0;
let starCount = 0;
let gameOver = false;
let gameCleared = false;
let currentStage = 1;
let stageTransitionActive = false;
let stageTransitionTimer = 0;
// スクロール/障害物速度調整
const BASE_SCROLL_SPEED = 1.05;
const SCROLL_ACCELERATION = 0.006;
const BASE_OBJECT_SPEED = 0.62;
const OBJECT_ACCELERATION = 0.00024;
const JUMP_INITIAL_VELOCITY = 17.0;
const JUMP_DOUBLE_VELOCITY = 24.0;
const JUMP_GRAVITY = 0.90;
const JUMP_FALL_SPEED = 0.36;
const MAX_JUMP_HEIGHT = 420;
const BIG_JUMP_GRAVITY = 1.05;
const BIG_JUMP_FALL_SPEED = 0.42;
const BIG_JUMP_MAX_HEIGHT = 320;
// 障害物生成間隔（ミリ秒）。値を大きくすると障害物の間隔が長くなります。
const OBSTACLE_INTERVAL = 1320;
const CLUSTER_INTERVAL = 940;
const CLUSTER_SIZE = 5;
const CLUSTER_CHANCE = 0.18;
const STAGE1_OBSTACLE_COUNT = 15;
// ゴールは全障害物が終わった後に遅延して出現させる
const GOAL_DELAY = 1200; // ミリ秒
const STAGE_TRANSITION_DELAY = 2400;
let clusterQueue = 0;
let goalActive = false;
let goalWaiting = false;
let goalDelayTimer = 0;
let starActive = false;
let starTimer = 0;
let starObstacleBlockTimer = 0;
let starSpawnCount = 0;
let previousStage2BigObstacle = false;
let stage2GoalPhase = false;
let gameClearTimeoutId = null;
const STAR_SPAWN_DELAY = 2200;
const STAR_OBSTACLE_BLOCK_DELAY = 800;
const STAR_TARGET_COUNT = 15;
const SCORE_TARGET_COUNT = 15;
const GAME_CLEAR_DELAY = 1200;

function getRelativeRect(element) {
  const rect = element.getBoundingClientRect();
  const areaRect = gameArea.getBoundingClientRect();
  return {
    left: rect.left - areaRect.left,
    top: rect.top - areaRect.top,
    right: rect.right - areaRect.left,
    bottom: rect.bottom - areaRect.top,
    width: rect.width,
    height: rect.height,
  };
}

function playSound(audio) {
  if (!audio) {
    return;
  }
  try {
    audio.currentTime = 0;
    audio.play();
  } catch (error) {
    // モバイル環境ではユーザー操作前に再生できない場合がある
  }
}

function preventTouchZoom(event) {
  if (event.touches && event.touches.length > 1) {
    event.preventDefault();
  }
}

touchPreventElements.forEach((element) => {
  ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach((eventName) => {
    element.addEventListener(eventName, preventTouchZoom, { passive: false });
  });
});

window.addEventListener('gesturestart', (event) => event.preventDefault());
window.addEventListener('dblclick', (event) => event.preventDefault());

function showInstructionOverlay(stage) {
  instructionStageMessageEl.textContent = stage === 1
    ? '障害物をジャンプして避けろ'
    : '全ての星をキャッチしてゴールを目指せ';
  instructionOverlay.classList.add('show');
}

function hideInstructionOverlay() {
  instructionOverlay.classList.remove('show');
}

function setStageTransitionDetail(stage) {
  stageTransitionDetailEl.textContent = stage === 2
    ? '全ての星をキャッチしてゴールを目指せ'
    : '';
}

function setObstacleType(obstacle, requiresBigJump) {
  obstacle.classList.toggle('big-jump', requiresBigJump);
  obstacle.dataset.requiresBigJump = String(requiresBigJump);
}

function resetObstacles() {
  obstacleTimer = 0;
  obstacleIndex = 0;
  starActive = false;
  starTimer = 0;
  starObstacleBlockTimer = 0;
  starSpawnCount = 0;
  previousStage2BigObstacle = false;
  clusterQueue = 0;
  obstacles.forEach((obstacle) => {
    obstacle.classList.remove('active');
    obstacle.classList.remove('big-jump');
    obstacle.dataset.requiresBigJump = 'false';
    obstacle.style.left = '100%';
  });
  if (starEl) {
    starEl.classList.remove('active');
    starEl.style.left = '100%';
    starEl.style.top = '40%';
  }
}

function startCountdown() {
  if (running && !gameOver) {
    return;
  }

  if (gameOver) {
    running = false;
  }

  startButton.disabled = true;
  countdownEl.classList.add('show');
  countdownEl.textContent = '3';

  let count = 3;
  const intervalId = window.setInterval(() => {
    count -= 1;

    if (count > 0) {
      countdownEl.textContent = String(count);
    } else {
      window.clearInterval(intervalId);
      countdownEl.classList.remove('show');
      countdownEl.textContent = '';
      startRunning();
    }
  }, 1000);
}

function startRunning() {
  if (running) {
    return;
  }

  running = true;
  gameOver = false;
  stageTransitionActive = false;
  stageTransitionTimer = 0;
  // ゴール状態リセット
  goalActive = false;
  goalWaiting = false;
  goalDelayTimer = 0;
  stage2GoalPhase = false;
  if (gameClearTimeoutId) {
    clearTimeout(gameClearTimeoutId);
    gameClearTimeoutId = null;
  }
  if (goalEl) {
    goalEl.classList.remove('active');
    goalEl.style.left = '100%';
  }
  jumpButton.disabled = false;
  gameOverEl.classList.remove('show', 'clear', 'cleared');
  retryButton.style.visibility = 'visible';
  stageTransitionEl.classList.remove('show');
  gameArea.classList.toggle('stage-2', currentStage === 2);
  stageLabel.textContent = `STAGE ${currentStage}`;
  score = 0;
  starCount = 0;
  scoreEl.textContent = currentStage === 2
    ? `☆ ${starCount}/${STAR_TARGET_COUNT}`
    : `Score: ${score}/${SCORE_TARGET_COUNT}`;
  resetObstacles();
  character.classList.add('run');
  character.style.transform = 'scaleX(-1)';
  character.style.bottom = '72px';
  character.style.left = 'clamp(24px, 7vw, 70px)';
  jumpHeight = 0;
  isJumping = false;
  jumpVelocity = 0;
  jumpSequence = 0;
  gameCleared = false;
  retryButton.textContent = 'リトライ';
  lastTime = 0;

  const step = (timestamp) => {
    if (!lastTime) {
      lastTime = timestamp;
    }

    const delta = timestamp - lastTime;
    lastTime = timestamp;

    if (gameOver) {
      return;
    }

    if (stageTransitionActive) {
      stageTransitionTimer += delta;
      if (stageTransitionTimer >= STAGE_TRANSITION_DELAY) {
        stageTransitionActive = false;
        stageTransitionEl.classList.remove('show');
        startRunning();
        return;
      }
      animationFrameId = window.requestAnimationFrame(step);
      return;
    }

    const stageSpeedBoost = (currentStage - 1) * 0.08;
    const speed = BASE_SCROLL_SPEED + (delta / 16) * SCROLL_ACCELERATION + stageSpeedBoost;
    scrollOffset += speed;

    if (scrollOffset > 1600) {
      scrollOffset = 0;
    }

    sky.style.backgroundPositionX = `${-scrollOffset * 0.25}px`;
    ground.style.backgroundPositionX = `${-scrollOffset}px`;

    obstacleTimer += delta;
    if (currentStage === 2) {
      starTimer += delta;
      if (starObstacleBlockTimer > 0) {
        starObstacleBlockTimer = Math.max(0, starObstacleBlockTimer - delta);
      }
      if (!starActive && starTimer > STAR_SPAWN_DELAY && starSpawnCount < STAR_TARGET_COUNT) {
        starActive = true;
        starTimer = 0;
        starObstacleBlockTimer = STAR_OBSTACLE_BLOCK_DELAY;
        starSpawnCount += 1;
        starEl.classList.add('active');
        starEl.style.left = '100%';
        starEl.style.top = `${Math.max(18, Math.min(42, 20 + Math.random() * 22))}%`;
      }
    }
    const obstacleInterval = currentStage === 1
      ? Math.max(900, OBSTACLE_INTERVAL - (currentStage - 1) * 90)
      : Math.max(1800, OBSTACLE_INTERVAL - (currentStage - 1) * 10);
    const clusterInterval = currentStage === 1
      ? Math.max(760, CLUSTER_INTERVAL - (currentStage - 1) * 50)
      : Math.max(1200, CLUSTER_INTERVAL - (currentStage - 1) * 5);
    const currentInterval = clusterQueue > 0 ? clusterInterval : obstacleInterval;
    const shouldSpawnObstacle = currentStage === 2
      ? !stage2GoalPhase && starObstacleBlockTimer <= 0 && Math.random() < 0.12
      : true;
    const maxObstacles = currentStage === 1 ? STAGE1_OBSTACLE_COUNT : obstacles.length;
    if (obstacleTimer > currentInterval && obstacleIndex < maxObstacles && shouldSpawnObstacle) {
      const obstacle = obstacles[obstacleIndex];
      const startCluster = false;
      const isClusterObstacle = false;
      let requiresBigJump = Math.random() < 0.45;
      if (currentStage === 2 && previousStage2BigObstacle) {
        requiresBigJump = false;
      }
      setObstacleType(obstacle, requiresBigJump);
      obstacle.classList.add('active');
      obstacleIndex += 1;
      obstacleTimer = 0;
      if (currentStage === 2) {
        previousStage2BigObstacle = requiresBigJump;
      }

      if (clusterQueue > 0) {
        clusterQueue -= 1;
      }
    }

    obstacles.forEach((obstacle) => {
      if (!obstacle.classList.contains('active')) {
        return;
      }

      const currentLeft = parseFloat(obstacle.style.left || '100%');
      const nextLeft = currentLeft - (BASE_OBJECT_SPEED + (currentStage - 1) * 0.05 + delta * OBJECT_ACCELERATION);
      obstacle.style.left = `${nextLeft}%`;

      if (nextLeft < -12) {
        obstacle.classList.remove('active');
        obstacle.style.left = '100%';
        if (currentStage === 1) {
          score += 1;
          scoreEl.textContent = `Score: ${score}/${SCORE_TARGET_COUNT}`;
        }
      }
    });

    if (currentStage === 2 && starActive && starEl) {
      const currentLeft = parseFloat(starEl.style.left || '100%');
      const nextLeft = currentLeft - (BASE_OBJECT_SPEED + 0.04 + delta * OBJECT_ACCELERATION);
      starEl.style.left = `${nextLeft}%`;

      if (nextLeft < -12) {
        starActive = false;
        starEl.classList.remove('active');
        starEl.style.left = '100%';
      }
    }
    // キャラクターの矩形はゴール判定の前に計算しておく
    const characterRect = getRelativeRect(character);

    // すべての障害物が出現済みで、画面上にアクティブな障害物が無くなったらゴール出現の遅延を開始
    const anyActiveObstacle = obstacles.some((o) => o.classList.contains('active'));
    if (!goalActive && !goalWaiting) {
      if (currentStage === 1 && score >= SCORE_TARGET_COUNT && !anyActiveObstacle) {
        goalWaiting = true;
        goalDelayTimer = 0;
      } else if (currentStage === 2 && stage2GoalPhase) {
        goalWaiting = true;
        goalDelayTimer = 0;
      }
    }
    if (!goalActive && goalWaiting) {
      goalDelayTimer += delta;
      if (goalDelayTimer > GOAL_DELAY) {
        goalActive = true;
        goalEl.classList.add('active', 'pulse');
        goalEl.style.left = '120%';
        playSound(goalSound);
      }
    }

    if (goalActive) {
      const currentLeft = parseFloat(goalEl.style.left || '120%');
      const nextLeft = currentLeft - (BASE_OBJECT_SPEED + (currentStage - 1) * 0.05 + delta * OBJECT_ACCELERATION);
      goalEl.style.left = `${nextLeft}%`;

      const goalRect = getRelativeRect(goalEl);
      const characterHitbox = {
        left: characterRect.left + 16,
        top: characterRect.top + 16,
        right: characterRect.right - 16,
        bottom: characterRect.bottom - 14,
      };
      const goalHitbox = {
        left: goalRect.left + 6,
        top: goalRect.top + 6,
        right: goalRect.right - 6,
        bottom: goalRect.bottom - 6,
      };
      const hitX = characterHitbox.right > goalHitbox.left && characterHitbox.left < goalHitbox.right;
      const hitY = characterHitbox.bottom > goalHitbox.top && characterHitbox.top < goalHitbox.bottom;

      if (hitX && hitY) {
        if (currentStage === 1) {
          currentStage += 1;
          running = false;
          stageTransitionActive = true;
          stageTransitionTimer = 0;
          // ゴール到達時はパルスを止めてメッセージを表示
          goalEl.classList.remove('pulse');
          goalEl.classList.remove('active');
          goalEl.style.left = '100%';
          goalActive = false;
          stageLabel.textContent = `STAGE ${currentStage}`;
          stageTransitionMessageEl.textContent = `STAGE ${currentStage}`;
          setStageTransitionDetail(currentStage);
          stageTransitionEl.classList.add('show');
          jumpButton.disabled = true;
        } else if (currentStage === 2) {
          if (starCount < STAR_TARGET_COUNT) {
            running = false;
            gameOver = true;
            gameCleared = false;
            goalEl.classList.remove('pulse');
            goalEl.classList.remove('active');
            goalEl.style.left = '100%';
            goalActive = false;
            jumpButton.disabled = true;
            gameOverEl.querySelector('#gameOverMessage').textContent = '☆が足りない...';
            retryButton.textContent = 'もう一回挑戦';
            gameOverEl.classList.add('show');
          } else {
            running = false;
            gameOver = true;
            gameCleared = true;
            goalEl.classList.remove('pulse');
            goalEl.classList.remove('active');
            goalEl.style.left = '100%';
            goalActive = false;
            jumpButton.disabled = true;
            gameOverEl.querySelector('#gameOverMessage').textContent = 'CLEAR!';
            retryButton.textContent = '最初からプレイ';
            gameOverEl.classList.add('show');
            triggerGameClearSequence();
          }
        }
      }
    }

    const characterRectForCollision = getRelativeRect(character);

    if (currentStage === 2 && starActive && starEl) {
      const starRect = getRelativeRect(starEl);
      const characterHitbox = {
        left: characterRect.left - 8,
        top: characterRect.top - 8,
        right: characterRect.right + 8,
        bottom: characterRect.bottom + 8,
      };
      const starHitbox = {
        left: starRect.left - 4,
        top: starRect.top - 4,
        right: starRect.right + 4,
        bottom: starRect.bottom + 4,
      };
      const hitX = characterHitbox.right > starHitbox.left && characterHitbox.left < starHitbox.right;
      const hitY = characterHitbox.bottom > starHitbox.top && characterHitbox.top < starHitbox.bottom;
      if (hitX && hitY) {
        starCount += 1;
        starActive = false;
        starEl.classList.remove('active');
        starEl.style.left = '100%';
        scoreEl.textContent = `☆ ${starCount}/${STAR_TARGET_COUNT}`;
        playSound(starSound);

        if (currentStage === 2 && starCount >= STAR_TARGET_COUNT) {
          stage2GoalPhase = true;
          goalWaiting = true;
          goalDelayTimer = 0;
        }
      }
    }

    obstacles.forEach((obstacle) => {
      if (!obstacle.classList.contains('active')) {
        return;
      }

      const obstacleRect = getRelativeRect(obstacle);
      const requiresBigJump = obstacle.dataset.requiresBigJump === 'true';
      const isInJump = isJumping || jumpHeight > 0;
      const isDescending = jumpHeight > 0 && !isJumping;
      const collisionInset = isDescending ? 24 : isInJump ? 20 : 14;
      const characterHitbox = {
        left: characterRect.left + 20,
        top: isDescending ? characterRect.top + 16 : isInJump ? characterRect.top + 18 : characterRect.top + 20,
        right: characterRect.right - 20,
        bottom: isDescending ? characterRect.bottom - 12 : isInJump ? characterRect.bottom - 18 : characterRect.bottom - 16,
      };
      const obstacleHitbox = {
        left: obstacleRect.left + collisionInset,
        top: obstacleRect.top + 8,
        right: obstacleRect.right - collisionInset,
        bottom: obstacleRect.bottom - 8,
      };
      const hitX = characterHitbox.right > obstacleHitbox.left && characterHitbox.left < obstacleHitbox.right;
      const hitY = characterHitbox.bottom > obstacleHitbox.top && characterHitbox.top < obstacleHitbox.bottom;
      const canClearWithCurrentJump = isInJump && (!requiresBigJump || jumpSequence === 2);

      if (hitX && hitY && !canClearWithCurrentJump) {
        gameOver = true;
        gameCleared = false;
        running = false;
        gameOverEl.querySelector('#gameOverMessage').textContent = 'GAME OVER';
        retryButton.textContent = 'リトライ';
        gameOverEl.classList.add('show');
        jumpButton.disabled = true;
      }
    });

    const physicsScale = delta / 16;
    if (isJumping) {
      const useBigJump = jumpSequence === 2;
      const gravity = useBigJump ? BIG_JUMP_GRAVITY : JUMP_GRAVITY;
      const fallSpeed = useBigJump ? BIG_JUMP_FALL_SPEED : JUMP_FALL_SPEED;
      const maxJumpHeight = useBigJump ? BIG_JUMP_MAX_HEIGHT : MAX_JUMP_HEIGHT;

      jumpVelocity -= gravity * physicsScale;
      jumpHeight += jumpVelocity * physicsScale;
      if (jumpHeight > maxJumpHeight) {
        jumpHeight = maxJumpHeight;
        if (jumpVelocity > 0) {
          jumpVelocity = 0;
        }
      }

      if (jumpHeight <= 0) {
        jumpHeight = 0;
        jumpVelocity = 0;
        isJumping = false;
        jumpSequence = 0;
        lastJumpInputTime = 0;
      }
    } else if (jumpHeight > 0) {
      const useBigJump = jumpSequence === 2;
      const fallSpeed = useBigJump ? BIG_JUMP_FALL_SPEED : JUMP_FALL_SPEED;
      jumpHeight -= fallSpeed * physicsScale;
      if (jumpHeight < 0) {
        jumpHeight = 0;
      }
    }

    character.style.bottom = `${72 + jumpHeight}px`;
    if (jumpHeight > 0) {
      character.classList.add('jump');
    } else {
      character.classList.remove('jump');
    }

    animationFrameId = window.requestAnimationFrame(step);
  };

  animationFrameId = window.requestAnimationFrame(step);
}

function triggerGameClearSequence() {
  if (gameClearTimeoutId) {
    clearTimeout(gameClearTimeoutId);
  }

  gameOverEl.classList.add('clear');
  gameOverEl.classList.remove('cleared');
  retryButton.disabled = true;
  retryButton.style.visibility = 'hidden';
  gameClearTimeoutId = window.setTimeout(() => {
    retryButton.disabled = false;
    retryButton.style.visibility = 'visible';
    if (gameOverEl.classList.contains('show')) {
      gameOverEl.classList.add('cleared');
    }
    gameClearTimeoutId = null;
  }, GAME_CLEAR_DELAY);
}

function jumpCharacter() {
  if (!running) {
    return;
  }

  const now = Date.now();
  const isGrounded = !isJumping && jumpHeight <= 0;

  if (isGrounded) {
    jumpVelocity = JUMP_INITIAL_VELOCITY;
    jumpSequence = 1;
    lastJumpInputTime = now;
    isJumping = true;
    playSound(jumpSound);
    return;
  }

  if (isJumping && jumpSequence === 1 && now - lastJumpInputTime < 250) {
    jumpVelocity = JUMP_DOUBLE_VELOCITY;
    jumpSequence = 2;
    lastJumpInputTime = now;
  }
}

startButton.addEventListener('click', () => showInstructionOverlay(1));
instructionContinueButton.addEventListener('click', () => {
  hideInstructionOverlay();
  startCountdown();
});
jumpButton.addEventListener('click', jumpCharacter);
retryButton.addEventListener('click', () => {
  // リトライ / 最初からプレイ時は状態をリセットして再開
  if (gameCleared) {
    currentStage = 1;
  }
  gameCleared = false;
  if (goalEl) {
    goalEl.classList.remove('active');
    goalEl.style.left = '100%';
  }
  goalWaiting = false;
  goalDelayTimer = 0;
  stage2GoalPhase = false;
  gameOver = false;
  gameOverEl.classList.remove('show', 'clear', 'cleared');
  retryButton.style.visibility = 'visible';
  if (gameClearTimeoutId) {
    clearTimeout(gameClearTimeoutId);
    gameClearTimeoutId = null;
  }
  stageTransitionEl.classList.remove('show');
  startCountdown();
});
