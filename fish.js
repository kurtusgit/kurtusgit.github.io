/* ==========================================================================
   Kurtus Gulliveri — Full-Viewport Interactive 3D ASCII Simulation
   Combines parametric 3D Kurtus gulliveri mesh, physical 3D steering,
   interactive water-current ASCII waves, pointer ripples, and seamless
   text-zone luminance dimming.
   ========================================================================== */

(() => {
  "use strict";

  const canvas = document.getElementById("kurtus-canvas");
  const screen = document.getElementById("hero-screen");
  const contentEl = document.getElementById("hero-content");
  const toggleBtn = document.getElementById("fish-toggle");
  const coordsEl = document.getElementById("fish-coords");

  if (!canvas || !screen) return;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;

  const RAMP = " .,:;-=+*#%@";
  const TRAIL_RAMP = " .,:;";
  const WAVE_RAMP = " .~-:=";

  const PALETTE = [
    "#202020",
    "#363636",
    "#505050",
    "#6e6e6e",
    "#8e8e8e",
    "#adadad",
    "#cccccc",
    "#e6e6e6",
    "#ffffff",
  ];
  const TRAIL_PALETTE = ["#191919", "#282828", "#3a3a3a", "#4e4e4e"];
  const FONT_FAMILY =
    "'Consolas', 'Cascadia Mono', 'Lucida Console', ui-monospace, 'SFMono-Regular', Menlo, 'Courier New', monospace";

  const state = {
    width: 0,
    height: 0,
    dpr: 1,
    cols: 0,
    rows: 0,
    charW: 6,
    charH: 11,
    fontSize: 10,
    safeRect: { left: 0, top: 0, right: 0, bottom: 0, valid: false },

    zBuf: new Float32Array(0),
    lumBuf: new Float32Array(0),
    trailBuf: new Float32Array(0),
    fxBuf: new Float32Array(0),

    buckets: Array.from({ length: PALETTE.length }, () => []),
    trailBuckets: Array.from({ length: TRAIL_PALETTE.length }, () => []),
    fxBuckets: Array.from({ length: 5 }, () => []),

    ripples: [],
    wakeParticles: [],
    ambientSpecks: [],

    rafId: 0,
    running: false,
    visible: true,
    userPaused: false,
    elapsed: 0.4,
    lastFrameTime: 0,
    hudTimer: 0,

    // Physical 3D fish state
    initializedPos: false,
    fishX: 0,
    fishY: 0,
    fishZ: 0,
    velX: 120,
    velY: 0,
    velZ: 40,
    prevYaw: 0,
    smoothRoll: 0,
    swimPhase: 0.9,

    // Pointer / click steering
    pointerActive: false,
    pointerX: 0,
    pointerY: 0,
    pointerSpeed: 0,
    clickTargetX: 0,
    clickTargetY: 0,
    clickTimer: 0,
    lastTailScreenX: 0,
    lastTailScreenY: 0,
    hasTailPos: false,
  };

  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function pad3(n) {
    const c = clamp(Math.round(n), 0, 999);
    return c < 10 ? "00" + c : c < 100 ? "0" + c : String(c);
  }

  // Parametric body silhouette of Kurtus gulliveri (s in [0..1]: 0=snout, 1=peduncle)
  function getBodyProfile(s) {
    let yTop;
    if (s < 0.24) {
      const u = s / 0.24;
      yTop = 0.05 + 0.43 * Math.pow(Math.sin(u * Math.PI * 0.5), 0.72);
    } else {
      const u = (s - 0.24) / 0.76;
      yTop = 0.48 * Math.pow(1 - u, 1.32) + 0.058 * u;
    }

    let yBot;
    if (s < 0.25) {
      const u = s / 0.25;
      yBot = -0.05 - 0.30 * Math.pow(Math.sin(u * Math.PI * 0.5), 0.82);
    } else {
      const u = (s - 0.25) / 0.75;
      yBot = -0.35 * Math.pow(1 - u, 1.18) - 0.058 * u;
    }

    let zHalf;
    if (s < 0.22) {
      const u = s / 0.22;
      zHalf = 0.035 + 0.19 * Math.pow(Math.sin(u * Math.PI * 0.5), 0.78);
    } else {
      const u = (s - 0.22) / 0.78;
      zHalf = 0.225 * Math.pow(1 - u, 1.25) + 0.032 * u;
    }

    return { yTop, yBot, zHalf };
  }

  function updateSafeRect(screenRect) {
    if (!contentEl) {
      state.safeRect.valid = false;
      return;
    }
    const cRect = contentEl.getBoundingClientRect();
    const pad = 18;
    state.safeRect = {
      left: cRect.left - screenRect.left - pad,
      top: cRect.top - screenRect.top - pad,
      right: cRect.right - screenRect.left + pad,
      bottom: cRect.bottom - screenRect.top + pad,
      valid: true,
    };
  }

  function initAmbientSpecks() {
    const count = state.width < 600 ? 18 : 30;
    state.ambientSpecks = [];
    for (let i = 0; i < count; i++) {
      state.ambientSpecks.push({
        x: Math.random() * state.cols,
        y: Math.random() * state.rows,
        vx: -0.5 - Math.random() * 1.1,
        vy: -0.15 + Math.random() * 0.1,
        char: i % 4 === 0 ? "," : ".",
      });
    }
  }

  function getHomeAnchor() {
    const { width, height, safeRect } = state;
    if (width >= 768 && safeRect.valid) {
      const openLeft = clamp(safeRect.right, width * 0.35, width * 0.65);
      return {
        x: lerp(openLeft, width * 0.92, 0.44),
        y: height * 0.48,
      };
    }
    if (safeRect.valid) {
      const openTop = clamp(safeRect.bottom, height * 0.3, height * 0.62);
      return {
        x: width * 0.5,
        y: lerp(openTop, height - 30, 0.52),
      };
    }
    return { x: width * 0.5, y: height * 0.5 };
  }

  function resize() {
    const rect = screen.getBoundingClientRect();
    const width = Math.max(260, Math.floor(rect.width));
    const height = Math.max(240, Math.floor(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    state.width = width;
    state.height = height;
    state.dpr = dpr;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    state.fontSize = width < 560 ? 9 : 11;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = `400 ${state.fontSize}px ${FONT_FAMILY}`;
    ctx.textBaseline = "top";

    const measured = ctx.measureText("M").width;
    state.charW = Math.max(5, measured || state.fontSize * 0.58);
    state.charH = Math.round(state.fontSize * 1.12 * 10) / 10;

    state.cols = Math.max(36, Math.floor(width / state.charW));
    state.rows = Math.max(18, Math.floor(height / state.charH));

    const total = state.cols * state.rows;
    state.zBuf = new Float32Array(total);
    state.lumBuf = new Float32Array(total);
    state.trailBuf = new Float32Array(total);
    state.fxBuf = new Float32Array(total);

    updateSafeRect(rect);

    if (!state.initializedPos) {
      const home = getHomeAnchor();
      state.fishX = home.x - width * 0.08;
      state.fishY = home.y;
      state.fishZ = 0;
      state.initializedPos = true;
    }

    initAmbientSpecks();

    if (state.userPaused) {
      updateAndDraw(0, state.elapsed);
    }
  }

  function renderFishIntoBuffers(posX, posY, worldZ, yaw, pitch, roll, swimPhase, scalePx) {
    const { cols, rows, charW, charH, zBuf, lumBuf } = state;

    const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
    const cosP = Math.cos(pitch), sinP = Math.sin(pitch);
    const cosR = Math.cos(roll), sinR = Math.sin(roll);

    const lx = 0.38, ly = 0.76, lz = 0.52;
    const lLen = Math.hypot(lx, ly, lz);
    const Lx = lx / lLen, Ly = ly / lLen, Lz = lz / lLen;

    const camDist = 3.8;
    const depthOffset = worldZ * 0.42;

    function plot(lx0, ly0, lz0, nx0, ny0, nz0, lumBoost, forceLum) {
      const sNorm = clamp((0.85 - lx0) / 2.25, 0, 1);
      const amp = 0.02 + 0.23 * Math.pow(sNorm, 1.65);
      const wave = amp * Math.sin(swimPhase - 5.0 * sNorm);
      const dWaveDs = (amp * -5.0 * Math.cos(swimPhase - 5.0 * sNorm)) / 2.25;

      const pz = lz0 + wave;
      const bnx = nx0 + nz0 * dWaveDs * 0.4;
      const bnz = nz0;

      const rx1 = lx0;
      const ry1 = ly0 * cosR - pz * sinR;
      const rz1 = ly0 * sinR + pz * cosR;
      const rnx1 = bnx;
      const rny1 = ny0 * cosR - bnz * sinR;
      const rnz1 = ny0 * sinR + bnz * cosR;

      const px2 = rx1 * cosP - ry1 * sinP;
      const py2 = rx1 * sinP + ry1 * cosP;
      const pz2 = rz1;
      const pnx2 = rnx1 * cosP - rny1 * sinP;
      const pny2 = rnx1 * sinP + rny1 * cosP;
      const pnz2 = rnz1;

      const wx = px2 * cosY + pz2 * sinY;
      const wy = py2;
      const wz = -px2 * sinY + pz2 * cosY + depthOffset;
      const wnx = pnx2 * cosY + pnz2 * sinY;
      const wny = pny2;
      const wnz = -pnx2 * sinY + pnz2 * cosY;

      const denom = camDist - wz;
      if (denom <= 0.4) return;
      const invZ = 1 / denom;

      const sx = posX + wx * invZ * camDist * scalePx;
      const sy = posY - wy * invZ * camDist * scalePx;

      const col = Math.round(sx / charW);
      const row = Math.round(sy / charH);
      if (col < 0 || col >= cols || row < 0 || row >= rows) return;

      const idx = row * cols + col;
      if (wz > zBuf[idx]) {
        zBuf[idx] = wz;
        if (forceLum !== undefined) {
          lumBuf[idx] = forceLum;
          return;
        }
        const nLen = Math.hypot(wnx, wny, wnz) || 1;
        const ndotl = (wnx * Lx + wny * Ly + wnz * Lz) / nLen;
        const rim = Math.pow(1 - Math.abs(wnz / nLen), 1.35);
        const backFill = Math.max(0, -ndotl) * 0.26;
        const lum = clamp(
          0.32 + Math.max(0, ndotl) * 0.5 + backFill + rim * 0.24 + lumBoost,
          0.24,
          1.0
        );
        lumBuf[idx] = lum;
      }
    }

    const sSteps = state.width < 560 ? 78 : 102;
    const tSteps = state.width < 560 ? 36 : 44;

    // 1. Body
    for (let i = 0; i <= sSteps; i++) {
      const s = i / sSteps;
      const x = 0.85 - s * 1.70;
      const { yTop, yBot, zHalf } = getBodyProfile(s);
      const yMid = (yTop + yBot) * 0.5;
      const yRad = (yTop - yBot) * 0.5;

      for (let j = 0; j < tSteps; j++) {
        const th = (j / tSteps) * Math.PI * 2;
        const st = Math.sin(th);
        const ct = Math.cos(th);

        const y = yMid + yRad * Math.sign(st) * Math.pow(Math.abs(st), 0.92);
        const z = zHalf * ct;

        const nx = s < 0.16 ? (1 - s / 0.16) * 0.72 : -0.14;
        const ny = st / Math.max(0.06, yRad);
        const nz = ct / Math.max(0.04, zHalf);

        const dxEye = (s - 0.115) * 1.70;
        const dyEye = y - 0.09;
        const eyeDist = Math.hypot(dxEye, dyEye);
        if (Math.abs(ct) > 0.35 && eyeDist < 0.056) {
          if (eyeDist < 0.024) {
            plot(x, y, z, nx, ny, nz, 0, 0.015);
          } else {
            plot(x, y, z, nx, ny, nz, 0.25);
          }
          continue;
        }

        const gillCurve = Math.abs(s - (0.22 - 0.025 * st));
        const gillShade =
          gillCurve < 0.011 && st < 0.4 && st > -0.65 && Math.abs(ct) > 0.45 ? -0.18 : 0;
        const mouthShade = s < 0.055 && y < 0.0 && y > -0.05 ? -0.2 : 0;
        const dorsalContrast = st > 0.22 ? 0.07 : -0.04;

        plot(x, y, z, nx, ny, nz, gillShade + mouthShade + dorsalContrast);
      }
    }

    // 2. Dorsal fin
    for (let u = 0; u <= 28; u++) {
      const fu = u / 28;
      const sBase = lerp(0.31, 0.56, fu);
      const { yTop } = getBodyProfile(sBase);
      const maxH = 0.26 * Math.sin(Math.pow(fu, 0.62) * Math.PI * 0.94);
      for (let v = 0; v <= 16; v++) {
        const fv = v / 16;
        const x = 0.85 - sBase * 1.70 - fv * 0.16;
        const y = yTop - 0.03 + fv * (maxH + 0.03);
        const z = fv * 0.035 * Math.sin(swimPhase - 2.4 - fv * 1.5);
        const ray = Math.abs(Math.sin(fu * 22)) < 0.35 ? 0.06 : -0.06;
        plot(x, y, z, 0.05, 0.38, 0.92, ray - fv * 0.1);
      }
    }

    // 3. Anal fin
    for (let u = 0; u <= 38; u++) {
      const fu = u / 38;
      const sBase = lerp(0.38, 0.88, fu);
      const { yBot } = getBodyProfile(sBase);
      const finDepth = 0.17 * (0.35 + 0.65 * Math.sin(fu * Math.PI)) * (1 - 0.28 * fu);
      for (let v = 0; v <= 11; v++) {
        const fv = v / 11;
        const x = 0.85 - sBase * 1.70 - fv * 0.06;
        const y = yBot + 0.025 - fv * (finDepth + 0.025);
        const z = fv * 0.04 * Math.sin(swimPhase - 3.6 - fu * 1.2);
        plot(x, y, z, 0, -0.35, 0.93, -0.08 - fv * 0.1);
      }
    }

    // 4. Forked caudal fin
    for (let u = 0; u <= 34; u++) {
      const fu = u / 34;
      const x = -0.82 - fu * 0.56;
      const spread = lerp(0.06, 0.44, Math.pow(fu, 0.85));
      const notch = fu > 0.22 ? lerp(0, 0.22, Math.pow((fu - 0.22) / 0.78, 1.08)) : 0;

      for (let v = 0; v <= 32; v++) {
        const fv = (v / 32) * 2 - 1;
        const absFv = Math.abs(fv);
        const y = fv * spread;
        if (Math.abs(y) < notch) continue;

        const yAdj = fv < 0 ? y * 1.07 : y;
        const rayRib = Math.abs(Math.sin(absFv * 16)) < 0.35 ? 0.09 : -0.06;
        plot(x, yAdj, 0, -0.15, fv * 0.3, 0.94, rayRib - fu * 0.12);
      }
    }

    // 5. Pectoral fins
    for (const side of [-1, 1]) {
      const flap = Math.sin(swimPhase * 1.15 + (side > 0 ? 0 : 0.7)) * 0.14;
      for (let u = 0; u <= 14; u++) {
        const fu = u / 14;
        const finWidth = 0.13 * Math.sin(Math.pow(fu, 0.65) * Math.PI);
        for (let v = 0; v <= 10; v++) {
          const fv = (v / 10) * 2 - 1;
          const x = 0.43 - fu * 0.24;
          const y = -0.09 - fu * 0.08 + fv * finWidth;
          const z = side * (0.18 + fu * (0.14 + flap));
          plot(x, y, z, 0.1, 0.2, side, -0.08 - fu * 0.1);
        }
      }
    }

    // Tail screen coordinate for wake particles
    let tailScreenX = posX;
    let tailScreenY = posY;
    const pz = 0.25 * Math.sin(swimPhase - 5.0);
    const rx1 = -1.32;
    const ry1 = -pz * sinR;
    const rz1 = pz * cosR;
    const px2 = rx1 * cosP - ry1 * sinP;
    const py2 = rx1 * sinP + ry1 * cosP;
    const wx = px2 * cosY + rz1 * sinY;
    const wz = -px2 * sinY + rz1 * cosY + depthOffset;
    const denom = camDist - wz;
    if (denom > 0.4) {
      const invZ = 1 / denom;
      tailScreenX = posX + wx * invZ * camDist * scalePx;
      tailScreenY = posY - py2 * invZ * camDist * scalePx;
    }

    return { tailScreenX, tailScreenY };
  }

  function renderWaterCurrents(elapsed, fishCol, fishRow) {
    const { cols, rows, charW, charH, fxBuf, lumBuf } = state;
    fxBuf.fill(0);

    const pCol = state.pointerX / charW;
    const pRow = state.pointerY / charH;
    const pointerBoost = clamp(state.pointerSpeed, 0, 1);

    // Two subtle horizontal current filaments across the black space (reacting to pointer & fish)
    const layers = [
      { base: rows * 0.44, freq: 0.075, speed: 0.9, amp: 2.2, strength: 0.22 },
      { base: rows * 0.64, freq: 0.055, speed: -0.65, amp: 2.8, strength: 0.18 },
    ];

    for (let l = 0; l < layers.length; l++) {
      const layer = layers[l];
      for (let c = 0; c < cols; c++) {
        let waveY =
          layer.base +
          Math.sin(c * layer.freq + elapsed * layer.speed + l * 1.7) * layer.amp +
          Math.cos(c * layer.freq * 0.45 - elapsed * 0.4) * (layer.amp * 0.5);

        let localEnergy = 0;

        // Deflect smoothly around pointer
        if (state.pointerActive) {
          const dxP = c - pCol;
          const dyP = waveY - pRow;
          const dist2 = dxP * dxP * 0.35 + dyP * dyP;
          if (dist2 < 140) {
            const pull = Math.exp(-dist2 / 48);
            waveY += (dyP >= 0 ? 1 : -1) * pull * (2.6 + pointerBoost * 2.5);
            localEnergy += pull * (0.38 + pointerBoost * 0.35);
          }
        }

        // Deflect smoothly around swimming fish
        const dxF = c - fishCol;
        const dyF = waveY - fishRow;
        const distF2 = dxF * dxF * 0.22 + dyF * dyF;
        if (distF2 < 160) {
          const wake = Math.exp(-distF2 / 55);
          waveY += (dyF >= 0 ? 1 : -1) * wake * 2.1;
          localEnergy += wake * 0.24;
        }

        const r = Math.round(waveY);
        if (r >= 1 && r < rows - 1) {
          const idx = r * cols + c;
          if (lumBuf[idx] <= 0.02) {
            fxBuf[idx] = Math.max(fxBuf[idx], clamp(layer.strength + localEnergy, 0.12, 0.78));
          }
        }
      }
    }

    // Expanding ASCII click/tap ripple rings
    for (let i = state.ripples.length - 1; i >= 0; i--) {
      const rp = state.ripples[i];
      const steps = Math.max(24, Math.floor(rp.radius * 7));
      for (let k = 0; k < steps; k++) {
        const a = (k / steps) * Math.PI * 2;
        const c = Math.round(rp.col + Math.cos(a) * rp.radius * 1.75);
        const r = Math.round(rp.row + Math.sin(a) * rp.radius);
        if (c >= 0 && c < cols && r >= 0 && r < rows) {
          const idx = r * cols + c;
          if (lumBuf[idx] <= 0.02) {
            fxBuf[idx] = Math.max(fxBuf[idx], rp.life * 0.75);
          }
        }
      }
    }
  }

  function updateAndDraw(dt, elapsed) {
    const {
      width,
      height,
      cols,
      rows,
      charW,
      charH,
      safeRect,
      zBuf,
      lumBuf,
      trailBuf,
      fxBuf,
      buckets,
      trailBuckets,
      fxBuckets,
    } = state;

    zBuf.fill(-1e9);
    lumBuf.fill(0);

    // Update click/tap ripples & pointer decay
    state.pointerSpeed = Math.max(0, state.pointerSpeed - dt * 2.5);
    if (state.clickTimer > 0) {
      state.clickTimer = Math.max(0, state.clickTimer - dt);
    }
    for (let i = state.ripples.length - 1; i >= 0; i--) {
      const rp = state.ripples[i];
      rp.radius += dt * 20;
      rp.life -= dt * 1.05;
      if (rp.life <= 0) state.ripples.splice(i, 1);
    }

    // Compute autonomous cruising goal around open space
    const home = getHomeAnchor();
    const roamX = width * (width >= 768 ? 0.25 : 0.30);
    const roamY = height * (width >= 768 ? 0.26 : 0.18);
    const u = elapsed * 0.44;

    let goalX = home.x + Math.sin(u) * roamX + Math.sin(u * 2.0 + 0.6) * (roamX * 0.18);
    let goalY = home.y - Math.sin(u * 1.65 + 0.35) * roamY;
    let goalZ = (Math.cos(u) * 0.68 + Math.sin(u * 2.0) * 0.18) * (height * 0.35);

    if (state.clickTimer > 0) {
      const weight = clamp(state.clickTimer / 2.2, 0.25, 0.85);
      goalX = lerp(goalX, state.clickTargetX, weight);
      goalY = lerp(goalY, state.clickTargetY, weight);
      goalZ = lerp(goalZ, 0, 0.5);
    } else if (state.pointerActive) {
      goalX = lerp(goalX, state.pointerX, 0.36);
      goalY = lerp(goalY, state.pointerY, 0.36);
    }

    // Keep goal comfortably inside screen bounds
    const padX = width < 560 ? 64 : 110;
    const padY = width < 560 ? 52 : 76;
    goalX = clamp(goalX, padX, Math.max(padX + 10, width - padX));
    goalY = clamp(goalY, padY, Math.max(padY + 10, height - padY));

    // Smooth spring-damped 3D steering
    if (dt > 0) {
      const dx = goalX - state.fishX;
      const dy = goalY - state.fishY;
      const dz = goalZ - state.fishZ;

      const accel = 2.6;
      state.velX += dx * accel * dt;
      state.velY += dy * accel * dt;
      state.velZ += dz * accel * dt;

      const damping = Math.exp(-1.7 * dt);
      state.velX *= damping;
      state.velY *= damping;
      state.velZ *= damping;

      const speed = Math.hypot(state.velX, state.velY, state.velZ);
      const minSpeed = width < 560 ? 68 : 95;
      const maxSpeed = width < 560 ? 190 : 270;
      if (speed > 0.001) {
        const clampedSpeed = clamp(speed, minSpeed, maxSpeed);
        const ratio = clampedSpeed / speed;
        state.velX *= ratio;
        state.velY *= ratio;
        state.velZ *= ratio;
      }

      state.fishX = clamp(state.fishX + state.velX * dt, 30, width - 30);
      state.fishY = clamp(state.fishY + state.velY * dt, 30, height - 30);
      state.fishZ = clamp(state.fishZ + state.velZ * dt, -height * 0.45, height * 0.45);
    }

    const yaw = Math.atan2(-state.velZ, state.velX);
    const pitch = Math.atan2(-state.velY, Math.hypot(state.velX, state.velZ)) * 0.62;

    let dYaw = yaw - state.prevYaw;
    while (dYaw > Math.PI) dYaw -= Math.PI * 2;
    while (dYaw < -Math.PI) dYaw += Math.PI * 2;
    state.prevYaw = yaw;

    const targetRoll = dt > 0 ? clamp((dYaw / Math.max(0.008, dt)) * 0.14, -0.36, 0.36) : 0;
    state.smoothRoll += (targetRoll - state.smoothRoll) * Math.min(1, dt * 5.0);

    const speedNow = Math.hypot(state.velX, state.velY, state.velZ);
    const speedFactor = clamp(speedNow / (width < 560 ? 105 : 145), 0.75, 1.55);
    state.swimPhase += dt * (4.1 * speedFactor);

    const scalePx =
      width < 560
        ? clamp(width * 0.24, 68, 102)
        : clamp(Math.min(width * 0.115, height * 0.195), 82, 138);

    const worldZNorm = state.fishZ / Math.max(120, height * 0.35);

    const { tailScreenX, tailScreenY } = renderFishIntoBuffers(
      state.fishX,
      state.fishY,
      worldZNorm,
      yaw,
      pitch,
      state.smoothRoll,
      state.swimPhase,
      scalePx
    );

    const fishCol = state.fishX / charW;
    const fishRow = state.fishY / charH;
    renderWaterCurrents(elapsed, fishCol, fishRow);

    // Update live HUD coordinates quietly
    state.hudTimer += dt;
    if (coordsEl && state.hudTimer >= 0.1) {
      state.hudTimer = 0;
      coordsEl.textContent = `pos: [${pad3(fishCol)}, ${pad3(fishRow)}]`;
    }

    // Spawn delicate wake specks behind tail tip
    if (state.hasTailPos && dt > 0 && Math.random() < dt * 12) {
      const col = tailScreenX / charW;
      const row = tailScreenY / charH;
      if (col > 1 && col < cols - 1 && row > 1 && row < rows - 1) {
        state.wakeParticles.push({
          x: col + (Math.random() - 0.5) * 2.2,
          y: row + (Math.random() - 0.5) * 1.2,
          vx: (tailScreenX - state.lastTailScreenX) * -0.02 + (Math.random() - 0.5) * 1.4,
          vy: -0.9 - Math.random() * 1.1,
          life: 1.0,
        });
        if (state.wakeParticles.length > 26) state.wakeParticles.shift();
      }
    }
    state.lastTailScreenX = tailScreenX;
    state.lastTailScreenY = tailScreenY;
    state.hasTailPos = true;

    // Clear pure black canvas
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);

    // Safe text dimming bounds in character grid units
    const sMinCol = safeRect.valid ? Math.floor(safeRect.left / charW) : 9999;
    const sMaxCol = safeRect.valid ? Math.ceil(safeRect.right / charW) : -1;
    const sMinRow = safeRect.valid ? Math.floor(safeRect.top / charH) : 9999;
    const sMaxRow = safeRect.valid ? Math.ceil(safeRect.bottom / charH) : -1;

    function isInsideSafe(c, r) {
      return c >= sMinCol && c <= sMaxCol && r >= sMinRow && r <= sMaxRow;
    }

    // Ambient specks
    for (let i = 0; i < state.ambientSpecks.length; i++) {
      const sp = state.ambientSpecks[i];
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      if (sp.x < 0) sp.x += cols;
      if (sp.y < 0) sp.y += rows;
      const c = Math.floor(sp.x);
      const r = Math.floor(sp.y);
      if (
        c >= 0 &&
        c < cols &&
        r >= 0 &&
        r < rows &&
        lumBuf[r * cols + c] <= 0.02 &&
        !isInsideSafe(c, r)
      ) {
        ctx.fillStyle = "#1c1c1c";
        ctx.fillText(sp.char, c * charW, r * charH);
      }
    }

    // Wake particles
    for (let i = state.wakeParticles.length - 1; i >= 0; i--) {
      const wp = state.wakeParticles[i];
      wp.x += wp.vx * dt;
      wp.y += wp.vy * dt;
      wp.life -= dt * 0.95;
      if (wp.life <= 0) {
        state.wakeParticles.splice(i, 1);
        continue;
      }
      const c = Math.round(wp.x);
      const r = Math.round(wp.y);
      if (c >= 0 && c < cols && r >= 0 && r < rows && lumBuf[r * cols + c] <= 0.02) {
        const dim = isInsideSafe(c, r);
        ctx.fillStyle = dim ? "#181818" : wp.life > 0.5 ? "#4a4a4a" : "#242424";
        ctx.fillText(wp.life > 0.55 ? ":" : ".", c * charW, r * charH);
      }
    }

    // Bucket background FX + trail + foreground fish
    for (let i = 0; i < buckets.length; i++) buckets[i].length = 0;
    for (let i = 0; i < trailBuckets.length; i++) trailBuckets[i].length = 0;
    for (let i = 0; i < fxBuckets.length; i++) fxBuckets[i].length = 0;

    const decay = Math.pow(0.055, dt);
    const total = cols * rows;

    for (let idx = 0; idx < total; idx++) {
      const r = Math.floor(idx / cols);
      const c = idx - r * cols;
      const inSafe = isInsideSafe(c, r);
      const lum = lumBuf[idx];

      if (lum > 0.02) {
        trailBuf[idx] = Math.max(lum, trailBuf[idx] * decay);
        const adjLum = inSafe ? lum * 0.22 : lum;
        const charIdx = clamp(Math.floor(lum * (RAMP.length - 1)), 1, RAMP.length - 1);
        const palIdx = clamp(Math.floor(adjLum * (PALETTE.length - 1)), 0, PALETTE.length - 1);
        buckets[palIdx].push(idx, charIdx);
      } else if (lum > 0.005) {
        trailBuf[idx] = 0;
      } else {
        const tr = trailBuf[idx] * decay;
        trailBuf[idx] = tr > 0.04 ? tr : 0;
        if (tr > 0.08 && !inSafe) {
          const tCharIdx = clamp(Math.floor(tr * (TRAIL_RAMP.length - 1)), 1, TRAIL_RAMP.length - 1);
          const tPalIdx = clamp(Math.floor(tr * (TRAIL_PALETTE.length - 1)), 0, TRAIL_PALETTE.length - 1);
          trailBuckets[tPalIdx].push(idx, tCharIdx);
        } else if (fxBuf[idx] > 0.05) {
          const fVal = inSafe ? fxBuf[idx] * 0.25 : fxBuf[idx];
          const fCharIdx = clamp(Math.floor(fxBuf[idx] * (WAVE_RAMP.length - 1)), 1, WAVE_RAMP.length - 1);
          const fPalIdx = clamp(Math.floor(fVal * (fxBuckets.length - 1)), 0, fxBuckets.length - 1);
          fxBuckets[fPalIdx].push(idx, fCharIdx);
        }
      }
    }

    const FX_COLORS = ["#171717", "#232323", "#333333", "#494949", "#666666"];
    for (let b = 0; b < fxBuckets.length; b++) {
      const list = fxBuckets[b];
      if (!list.length) continue;
      ctx.fillStyle = FX_COLORS[b];
      for (let k = 0; k < list.length; k += 2) {
        const idx = list[k];
        const ch = WAVE_RAMP[list[k + 1]];
        const r = Math.floor(idx / cols);
        const c = idx - r * cols;
        ctx.fillText(ch, c * charW, r * charH);
      }
    }

    for (let b = 0; b < trailBuckets.length; b++) {
      const list = trailBuckets[b];
      if (!list.length) continue;
      ctx.fillStyle = TRAIL_PALETTE[b];
      for (let k = 0; k < list.length; k += 2) {
        const idx = list[k];
        const ch = TRAIL_RAMP[list[k + 1]];
        const r = Math.floor(idx / cols);
        const c = idx - r * cols;
        ctx.fillText(ch, c * charW, r * charH);
      }
    }

    for (let b = 0; b < buckets.length; b++) {
      const list = buckets[b];
      if (!list.length) continue;
      ctx.fillStyle = PALETTE[b];
      for (let k = 0; k < list.length; k += 2) {
        const idx = list[k];
        const ch = RAMP[list[k + 1]];
        const r = Math.floor(idx / cols);
        const c = idx - r * cols;
        ctx.fillText(ch, c * charW, r * charH);
      }
    }
  }

  function frameLoop(now) {
    if (!state.running) return;
    if (!state.lastFrameTime) state.lastFrameTime = now;

    const dt = Math.min(0.05, Math.max(0.001, (now - state.lastFrameTime) / 1000));
    state.lastFrameTime = now;
    state.elapsed += dt;

    updateAndDraw(dt, state.elapsed);
    state.rafId = requestAnimationFrame(frameLoop);
  }

  function start() {
    if (state.running || state.userPaused || !state.visible || document.hidden) return;
    state.running = true;
    state.lastFrameTime = performance.now();
    state.rafId = requestAnimationFrame(frameLoop);
  }

  function stop() {
    state.running = false;
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }
  }

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      state.userPaused = !state.userPaused;
      toggleBtn.setAttribute("aria-pressed", String(state.userPaused));
      toggleBtn.textContent = state.userPaused ? "[ > PLAY ]" : "[ II PAUSE ]";
      if (state.userPaused) stop();
      else start();
    });
  }

  // Interactive pointer movement & click/tap ripple + steering
  screen.addEventListener("pointermove", (e) => {
    const rect = screen.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nx = e.clientX - rect.left;
    const ny = e.clientY - rect.top;
    const dist = Math.hypot(nx - state.pointerX, ny - state.pointerY);
    state.pointerSpeed = clamp(state.pointerSpeed + dist * 0.015, 0, 1.2);
    state.pointerX = nx;
    state.pointerY = ny;
    state.pointerActive = true;
  });

  screen.addEventListener("pointerleave", () => {
    state.pointerActive = false;
  });

  screen.addEventListener("pointerdown", (e) => {
    if (e.target && e.target.closest && e.target.closest("a, button")) return;
    const rect = screen.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    state.clickTargetX = px;
    state.clickTargetY = py;
    state.clickTimer = 3.0;
    state.pointerX = px;
    state.pointerY = py;
    state.pointerActive = true;

    state.ripples.push({
      col: px / state.charW,
      row: py / state.charH,
      radius: 0.6,
      life: 1.0,
    });
    if (state.ripples.length > 6) state.ripples.shift();
  });

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        state.visible = entries[0] ? entries[0].isIntersecting : true;
        if (state.visible) start();
        else stop();
      },
      { threshold: 0.05 }
    );
    io.observe(screen);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });

  if ("ResizeObserver" in window) {
    const ro = new ResizeObserver(() => resize());
    ro.observe(screen);
  } else {
    window.addEventListener("resize", resize);
  }

  resize();
  start();
})();
