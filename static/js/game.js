"use strict";

const WAVE_CONFIGS = [
  { zombies: [
    { type: 'zombie', row: 2, delay: 0 },
    { type: 'zombie', row: 4, delay: 5000 },
    { type: 'zombie', row: 0, delay: 8000 },
    { type: 'zombie', row: 1, delay: 10000 },
  ]},
  { zombies: [
    { type: 'zombie',      row: 0, delay: 0 },
    { type: 'zombie',      row: 3, delay: 3000 },
    { type: 'zombie',      row: 1, delay: 5000 },
    { type: 'ssd_zombie',  row: 2, delay: 7000 },
    { type: 'zombie',      row: 4, delay: 9000 },
    { type: 'zombie',      row: 0, delay: 11000 },
  ]},
  { zombies: [
    { type: 'zombie',           row: 0, delay: 0 },
    { type: 'hdd_zombie',       row: 2, delay: 2000 },
    { type: 'zombie',           row: 4, delay: 3500 },
    { type: 'ssd_zombie',       row: 1, delay: 5000 },
    { type: 'zombie',           row: 3, delay: 6500 },
    { type: 'trojan_catapult',  row: 1, delay: 7500 },
    { type: 'ssd_zombie',       row: 0, delay: 9000 },
    { type: 'zombie',           row: 4, delay: 10500 },
    { type: 'hdd_zombie',       row: 3, delay: 12000 },
  ]},
  { zombies: [
    { type: 'zombie',           row: 1, delay: 0 },
    { type: 'winrar_zombie',    row: 3, delay: 2000 },
    { type: 'zombie',           row: 0, delay: 3500 },
    { type: 'flag_zombie',      row: 2, delay: 4500 },
    { type: 'ssd_zombie',       row: 4, delay: 5500 },
    { type: 'zombie',           row: 2, delay: 7000 },
    { type: 'winrar_zombie',    row: 1, delay: 8000 },
    { type: 'hdd_zombie',       row: 0, delay: 9500 },
    { type: 'zombie',           row: 3, delay: 11000 },
    { type: 'trojan_catapult',  row: 4, delay: 12500 },
  ]},
  { zombies: [
    { type: 'zombie',           row: 0, delay: 0 },
    { type: 'system_zombie',    row: 2, delay: 2000 },
    { type: 'zombie',           row: 4, delay: 3000 },
    { type: 'hdd_zombie',       row: 1, delay: 4500 },
    { type: 'trojan_catapult',  row: 3, delay: 5500 },
    { type: 'zombie',           row: 0, delay: 6500 },
    { type: 'flag_zombie',      row: 2, delay: 7500 },
    { type: 'ssd_zombie',       row: 4, delay: 8500 },
    { type: 'winrar_zombie',    row: 1, delay: 9500 },
    { type: 'system_zombie',    row: 3, delay: 11000 },
    { type: 'zombie',           row: 2, delay: 12500 },
  ]},
  { zombies: [
    { type: 'zombie',           row: 1, delay: 0 },
    { type: 'ssd_zombie',       row: 3, delay: 1500 },
    { type: 'bungee',           row: 0, delay: 2500 },
    { type: 'hdd_zombie',       row: 2, delay: 3500 },
    { type: 'zombie',           row: 4, delay: 4500 },
    { type: 'trojan_catapult',  row: 1, delay: 5500 },
    { type: 'flag_zombie',      row: 3, delay: 6000 },
    { type: 'bungee',           row: 4, delay: 7000 },
    { type: 'winrar_zombie',    row: 0, delay: 8000 },
    { type: 'zombie',           row: 2, delay: 9000 },
    { type: 'ssd_zombie',       row: 1, delay: 10000 },
    { type: 'hdd_zombie',       row: 3, delay: 11000 },
    { type: 'bungee',           row: 2, delay: 12000 },
  ]},
  { zombies: [
    { type: 'zombie',           row: 0, delay: 0 },
    { type: 'system_zombie',    row: 2, delay: 1000 },
    { type: 'flag_zombie',      row: 3, delay: 2000 },
    { type: 'winrar_zombie',    row: 1, delay: 3000 },
    { type: 'trojan_catapult',  row: 4, delay: 3500 },
    { type: 'hdd_zombie',       row: 0, delay: 4500 },
    { type: 'ssd_zombie',       row: 2, delay: 5000 },
    { type: 'bungee',           row: 1, delay: 5500 },
    { type: 'zombie',           row: 3, delay: 6500 },
    { type: 'flag_zombie',      row: 1, delay: 7000 },
    { type: 'winrar_zombie',    row: 4, delay: 7500 },
    { type: 'system_zombie',    row: 0, delay: 8500 },
    { type: 'hdd_zombie',       row: 2, delay: 9500 },
    { type: 'trojan_catapult',  row: 3, delay: 10500 },
    { type: 'bungee',           row: 4, delay: 11500 },
    { type: 'ssd_zombie',       row: 1, delay: 12500 },
  ]},
  { zombies: [
    { type: 'hdd_zombie',       row: 0, delay: 0 },
    { type: 'hdd_zombie',       row: 4, delay: 0 },
    { type: 'flag_zombie',      row: 2, delay: 1000 },
    { type: 'system_zombie',    row: 1, delay: 2000 },
    { type: 'trojan_catapult',  row: 3, delay: 2500 },
    { type: 'winrar_zombie',    row: 0, delay: 3500 },
    { type: 'bungee',           row: 2, delay: 4000 },
    { type: 'ssd_zombie',       row: 4, delay: 4500 },
    { type: 'zombie',           row: 1, delay: 5500 },
    { type: 'flag_zombie',      row: 3, delay: 6000 },
    { type: 'system_zombie',    row: 4, delay: 7000 },
    { type: 'trojan_catapult',  row: 0, delay: 7500 },
    { type: 'hdd_zombie',       row: 2, delay: 8500 },
    { type: 'bungee',           row: 1, delay: 9000 },
    { type: 'winrar_zombie',    row: 3, delay: 9500 },
    { type: 'ssd_zombie',       row: 0, delay: 10500 },
    { type: 'zombie',           row: 4, delay: 11000 },
    { type: 'flag_zombie',      row: 2, delay: 11500 },
    { type: 'hdd_zombie',       row: 1, delay: 12500 },
    { type: 'bungee',           row: 3, delay: 13000 },
  ]},
  { zombies: [], isBossWave: true },
];

