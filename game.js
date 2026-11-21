
/* =========================================================
   HARBOUR HAZARD
   Main game engine
   ========================================================= */

(() => {
  "use strict";

  // -------------------------------------------------------
  // ELEMENTS
  // -------------------------------------------------------

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const scoreEl = document.getElementById("score");
  const crossingsEl = document.getElementById("crossings");
  const livesEl = document.getElementById("lives");
  const harbourEl = document.getElementById("harbour");
  const bestScoreEl = document.getElementById("bestScore");

  const startOverlay = document.getElementById("startOverlay");
  const endOverlay = document.getElementById("endOverlay");
  const startButton = document.getElementById("startButton");
  const againButton = document.getElementById("againButton");
  const playerNameInput = document.getElementById("playerName");
  const endTitle = document.getElementById("endTitle");
  const endSummary = document.getElementById("endSummary");

  const soundButton = document.getElementById("soundButton");
  const pauseButton = document.getElementById("pauseButton");

  // -------------------------------------------------------
  // SETTINGS
  // -------------------------------------------------------

  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;

  const TILE = 64;
  const COLUMNS = WIDTH / TILE;

  const PLAYER_SIZE = 48;
  const PLAYER_SPEED = 10;

  const LANE_ROWS = [2, 3, 4, 5, 6, 7];
  const SAFE_ROWS = [0, 1, 8, 9];

  const CHARACTER_STORAGE = "harbourHazardCharacter";
  const NAME_STORAGE = "harbourHazardPlayer";
  const BEST_STORAGE = "harbourHazardBest";

  const SPRITE_PATH = "images/harbour-hazard/";

  // -------------------------------------------------------
  // GAME STATE
  // -------------------------------------------------------

  let running = false;
  let paused = false;
  let gameOver = false;

  let score = 0;
  let crossings = 0;
  let lives = 2;
  let harbour = 1;

  let selectedCharacter = "turtle";
  let playerName = "";

  let animationTime = 0;
  let lastFrame = 0;
  let frameCount = 0;

  let boats = [];
  let nets = [];
  let collectibles = [];
  let particles = [];

  let audioContext = null;
  let soundEnabled = true;

  let moveQueue = [];
  let lastMoveTime = 0;
  let collisionCooldown = 0;

  let player = {
    x: WIDTH / 2,
    y: HEIGHT - TILE / 2,
    targetX: WIDTH / 2,
    targetY: HEIGHT - TILE / 2,
    direction: "front",
    moving: false,
    animation: 0,
    invulnerable: 0
  };

  // -------------------------------------------------------
  // IMAGE LOADING
  // -------------------------------------------------------

  const images = {};
   const dockAtlas = new Image();
dockAtlas.src = SPRITE_PATH + "harbour_atlas_01_cleaned.png";
   
  function loadImage(name) {
    const img = new Image();
    img.src = SPRITE_PATH + name + ".png";
    images[name] = img;
    return img;
  }

  const spriteNames = [
    "turtle_front_1", "turtle_front_2",
    "turtle_front_3", "turtle_front_4",
    "turtle_side_1", "turtle_side_2",
    "turtle_side_3", "turtle_side_4",
    "turtle_rear_1", "turtle_rear_2",
    "turtle_rear_3", "turtle_rear_4",
    "turtle_rear_side_1", "turtle_rear_side_2",
    "turtle_rear_side_3", "turtle_rear_side_4",

    "whale_front_1", "whale_front_2",
    "whale_front_3", "whale_front_4",
    "whale_side_1", "whale_side_2",
    "whale_side_3", "whale_side_4",
    "whale_rear_1", "whale_rear_2",
    "whale_rear_3", "whale_rear_4",
    "whale_rear_side_1", "whale_rear_side_2",
    "whale_rear_side_3", "whale_rear_side_4"
  ];

  spriteNames.forEach(loadImage);

  const smokeFrames = [];
  for (let i = 1; i <= 6; i++) {
    smokeFrames.push(loadImage("boat_smoke_" + i));
  }

  // -------------------------------------------------------
  // SMALL HELPERS
  // -------------------------------------------------------

  function random(min, max) {
    return Math.random() * (max - min) + min;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function rowY(row) {
    return row * TILE + TILE / 2;
  }

  function formatScore(value) {
    return String(value).padStart(6, "0");
  }

  function addScore(points) {
    score += points;
    scoreEl.textContent = formatScore(score);
  }

  function getBestScore() {
    return Number(localStorage.getItem(BEST_STORAGE) || 0);
  }

  function updateBestScore() {
    const best = getBestScore();

    if (score > best) {
      localStorage.setItem(BEST_STORAGE, String(score));
    }

    bestScoreEl.textContent = formatScore(getBestScore());
  }

  // -------------------------------------------------------
  // AUDIO
  // -------------------------------------------------------

  function initialiseAudio() {
    if (!soundEnabled) return;

    if (!audioContext) {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (AudioContextClass) {
        audioContext = new AudioContextClass();
      }
    }

    if (audioContext && audioContext.state === "suspended") {
      audioContext.resume();
    }
  }

  function tone(frequency, duration, type = "sine", volume = 0.07) {
    if (!soundEnabled || !audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(
      frequency,
      audioContext.currentTime
    );

    gain.gain.setValueAtTime(volume, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + duration
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  }

  function playCollectSound() {
    tone(620, 0.12, "sine", 0.08);
    setTimeout(() => tone(880, 0.15, "sine", 0.06), 75);
  }

  function playCrossingSound() {
    tone(440, 0.12, "square", 0.045);
    setTimeout(() => tone(660, 0.18, "square", 0.045), 100);
    setTimeout(() => tone(880, 0.2, "square", 0.035), 200);
  }

  function playCollisionSound() {
    tone(150, 0.35, "sawtooth", 0.09);
    setTimeout(() => tone(90, 0.3, "square", 0.06), 100);
  }

  function playMoveSound() {
    tone(240, 0.045, "sine", 0.025);
  }

  soundButton.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    soundButton.textContent = soundEnabled ? "♪ SOUND ON" : "♪ SOUND OFF";

    if (soundEnabled) {
      initialiseAudio();
      tone(500, 0.1);
    }
  });

  // -------------------------------------------------------
  // CHARACTER SELECTION
  // -------------------------------------------------------

  const characterButtons = document.querySelectorAll(".character-option");

  characterButtons.forEach(button => {
    button.addEventListener("click", () => {
      selectedCharacter = button.dataset.character;

      characterButtons.forEach(item => {
        item.classList.toggle("selected", item === button);
      });

      localStorage.setItem(CHARACTER_STORAGE, selectedCharacter);
    });
  });

  const savedCharacter = localStorage.getItem(CHARACTER_STORAGE);

  if (savedCharacter === "turtle" || savedCharacter === "whale") {
    selectedCharacter = savedCharacter;

    characterButtons.forEach(button => {
      button.classList.toggle(
        "selected",
        button.dataset.character === selectedCharacter
      );
    });
  }

  playerNameInput.value = localStorage.getItem(NAME_STORAGE) || "";

  // -------------------------------------------------------
  // WORLD GENERATION
  // -------------------------------------------------------

  function createWorld() {
    boats = [];
    nets = [];
    collectibles = [];
    particles = [];

    // Six traffic lanes, with more boats as difficulty rises.
    LANE_ROWS.forEach((row, index) => {
      const direction = index % 2 === 0 ? 1 : -1;
      const baseSpeed = (0.1 + harbour * 0.1 + index) * 0.14;
      const boatCount = Math.min(4, 2 + Math.floor(harbour / 3));

      for (let i = 0; i < boatCount; i++) {
        const width = random(112, 174);
        const spacing = WIDTH / boatCount;

        boats.push({
          x: i * spacing + random(-40, 40),
          y: rowY(row),
          width,
          height: random(34, 43),
          speed: baseSpeed * random(0.8, 1.2) * direction,
          direction,
          smokeOffset: random(0, 5),
          smokeDrift: random(0, 20),
          colour: Math.random() > 0.5 ? "#d6d5c8" : "#b8c8c6",
          cabin: Math.random() > 0.5
        });
      }
    });

    // Nets and ropes are fixed hazards.
    const netCount = Math.min(2 + Math.floor(harbour / 2), 5);

    for (let i = 0; i < netCount; i++) {
      const row = LANE_ROWS[(i * 2 + 1) % LANE_ROWS.length];

      nets.push({
        x: random(75, WIDTH - 150),
        y: rowY(row),
        width: random(55, 100),
        height: 12,
        type: i % 2 === 0 ? "net" : "rope"
      });
    }

    // Bonus food is placed in the water.
    const foodCount = 3 + Math.min(2, Math.floor(harbour / 3));

    for (let i = 0; i < foodCount; i++) {
      const row = LANE_ROWS[Math.floor(random(0, LANE_ROWS.length))];

      collectibles.push({
        x: random(55, WIDTH - 55),
        y: rowY(row) + random(-10, 10),
        collected: false,
        phase: random(0, Math.PI * 2)
      });
    }
  }

  // -------------------------------------------------------
  // PLAYER MOVEMENT
  // -------------------------------------------------------

  function queueMove(dx, dy) {
    if (!running || paused || gameOver) return;

    if (moveQueue.length < 3) {
      moveQueue.push({ dx, dy });
    }
  }

  function performMove() {
    if (!moveQueue.length || !running || paused) return;

    const now = performance.now();

    if (now - lastMoveTime < 200) return;
    if (Math.abs(player.x - player.targetX) > 3) return;
    if (Math.abs(player.y - player.targetY) > 3) return;

    const move = moveQueue.shift();

    const nextX = player.targetX + move.dx * TILE;
    const nextY = player.targetY + move.dy * TILE;

    if (nextX < TILE / 2 || nextX > WIDTH - TILE / 2) return;
    if (nextY < TILE / 2 || nextY > HEIGHT - TILE / 2) return;

    player.targetX = nextX;
    player.targetY = nextY;
    player.moving = true;
    lastMoveTime = now;

    if (move.dy < 0) player.direction = "rear";
    else if (move.dy > 0) player.direction = "front";
    else player.direction = "side";

    playMoveSound();
  }

  document.addEventListener("keydown", event => {
    const key = event.key.toLowerCase();

    const controls = {
      arrowup: [0, -1],
      w: [0, -1],
      arrowdown: [0, 1],
      s: [0, 1],
      arrowleft: [-1, 0],
      a: [-1, 0],
      arrowright: [1, 0],
      d: [1, 0]
    };

    if (controls[key]) {
      event.preventDefault();
      queueMove(controls[key][0], controls[key][1]);
    }

    if (key === " " || key === "escape") {
      if (running) {
        event.preventDefault();
        togglePause();
      }
    }
  });

  // Tap or click a destination on the canvas.
  canvas.addEventListener("pointerdown", event => {
    if (!running || paused || gameOver) return;

    const rect = canvas.getBoundingClientRect();

    const x = (event.clientX - rect.left) * WIDTH / rect.width;
    const y = (event.clientY - rect.top) * HEIGHT / rect.height;

    const dx = x - player.targetX;
    const dy = y - player.targetY;

    if (Math.abs(dx) > Math.abs(dy)) {
      queueMove(Math.sign(dx), 0);
    } else {
      queueMove(0, Math.sign(dy));
    }
  });

  // -------------------------------------------------------
  // BOAT MOVEMENT
  // -------------------------------------------------------

  function updateBoats(delta) {
    boats.forEach(boat => {
      boat.x += boat.speed * delta * 0.2;

      if (boat.speed > 0 && boat.x > WIDTH + boat.width) {
        boat.x = -boat.width;
      } else if (boat.speed < 0 && boat.x < -boat.width) {
        boat.x = WIDTH + boat.width;
      }

      boat.smokeDrift += delta * 0.025;
    });
  }

  // -------------------------------------------------------
  // PLAYER ANIMATION
  // -------------------------------------------------------

  function updatePlayer(delta) {
    const easing = Math.min(1, delta * 0.018);

    player.x += (player.targetX - player.x) * easing;
    player.y += (player.targetY - player.y) * easing;

    if (
      Math.abs(player.x - player.targetX) < 2 &&
      Math.abs(player.y - player.targetY) < 2
    ) {
      player.x = player.targetX;
      player.y = player.targetY;
      player.moving = false;
    }

    player.animation += delta * 0.012;

    if (player.invulnerable > 0) {
      player.invulnerable -= delta;
    }

    if (collisionCooldown > 0) {
      collisionCooldown -= delta;
    }

    performMove();

    // Successful crossing.
    if (player.targetY <= TILE / 2 && player.y <= TILE / 2 + 3) {
      completeCrossing();
    }
  }

  // -------------------------------------------------------
  // COLLECTIBLES
  // -------------------------------------------------------

  function updateCollectibles() {
    collectibles.forEach(item => {
      if (item.collected) return;

      const dx = player.x - item.x;
      const dy = player.y - item.y;

      if (Math.hypot(dx, dy) < 32) {
        item.collected = true;
        addScore(100);
        playCollectSound();

        for (let i = 0; i < 9; i++) {
          particles.push({
            x: item.x,
            y: item.y,
            vx: random(-2, 2),
            vy: random(-3, 1),
            life: random(250, 500),
            colour: "#ffe28a"
          });
        }
      }
    });
  }

  // -------------------------------------------------------
  // COLLISIONS
  // -------------------------------------------------------

  function rectanglesOverlap(a, b) {
    return (
      a.x - a.width / 2 < b.x + b.width / 2 &&
      a.x + a.width / 2 > b.x - b.width / 2 &&
      a.y - a.height / 2 < b.y + b.height / 2 &&
      a.y + a.height / 2 > b.y - b.height / 2
    );
  }

  function checkCollisions() {
    if (!running || paused || gameOver) return;
    if (player.invulnerable > 0 || collisionCooldown > 0) return;

    const playerBox = {
      x: player.x,
      y: player.y,
      width: 31,
      height: 31
    };

    for (const boat of boats) {
      const boatBox = {
        x: boat.x,
        y: boat.y,
        width: boat.width * 0.78,
        height: boat.height
      };

      if (rectanglesOverlap(playerBox, boatBox)) {
        loseLife("boat");
        return;
      }
    }

    for (const net of nets) {
      const netBox = {
        x: net.x,
        y: net.y,
        width: net.width,
        height: net.height + 12
      };

      if (rectanglesOverlap(playerBox, netBox)) {
        loseLife("net");
        return;
      }
    }
  }

  function loseLife(reason) {
    lives--;
    collisionCooldown = 900;
    player.invulnerable = 1300;
    moveQueue = [];

    playCollisionSound();

    // Return the player to the starting shore.
    player.x = WIDTH / 2;
    player.y = HEIGHT - TILE / 2;
    player.targetX = player.x;
    player.targetY = player.y;
    player.direction = "front";
    player.moving = false;

    updateHUD();

    if (lives <= 0) {
      finishGame();
    }
  }

  // -------------------------------------------------------
  // CROSSINGS AND DIFFICULTY
  // -------------------------------------------------------

  function completeCrossing() {
    crossings++;
    harbour = Math.floor(crossings / 2) + 1;

    addScore(250 + crossings * 25);
    playCrossingSound();

    player.x = WIDTH / 2;
    player.y = HEIGHT - TILE / 2;
    player.targetX = player.x;
    player.targetY = player.y;
    player.direction = "front";
    player.moving = false;

    moveQueue = [];

    createWorld();
    updateHUD();
  }

  // -------------------------------------------------------
  // PARTICLES
  // -------------------------------------------------------

  function updateParticles(delta) {
    particles.forEach(particle => {
      particle.x += particle.vx * delta * 0.06;
      particle.y += particle.vy * delta * 0.06;
      particle.life -= delta;
    });

    particles = particles.filter(particle => particle.life > 0);
  }

  // -------------------------------------------------------
  // DRAWING: WATER
  // -------------------------------------------------------

  function drawWater() {
    const time = animationTime;

    ctx.fillStyle = "#07516b";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Subtle horizontal water bands.
    for (let y = 0; y < HEIGHT; y += 64) {
      ctx.fillStyle = y % 128 === 0 ? "#0a5870" : "#084b65";
      ctx.fillRect(0, y, WIDTH, 64);
    }

    // Animated wave lines.
    for (let i = 0; i < 75; i++) {
      const x = (i * 137 + time * (12 + i % 4)) % WIDTH;
      const y = (i * 83 + Math.sin(time * 0.001 + i) * 10) % HEIGHT;

      ctx.fillStyle = i % 3 === 0 ? "#39859a" : "#1d7087";
      ctx.globalAlpha = 0.28;
      ctx.fillRect(x, y, 13 + i % 15, 2);
      ctx.globalAlpha = 1;
    }

    // Safe shore at top.
    ctx.fillStyle = "#315c52";
    ctx.fillRect(0, 0, WIDTH, 64);

    ctx.fillStyle = "#547b62";
    ctx.fillRect(0, 0, WIDTH, 9);

    for (let x = 0; x < WIDTH; x += 48) {
      ctx.fillStyle = x % 96 === 0 ? "#79926a" : "#3e705c";
      ctx.fillRect(x, 12, 30, 7);
    }

    // Lower shore.
    ctx.fillStyle = "#315c52";
    ctx.fillRect(0, HEIGHT - 64, WIDTH, 64);

    ctx.fillStyle = "#547b62";
    ctx.fillRect(0, HEIGHT - 64, WIDTH, 8);

    // Dock edges.
    drawSideDocks();

    // Small dock bollards.
    for (let y = 100; y < HEIGHT - 80; y += 128) {
      drawBollard(25, y);
      drawBollard(WIDTH - 25, y);
    }

    // Subtle lane markers.
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = "#b5e5dc";

    LANE_ROWS.forEach(row => {
      ctx.fillRect(18, rowY(row) - 32, WIDTH - 36, 1);
    });

    ctx.globalAlpha = 1;

    // Occasional floating debris.
    for (let i = 0; i < 9; i++) {
      const x = (i * 131 + time * (5 + i % 3)) % WIDTH;
      const y = 100 + (i * 71) % (HEIGHT - 200);

      ctx.fillStyle = "#9a9670";
      ctx.fillRect(x, y, 5, 3);
    }
  }

   function drawSideDocks() {
  if (!dockAtlas.complete || !dockAtlas.naturalWidth) return;

  // The long stone seawall in harbour_atlas_01_cleaned.png
  const sourceX = 528;
  const sourceY = 148;
  const sourceWidth = 418;
  const sourceHeight = 80;

  const dockWidth = 78;

  // Left wall: rocky edge faces into the harbour.
  ctx.save();
  ctx.translate(dockWidth / 2, HEIGHT / 2);
  ctx.rotate(-Math.PI / 2);

  ctx.drawImage(
    dockAtlas,
    sourceX, sourceY, sourceWidth, sourceHeight,
    -HEIGHT / 2, -dockWidth / 2,
    HEIGHT, dockWidth
  );

  ctx.restore();

  // Right wall: mirrored orientation.
  ctx.save();
  ctx.translate(WIDTH - dockWidth / 2, HEIGHT / 2);
  ctx.rotate(Math.PI / 2);

  ctx.drawImage(
    dockAtlas,
    sourceX, sourceY, sourceWidth, sourceHeight,
    -HEIGHT / 2, -dockWidth / 2,
    HEIGHT, dockWidth
  );

  ctx.restore();
}
  function drawBollard(x, y) {
    ctx.fillStyle = "#263b3b";
    ctx.fillRect(x - 5, y - 5, 10, 12);
    ctx.fillStyle = "#b7a17b";
    ctx.fillRect(x - 6, y - 7, 12, 4);
  }

  // -------------------------------------------------------
  // DRAWING: BOATS AND SMOKE
  // -------------------------------------------------------

  function drawSmoke(boat) {
    const frame = Math.floor(
      (animationTime * 0.008 + boat.smokeOffset) % smokeFrames.length
    );

    const img = smokeFrames[frame];

    if (!img || !img.complete || !img.naturalWidth) return;

    const trailDirection = boat.speed > 0 ? -1 : 1;

    const smokeX =
      boat.x + trailDirection * (boat.width * 0.35) -
      Math.sin(animationTime * 0.002 + boat.smokeOffset) * 8;

    const smokeY = boat.y - 23 - boat.smokeDrift % 12;

    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, smokeX - 14, smokeY - 14, 28, 28);
    ctx.restore();
  }

  function drawBoat(boat) {
    ctx.save();

    // Smoke behind the boat.
    drawSmoke(boat);

    const x = boat.x;
    const y = boat.y;
    const w = boat.width;
    const h = boat.height;

    // Wake.
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = "#a8d9d7";
    ctx.fillRect(x - w / 2, y + h / 2 + 4, w, 3);
    ctx.globalAlpha = 1;

    // Hull.
    ctx.fillStyle = "#263b45";
    ctx.fillRect(x - w / 2, y - h / 2, w, h);
    ctx.fillStyle = "#bd4e39";
    ctx.fillRect(x - w / 2 + 7, y + h / 2 - 8, w - 14, 7);

    // Deck.
    ctx.fillStyle = boat.colour;
    ctx.fillRect(x - w / 2 + 10, y - h / 2 + 4, w - 20, h - 12);

    // Cabin.
    if (boat.cabin) {
      ctx.fillStyle = "#e4dfc9";
      ctx.fillRect(x - 15, y - h / 2 - 13, 36, 18);
      ctx.fillStyle = "#456a75";
      ctx.fillRect(x - 9, y - h / 2 - 10, 10, 8);
      ctx.fillRect(x + 5, y - h / 2 - 10, 10, 8);
      ctx.fillStyle = "#263d47";
      ctx.fillRect(x - 19, y - h / 2 + 3, 44, 3);
    }

    // Fishing equipment / deck details.
    ctx.fillStyle = "#5b6c68";
    ctx.fillRect(x - w / 2 + 22, y - 3, 15, 5);
    ctx.fillRect(x + w / 2 - 35, y - 3, 13, 5);

    // Direction light.
    ctx.fillStyle = "#f4d56e";
    ctx.fillRect(
      boat.speed > 0 ? x + w / 2 - 5 : x - w / 2 + 1,
      y - 4,
      4,
      4
    );

    ctx.restore();
  }

  // -------------------------------------------------------
  // DRAWING: NETS AND ROPES
  // -------------------------------------------------------

  function drawNet(net) {
    ctx.save();

    if (net.type === "net") {
      ctx.fillStyle = "#a58e5d";
      ctx.fillRect(net.x - net.width / 2, net.y - 5, net.width, 10);

      ctx.strokeStyle = "#d3bc82";
      ctx.lineWidth = 1;

      for (let x = net.x - net.width / 2; x < net.x + net.width / 2; x += 9) {
        ctx.beginPath();
        ctx.moveTo(x, net.y - 5);
        ctx.lineTo(x + 8, net.y + 5);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x, net.y + 5);
        ctx.lineTo(x + 8, net.y - 5);
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = "#d2b87a";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(net.x - net.width / 2, net.y);
      ctx.quadraticCurveTo(
        net.x,
        net.y + 10,
        net.x + net.width / 2,
        net.y
      );
      ctx.stroke();

      ctx.fillStyle = "#5c5541";
      ctx.fillRect(net.x - net.width / 2 - 3, net.y - 4, 7, 9);
      ctx.fillRect(net.x + net.width / 2 - 3, net.y - 4, 7, 9);
    }

    ctx.restore();
  }

  // -------------------------------------------------------
  // DRAWING: COLLECTIBLES
  // -------------------------------------------------------

  function drawCollectibles() {
    collectibles.forEach(item => {
      if (item.collected) return;

      const bob = Math.sin(animationTime * 0.004 + item.phase) * 4;

      ctx.save();
      ctx.translate(item.x, item.y + bob);

      if (selectedCharacter === "turtle") {
        // Jellyfish.
        ctx.fillStyle = "#e4a8f1";
        ctx.fillRect(-9, -7, 18, 13);
        ctx.fillRect(-6, -11, 12, 5);

        ctx.fillStyle = "#f8d9ff";
        ctx.fillRect(-5, -5, 4, 4);
        ctx.fillRect(3, -5, 4, 4);

        ctx.strokeStyle = "#e7b8f2";
        ctx.lineWidth = 2;

        for (let i = -6; i <= 6; i += 6) {
          ctx.beginPath();
          ctx.moveTo(i, 6);
          ctx.lineTo(i + Math.sin(animationTime * 0.01 + i) * 3, 15);
          ctx.stroke();
        }
      } else {
        // Copepods.
        ctx.fillStyle = "#ffd978";
        ctx.fillRect(-5, -5, 10, 10);
        ctx.fillRect(-2, -9, 4, 4);
        ctx.fillStyle = "#fff1bd";
        ctx.fillRect(-2, -3, 4, 4);

        ctx.strokeStyle = "#f1c36c";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-3, 3);
        ctx.lineTo(-9, 10);
        ctx.moveTo(3, 3);
        ctx.lineTo(9, 10);
        ctx.stroke();
      }

      ctx.restore();
    });
  }

  // -------------------------------------------------------
  // DRAWING: PLAYER
  // -------------------------------------------------------

  function getPlayerSprite() {
    const frame = Math.floor(player.animation / 2) % 4 + 1;

    let direction = player.direction;

    if (direction === "side") {
      direction = "side";
    } else if (direction === "rear") {
      direction = "rear";
    } else {
      direction = "front";
    }

    return images[
      selectedCharacter + "_" + direction + "_" + frame
    ];
  }

  function drawPlayer() {
    if (player.invulnerable > 0 && Math.floor(animationTime / 90) % 2 === 0) {
      return;
    }

    const img = getPlayerSprite();

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    if (img && img.complete && img.naturalWidth) {
      let flip = false;

      if (player.direction === "side") {
        flip = player.targetX < player.x;
      }

      if (flip) {
        ctx.translate(player.x, player.y);
        ctx.scale(-1, 1);
        ctx.drawImage(
          img,
          -PLAYER_SIZE / 2,
          -PLAYER_SIZE / 2,
          PLAYER_SIZE,
          PLAYER_SIZE
        );
      } else {
        ctx.drawImage(
          img,
          player.x - PLAYER_SIZE / 2,
          player.y - PLAYER_SIZE / 2,
          PLAYER_SIZE,
          PLAYER_SIZE
        );
      }
    } else {
      // Simple fallback while images load.
      ctx.fillStyle = selectedCharacter === "turtle" ? "#55b879" : "#9bbfd3";
      ctx.beginPath();
      ctx.ellipse(player.x, player.y, 20, 25, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // -------------------------------------------------------
  // DRAWING: PARTICLES
  // -------------------------------------------------------

  function drawParticles() {
    particles.forEach(particle => {
      ctx.globalAlpha = clamp(particle.life / 400, 0, 1);
      ctx.fillStyle = particle.colour;
      ctx.fillRect(particle.x, particle.y, 4, 4);
    });

    ctx.globalAlpha = 1;
  }

  // -------------------------------------------------------
  // HUD
  // -------------------------------------------------------

  function updateHUD() {
    scoreEl.textContent = formatScore(score);
    crossingsEl.textContent = crossings;
    livesEl.textContent = lives === 2 ? "♥ ♥" : lives === 1 ? "♥ ♡" : "♡ ♡";
    harbourEl.textContent = String(harbour).padStart(2, "0");
    bestScoreEl.textContent = formatScore(getBestScore());
  }

  // -------------------------------------------------------
  // START, END AND RESTART
  // -------------------------------------------------------

  function resetPlayer() {
    player = {
      x: WIDTH / 2,
      y: HEIGHT - TILE / 2,
      targetX: WIDTH / 2,
      targetY: HEIGHT - TILE / 2,
      direction: "front",
      moving: false,
      animation: 0,
      invulnerable: 0
    };

    moveQueue = [];
    collisionCooldown = 0;
  }

  function startGame() {
    initialiseAudio();

    playerName = playerNameInput.value.trim().slice(0, 15) || "SeaExplorer";
    playerNameInput.value = playerName;
    localStorage.setItem(NAME_STORAGE, playerName);

    score = 0;
    crossings = 0;
    lives = 2;
    harbour = 1;

    gameOver = false;
    paused = false;
    running = true;

    animationTime = 0;
    lastFrame = 0;

    resetPlayer();
    createWorld();
    updateHUD();

    startOverlay.classList.add("hidden");
    endOverlay.classList.add("hidden");

    pauseButton.disabled = false;
    pauseButton.textContent = "Ⅱ PAUSE";

    requestAnimationFrame(gameLoop);
  }

  function finishGame() {
    running = false;
    gameOver = true;
    paused = false;

    updateBestScore();
    updateHUD();

    pauseButton.disabled = true;

    endTitle.textContent = "The harbour got you!";
    endSummary.textContent =
      playerName + ", you scored " + score +
      " points and completed " + crossings +
      (crossings === 1 ? " crossing." : " crossings.") +
      " Your best score on this device is " + getBestScore() + ".";

    endOverlay.classList.remove("hidden");
  }

  function togglePause() {
    if (!running || gameOver) return;

    paused = !paused;
    pauseButton.textContent = paused ? "▶ RESUME" : "Ⅱ PAUSE";

    if (!paused) {
      lastFrame = 0;
      requestAnimationFrame(gameLoop);
    }
  }

  startButton.addEventListener("click", startGame);
  againButton.addEventListener("click", startGame);
  pauseButton.addEventListener("click", togglePause);

  // -------------------------------------------------------
  // DRAW FRAME
  // -------------------------------------------------------

  function drawGame() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    drawWater();

    // Boats and hazards.
    boats.forEach(drawBoat);
    nets.forEach(drawNet);

    drawCollectibles();
    drawParticles();
    drawPlayer();

    // Harbour number.
    ctx.fillStyle = "#e5f3e8";
    ctx.font = "10px monospace";
    ctx.globalAlpha = 0.8;
    ctx.fillText("HARBOUR " + String(harbour).padStart(2, "0"), 28, 88);
    ctx.globalAlpha = 1;

    if (paused && running) {
      ctx.fillStyle = "#031b2bd9";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.font = "bold 34px monospace";
      ctx.fillText("PAUSED", WIDTH / 2, HEIGHT / 2);

      ctx.font = "15px monospace";
      ctx.fillText("Press SPACE or click RESUME", WIDTH / 2, HEIGHT / 2 + 35);
      ctx.textAlign = "left";
    }
  }

  // -------------------------------------------------------
  // MAIN GAME LOOP
  // -------------------------------------------------------

  function gameLoop(timestamp) {
    if (!running || paused || gameOver) return;

    if (!lastFrame) lastFrame = timestamp;

    const delta = Math.min(timestamp - lastFrame, 40);
    lastFrame = timestamp;

    animationTime += delta;
    frameCount++;

    updateBoats(delta);
    updatePlayer(delta);
    updateCollectibles();
    updateParticles(delta);
    checkCollisions();

    drawGame();

    if (running && !paused && !gameOver) {
      requestAnimationFrame(gameLoop);
    }
  }

  // -------------------------------------------------------
  // INITIAL SCREEN
  // -------------------------------------------------------

  function drawInitialScreen() {
    drawWater();

    // A few boats moving in the background.
    const previewBoats = [
      { x: 190, y: 210, width: 150, height: 38, speed: 1, direction: 1, smokeOffset: 0, smokeDrift: 0, colour: "#d6d5c8", cabin: true },
      { x: 690, y: 355, width: 130, height: 38, speed: -1, direction: -1, smokeOffset: 2, smokeDrift: 0, colour: "#b8c8c6", cabin: true }
    ];

    previewBoats.forEach(drawBoat);

    const img = images[selectedCharacter + "_front_1"];

    if (img && img.complete && img.naturalWidth) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, WIDTH / 2 - 24, HEIGHT - 64 - 50, 48, 48);
    }
  }

  // -------------------------------------------------------
  // INITIALISE
  // -------------------------------------------------------

  bestScoreEl.textContent = formatScore(getBestScore());

  if (playerNameInput.value) {
    playerName = playerNameInput.value;
  }

  createWorld();
  drawInitialScreen();

  // Keep the preview gently animated behind the start overlay.
  function previewLoop(timestamp) {
    if (running) return;

    animationTime = timestamp;
    drawInitialScreen();

    requestAnimationFrame(previewLoop);
  }

  requestAnimationFrame(previewLoop);

})();
