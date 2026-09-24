/* =========================================================
   ZEROCLUB — FOOTER PLATFORMER GAME
   =========================================================
   Architecture:
     CONFIG      — all tunable constants in one place
     GameState   — pure data / state machine
     Input       — keyboard + touch unified
     Physics     — update loop for player + entities
     Camera      — lerped follow camera
     Renderer    — canvas drawing (no DOM mutations)
     Particles   — pooled particle system
     Level       — level data + entity spawning
     GameUI      — DOM layer (score, buttons, completion)
     FooterGame  — root controller / lifecycle

   Uses requestAnimationFrame for the game loop.
   GSAP (already loaded on the page) drives DOM transitions.
   Fully pauses when invisible or tab hidden.
   Respects prefers-reduced-motion.
   ========================================================= */

const ZCGame = (() => {
  'use strict';

  /* ----------------------------------------------------------
     CONFIG — change these to tune the game feel
     ---------------------------------------------------------- */
  const CFG = {
    // World
    GAME_HEIGHT:    340,
    WORLD_WIDTH:    3200,

    // Player physics
    PLAYER_SPEED:   2.8,
    JUMP_FORCE:     10.67,
    GRAVITY:        0.46,
    FRICTION:       0.82,
    AIR_RESISTANCE: 0.92,
    MAX_FALL:       18,

    // Camera
    CAM_LERP:       0.09,

    // Collectibles
    TOKEN_COUNT:    12,
    TOKEN_RADIUS:   8,
    TOTAL_LEVELS:   3,

    // Visual
    ACCENT:         '#FF4B22',
    PLAYER_COLOR:   '#EDEEF0',
    PLATFORM_COLOR: '#1E222B',
    TOKEN_COLOR:    '#FF4B22',
    BG_COLOR:       '#080A0D',

    // Timing
    INSTR_DURATION: 3000,   // ms before instructions fade
  };

  /* ----------------------------------------------------------
     UTILS
     ---------------------------------------------------------- */
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const rand = (lo, hi) => lo + Math.random() * (hi - lo);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ----------------------------------------------------------
     LEVEL DATA
     Each platform: { x, y, w, h }
     Each token:    { x, y }   — populated by spawnTokens()
     ---------------------------------------------------------- */
  function buildLevel(levelNum = 1) {
    const H = CFG.GAME_HEIGHT;
    const ground = H - 40;
    const d = Math.min(levelNum - 1, 2);
    const shrink = 1 - d * 0.1;
    const lift = d * 15;
    const spdMult = 1 + d * 0.5;

    // Ground segments — narrow each level creating wider gaps
    const rawG = [[0,460],[520,340],[920,300],[1300,380],[1760,260],[2100,340],[2520,280],[2880,320]];
    const platforms = rawG.map(([x, w]) => ({
      x, y: ground, w: Math.max(140, Math.round(w * shrink)), h: 40
    }));
    // Floating platforms — rise higher each level
    const rawF = [[480,-90,110],[700,-140,90],[860,-80,80],[1050,-110,100],[1200,-60,80],
                  [1450,-130,120],[1620,-80,90],[1700,-160,70],[1850,-100,110],[2020,-140,80],
                  [2200,-90,100],[2380,-130,90],[2600,-100,110],[2760,-70,80]];
    rawF.forEach(([x, yOff, w]) => platforms.push({
      x, y: ground + yOff - lift, w: Math.max(50, Math.round(w * shrink)), h: 14
    }));

    // Moving platforms — faster and wider range each level
    const moving = [
      { x: 1100, y: ground - 170 - lift, w: 90, h: 14, dx: 1.2 * spdMult, range: 80 + d * 20 },
      { x: 1950, y: ground - 145 - lift, w: 80, h: 14, dx: -1 * spdMult,  range: 70 + d * 15 },
      { x: 2680, y: ground - 155 - lift, w: 90, h: 14, dx: 1.4 * spdMult, range: 90 + d * 25 },
    ];
    if (d >= 1) moving.push({ x: 600, y: ground - 120 - lift, w: 80, h: 14, dx: 1.1 * spdMult, range: 70 });
    if (d >= 2) moving.push({ x: 2300, y: ground - 170 - lift, w: 70, h: 14, dx: -1.3 * spdMult, range: 85 });

    // Generate randomly scattered themed grass for each platform
    const colors = ['#272E3B', '#384252', '#4F5C70', '#74839B', '#A2B0C4'];
    function populateGrass(p) {
      p.grass = [];
      const count = Math.max(3, Math.floor(p.w / 11));
      for (let i = 0; i < count; i++) {
        const relX = rand(3, p.w - 5);
        const height = rand(3.5, 10.5);
        const curve = rand(-0.35, 0.35);
        const freq = rand(1.6, 4.2); // independent wind speed
        const phase = rand(0, Math.PI * 2); // independent wind timing offset
        const color = colors[Math.floor(rand(0, colors.length))];
        const hasOrangeTip = Math.random() < 0.28;
        const tipColor = hasOrangeTip ? (Math.random() < 0.5 ? '#FF4B22' : '#FFA033') : null;
        p.grass.push({ relX, height, curve, freq, phase, color, tipColor, width: rand(0.9, 1.5) });
      }
    }
    platforms.forEach(populateGrass);
    moving.forEach(populateGrass);

    // End flag / goal
    const goal = { x: CFG.WORLD_WIDTH - 80, y: ground - 60, w: 30, h: 60 };

    // Calculate water pools in ground holes
    const waters = [];
    for (let i = 0; i < rawG.length - 1; i++) {
      const p1 = platforms[i];
      const p2 = platforms[i + 1];
      const x = p1.x + p1.w;
      const w = p2.x - x;
      if (w > 0) {
        waters.push({ x, y: ground + 14, w, h: H - (ground + 14) + 20 });
      }
    }

    // Tokens — rise with floating platforms
    const rawT = [[540,-55],[490,-140],[720,-195],[940,-55],[1070,-165],[1230,-115],
                  [1470,-185],[1640,-135],[1720,-215],[1870,-155],[2210,-145],[2620,-155]];
    const tokens = rawT.map(([x, yOff]) => ({
      x, y: ground + yOff - lift, collected: false, scale: 1, fadeOut: 0
    }));

    return { platforms, moving, tokens, goal, ground, waters };
  }

  /* ----------------------------------------------------------
     PARTICLES — pooled
     ---------------------------------------------------------- */
  function createParticleSystem() {
    const pool = [];

    function emit(x, y, color, count = 8) {
      for (let i = 0; i < count; i++) {
        const angle = rand(0, Math.PI * 2);
        const speed = rand(1.2, 4.5);
        pool.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2,
          r: rand(2, 4.5),
          life: 1, decay: rand(0.025, 0.055),
          color,
        });
      }
    }

    function emitConfetti(x, y, count = 50) {
      const colors = ['#FF4B22', '#FF6A44', '#EDEEF0', '#FFD700', '#22CCFF', '#FF85A1'];
      for (let i = 0; i < count; i++) {
        const angle = rand(0, Math.PI * 2);
        const speed = rand(2, 8);
        pool.push({
          x: x + rand(-20, 20), y: y + rand(-10, 10),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - rand(3, 7),
          r: rand(2, 5.5),
          life: 1, decay: rand(0.006, 0.02),
          color: colors[Math.floor(rand(0, colors.length))],
        });
      }
    }

    function update() {
      for (let i = pool.length - 1; i >= 0; i--) {
        const p = pool[i];
        p.x += p.vx; p.y += p.vy;
        p.vy += 0.12; p.life -= p.decay;
        if (p.life <= 0) pool.splice(i, 1);
      }
    }

    function draw(ctx, camX) {
      for (const p of pool) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.beginPath();
        ctx.arc(p.x - camX, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.restore();
      }
    }

    return { emit, emitConfetti, update, draw };
  }

  /* ----------------------------------------------------------
     PLAYER
     ---------------------------------------------------------- */
  function createPlayer(x, y) {
    return {
      x, y,
      vx: 0, vy: 0,
      w: 24, h: 24,
      onGround: false,
      facingRight: true,
      // Visual
      scaleX: 1, scaleY: 1,   // squash/stretch
      rotation: 0,
      idleT: 0,               // idle bob timer
      // State
      jumpCooldown: 0,
      coyoteTime: 0,           // grace frames after leaving platform
      checkpoints: [x],
    };
  }

  /* ----------------------------------------------------------
     CAMERA
     ---------------------------------------------------------- */
  function createCamera(canvasW) {
    return {
      x: 0, y: 0,
      targetX: 0,
      canvasW,
    };
  }

  /* ----------------------------------------------------------
     INPUT — unified keyboard + virtual buttons + touch
     ---------------------------------------------------------- */
  function createInput() {
    const state = { left: false, right: false, jump: false, jumpJustPressed: false };
    let prevJump = false;

    function onKey(e, down) {
      if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') state.left  = down;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') state.right = down;
      if ((e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') && down) {
        e.preventDefault();
        state.jump = true;
      }
      if ((e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') && !down) {
        state.jump = false;
      }
    }

    function tick() {
      state.jumpJustPressed = state.jump && !prevJump;
      prevJump = state.jump;
    }

    function bindVirtualButtons(leftBtn, rightBtn, jumpBtn) {
      const press   = (k) => (e) => { e.preventDefault(); state[k] = true;  };
      const release = (k) => (e) => { e.preventDefault(); state[k] = false; };
      leftBtn.addEventListener('pointerdown',  press('left'));
      leftBtn.addEventListener('pointerup',    release('left'));
      leftBtn.addEventListener('pointerleave', release('left'));
      rightBtn.addEventListener('pointerdown',  press('right'));
      rightBtn.addEventListener('pointerup',    release('right'));
      rightBtn.addEventListener('pointerleave', release('right'));
      jumpBtn.addEventListener('pointerdown',  press('jump'));
      jumpBtn.addEventListener('pointerup',    release('jump'));
      jumpBtn.addEventListener('pointerleave', release('jump'));
    }

    // Swipe detection on canvas for mobile
    let touchStartX = 0, touchStartY = 0;
    function onTouchStart(e) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
    function onTouchEnd(e) {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dy) > 40 && dy < 0) { state.jump = true; setTimeout(() => { state.jump = false; }, 100); }
    }

    return { state, onKey, tick, bindVirtualButtons, onTouchStart, onTouchEnd };
  }

  /* ----------------------------------------------------------
     PHYSICS — one tick
     ---------------------------------------------------------- */
  function physicsStep(player, level, input, audio) {
    const { state } = input;
    const H = CFG.GAME_HEIGHT;

    // Horizontal
    if (state.left)  player.vx -= CFG.PLAYER_SPEED * 0.38;
    if (state.right) player.vx += CFG.PLAYER_SPEED * 0.38;
    const friction = player.onGround ? CFG.FRICTION : CFG.AIR_RESISTANCE;
    player.vx *= friction;
    if (Math.abs(player.vx) < 0.06) player.vx = 0;

    // Facing direction
    if (player.vx > 0.2)  player.facingRight = true;
    if (player.vx < -0.2) player.facingRight = false;

    // Jump
    const canJump = player.onGround || player.coyoteTime > 0;
    if ((state.jumpJustPressed || state.jump && state.jumpJustPressed) && canJump && player.jumpCooldown <= 0) {
      player.vy = -CFG.JUMP_FORCE;
      player.coyoteTime = 0;
      player.jumpCooldown = 8;
      // Squash: stretch up when jumping
      player.scaleX = 0.75; player.scaleY = 1.35;
      if (audio) audio.playJump();
    }
    if (player.jumpCooldown > 0) player.jumpCooldown--;

    // Gravity
    player.vy = Math.min(player.vy + CFG.GRAVITY, CFG.MAX_FALL);

    // Move + platform collision
    player.x += player.vx;
    player.y += player.vy;
    player.onGround = false;

    if (player.coyoteTime > 0) player.coyoteTime--;

    // Clamp to world bounds
    player.x = clamp(player.x, 0, CFG.WORLD_WIDTH - player.w);

    // Resolve platforms (static + moving)
    const allPlatforms = [...level.platforms, ...level.moving];
    for (const plat of allPlatforms) {
      if (resolvePlatformCollision(player, plat)) break;
    }

    // Fallen below into water holes → splash and reset to last checkpoint
    if (player.y > H + 40) {
      player.x = player.checkpoints[player.checkpoints.length - 1];
      player.y = CFG.GAME_HEIGHT - 40 - player.h - 4;
      player.vx = 0; player.vy = 0;
      if (audio) audio.playSplash();
    }

    // Smooth squash/stretch return
    player.scaleX = lerp(player.scaleX, 1, 0.18);
    player.scaleY = lerp(player.scaleY, 1, 0.18);

    // Idle bob
    if (!state.left && !state.right && player.onGround) {
      player.idleT += 0.06;
    }
    // Rotation while airborne
    if (!player.onGround) {
      const dir = player.facingRight ? 1 : -1;
      player.rotation = lerp(player.rotation, dir * 0.18, 0.08);
    } else {
      player.rotation = lerp(player.rotation, 0, 0.15);
    }
  }

  function resolvePlatformCollision(player, plat) {
    const px = player.x, py = player.y, pw = player.w, ph = player.h;
    const overlapX = px + pw > plat.x && px < plat.x + plat.w;
    const overlapY = py + ph > plat.y && py < plat.y + plat.h;
    if (!overlapX || !overlapY) return false;

    const fromTop    = player.vy >= 0 && py + ph - player.vy <= plat.y + 2;
    const fromBottom = player.vy < 0  && py - player.vy >= plat.y + plat.h - 2;
    const fromLeft   = player.vx > 0  && px + pw - player.vx <= plat.x + 4;
    const fromRight  = player.vx < 0  && px - player.vx >= plat.x + plat.w - 4;

    if (fromTop) {
      player.y = plat.y - ph;
      player.vy = 0;
      player.onGround = true;
      player.coyoteTime = 6;
      // Land squash
      if (player.scaleY > 1.1) { player.scaleX = 1.35; player.scaleY = 0.7; }
    } else if (fromBottom) {
      player.y = plat.y + plat.h;
      player.vy = 0;
    } else if (fromLeft) {
      player.x = plat.x - pw;
      player.vx = 0;
    } else if (fromRight) {
      player.x = plat.x + plat.w;
      player.vx = 0;
    }
    return true;
  }

  /* ----------------------------------------------------------
     AUDIO SYSTEM — Web Audio API Synthesizer
     ---------------------------------------------------------- */
  function createAudioSystem() {
    let ctx = null;

    function getContext() {
      if (!ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) ctx = new AudioCtx();
      }
      if (ctx && ctx.state === 'suspended') {
        ctx.resume();
      }
      return ctx;
    }

    function playJump() {
      try {
        const ac = getContext();
        if (!ac) return;
        const now = ac.currentTime;

        // Springy cute frog jump leap sound
        const osc = ac.createOscillator();
        const gain = ac.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(360, now + 0.12);

        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

        osc.connect(gain);
        gain.connect(ac.destination);

        osc.start(now);
        osc.stop(now + 0.15);
      } catch (e) {}
    }

    function playEat() {
      try {
        const ac = getContext();
        if (!ac) return;
        const now = ac.currentTime;

        // Cute magical harmonic firefly chime sound
        const osc1 = ac.createOscillator();
        const osc2 = ac.createOscillator();
        const gain = ac.createGain();

        osc1.type = 'triangle';
        osc2.type = 'sine';

        osc1.frequency.setValueAtTime(1318.5, now);
        osc1.frequency.setValueAtTime(1975.5, now + 0.04);

        osc2.frequency.setValueAtTime(659.25, now);
        osc2.frequency.setValueAtTime(987.77, now + 0.04);

        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ac.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.23);
        osc2.stop(now + 0.23);
      } catch (e) {}
    }

    function playWin() {
      try {
        const ac = getContext();
        if (!ac) return;
        const now = ac.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, i) => {
          const osc = ac.createOscillator();
          const gain = ac.createGain();
          const t = now + i * 0.08;
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.15, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
          osc.connect(gain);
          gain.connect(ac.destination);
          osc.start(t);
          osc.stop(t + 0.24);
        });
      } catch (e) {}
    }

    function playSplash() {
      try {
        const ac = getContext();
        if (!ac) return;
        const now = ac.currentTime;
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(340, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.12);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(now);
        osc.stop(now + 0.16);
      } catch (e) {}
    }

    return { playJump, playEat, playWin, playSplash, getContext };
  }

  /* ----------------------------------------------------------
     RENDERER — pure canvas
     ---------------------------------------------------------- */
  function createRenderer(canvas) {
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.parentElement.clientWidth || window.innerWidth || 800;
      H = CFG.GAME_HEIGHT;
      canvas.width  = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width  = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /* Background: dark gradient + subtle dot grid */
    function drawBackground(camX) {
      // Base
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0,   '#080A0D');
      grad.addColorStop(0.7, '#0C0F14');
      grad.addColorStop(1,   '#10141A');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Dot grid — subtle, parallax at 0.15x
      const gridX  = (camX * 0.15) % 32;
      ctx.fillStyle = 'rgba(30,34,43,0.55)';
      for (let x = -gridX; x < W + 32; x += 32) {
        for (let y = 0; y < H; y += 32) {
          ctx.beginPath();
          ctx.arc(x, y, 0.9, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Distant geometric shapes — parallax at 0.3x
      drawBgShapes(ctx, camX * 0.3, W, H);
    }

    function drawBgShapes(ctx, parallax, W, H) {
      const shapes = [
        { x: 200,  y: 60,  r: 32, opacity: 0.06 },
        { x: 680,  y: 110, r: 22, opacity: 0.05 },
        { x: 1200, y: 50,  r: 40, opacity: 0.04 },
        { x: 1700, y: 80,  r: 28, opacity: 0.06 },
        { x: 2300, y: 65,  r: 36, opacity: 0.05 },
        { x: 2800, y: 90,  r: 24, opacity: 0.06 },
      ];
      for (const s of shapes) {
        const sx = ((s.x - parallax) % (CFG.WORLD_WIDTH + 80) + W) % (W + 80) - 40;
        ctx.strokeStyle = `rgba(255,75,34,${s.opacity})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sx, s.y, s.r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    function drawWaters(waters, camX, time) {
      if (!waters) return;
      for (const wat of waters) {
        const sx = wat.x - camX;
        if (sx + wat.w < -20 || sx > W + 20) continue;

        ctx.save();

        // 1. Deep glowing bioluminescent water body
        const grad = ctx.createLinearGradient(0, wat.y, 0, H);
        grad.addColorStop(0, 'rgba(12, 38, 62, 0.9)');
        grad.addColorStop(0.4, 'rgba(7, 22, 38, 0.96)');
        grad.addColorStop(1, 'rgba(3, 10, 18, 1)');
        ctx.fillStyle = grad;

        // Draw animated wavy surface
        ctx.beginPath();
        ctx.moveTo(sx, H + 10);
        ctx.lineTo(sx, wat.y);

        const steps = Math.max(4, Math.floor(wat.w / 6));
        const dx = wat.w / steps;
        for (let i = 0; i <= steps; i++) {
          const px = sx + i * dx;
          const worldX = wat.x + i * dx;
          const waveY = wat.y + Math.sin((time || 0) * 3.8 + worldX * 0.08) * 2.2 + Math.cos((time || 0) * 2.2 + worldX * 0.12) * 1.0;
          ctx.lineTo(px, waveY);
        }

        ctx.lineTo(sx + wat.w, H + 10);
        ctx.closePath();
        ctx.fill();

        // 2. Glowing Cyan / Aquamarine Surface Wave Crest Line
        ctx.strokeStyle = '#22CCFF';
        ctx.shadowColor = '#00E5FF';
        ctx.shadowBlur = 7;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
          const px = sx + i * dx;
          const worldX = wat.x + i * dx;
          const waveY = wat.y + Math.sin((time || 0) * 3.8 + worldX * 0.08) * 2.2 + Math.cos((time || 0) * 2.2 + worldX * 0.12) * 1.0;
          if (i === 0) ctx.moveTo(px, waveY);
          else ctx.lineTo(px, waveY);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // 3. Floating rising bubbles
        const bubbleCount = Math.max(1, Math.floor(wat.w / 22));
        for (let b = 0; b < bubbleCount; b++) {
          const bSeed = wat.x + b * 43;
          const bTime = (((time || 0) * 16 + bSeed) % 36);
          const bx = sx + ((bSeed * 17) % (wat.w - 8)) + 4;
          const by = H - bTime;
          if (by > wat.y && by < H) {
            ctx.fillStyle = 'rgba(34, 204, 255, 0.4)';
            ctx.beginPath();
            ctx.arc(bx + Math.sin((time || 0) * 4 + b) * 1.5, by, 1.1, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.restore();
      }
    }

    function drawPlatforms(platforms, moving, camX, time) {
      for (const p of [...platforms, ...moving]) {
        const sx = p.x - camX;
        if (sx + p.w < -20 || sx > W + 20) continue;

        // Ground / floating platform base
        if (p.h >= 30) {
          ctx.fillStyle = '#0E1117';
          ctx.fillRect(sx, p.y, p.w, p.h);
          // Top edge highlight
          ctx.fillStyle = '#1A202A';
          ctx.fillRect(sx, p.y, p.w, 2.5);
        } else {
          const grad = ctx.createLinearGradient(sx, p.y, sx, p.y + p.h);
          grad.addColorStop(0, '#252B38');
          grad.addColorStop(1, '#1A1E27');
          ctx.fillStyle = grad;
          ctx.fillRect(sx, p.y, p.w, p.h);
          ctx.fillStyle = 'rgba(255,75,34,0.35)';
          ctx.fillRect(sx, p.y, p.w, 1.5);
        }

        // Draw scattered themed grass blades with individual wind sway
        if (p.grass) {
          for (const b of p.grass) {
            const gx = sx + b.relX;
            if (gx < -10 || gx > W + 10) continue;

            // Individual wind sway: each blade has its own phase and frequency
            const sway = Math.sin((time || 0) * b.freq + b.phase) * (b.height * 0.32);
            const tipX = gx + b.curve * b.height + sway;
            const tipY = p.y - b.height;

            ctx.strokeStyle = b.color;
            ctx.lineWidth = b.width;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(gx, p.y);
            ctx.quadraticCurveTo(gx + sway * 0.5, p.y - b.height * 0.5, tipX, tipY);
            ctx.stroke();

            // Themed glowing signal-orange / amber tip
            if (b.tipColor) {
              ctx.fillStyle = b.tipColor;
              ctx.beginPath();
              ctx.arc(tipX, tipY, 0.9, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }
    }

    function drawTokens(tokens, camX, time) {
      for (const tok of tokens) {
        if (tok.collected && tok.scale <= 0.02) continue;
        const sx = tok.x - camX;
        if (sx < -40 || sx > W + 40) continue;

        // Organic floating and fluttering motion
        const floatX = Math.cos(time * 2.2 + tok.x * 0.02) * 3.5;
        const floatY = Math.sin(time * 2.8 + tok.x * 0.01) * 4.5;
        const scale = tok.collected ? lerp(tok.scale, 0, 0.18) : 1;
        tok.scale = scale;

        // Pulsing bioluminescent light
        const pulse = (Math.sin(time * 4.5 + tok.x * 0.05) + 1) * 0.5; // 0 to 1
        const glowRadius = 14 + pulse * 7;

        ctx.save();
        ctx.translate(sx + floatX, tok.y + floatY);
        ctx.scale(scale, scale);

        // 1. Soft Warm Glowing Aura (radial gradient)
        const aura = ctx.createRadialGradient(0, 2, 1, 0, 2, glowRadius);
        aura.addColorStop(0, 'rgba(255, 200, 40, 0.95)');
        aura.addColorStop(0.35, 'rgba(255, 120, 20, 0.45)');
        aura.addColorStop(1, 'rgba(255, 80, 20, 0)');
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(0, 2, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // 2. Fluttering Translucent Wings
        const wingFlap = Math.sin(time * 24 + tok.x) * 0.45;
        ctx.fillStyle = 'rgba(240, 245, 255, 0.75)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 0.6;

        // Left wing
        ctx.save();
        ctx.translate(-1, -2);
        ctx.rotate(-0.5 + wingFlap);
        ctx.beginPath();
        ctx.ellipse(-4, -4, 5.5, 2.2, -0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Right wing
        ctx.save();
        ctx.translate(1, -2);
        ctx.rotate(0.5 - wingFlap);
        ctx.beginPath();
        ctx.ellipse(4, -4, 5.5, 2.2, 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // 3. Firefly Body (Dark head and thorax)
        ctx.fillStyle = '#1A1E24';
        // Head
        ctx.beginPath();
        ctx.arc(0, -3.5, 2, 0, Math.PI * 2);
        ctx.fill();
        // Thorax
        ctx.beginPath();
        ctx.ellipse(0, -1, 2.2, 2.8, 0, 0, Math.PI * 2);
        ctx.fill();

        // 4. Glowing Lantern Abdomen (Bright Core)
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 10 + pulse * 6;
        ctx.fillStyle = '#FFF275';
        ctx.beginPath();
        ctx.ellipse(0, 2.5, 3.2, 3.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Inner hot-white center
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(0, 2.2, 1.6, 0, Math.PI * 2);
        ctx.fill();

        // 5. Tiny antennae
        ctx.strokeStyle = 'rgba(237, 238, 240, 0.6)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(-1, -5); ctx.lineTo(-2.5, -7.5);
        ctx.moveTo(1, -5); ctx.lineTo(2.5, -7.5);
        ctx.stroke();

        ctx.restore();
      }
    }

    function drawGoal(goal, camX, time) {
      const sx = goal.x - camX;
      if (sx < -60 || sx > W + 60) return;

      // Flag pole
      ctx.strokeStyle = '#2A2F3A';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sx + goal.w / 2, goal.y);
      ctx.lineTo(sx + goal.w / 2, goal.y + goal.h);
      ctx.stroke();

      // Flag
      const wave = Math.sin(time * 3) * 4;
      ctx.beginPath();
      ctx.moveTo(sx + goal.w / 2, goal.y);
      ctx.lineTo(sx + goal.w / 2 + 28 + wave, goal.y + 8);
      ctx.lineTo(sx + goal.w / 2, goal.y + 18);
      ctx.closePath();
      ctx.fillStyle = CFG.ACCENT;
      ctx.shadowColor = CFG.ACCENT; ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Label
      ctx.font = "bold 10px 'JetBrains Mono', monospace";
      ctx.fillStyle = 'rgba(237,238,240,0.4)';
      ctx.textAlign = 'center';
      ctx.fillText('FINISH', sx + goal.w / 2 + 2, goal.y - 10);
    }

    function drawPlayer(player, camX) {
      const sx = player.x - camX + player.w / 2;
      const sy = player.y + player.h / 2;
      const inAir = !player.onGround;
      const throatBob = player.onGround ? Math.sin(player.idleT * 2.5) * 1.2 : 0;
      const bob = player.onGround ? Math.sin(player.idleT) * 1.2 : 0;

      ctx.save();
      ctx.translate(sx, sy + bob);
      ctx.rotate(player.rotation);
      ctx.scale(player.scaleX * (player.facingRight ? 1 : -1), player.scaleY);

      const hw = player.w / 2, hh = player.h / 2;

      // 1. Shadow underneath frog (ground only)
      if (!inAir) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(0, hh + 2, hw * 1.15, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. BACK HIND LEGS & FEET
      if (inAir) {
        // Leaping kick pose: legs stretched backwards with splayed webbed toes
        ctx.fillStyle = '#E2E5EA';
        ctx.beginPath();
        ctx.moveTo(-hw * 0.4, 0);
        ctx.quadraticCurveTo(-hw * 1.1, hh * 0.2, -hw * 1.5, hh * 0.7);
        ctx.lineTo(-hw * 1.4, hh * 0.9);
        ctx.quadraticCurveTo(-hw * 0.9, hh * 0.5, -hw * 0.3, hh * 0.4);
        ctx.closePath();
        ctx.fill();

        // Webbed toes splayed in air
        ctx.strokeStyle = '#EDEEF0';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-hw * 1.45, hh * 0.75); ctx.lineTo(-hw * 1.85, hh * 0.65); // toe 1
        ctx.moveTo(-hw * 1.45, hh * 0.8);  ctx.lineTo(-hw * 1.9,  hh * 0.9);  // toe 2
        ctx.moveTo(-hw * 1.4,  hh * 0.85); ctx.lineTo(-hw * 1.75, hh * 1.15); // toe 3
        ctx.stroke();
      } else {
        // Crouched perched pose: muscular bent Z-thigh + flat webbed foot
        // Thigh
        ctx.fillStyle = '#DCE0E6';
        ctx.beginPath();
        ctx.ellipse(-hw * 0.45, hh * 0.25, 7.5, 5.8, -0.4, 0, Math.PI * 2);
        ctx.fill();

        // Folded lower leg
        ctx.fillStyle = '#E8EBF0';
        ctx.beginPath();
        ctx.ellipse(-hw * 0.35, hh * 0.65, 6, 3.2, 0.2, 0, Math.PI * 2);
        ctx.fill();

        // Long webbed 3 toes on ground
        ctx.strokeStyle = '#EDEEF0';
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-hw * 0.4, hh * 0.85); ctx.lineTo(-hw * 0.05, hh * 0.95); // main toe
        ctx.moveTo(-hw * 0.4, hh * 0.85); ctx.lineTo(-hw * 0.1,  hh * 0.75); // top toe
        ctx.moveTo(-hw * 0.4, hh * 0.85); ctx.lineTo(-hw * 0.15, hh * 1.05); // bottom toe
        ctx.stroke();
      }

      // 3. BACK EYE BUMP (3D depth on head)
      ctx.fillStyle = '#E0E4EB';
      ctx.beginPath();
      ctx.arc(-hw * 0.15, -hh * 0.75, 5.2, 0, Math.PI * 2);
      ctx.fill();
      // Back eye glow edge
      ctx.fillStyle = CFG.ACCENT;
      ctx.beginPath();
      ctx.arc(-hw * 0.15, -hh * 0.8, 3.2, 0, Math.PI * 2);
      ctx.fill();

      // 4. MAIN FROG BODY (Distinctive Low-Slung Crouched Frog Silhouette)
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      // Back hump curve
      ctx.moveTo(-hw * 0.75, hh * 0.3);
      ctx.quadraticCurveTo(-hw * 0.85, -hh * 0.2, -hw * 0.25, -hh * 0.55); // high back hump
      // Head curve towards snout
      ctx.quadraticCurveTo(hw * 0.2, -hh * 0.75, hw * 0.85, -hh * 0.15); // flat tapered snout
      // Snout down to wide frog jaw
      ctx.quadraticCurveTo(hw * 0.95, hh * 0.25, hw * 0.65, hh * 0.55);
      // Soft throat & belly line
      ctx.quadraticCurveTo(hw * 0.2, hh * 0.9 + throatBob * 0.3, -hw * 0.4, hh * 0.85);
      // Back around to rear
      ctx.quadraticCurveTo(-hw * 0.7, hh * 0.75, -hw * 0.75, hh * 0.3);
      ctx.closePath();
      ctx.fill();

      // Subtle ambient rim stroke
      ctx.strokeStyle = 'rgba(230, 235, 245, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 5. FROG THROAT / VOCAL SAC & BELLY
      ctx.fillStyle = '#F2F5F8';
      ctx.beginPath();
      ctx.ellipse(hw * 0.3, hh * 0.45 + throatBob * 0.4, 5.5, 4.2 + throatBob * 0.5, 0.2, 0, Math.PI * 2);
      ctx.fill();

      // 6. FRONT ARM & DIGITS
      ctx.fillStyle = '#EDEEF0';
      if (inAir) {
        // Reaching forward in air
        ctx.beginPath();
        ctx.ellipse(hw * 0.65, hh * 0.5, 4.5, 2.2, 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#EDEEF0';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(hw * 0.8, hh * 0.6); ctx.lineTo(hw * 1.05, hh * 0.55);
        ctx.moveTo(hw * 0.8, hh * 0.6); ctx.lineTo(hw * 1.0,  hh * 0.75);
        ctx.stroke();
      } else {
        // Planted on floor with spread little fingers
        ctx.beginPath();
        ctx.ellipse(hw * 0.45, hh * 0.65, 4, 3, 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#E2E5EA';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(hw * 0.45, hh * 0.8); ctx.lineTo(hw * 0.7, hh * 0.95);
        ctx.moveTo(hw * 0.45, hh * 0.8); ctx.lineTo(hw * 0.55, hh * 1.05);
        ctx.moveTo(hw * 0.45, hh * 0.8); ctx.lineTo(hw * 0.35, hh * 1.02);
        ctx.stroke();
      }

      // 7. CUTE FROG BACK SPOTS
      ctx.fillStyle = 'rgba(255, 75, 34, 0.18)';
      ctx.beginPath();
      ctx.arc(-hw * 0.4, -hh * 0.15, 1.8, 0, Math.PI * 2);
      ctx.arc(-hw * 0.15, -hh * 0.25, 2.2, 0, Math.PI * 2);
      ctx.arc(-hw * 0.05, 0, 1.6, 0, Math.PI * 2);
      ctx.fill();

      // 8. BIG BULGING FROG EYE SOCKET (Perched high on head)
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(hw * 0.3, -hh * 0.7, 6.8, 0, Math.PI * 2);
      ctx.fill();

      // 9. VIBRANT GLOWING ORANGE EYE
      ctx.shadowColor = CFG.ACCENT;
      ctx.shadowBlur = 8;
      ctx.fillStyle = CFG.ACCENT; // Signal Orange (#FF4B22)
      ctx.beginPath();
      ctx.arc(hw * 0.3, -hh * 0.7, 5.0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Inner Golden-Amber Iris Layer
      ctx.fillStyle = '#FFB300';
      ctx.beginPath();
      ctx.arc(hw * 0.32, -hh * 0.72, 3.4, 0, Math.PI * 2);
      ctx.fill();

      // Characteristic Frog Horizontal Oval Pupil
      ctx.fillStyle = '#080A0D';
      ctx.beginPath();
      ctx.ellipse(hw * 0.32, -hh * 0.72, 2.5, 1.3, -0.05, 0, Math.PI * 2);
      ctx.fill();

      // Glossy Catchlight Glint
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(hw * 0.42, -hh * 0.85, 1.3, 0, Math.PI * 2);
      ctx.fill();

      // 10. WIDE FROG MOUTH & NOSTRIL
      ctx.strokeStyle = '#ABB3BF';
      ctx.lineWidth = 1.1;
      ctx.lineCap = 'round';
      ctx.beginPath();
      // Long sweeping frog mouth
      ctx.moveTo(hw * 0.85, -hh * 0.12);
      ctx.quadraticCurveTo(hw * 0.55, hh * 0.08, hw * 0.25, -hh * 0.05);
      ctx.stroke();

      // Nostril bump/dot
      ctx.fillStyle = '#9BA4B2';
      ctx.beginPath();
      ctx.arc(hw * 0.78, -hh * 0.3, 0.9, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    return {
      ctx, resize,
      get W() { return W; },
      drawBackground, drawWaters, drawPlatforms, drawTokens, drawGoal, drawPlayer,
    };
  }

  /* ----------------------------------------------------------
     GAME STATE MACHINE
     ---------------------------------------------------------- */
  function createGameState(level) {
    return {
      phase: 'idle',       // idle | playing | complete
      player: null,
      camera: null,
      level,
      particles: createParticleSystem(),
      score: 0,
      time: 0,
      currentLevel: 1,
      tokensTotal: level.tokens.length,
    };
  }

  /* ----------------------------------------------------------
     FOOTER GAME — root controller
     ---------------------------------------------------------- */
  function init() {
    /* ── DOM refs ─────────────────────────────────────── */
    const enterBtn      = document.getElementById('gameEnterBtn');
    const canvasWrap    = document.getElementById('gameCanvasWrap');
    const canvas        = document.getElementById('gameCanvas');
    const scoreEl       = document.getElementById('gameScoreVal');
    const levelEl       = document.getElementById('gameLevelVal');
    const progressFill  = document.getElementById('gameProgressFill');
    const closeBtn      = document.getElementById('gameCloseBtn');
    const instrEl       = document.getElementById('gameInstructions');
    const completeEl    = document.getElementById('gameComplete');
    const completeBack  = document.getElementById('gameCompleteBack');
    const vLeft         = document.getElementById('vBtnLeft');
    const vRight        = document.getElementById('vBtnRight');
    const vJump         = document.getElementById('vBtnJump');
    const mobileCtrl    = document.getElementById('gameMobileControls');

    if (!canvas || !enterBtn) return;

    /* ── Sub-systems ─────────────────────────────────── */
    const input    = createInput();
    const renderer = createRenderer(canvas);
    const audio    = createAudioSystem();
    let state      = null;
    let rafId      = null;
    let isVisible  = false;
    let instrTimer = null;

    /* ── IntersectionObserver: pause when not visible ─ */
    const io = new IntersectionObserver(entries => {
      isVisible = entries[0].isIntersecting;
      if (!isVisible && rafId) { cancelAnimationFrame(rafId); rafId = null; }
      else if (isVisible && state?.phase === 'playing' && !rafId) { rafId = requestAnimationFrame(loop); }
    }, { threshold: 0.1 });
    io.observe(canvasWrap);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && rafId) { cancelAnimationFrame(rafId); rafId = null; }
      else if (!document.hidden && state?.phase === 'playing' && isVisible && !rafId) {
        rafId = requestAnimationFrame(loop);
      }
    });

    /* ── Keyboard ─────────────────────────────────── */
    window.addEventListener('keydown', (e) => {
      if (state?.phase !== 'playing') return;
      input.onKey(e, true);
    });
    window.addEventListener('keyup', (e) => input.onKey(e, false));

    /* ── Virtual / touch ────────────────────────────── */
    input.bindVirtualButtons(vLeft, vRight, vJump);
    canvas.addEventListener('touchstart', input.onTouchStart, { passive: true });
    canvas.addEventListener('touchend',   input.onTouchEnd,   { passive: true });

    /* ── Enter button ──────────────────────────────── */
    enterBtn.addEventListener('click', () => {
      if (reducedMotion) {
        startGame();
      } else if (typeof gsap !== 'undefined') {
        gsap.to(enterBtn, { opacity: 0, scale: 0.9, duration: 0.3, ease: 'power2.in',
          onComplete: () => { enterBtn.style.display = 'none'; startGame(); }
        });
      } else {
        enterBtn.style.display = 'none';
        startGame();
      }
    });

    /* ── Close / exit ───────────────────────────────── */
    closeBtn.addEventListener('click', exitGame);
    completeBack.addEventListener('click', () => {
      completeEl.classList.remove('is-shown');
      resetGame();
    });

    /* ── Start ─────────────────────────────────────── */
    function startGame() {
      isVisible = true;
      const level = buildLevel(1);
      state = createGameState(level);
      state.player = createPlayer(40, level.ground - 80);
      state.camera = createCamera(renderer.W || canvasWrap.clientWidth || window.innerWidth || 800);
      state.phase  = 'playing';
      if (scoreEl) scoreEl.textContent = '0';
      if (levelEl) levelEl.textContent = '1';
      if (progressFill) progressFill.style.width = '0%';

      renderer.resize();

      // Show canvas
      canvasWrap.classList.add('is-active');
      completeEl.classList.remove('is-shown');
      completeEl.setAttribute('aria-hidden', 'true');

      // Auto-scroll game into full view so it never looks cut off or blank
      setTimeout(() => {
        canvasWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 60);

      // Show instructions briefly
      if (instrEl) {
        instrEl.style.opacity = '1';
        clearTimeout(instrTimer);
        instrTimer = setTimeout(() => {
          if (instrEl && !reducedMotion) {
            instrEl.style.opacity = '0';
          }
        }, CFG.INSTR_DURATION);
      }

      // Mobile controls
      if (mobileCtrl) mobileCtrl.style.display = '';

      // Animate canvas in
      if (!reducedMotion && typeof gsap !== 'undefined') {
        gsap.fromTo(canvasWrap, { opacity: 0, scaleY: 0.92 }, {
          opacity: 1, scaleY: 1, duration: 0.5, ease: 'power3.out',
          transformOrigin: 'top center',
        });
      }

      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(loop);
    }

    function resetGame() {
      if (!state) return;
      state.currentLevel = 1;
      state.level = buildLevel(1);
      state.player = createPlayer(40, state.level.ground - 80);
      state.camera = createCamera(renderer.W);
      state.score  = 0;
      state.time   = 0;
      state.phase  = 'playing';
      state.particles = createParticleSystem();
      if (scoreEl) scoreEl.textContent = '0';
      if (levelEl) levelEl.textContent = '1';
      if (progressFill) progressFill.style.width = '0%';
      if (instrEl) { instrEl.style.opacity = '1';
        clearTimeout(instrTimer);
        instrTimer = setTimeout(() => { if(instrEl) instrEl.style.opacity = '0'; }, CFG.INSTR_DURATION);
      }
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(loop);
    }

    function exitGame() {
      state.phase = 'idle';
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }

      if (!reducedMotion && typeof gsap !== 'undefined') {
        gsap.to(canvasWrap, { opacity: 0, duration: 0.35, onComplete: () => {
          canvasWrap.classList.remove('is-active');
          canvasWrap.style.opacity = '';
          enterBtn.style.display   = '';
          gsap.fromTo(enterBtn, { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: 0.3 });
        }});
      } else {
        canvasWrap.classList.remove('is-active');
        enterBtn.style.display = '';
      }
      if (mobileCtrl) mobileCtrl.style.display = 'none';
    }

    /* ── Main loop ──────────────────────────────────── */
    function loop() {
      if (!state || state.phase !== 'playing') return;

      input.tick();

      /* Update moving platforms */
      for (const m of state.level.moving) {
        if (!m.ox) m.ox = m.x;
        m.x += m.dx;
        if (m.x > m.ox + m.range || m.x < m.ox - m.range) m.dx *= -1;
      }

      /* Physics */
      physicsStep(state.player, state.level, input, audio);

      /* Camera lerp */
      const targetCamX = state.player.x - state.camera.canvasW * 0.38;
      state.camera.x = lerp(
        state.camera.x,
        clamp(targetCamX, 0, CFG.WORLD_WIDTH - state.camera.canvasW),
        reducedMotion ? 1 : CFG.CAM_LERP
      );

      /* Token / firefly collection */
      for (const tok of state.level.tokens) {
        if (tok.collected) continue;
        const dx = state.player.x + state.player.w / 2 - tok.x;
        const dy = state.player.y + state.player.h / 2 - tok.y;
        if (Math.sqrt(dx*dx + dy*dy) < CFG.TOKEN_RADIUS + state.player.w / 2) {
          tok.collected = true;
          state.score++;
          if (scoreEl) scoreEl.textContent = String(state.score);
          state.particles.emit(tok.x, tok.y, '#FFD700', 12);
          if (audio) audio.playEat();
        }
      }

      /* Goal check - robust trigger across full goal/finish zone */
      const goal = state.level.goal;
      if (
        state.player.x + state.player.w >= goal.x &&
        state.player.y + state.player.h >= goal.y - 40
      ) {
        if (state.currentLevel < CFG.TOTAL_LEVELS) {
          if (audio) audio.playWin();
          advanceLevel();
        } else {
          if (audio) audio.playWin();
          triggerComplete();
          return;
        }
      }

      /* Update scroll / progress track */
      if (progressFill) {
        const trackMax = CFG.WORLD_WIDTH - 120;
        const pct = Math.min(100, Math.max(0, Math.round((state.player.x / trackMax) * 100)));
        progressFill.style.width = pct + '%';
      }

      state.particles.update();
      state.time += 1/60;

      /* Render */
      renderer.drawBackground(state.camera.x);
      renderer.drawWaters(state.level.waters, state.camera.x, state.time);
      renderer.drawPlatforms(state.level.platforms, state.level.moving, state.camera.x, state.time);
      renderer.drawTokens(state.level.tokens, state.camera.x, state.time);
      renderer.drawGoal(state.level.goal, state.camera.x, state.time);
      state.particles.draw(renderer.ctx, state.camera.x);
      renderer.drawPlayer(state.player, state.camera.x);

      rafId = requestAnimationFrame(loop);
    }

    /* ── Level advance ─────────────────────────────── */
    function advanceLevel() {
      state.currentLevel++;
      state.level = buildLevel(state.currentLevel);
      state.player = createPlayer(40, state.level.ground - 80);
      state.camera = createCamera(renderer.W || canvasWrap.clientWidth || 800);
      state.camera.x = 0;
      state.particles = createParticleSystem();
      state.particles.emitConfetti(state.player.x + state.player.w / 2, state.player.y - 20, 60);
      state.tokensTotal += state.level.tokens.length;
      if (levelEl) levelEl.textContent = String(state.currentLevel);
      if (progressFill) progressFill.style.width = '0%';
    }

    /* ── Completion ─────────────────────────────────── */
    function triggerComplete() {
      state.phase = 'complete';
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }

      // Confetti celebration
      const px = state.player.x + state.player.w / 2, py = state.player.y;
      state.particles.emitConfetti(px, py, 90);
      state.particles.emitConfetti(px - 100, py - 20, 45);
      state.particles.emitConfetti(px + 100, py - 20, 45);

      completeEl.classList.add('is-shown');
      completeEl.setAttribute('aria-hidden', 'false');

      // Keep rendering scene + confetti in the background
      let f = 0;
      (function confettiLoop() {
        if (state.phase !== 'complete') return;
        state.particles.update();
        renderer.drawBackground(state.camera.x);
        renderer.drawWaters(state.level.waters, state.camera.x, state.time);
        renderer.drawPlatforms(state.level.platforms, state.level.moving, state.camera.x, state.time);
        renderer.drawTokens(state.level.tokens, state.camera.x, state.time);
        renderer.drawGoal(state.level.goal, state.camera.x, state.time);
        renderer.drawPlayer(state.player, state.camera.x);
        state.particles.draw(renderer.ctx, state.camera.x);
        if (++f < 180) {
          requestAnimationFrame(confettiLoop);
        }
      })();
    }

    /* ── Resize ─────────────────────────────────────── */
    const ro = 'ResizeObserver' in window
      ? new ResizeObserver(() => { renderer.resize(); if(state) state.camera.canvasW = renderer.W; })
      : null;
    if (ro) ro.observe(canvasWrap);
    else window.addEventListener('resize', () => { renderer.resize(); });
  }

  return { init };
})();

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ZCGame.init);
} else {
  ZCGame.init();
}