let currentWaveZombiesSpawned = 0;
let currentWaveZombiesTotal   = 0;
let waveActive = false;
let waveCheckInterval = null;
let waveTimeouts = [];

function startWave(waveIndex) {
  if (waveIndex >= WAVE_CONFIGS.length) return;

  const S = Engine.State;
  S.wave = waveIndex + 1;
  GameLog.log('WAVE', `Starting wave ${S.wave}/${WAVE_CONFIGS.length}, zombies: ${WAVE_CONFIGS[waveIndex].zombies?.length || 'boss'}`);
  UI.updateWave();

  const cfg = WAVE_CONFIGS[waveIndex];

  if (cfg.isBossWave) {
    startBossWave();
    return;
  }

  waveActive = true;
  currentWaveZombiesTotal   = cfg.zombies.length;
  currentWaveZombiesSpawned = 0;

  showWaveBanner(S.wave);

  cfg.zombies.forEach(({ type, row, delay }) => {
    function trySpawn() {
      if (S.gameOver) return;
      if (S.paused && !Engine.State.funMode) { waveTimeouts.push(setTimeout(trySpawn, 500)); return; }
      Engine.spawnZombie(type, row);
      currentWaveZombiesSpawned++;
    }
    waveTimeouts.push(setTimeout(trySpawn, delay + 2000));
  });

  if (waveCheckInterval) clearInterval(waveCheckInterval);
  waveCheckInterval = setInterval(() => {
    if (S.gameOver) { clearInterval(waveCheckInterval); return; }
    if (!waveActive) { clearInterval(waveCheckInterval); return; }
    if (S.paused) return;
    if (currentWaveZombiesSpawned < currentWaveZombiesTotal) return;
    if (S.zombies.filter(z => z.alive).length === 0) {
      GameLog.log('WAVE', `Wave ${waveIndex + 1} complete, all zombies dead`);
      clearInterval(waveCheckInterval);
      waveActive = false;
      function tryNextWave() {
        if (S.gameOver) return;
        if (S.paused) { waveTimeouts.push(setTimeout(tryNextWave, 500)); return; }
        startWave(waveIndex + 1);
      }
      waveTimeouts.push(setTimeout(tryNextWave, 5000));
    }
  }, 1000);
}

function showWaveBanner(num) {
  const el = document.createElement('div');
  el.className = 'wave-banner';
  el.style.cssText = `
    position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(0.5);
    background:rgba(0,0,0,0.85);border:2px solid #5cb85c;border-radius:10px;
    padding:20px 48px;font-family:var(--font-pixel);font-size:20px;color:#7fff00;
    z-index:300;pointer-events:none;opacity:0;
    transition:all 0.4s cubic-bezier(0.34,1.56,0.64,1);
    text-shadow:0 0 12px rgba(127,255,0,0.5);
  `;
  el.textContent = Lang.t('hud.wave_banner', num);
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translate(-50%,-50%) scale(1)';
  });
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translate(-50%,-70%) scale(0.8)';
    setTimeout(() => el.remove(), 500);
  }, 2500);
}

function startBossWave() {
  const S = Engine.State;
  GameLog.log('WAVE', 'Boss wave started — "Ваша смерть" incoming');
  showWaveBanner('???');
  SFX.play('snd-death');

  waveTimeouts.push(setTimeout(() => {
    if (S.gameOver) return;
    const boss = Engine.spawnZombie('your_death', 2);

    waveTimeouts.push(setTimeout(() => {
      if (S.gameOver) return;
      CursikTalk(Lang.t('cursik.boss_who'));
    }, 1500));

    waveTimeouts.push(setTimeout(() => {
      if (S.gameOver) return;
      CursikTalk(Lang.t('cursik.boss_no'));
    }, 3500));

    waveTimeouts.push(setTimeout(() => {
      if (S.gameOver) return;
      const gw = document.getElementById('game-world');
      if (gw) {
        const o = Engine.getGridOrigin();
        const focusX = o.x + 2 * Engine.CELL_W;
        const focusY = (Engine.GRID_ROWS / 2) * Engine.CELL_H;
        gw.style.transition = 'transform 2s cubic-bezier(0.25, 0.1, 0.25, 1)';
        gw.style.transformOrigin = `${focusX}px ${focusY}px`;
        gw.style.transform = 'scale(2.2)';
      }
    }, 5000));

    waveTimeouts.push(setTimeout(() => {
      if (S.gameOver) return;

      const flash = document.createElement('div');
      flash.style.cssText = `
        position:fixed;inset:0;background:rgba(231,76,60,0.7);z-index:200;
        pointer-events:none;animation:boss-flash 1s ease forwards;
      `;
      document.body.appendChild(flash);
      setTimeout(() => flash.remove(), 1000);

      const o = Engine.getGridOrigin();
      const boomSize = 5 * Engine.CELL_W;
      const boomX = o.x + 2 * Engine.CELL_W - boomSize / 2 + Engine.CELL_W / 2;
      const boomY = (Engine.GRID_ROWS / 2) * Engine.CELL_H - boomSize / 2 + Engine.CELL_H / 2;
      const explosionEl = document.createElement('div');
      explosionEl.className = 'ingame-explosion';
      explosionEl.style.position = 'absolute';
      explosionEl.style.width = boomSize + 'px';
      explosionEl.style.height = boomSize + 'px';
      explosionEl.style.left = boomX + 'px';
      explosionEl.style.top = boomY + 'px';
      const explosionImg = document.createElement('img');
      explosionImg.src = 'static/effects/взрыв.png';
      explosionImg.style.width = '100%';
      explosionImg.style.height = '100%';
      explosionEl.appendChild(explosionImg);
      document.getElementById('entities-layer').appendChild(explosionEl);
      setTimeout(() => explosionEl.remove(), 1800);

      const pcx = o.x + 2 * Engine.CELL_W + Engine.CELL_W / 2;
      const pcy = (Engine.GRID_ROWS / 2) * Engine.CELL_H + Engine.CELL_H / 2;
      Engine.spawnParticles(pcx, pcy, '#e74c3c', 30);
      Engine.spawnParticles(pcx, pcy, '#f39c12', 25);
      Engine.spawnParticles(pcx, pcy, '#ff6600', 20);
      Engine.spawnParticles(pcx - 100, pcy - 80, '#e74c3c', 15);
      Engine.spawnParticles(pcx + 100, pcy + 80, '#f39c12', 15);
      SFX.play('snd-explosion');

      const gw = document.getElementById('game-world');
      if (gw) {
        gw.classList.add('screen-shake');
        setTimeout(() => gw.classList.remove('screen-shake'), 600);
      }

      for (let r = 0; r < Engine.GRID_ROWS; r++) {
        for (let c = 0; c < Engine.GRID_COLS; c++) {
          if (S.plants[r][c]) {
            Engine.spawnParticles(
              S.plants[r][c].el.offsetLeft + 37,
              S.plants[r][c].el.offsetTop + 48,
              '#5cb85c', 8
            );
            Engine.removePlant(c, r);
          }
        }
      }

      waveTimeouts.push(setTimeout(() => triggerGameOver(), 2000));
    }, 7000));

  }, 2500));
}

function getDeathReason(key) {
  var k = key || 'zombie_reached';
  return {
    title: Lang.t('death.' + k + '.title'),
    text:  Lang.t('death.' + k + '.text'),
    tip:   Lang.t('death.' + k + '.tip'),
  };
}

function triggerGameOver(zombie, reason) {
  const S = Engine.State;
  if (S.gameOver) return;
  S.gameOver = true;
  Engine.clearAllTimers();

  const deathReason = reason || (zombie ? 'zombie_reached' : 'boss');
  GameLog.log('BSOD', `Game over! Reason: ${deathReason}${zombie ? `, zombie #${zombie.id} (${zombie.type})` : ''}`);
  GameLog.flush();

  if (zombie && zombie.alive) {
    zombie.el.classList.add('selected');
    const targetX = zombie.x - 200;
    Engine.moveCursikTo(zombie.x + 37, zombie.y + 48, () => {
      S.cursik.el.classList.add('dragging');
      animateGameOverDrag(zombie, targetX, () => {
        zombie.el.classList.remove('selected');
        S.cursik.el.classList.remove('dragging');
        showBSOD(deathReason);
      });
    }, true);
  } else {
    setTimeout(() => showBSOD(deathReason), 500);
  }
}

function animateGameOverDrag(zombie, targetX, cb) {
  const ck = Engine.State.cursik;
  const dir = targetX < zombie.x ? -1 : 1;
  function step() {
    const remaining = Math.abs(targetX - zombie.x);
    const move = Math.min(22, remaining);
    zombie.x += dir * move;
    Engine.posEl(zombie.el, zombie.x, zombie.y);
    ck.x = zombie.x + 37;
    ck.y = zombie.y + 48;
    Engine.posEl(ck.el, ck.x - 20, ck.y - 20);
    if (remaining > 1) {
      setTimeout(step, 140);
    } else {
      cb && cb();
    }
  }
  setTimeout(step, 140);
}

function showBSOD(reason) {
  const gameScreen = document.getElementById('screen-game');
  const endScreen  = document.getElementById('screen-end');
  const info = getDeathReason(reason);

  SFX.play('snd-defeat');

  document.getElementById('bsod-face').style.opacity = '0';
  document.getElementById('bsod-title').style.opacity = '0';
  document.getElementById('bsod-text').style.opacity = '0';
  document.getElementById('bsod-progress').style.opacity = '0';
  document.getElementById('bsod-progress').innerHTML = Lang.t('bsod.progress', '0');
  document.getElementById('btn-end-menu').style.display = 'none';

  document.getElementById('bsod-title').textContent = info.title.toUpperCase();
  document.getElementById('bsod-text').innerHTML =
    info.text + '<br><br><span style="color:rgba(255,255,255,0.6);font-size:0.9em">' + info.tip + '</span>';

  gameScreen.style.transition = 'opacity 1.5s';
  gameScreen.style.opacity = '0';

  setTimeout(() => {
    gameScreen.style.display = 'none';
    endScreen.style.display = 'flex';
    endScreen.style.opacity = '0';
    endScreen.style.transition = 'opacity 1s';

    requestAnimationFrame(() => {
      endScreen.style.opacity = '1';
      setTimeout(() => { document.getElementById('bsod-face').style.opacity = '1'; }, 300);
      setTimeout(() => { document.getElementById('bsod-title').style.opacity = '1'; }, 900);
      setTimeout(() => { document.getElementById('bsod-text').style.opacity = '1'; }, 1500);
      setTimeout(() => {
        document.getElementById('bsod-progress').style.opacity = '1';
        startBSODProgress();
      }, 2200);
    });
  }, 1500);
}

function startBSODProgress() {
  const progressEl = document.getElementById('bsod-progress');
  const btnMenu = document.getElementById('btn-end-menu');
  let pct = 0;

  function tick() {
    pct += Engine.rndInt(1, 8);
    if (pct >= 100) {
      pct = 100;
      progressEl.innerHTML = Lang.t('bsod.progress', '100');
      setTimeout(() => {
        btnMenu.style.display = 'block';
        btnMenu.style.opacity = '0';
        btnMenu.style.transition = 'opacity 0.5s';
        requestAnimationFrame(() => { btnMenu.style.opacity = '1'; });
      }, 500);
      return;
    }
    progressEl.innerHTML = Lang.t('bsod.progress', String(pct));
    setTimeout(tick, Engine.rndInt(200, 800));
  }
  setTimeout(tick, 600);
}

function CursikTalk(text, onDone) {
  const ck = Engine.State.cursik;
  const bubble = ck.bubbleEl;
  bubble.textContent = text;
  bubble.classList.remove('hidden');

  const duration = text.length * 60 + 1200;
  setTimeout(() => {
    bubble.classList.add('hidden');
    if (onDone) onDone();
  }, duration);
}

function getTutorialSteps() {
  return [
    { text: Lang.t('tutorial.step0'), highlight: null, cursikTarget: 'center' },
    { text: Lang.t('tutorial.step1'), highlight: 'sun-counter', cursikTarget: 'sun-counter', pulse: true },
    { text: Lang.t('tutorial.step2'), highlight: null, interactive: 'collect_sun', cursikTarget: 'sun' },
    { text: Lang.t('tutorial.step3'), highlight: 'plant-bar', interactive: 'place_plant', cursikTarget: 'plant-bar', pulse: true },
    { text: Lang.t('tutorial.step4'), highlight: null, cursikTarget: 'center' },
    { text: Lang.t('tutorial.step5'), highlight: null, miniCursiks: true, cursikTarget: 'center' },
    { text: Lang.t('tutorial.step6'), highlight: null, cursikTarget: 'lawnmower' },
    { text: Lang.t('tutorial.step7'), highlight: 'pause-menu', showPause: true, cursikTarget: 'center' },
  ];
}
var TUTORIAL_STEPS = getTutorialSteps();

let tutorialStep = 0;
let tutorialHandlersBound = false;
let tutorialOnComplete = null;
let tutorialMiniCursiks = [];
let tutorialInteractiveCleanup = null;

function startTutorial(onComplete) {
  tutorialOnComplete = onComplete || null;
  tutorialStep = 0;
  showTutorialStep(tutorialOnComplete);

  if (!tutorialHandlersBound) {
    document.getElementById('tutorial-next').addEventListener('click', () => nextTutorialStep(tutorialOnComplete));
    document.getElementById('tutorial-skip').addEventListener('click', () => {
      endTutorial();
      if (tutorialOnComplete) tutorialOnComplete();
    });
    tutorialHandlersBound = true;
  }
}

function showTutorialStep(onComplete) {
  const overlay = document.getElementById('tutorial-overlay');
  const textEl  = document.getElementById('tutorial-text');
  const nextBtn = document.getElementById('tutorial-next');
  const step    = TUTORIAL_STEPS[tutorialStep];

  if (tutorialInteractiveCleanup) {
    tutorialInteractiveCleanup();
    tutorialInteractiveCleanup = null;
  }

  overlay.classList.remove('hidden');
  const cursikEl = document.getElementById('cursik');
  if (cursikEl) {
    cursikEl.style.opacity = "1";
    cursikEl.style.display = "block";
  }
  textEl.textContent = step.text;

  document.querySelectorAll('.tutorial-highlight').forEach(e => e.classList.remove('tutorial-highlight', 'tutorial-pulse'));
  const bubble = Engine.State.cursik?.bubbleEl;
  if (bubble) bubble.classList.add('hidden');

  if (step.highlight) {
    const el = document.getElementById(step.highlight);
    if (el) {
      el.classList.add('tutorial-highlight');
      if (step.pulse) el.classList.add('tutorial-pulse');
    }
  }

  moveCursikToTarget(step.cursikTarget);

  if (step.interactive) {
    nextBtn.style.display = 'none';
    setupInteractiveStep(step.interactive, onComplete);
  } else {
    nextBtn.style.display = '';
  }

  if (step.showPause) {
    document.getElementById('pause-menu').classList.remove('hidden');
    document.getElementById('pause-info').style.boxShadow = '0 0 0 3px #ffd700';
  } else {
    document.getElementById('pause-menu').classList.add('hidden');
    document.getElementById('pause-info').style.boxShadow = '';
  }

  removeTutorialMiniCursiks();
  if (step.miniCursiks) {
    const o = Engine.getGridOrigin();
    const cx = o.x + (Engine.GRID_COLS * Engine.CELL_W) / 2;
    const cy = o.y + (Engine.GRID_ROWS * Engine.CELL_H) / 2;
    const offsets = [
      { x: -120, y: -60, delay: '0s' },
      { x:  40,  y: -30, delay: '0.5s' },
      { x: -30,  y:  50, delay: '1s' },
    ];
    for (const off of offsets) {
      const mc = document.createElement('div');
      mc.className = 'tutorial-mini-cursik';
      mc.style.left = (cx + off.x) + 'px';
      mc.style.top = (cy + off.y) + 'px';
      mc.style.animationDelay = off.delay;
      const img = document.createElement('img');
      img.src = 'static/img/ui/курсик.png';
      img.draggable = false;
      img.onerror = () => { img.style.display = 'none'; };
      mc.appendChild(img);
      document.body.appendChild(mc);
      tutorialMiniCursiks.push(mc);
    }
  }
}

function moveCursikToTarget(target) {
  const o = Engine.getGridOrigin();
  let tx, ty;

  if (target === 'center') {
    tx = o.x + (Engine.GRID_COLS * Engine.CELL_W) / 2;
    ty = o.y + (Engine.GRID_ROWS * Engine.CELL_H) / 2;
  } else if (target === 'lawnmower') {
    tx = o.x - 40;
    ty = o.y + Engine.CELL_H * 2 + Engine.CELL_H / 2;
  } else if (target === 'sun') {
    tx = window.innerWidth / 2;
    ty = 150;
  } else if (target) {
    const el = document.getElementById(target);
    if (el) {
      const r = el.getBoundingClientRect();
      tx = r.left + r.width / 2;
      ty = r.top + r.height / 2;
    } else {
      tx = o.x + (Engine.GRID_COLS * Engine.CELL_W) / 2;
      ty = o.y + (Engine.GRID_ROWS * Engine.CELL_H) / 2;
    }
  } else {
    tx = o.x + (Engine.GRID_COLS * Engine.CELL_W) / 2;
    ty = o.y + (Engine.GRID_ROWS * Engine.CELL_H) / 2;
  }

  Engine.moveCursikToPoint(tx, ty);
}

function setupInteractiveStep(type, onComplete) {
  const S = Engine.State;

  if (type === 'collect_sun') {
    S.paused = false;
    const x = window.innerWidth / 2 - 25;
    const y = 120;
    Engine.spawnSun(x, y, false);

    setTimeout(() => Engine.moveCursikToPoint(x + 25, y + 25), 300);

    const origSun = S.sun;
    const checkInterval = setInterval(() => {
      if (S.sun > origSun) {
        clearInterval(checkInterval);
        S.paused = true;
        document.getElementById('tutorial-next').style.display = '';
        nextTutorialStep(onComplete);
      }
    }, 200);

    tutorialInteractiveCleanup = () => {
      clearInterval(checkInterval);
      S.paused = true;
    };
  }

  if (type === 'place_plant') {
    S.paused = false;
    const origPlants = S.plants.flat().filter(Boolean).length;

    const checkInterval = setInterval(() => {
      const currentPlants = S.plants.flat().filter(Boolean).length;
      if (currentPlants > origPlants) {
        clearInterval(checkInterval);
        S.paused = true;
        document.getElementById('tutorial-next').style.display = '';
        nextTutorialStep(onComplete);
      }
    }, 200);

    tutorialInteractiveCleanup = () => {
      clearInterval(checkInterval);
      S.paused = true;
    };
  }
}

function removeTutorialMiniCursiks() {
  tutorialMiniCursiks.forEach(mc => mc.remove());
  tutorialMiniCursiks = [];
}

function nextTutorialStep(onComplete) {
  if (tutorialStep >= TUTORIAL_STEPS.length) return;

  tutorialStep++;
  if (tutorialStep >= TUTORIAL_STEPS.length) {
    endTutorial();
    onComplete && onComplete();
  } else {
    showTutorialStep(onComplete);
  }
}

function endTutorial() {
  if (tutorialInteractiveCleanup) {
    tutorialInteractiveCleanup();
    tutorialInteractiveCleanup = null;
  }

  document.getElementById('tutorial-overlay').classList.add('hidden');
  document.getElementById('pause-menu').classList.add('hidden');

  document.querySelectorAll('.tutorial-highlight').forEach(e => {
    e.classList.remove('tutorial-highlight', 'tutorial-pulse');
  });
  document.querySelectorAll('.tutorial-pulse').forEach(e => e.classList.remove('tutorial-pulse'));

  removeTutorialMiniCursiks();
  const bubble = Engine.State.cursik?.bubbleEl;
  if (bubble) bubble.classList.add('hidden');

  const nextBtn = document.getElementById('tutorial-next');
  if (nextBtn) nextBtn.style.display = '';

  tutorialStep = TUTORIAL_STEPS.length;

  localStorage.setItem('pvz_tutorial_done', '1');
}

function startSunSpawner() {
  function scheduleFallingSun() {
    Engine.gameTimer('falling_sun', () => {
      Engine.spawnFallingSun();
      scheduleFallingSun();
    }, Engine.rndInt(4000, 7000));
  }
  scheduleFallingSun();

  setTimeout(() => Engine.spawnFallingSun(), 1500);
}

function cleanupWaves() {
  if (waveCheckInterval) { clearInterval(waveCheckInterval); waveCheckInterval = null; }
  waveTimeouts.forEach(t => clearTimeout(t));
  waveTimeouts = [];
  waveActive = false;
  currentWaveZombiesSpawned = 0;
  currentWaveZombiesTotal = 0;
}

function startCustomWave(config) {
  cleanupWaves();
  const S = Engine.State;

  [...S.zombies].forEach(z => { if (z.alive) Engine.killZombie(z, true); });

  for (var r = 0; r < Engine.GRID_ROWS; r++) {
    for (var c = 0; c < Engine.GRID_COLS; c++) {
      if (S.plants[r][c]) Engine.removePlant(c, r, true);
    }
  }

  S._customWave = true;
  if (config.startSun != null) { S.sun = config.startSun; } else { S.sun = 150; }
  UI.updateSun();

  if (config.nightMode != null) S.nightMode = !!config.nightMode;
  S._customPlants = Array.isArray(config.plants) ? config.plants : null;

  if (config.lawnmowers === false) {
    S.lawnmowers.forEach((m, i) => {
      if (m && m.el) m.el.remove();
      S.lawnmowers[i] = null;
    });
  } else {
    Engine.spawnLawnmowers();
  }

  UI.buildPlantBar();

  S._customWaveConfigs = config.waves;
  S.maxWaves = config.waves.length;
  S.wave = 0;
  UI.updateWave();

  startCustomWaveStep(0);
}

function startCustomWaveStep(index) {
  const S = Engine.State;
  if (!S._customWave) return;
  if (index >= S._customWaveConfigs.length) {
    GameLog.log('CWAVE', 'All custom waves complete!');
    showWaveBanner('WIN');
    stopCustomWave();
    return;
  }

  const cfg = S._customWaveConfigs[index];
  S.wave = index + 1;
  UI.updateWave();
  waveActive = true;
  currentWaveZombiesTotal = cfg.zombies.length;
  currentWaveZombiesSpawned = 0;

  showWaveBanner(S.wave);
  GameLog.log('CWAVE', `Custom wave ${S.wave}/${S.maxWaves}, zombies: ${cfg.zombies.length}`);

  cfg.zombies.forEach(({ type, row, delay }) => {
    const r = (row >= 1 ? row - 1 : row);
    function trySpawn() {
      if (S.gameOver || !S._customWave) return;
      if (S.paused && !Engine.State.funMode) { waveTimeouts.push(setTimeout(trySpawn, 500)); return; }
      Engine.spawnZombie(type, Math.max(0, Math.min(4, r)));
      currentWaveZombiesSpawned++;
    }
    waveTimeouts.push(setTimeout(trySpawn, (delay || 0) + 2000));
  });

  if (waveCheckInterval) clearInterval(waveCheckInterval);
  waveCheckInterval = setInterval(() => {
    if (S.gameOver || !S._customWave) { clearInterval(waveCheckInterval); return; }
    if (!waveActive) { clearInterval(waveCheckInterval); return; }
    if (S.paused) return;
    if (currentWaveZombiesSpawned < currentWaveZombiesTotal) return;
    if (S.zombies.filter(z => z.alive).length === 0) {
      GameLog.log('CWAVE', `Custom wave ${index + 1} complete`);
      clearInterval(waveCheckInterval);
      waveActive = false;
      function tryNext() {
        if (S.gameOver || !S._customWave) return;
        if (S.paused) { waveTimeouts.push(setTimeout(tryNext, 500)); return; }
        startCustomWaveStep(index + 1);
      }
      waveTimeouts.push(setTimeout(tryNext, 5000));
    }
  }, 1000);
}

function stopCustomWave() {
  cleanupWaves();
  const S = Engine.State;
  [...S.zombies].forEach(z => { if (z.alive) Engine.killZombie(z, true); });
  S._customWave = false;
  S._customWaveConfigs = null;
  S._customPlants = null;
  UI.buildPlantBar();
}

window.Game = {
  startWave,
  startTutorial,
  startSunSpawner,
  CursikTalk,
  triggerGameOver,
  showWaveBanner,
  cleanupWaves,
  startCustomWave,
  stopCustomWave,
};
