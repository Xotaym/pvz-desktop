"use strict";

const GRID_COLS  = 9;
const GRID_ROWS  = 5;
const CELL_W     = 110;
const CELL_H     = 110;
const HUD_H      = 90;

function getGridOrigin() {
  const totalW = GRID_COLS * CELL_W;
  const totalH = GRID_ROWS * CELL_H;
  const areaH  = window.innerHeight - HUD_H;
  return {
    x: Math.round((window.innerWidth - totalW) / 2),
    y: Math.round((areaH - totalH) / 2)
  };
}

function cellToPixel(col, row) {
  const o = getGridOrigin();
  return { x: o.x + col * CELL_W, y: o.y + row * CELL_H };
}

function pixelToCell(px, py) {
  const o = getGridOrigin();
  const col = Math.floor((px - o.x) / CELL_W);
  const row = Math.floor(((py - HUD_H) - o.y) / CELL_H);
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return null;
  return { col, row };
}

const State = {
  sun:        150,
  wave:       0,
  maxWaves:   5,
  paused:     false,
  gameOver:   false,
  started:    false,

  plants:     Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null)),
  lawnmowers: Array(GRID_ROWS).fill(null),
  zombies:    [],
  peas:       [],
  suns:       [],

  cursik: {
    x: 0, y: 0,
    dragZombieId: null,
    queue: [],
    busy:  false,
    targetX: 0, targetY: 0,
    el: null,
    bubbleEl: null,
  },

  nightMode:     false,
  _devPaused:    false,
  selectedPlant: null,
  nextZombieId: 0,
  nextPeaId:    0,
  nextSunId:    0,
  nextFileId:   0,

  droppedFiles:    [],
  _sysFolder:      null,
  _magnetBlocked:  {},

  _timers: {},
};

function rnd(min, max) { return min + Math.random() * (max - min); }
function rndInt(min, max) { return Math.floor(rnd(min, max + 1)); }

function gameTimer(key, fn, delay) {
  if (State._timers[key]) clearTimeout(State._timers[key]);
  State._timers[key] = setTimeout(() => {
    if (!State.paused && !State.gameOver) fn();
  }, delay);
}

function gameInterval(key, fn, interval) {
  if (State._timers[key]) clearInterval(State._timers[key]);
  State._timers[key] = setInterval(() => {
    if (!State.paused && !State.gameOver) fn();
  }, interval);
}

function clearAllTimers() {
  Object.values(State._timers).forEach(t => { clearTimeout(t); clearInterval(t); });
  State._timers = {};
}

const entitiesLayer = () => document.getElementById('entities-layer');
const sunsLayer     = () => document.getElementById('suns-layer');
const particlesLayer = () => document.getElementById('particles-layer');

function makeEl(tag, cls, parent) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (parent) parent.appendChild(el);
  return el;
}

function addFilenameLabel(parent, text, extraClass = '') {
  const label = makeEl('span', `icon-label entity-file-label ${extraClass}`.trim(), parent);
  label.textContent = text;
  return label;
}

function posEl(el, x, y) {
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
}

function spawnMiniCursik(parent) {
  const mc = makeEl('div', 'mini-cursik', parent || entitiesLayer());
  mc.style.position = 'absolute';
  const img = makeEl('img', null, mc);
  img.src = 'static/img/ui/курсик.png';
  img.draggable = false;
  img.onerror = () => { img.style.display = 'none'; };
  return mc;
}

function buildGrid() {
  const container = document.getElementById('grid-container');
  container.innerHTML = '';
  const o = getGridOrigin();
  container.style.left = o.x + 'px';
  container.style.top  = o.y + 'px';

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const cell = makeEl('div', 'grid-cell', container);
      cell.dataset.col = c;
      cell.dataset.row = r;
      cell.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (State.selectedPlant) {
          tryPlacePlant(State.selectedPlant, c, r);
        } else {
          removePlant(c, r);
        }
      });
    }
  }
}

function canPlacePlant(type, col, row) {
  if (!type || !PLANTS[type]) return false;
  if (State.paused || State.gameOver) return false;
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return false;
  if (State.sun < PLANTS[type].cost) return false;
  if (State.plants[row][col]) return false;
  return true;
}

function tryPlacePlant(type, col, row) {
  if (!type || !PLANTS[type]) return false;
  if (State.sun < PLANTS[type].cost) {
    flashSunCounter();
    return false;
  }

  if (type === 'unarchiver') {
    const plant = State.plants[row]?.[col];
    if (!plant || !plant.archived) return false;
    State.sun -= PLANTS[type].cost;
    unarchivePlant(col, row);
    spawnParticles(plant.el.offsetLeft + CELL_W/2, plant.el.offsetTop + CELL_H/2, '#f39c12', 8);
    UI.updateSun();
    UI.updatePlantBar();
    return true;
  }

  if (!canPlacePlant(type, col, row)) return false;
  placePlant(type, col, row);
  State.sun -= PLANTS[type].cost;
  UI.updateSun();
  UI.updatePlantBar();
  return true;
}

const PLANTS = {
  sunflower: {
    name: 'подсолнух.png',
    cost: 50,
    file: 'подсолнух.png',
    folder: 'plants',
    shootInterval: null,
    sunInterval: [6000, 9000],
    cooldown: 5000,
    displayName: 'подсолнух.png',
  },
  peashooter: {
    name: 'горохострел.png',
    cost: 75,
    file: 'горохострел.png',
    folder: 'plants',
    shootInterval: 2000,
    sunInterval: null,
    cooldown: 3000,
    displayName: 'горохострел.png',
  },
  folder_magnet: {
    name: 'папка-магнит.png',
    cost: 75,
    file: 'папка-магнит.png',
    folder: 'plants',
    shootInterval: null,
    sunInterval: null,
    cooldown: 6000,
    displayName: 'папка-магнит.png',
    attractRadius: 3,
    attractInterval: 6000,
  },
  siamese_peashooter: {
    name: 'сиамский-горохострел.png',
    cost: 125,
    file: 'сиамский-горохострел.png',
    folder: 'plants',
    shootInterval: 2200,
    sunInterval: null,
    cooldown: 5000,
    displayName: 'сиам-горохострел.png',
    shootsBothWays: true,
  },
  xsas_mushroom: {
    name: 'xsas-гриб.png',
    cost: 150,
    file: 'xsas-гриб.png',
    folder: 'plants',
    shootInterval: null,
    sunInterval: null,
    cooldown: 30000,
    displayName: 'xsas-гриб.png',
    isExplosive: true,
    explosionRadius: 2,
  },
  sun_mushroom: {
    name: 'солнце-гриб.png',
    cost: 25,
    file: 'солнце-гриб.png',
    folder: 'plants',
    shootInterval: null,
    sunInterval: [5000, 8000],
    cooldown: 4000,
    displayName: 'солнце-гриб.png',
    nightOnly: true,
    sunValue: 15,
  },
  unarchiver: {
    name: 'разархиватор.png',
    cost: 50,
    file: 'разархиватор.png',
    folder: 'plants',
    shootInterval: null,
    sunInterval: null,
    cooldown: 2000,
    displayName: 'разархиватор.png',
    isItem: true,
  },
};

function placePlant(type, col, row) {
  const pos = cellToPixel(col, row);
  const el = makeEl('div', 'plant-entity icon-entity', entitiesLayer());
  el.dataset.type = type;
  el.style.left   = pos.x + 'px';
  el.style.top    = pos.y + 'px';
  el.style.width  = CELL_W + 'px';
  el.style.height = CELL_H + 'px';
  el.style.position = 'absolute';

  const img = makeEl('img', 'icon-img', el);
  img.src = `static/img/plants/${PLANTS[type].file}`;
  img.alt = PLANTS[type].file;
  addFilenameLabel(el, PLANTS[type].displayName || PLANTS[type].file);
  img.draggable = false;
  img.onerror = () => {
    img.remove();
    el.classList.add('asset-missing', `asset-missing-${type}`);
  };

  const plantData = { type, col, row, el, hp: 3, archived: false };
  State.plants[row][col] = plantData;

  if (type === 'sunflower' || type === 'sun_mushroom') {
    scheduleSunflower(plantData);
  } else if (type === 'peashooter' || type === 'siamese_peashooter') {
    scheduleShoot(plantData);
  } else if (type === 'folder_magnet') {
    scheduleFolderMagnet(plantData);
  } else if (type === 'xsas_mushroom') {
    const bombKey = `xsas_${col}_${row}`;
    State._timers[bombKey] = setTimeout(() => {
      if (!State.plants[row][col]) return;
      triggerXSASExplosion(plantData);
    }, 3000);
  }

  el.style.transform = 'scale(0)';
  el.style.transition = 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)';
  requestAnimationFrame(() => { el.style.transform = 'scale(1)'; });

  spawnParticles(pos.x + CELL_W/2, pos.y + CELL_H/2, '#7fff00', 6);
}

function removePlant(col, row) {
  const p = State.plants[row][col];
  if (!p) return;
  p.el.remove();
  State.plants[row][col] = null;
  clearTimer(`plant_sun_${col}_${row}`);
  clearTimer(`plant_shoot_${col}_${row}`);
  clearTimer(`magnet_${col}_${row}`);
  clearTimer(`xsas_${col}_${row}`);
}

function clearTimer(key) {
  if (State._timers[key]) { clearTimeout(State._timers[key]); clearInterval(State._timers[key]); delete State._timers[key]; }
}

function scheduleSunflower(plant) {
  const cfg = PLANTS[plant.type] || PLANTS.sunflower;
  if (!cfg.sunInterval) return;

  if (cfg.nightOnly && !State.nightMode) return;
  if (plant.type === 'sunflower' && State.nightMode) return;

  const delay = rndInt(cfg.sunInterval[0], cfg.sunInterval[1]);
  const key = `plant_sun_${plant.col}_${plant.row}`;
  State._timers[key] = setTimeout(() => {
    if (!State.plants[plant.row][plant.col]) return;
    if (State.plants[plant.row][plant.col].archived) return;
    if (State.gameOver) return;
    if (State.paused) {
      scheduleSunflower(plant);
      return;
    }
    spawnPlantSun(plant);
    scheduleSunflower(plant);
  }, delay);
}

function spawnPlantSun(plant) {
  const pos = cellToPixel(plant.col, plant.row);
  const sx = pos.x + CELL_W / 2 - 25;
  const sy = pos.y + 20;
  const cfg = PLANTS[plant.type];
  const sunVal = cfg && cfg.sunValue ? cfg.sunValue : 25;
  spawnSun(sx, sy, false, sunVal);
  SFX.play('snd-sun');
}

function scheduleShoot(plant) {
  const cfg = PLANTS[plant.type] || PLANTS.peashooter;
  const key = `plant_shoot_${plant.col}_${plant.row}`;
  State._timers[key] = setInterval(() => {
    if (!State.plants[plant.row][plant.col]) { clearTimer(key); return; }
    if (State.plants[plant.row][plant.col].archived) return;
    if (State.paused || State.gameOver) return;
    const hasZombie = State.zombies.some(z => z.row === plant.row && z.alive);
    if (hasZombie) shootPea(plant, 1);
    if (cfg.shootsBothWays) {
      const hasZombieLeft = State.zombies.some(z => z.row === plant.row && z.alive && z.x < cellToPixel(plant.col, plant.row).x);
      if (hasZombieLeft) shootPea(plant, -1);
    }
  }, cfg.shootInterval || 2000);
}

function shootPea(plant, direction = 1) {
  const pos = cellToPixel(plant.col, plant.row);
  const el = makeEl('div', 'pea-entity icon-pea', entitiesLayer());
  el.style.position = 'absolute';
  const startX = direction > 0 ? pos.x + CELL_W : pos.x;
  const peaY = pos.y + CELL_H / 2 - 12;
  posEl(el, startX, peaY);

  const img = makeEl('img', null, el);
  img.draggable = false;
  img.onerror = () => {
    img.remove();
    el.classList.add('pea-fallback');
  };
  img.src = 'static/img/ui/горошина.png';
  if (direction < 0) img.style.transform = 'scaleX(-1)';

  addFilenameLabel(el, 'горошина.png', 'pea-file-label');
  const mc = spawnMiniCursik();
  posEl(mc, startX + (direction > 0 ? 10 : -10), peaY - 8);
  const id = State.nextPeaId++;
  const pea = { id, row: plant.row, x: startX, el, alive: true, mc, peaY, direction };
  State.peas.push(pea);
  SFX.play('snd-pea');
}

const SUN_FALL_STEP_PX = 16;
const SUN_FALL_STEP_MS = 250;

function spawnSun(x, y, falling = true, value = 25) {
  const el = makeEl('div', 'sun-entity icon-entity', sunsLayer());
  el.style.position = 'absolute';
  posEl(el, x, y);

  const img = makeEl('img', 'icon-img', el);
  img.src = 'static/img/ui/солнце.png';
  img.draggable = false;
  img.onerror = () => { img.remove(); const fb = makeEl('div', null, el); fb.textContent = '☀'; fb.style.fontSize='36px'; fb.style.width='48px'; fb.style.height='48px'; fb.style.textAlign='center'; };

  addFilenameLabel(el, 'солнце.png', 'sun-file-label');
  const mc = falling ? spawnMiniCursik(sunsLayer()) : null;
  if (mc) posEl(mc, x + 20, y - 10);
  const id = State.nextSunId++;
  const sun = { id, el, collected: false, y, falling, mc, value };
  State.suns.push(sun);

  if (falling) {
    const targetY = y + rnd(200, 400);
    const fallKey = `sun_fall_${id}`;
    function fallStep() {
      if (sun.collected || State.gameOver) return;
      if (State.paused) { State._timers[fallKey] = setTimeout(fallStep, 100); return; }
      sun.y += SUN_FALL_STEP_PX;
      posEl(sun.el, x, sun.y);
      if (sun.mc) posEl(sun.mc, x + 20, sun.y - 10);
      if (sun.y < targetY) {
        State._timers[fallKey] = setTimeout(fallStep, SUN_FALL_STEP_MS);
      } else {
        if (sun.mc) sun.mc.remove();
        sun.mc = null;
      }
    }
    State._timers[fallKey] = setTimeout(fallStep, SUN_FALL_STEP_MS);
  }

  el.addEventListener('click', () => collectSun(sun));
  setTimeout(() => { if (!sun.collected) removeSun(sun); }, 8000);
}

function spawnFallingSun() {
  const x = rnd(80, window.innerWidth - 80);
  const y = 20;
  spawnSun(x, y, true);
}

function collectSun(sun) {
  if (sun.collected) return;
  sun.collected = true;
  sun.el.classList.add('sun-collect');
  if (sun.mc) { sun.mc.remove(); sun.mc = null; }
  State.sun += sun.value || 25;
  UI.updateSun();
  SFX.play('snd-sun');
  setTimeout(() => removeSun(sun), 200);
}

function removeSun(sun) {
  sun.el.remove();
  if (sun.mc) { sun.mc.remove(); sun.mc = null; }
  State.suns = State.suns.filter(s => s.id !== sun.id);
}

function dropSystemFile(x, y, row) {
  const el = makeEl('div', 'dropped-file-entity icon-entity', sunsLayer());
  el.style.position = 'absolute';
  posEl(el, x, y);

  const img = makeEl('img', 'icon-img', el);
  img.src = 'static/img/other/sys.png';
  img.draggable = false;
  img.onerror = () => { img.remove(); el.textContent = '📄'; el.style.fontSize = '36px'; };

  addFilenameLabel(el, 'sys.dll');

  const id = State.nextFileId++;
  const file = { id, x, y, row, el, collected: false };
  State.droppedFiles.push(file);

  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (State.paused || State.gameOver) return;
    UI.startFileDrag(file, e);
  });

  el.style.transform = 'scale(0) translateY(-20px)';
  el.style.transition = 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)';
  requestAnimationFrame(() => { el.style.transform = 'scale(1) translateY(0)'; });

  SFX.play('snd-sun');
  return file;
}

function removeDroppedFile(file) {
  file.collected = true;
  file.el.remove();
  State.droppedFiles = State.droppedFiles.filter(f => f.id !== file.id);
}

function checkWinrarFileCollision() {
  if (State.droppedFiles.length === 0) return;
  for (const z of State.zombies) {
    if (!z.alive || !z.canArchive) continue;
    for (const file of State.droppedFiles) {
      if (file.collected) continue;
      if (file.row === z.row && Math.abs(z.x - file.x) < CELL_W * 0.8) {
        spawnParticles(file.x + 24, file.y + 20, '#ff0000', 15);
        Game.triggerGameOver(null, 'winrar_file_collision');
        return;
      }
    }
  }
}

const ZOMBIE_TYPES = {
  zombie:      { name: 'зомби.webp', file: 'зомби.webp', hp: [5, 7], speed: 0.6, displayName: 'зомби.webp' },
  zombie_copy: { name: 'зомби-копия.webp', file: 'зомби-копия.webp', hp: [5, 7], speed: 0.6, displayName: 'зомби-копия.webp' },
  your_death:  { name: 'ваша-смерть.png', file: 'ваша-смерть.png', hp: 999, speed: 0.3, isBoss: true, displayName: 'ваша-смерть.png' },
  system_zombie: {
    name: 'систем-зомби.png', file: 'систем-зомби.png', displayName: 'систем-зомби.png',
    hp: [5, 7], speed: 0.6,
    hasSystemFile: true, fileHp: 4,
  },
  hdd_zombie: {
    name: 'хдд-зомби.png', file: 'хдд-зомби.png', displayName: 'хдд-зомби.png',
    hp: [10, 12], speed: 0.4,
    armorHits: 3, armorType: 'hdd',
  },
  ssd_zombie: {
    name: 'ссд-зомби.png', file: 'ссд-зомби.png', displayName: 'ссд-зомби.png',
    hp: [3, 5], speed: 0.8,
    armorHits: 2, armorType: 'ssd',
  },
  winrar_zombie: {
    name: 'winrar-зомби.png', file: 'winrar-зомби.png', displayName: 'winrar-зомби.png',
    hp: [5, 7], speed: 0.5,
    canArchive: true,
  },
};

function spawnZombie(type, row) {
  const cfg = ZOMBIE_TYPES[type];
  const maxHp = Array.isArray(cfg.hp) ? rndInt(cfg.hp[0], cfg.hp[1]) : cfg.hp;
  const rightEdge = getGridOrigin().x + GRID_COLS * CELL_W;
  const startX = rightEdge + 80;
  const pos = cellToPixel(GRID_COLS - 1, row);
  const y = pos.y + CELL_H/2 - 48;

  const el = makeEl('div', 'zombie-entity icon-entity', entitiesLayer());
  el.dataset.type = type;
  el.style.position = 'absolute';
  posEl(el, startX, y);

  const img = makeEl('img', 'icon-img', el);
  img.src = `static/img/zombies/${cfg.file}`;
  img.alt = cfg.file;
  img.draggable = false;
  img.onerror = () => { el.textContent = '🧟'; el.style.fontSize = '60px'; };

  addFilenameLabel(el, cfg.displayName || cfg.file);

  const hpBar = makeEl('div', 'zombie-hp-bar', el);
  const hpChrome = makeEl('div', 'zombie-hp-chrome', hpBar);
  const hpFill = makeEl('div', 'zombie-hp-fill', hpChrome);
  const hpText = makeEl('span', 'zombie-hp-text', hpBar);
  hpFill.style.width = '100%';
  hpText.textContent = '100%';

  const id = State.nextZombieId++;
  const zombie = {
    id, type, row,
    x: startX, y,
    hp: maxHp, maxHp,
    speed: cfg.speed,
    isBoss: cfg.isBoss || false,
    alive: true,
    el, hpFill, hpText,
    selected: false,
    reachedEnd: false,
    hasSystemFile: cfg.hasSystemFile || false,
    fileHp: cfg.fileHp || 0,
    armorHits: cfg.armorHits || 0,
    armorType: cfg.armorType || null,
    armorBroken: false,
    canArchive: cfg.canArchive || false,
    _archiveTimer: null,
    abilitiesDisabled: false,
  };

  if (zombie.hasSystemFile) {
    zombie._fileEl = null;
  }

  if (zombie.armorType) {
    zombie._armorEl = null;
  }

  State.zombies.push(zombie);

  State.cursik.queue.push(id);
  if (!State.cursik.busy) processCursikQueue();

  return zombie;
}

function damageZombie(zombie, dmg) {
  if (!zombie.alive) return;

  if (zombie.armorType && !zombie.armorBroken && zombie.armorHits > 0) {
    zombie.armorHits -= dmg;
    if (zombie.armorHits <= 0) {
      zombie.armorBroken = true;
      if (zombie._armorEl) { zombie._armorEl.remove(); zombie._armorEl = null; }
      const img = zombie.el.querySelector('.icon-img');
      if (img) img.src = 'static/img/zombies/зомби.webp';
      spawnParticles(zombie.x + 40, zombie.y + 30, '#888', 6);
    }
    return;
  }

  zombie.hp = Math.max(0, zombie.hp - dmg);
  const pct = (zombie.hp / zombie.maxHp) * 100;
  zombie.hpFill.style.width = pct + '%';
  if (zombie.hpText) zombie.hpText.textContent = Math.max(0, Math.round(pct)) + '%';

  if (zombie.hp <= 0) killZombie(zombie);
}

function killZombie(zombie) {
  zombie.alive = false;

  if (zombie.hasSystemFile && zombie.fileHp > 0) {
    zombie.hasSystemFile = false;
    zombie.fileHp = 0;
    if (zombie._fileEl) { zombie._fileEl.remove(); zombie._fileEl = null; }
    spawnParticles(zombie.x + 40, zombie.y + 20, '#ff0000', 15);
    Game.triggerGameOver(null, 'system_file_destroyed');
    return;
  }

  spawnParticles(zombie.x + 40, zombie.y + 50, '#8fbc8f', 10);
  zombie.el.style.transition = 'opacity 0.3s, transform 0.3s';
  zombie.el.style.opacity = '0';
  zombie.el.style.transform = 'scale(0.5) translateY(20px)';

  State.cursik.queue = State.cursik.queue.filter(id => id !== zombie.id);

  if (State.cursik.dragZombieId === zombie.id) {
    State.cursik.dragZombieId = null;
    State.cursik.busy = false;
    State.cursik.el.classList.remove('dragging');
    setTimeout(processCursikQueue, CURSIK_COOLDOWN);
  }

  setTimeout(() => {
    zombie.el.remove();
    State.zombies = State.zombies.filter(z => z.id !== zombie.id);
  }, 350);
}

const CURSIK_COOLDOWN  = 200;
const CURSIK_DRAG_TIME = 500;

function processCursikQueue() {
  if (State.cursik.busy) return;
  if (State.cursik.queue.length === 0) return;
  if (State.gameOver) return;
  if (State.paused) {
    setTimeout(processCursikQueue, 300);
    return;
  }

  const zombieId = State.cursik.queue[0];
  const zombie = State.zombies.find(z => z.id === zombieId);

  if (!zombie || !zombie.alive) {
    State.cursik.queue.shift();
    setTimeout(processCursikQueue, CURSIK_COOLDOWN);
    return;
  }

  const o = getGridOrigin();

  const zombieCol = Math.floor((zombie.x - o.x) / CELL_W);
  if (zombieCol >= 0 && zombieCol < GRID_COLS) {
    const plant = State.plants[zombie.row][zombieCol];
    if (plant) {
      State.cursik.queue.shift();
      State.cursik.queue.push(zombieId);
      setTimeout(processCursikQueue, 500);
      return;
    }
  }

  State.cursik.busy = true;
  State.cursik.dragZombieId = zombie.id;

  zombie.el.classList.add('selected');
  zombie.selected = true;

  moveCursikTo(zombie.x + 37, zombie.y + 48, () => {
    if (!zombie.alive) {
      State.cursik.dragZombieId = null;
      State.cursik.busy = false;
      State.cursik.el.classList.remove('dragging');
      setTimeout(processCursikQueue, CURSIK_COOLDOWN);
      return;
    }

    const targetX = Math.max(zombie.x - CELL_W, o.x - CELL_W);

    animateZombieMove(zombie, targetX, CURSIK_DRAG_TIME, () => {
      if (zombie.el && zombie.el.parentNode) {
        zombie.el.classList.remove('selected');
      }
      zombie.selected = false;
      State.cursik.el.classList.remove('dragging');
      State.cursik.dragZombieId = null;

      if (zombie.alive) checkZombieRow(zombie);

      const movedId = State.cursik.queue.shift();
      if (zombie.alive && zombie.x > o.x - CELL_W) {
        State.cursik.queue.push(movedId);
      }
      State.cursik.busy = false;

      setTimeout(processCursikQueue, CURSIK_COOLDOWN);
    });
  }, true);
}

const CURSIK_STEP_PX = 40;
const CURSIK_STEP_MS = 30;

function moveCursikTo(tx, ty, cb, dragging = true) {
  const ck = State.cursik;
  const startX = ck.x, startY = ck.y;
  const dx = tx - startX;
  const dy = ty - startY;
  const dist = Math.sqrt(dx*dx + dy*dy);
  const steps = Math.max(1, Math.ceil(dist / CURSIK_STEP_PX));
  let step = 0;

  function tick() {
    if (State.paused) { setTimeout(tick, 100); return; }
    step++;
    const t = step / steps;
    ck.x = startX + dx * t;
    ck.y = startY + dy * t;
    posEl(ck.el, ck.x - 20, ck.y - 20);

    if (step < steps) {
      setTimeout(tick, CURSIK_STEP_MS);
    } else {
      if (dragging) ck.el.classList.add('dragging');
      else ck.el.classList.remove('dragging');
      cb && cb();
    }
  }
  setTimeout(tick, CURSIK_STEP_MS);
}

function moveCursikToPoint(tx, ty, cb) {
  moveCursikTo(tx, ty, cb, false);
}

const DRAG_STEP_PX = 22;
const DRAG_STEP_MS = 140;

function animateZombieMove(zombie, targetX, duration, cb) {
  const ck = State.cursik;
  const dir = targetX < zombie.x ? -1 : 1;

  function dragStep() {
    if (!zombie.alive || zombie.reachedEnd) {
      ck.el.classList.remove('dragging');
      cb && cb();
      return;
    }
    if (State.paused) { setTimeout(dragStep, 100); return; }
    if (State.gameOver) { cb && cb(); return; }

    const remaining = Math.abs(targetX - zombie.x);
    const step = Math.min(DRAG_STEP_PX, remaining);
    zombie.x += dir * step;
    posEl(zombie.el, zombie.x, zombie.y);

    ck.x = zombie.x + 37;
    ck.y = zombie.y + 48;
    posEl(ck.el, ck.x - 20, ck.y - 20);

    if (remaining > 1) {
      setTimeout(dragStep, DRAG_STEP_MS);
    } else {
      cb && cb();
    }
  }
  setTimeout(dragStep, DRAG_STEP_MS);
}

function spawnLawnmowers() {
  for (let row = 0; row < GRID_ROWS; row++) {
    spawnLawnmower(row);
  }
}

function spawnLawnmower(row) {
  const o = getGridOrigin();
  const x = o.x - 80;
  const y = o.y + row * CELL_H + CELL_H/2 - 30;

  const el = makeEl('div', 'lawnmower-entity icon-entity', entitiesLayer());
  el.style.position = 'absolute';
  posEl(el, x, y);

  const img = makeEl('img', 'icon-img', el);
  img.src = 'static/img/ui/косилка.png';
  img.draggable = false;
  img.onerror = () => { img.remove(); const fb = makeEl('div', null, el); fb.textContent = '🚜'; fb.style.fontSize='36px'; fb.style.width='48px'; fb.style.height='48px'; fb.style.textAlign='center'; };

  addFilenameLabel(el, 'косилка.png', 'mower-file-label');
  const data = { row, x, y, running: false, el, alive: true };
  State.lawnmowers[row] = data;

  el.style.opacity = '0';
  el.style.transition = 'opacity 0.5s, transform 0.5s';
  el.style.transform = 'translateX(-20px)';
  setTimeout(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateX(0)';
  }, row * 200 + 100);
}

function triggerLawnmower(row) {
  const mower = State.lawnmowers[row];
  if (!mower || mower.running || !mower.alive) return;
  mower.running = true;
  mower.el.classList.add('running');
  SFX.play('snd-lawnmower');

  const mc = spawnMiniCursik();
  posEl(mc, mower.x + 30, mower.y - 8);

  function moveMower() {
    if (State.paused) { setTimeout(moveMower, 100); return; }
    mower.x += CELL_W;
    posEl(mower.el, mower.x, mower.y);
    posEl(mc, mower.x + 30, mower.y - 8);

    State.zombies.filter(z => z.alive && !z.isBoss && z.row === row).forEach(z => {
      if (Math.abs(z.x - mower.x) < CELL_W) {
        spawnParticles(z.x + 40, z.y + 40, '#e74c3c', 12);
        killZombie(z);
      }
    });

    const rightEdge = getGridOrigin().x + GRID_COLS * CELL_W + 200;
    if (mower.x < rightEdge) {
      setTimeout(moveMower, 180);
    } else {
      mower.el.remove();
      mc.remove();
      mower.alive = false;
    }
  }
  setTimeout(moveMower, 180);
}

function checkZombieRow(zombie) {
  if (!zombie.alive || zombie.reachedEnd) return;
  const o = getGridOrigin();
  if (zombie.x <= o.x - 20) {
    const mower = State.lawnmowers[zombie.row];
    if (mower && !mower.running && mower.alive) {
      zombie.reachedEnd = true;
      State.cursik.queue = State.cursik.queue.filter(id => id !== zombie.id);
      if (State.cursik.dragZombieId === zombie.id) {
        State.cursik.dragZombieId = null;
        State.cursik.busy = false;
        State.cursik.el.classList.remove('dragging');
        zombie.el.classList.remove('selected');
        zombie.selected = false;
        setTimeout(processCursikQueue, CURSIK_COOLDOWN);
      }
      triggerLawnmower(zombie.row);
    } else if (!mower || !mower.alive) {
      zombie.reachedEnd = true;
      Game.triggerGameOver(zombie);
    }
  }
}

const PEA_STEP_PX = 30;
const PEA_STEP_MS = 100;

function updatePeas(dt) {
  for (let i = State.peas.length - 1; i >= 0; i--) {
    const pea = State.peas[i];
    if (!pea.alive) continue;
    const dir = pea.direction || 1;

    pea._stepAcc = (pea._stepAcc || 0) + dt;
    if (pea._stepAcc >= PEA_STEP_MS) {
      pea._stepAcc -= PEA_STEP_MS;
      pea.x += PEA_STEP_PX * dir;
      posEl(pea.el, pea.x, pea.peaY);
      if (pea.mc) posEl(pea.mc, pea.x + 10 * dir, pea.peaY - 8);
    }

    let hit = false;
    for (const z of State.zombies) {
      if (!z.alive) continue;
      if (z.row !== pea.row) continue;
      if (Math.abs(z.x - pea.x) < 50) {
        damageZombie(z, 1);
        hit = true;
        spawnParticles(pea.x, pea.peaY, '#7fff00', 4);
        break;
      }
    }

    const o = getGridOrigin();
    const rightEdge = o.x + GRID_COLS * CELL_W + 80;
    const leftEdge = o.x - 80;
    if (hit || pea.x > rightEdge || pea.x < leftEdge) {
      pea.alive = false;
      pea.el.remove();
      if (pea.mc) pea.mc.remove();
      State.peas.splice(i, 1);
    }
  }
}

function updateZombies(dt) {
  const o = getGridOrigin();
  const leftEdge = o.x - 20;
  for (const z of State.zombies) {
    if (!z.alive) continue;
    if (z.x <= leftEdge) {
      checkZombieRow(z);
    }
  }
}

let lastTime = 0;

function gameLoop(ts) {
  if (State.gameOver) return;
  const dt = Math.min(ts - lastTime, 50);
  lastTime = ts;

  if (!State.paused) {
    updateZombies(dt);
    updatePeas(dt);
    updateCursikIdle();
    checkPlantsEaten();
    checkWinrarFileCollision();
    checkWaveComplete();
  }

  requestAnimationFrame(gameLoop);
}

function startGameLoop() {
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function updateCursikIdle() {
  if (!State.cursik.busy && State.cursik.queue.length === 0) {
    const t = Date.now() / 1000;
    const bx = State.cursik.x + Math.sin(t * 1.2) * 0.5;
    const by = State.cursik.y + Math.cos(t * 0.8) * 0.5;
    posEl(State.cursik.el, bx - 20, by - 20);
  }
}

function scheduleFolderMagnet(plant) {
  const cfg = PLANTS.folder_magnet;
  const key = `magnet_${plant.col}_${plant.row}`;
  State._timers[key] = setInterval(() => {
    if (!State.plants[plant.row][plant.col]) { clearTimer(key); return; }
    if (State.plants[plant.row][plant.col].archived) return;
    if (State.paused || State.gameOver) return;

    const magnetKey = `${plant.col}_${plant.row}`;
    if (State._magnetBlocked[magnetKey]) return;

    const plantPos = cellToPixel(plant.col, plant.row);
    for (const z of State.zombies) {
      if (!z.alive) continue;
      if (!z.hasSystemFile || z.fileHp <= 0) continue;
      const distX = Math.abs(z.x - plantPos.x) / CELL_W;
      const distY = Math.abs(z.row - plant.row);
      if (distX <= cfg.attractRadius && distY <= cfg.attractRadius) {
        z.hasSystemFile = false;
        z.fileHp = 0;
        if (z._fileEl) { z._fileEl.remove(); z._fileEl = null; }
        const imgEl = z.el.querySelector('.icon-img');
        if (imgEl) imgEl.src = 'static/img/zombies/зомби.webp';
        const zCol = Math.round((z.x - getGridOrigin().x) / CELL_W);
        const zPos = cellToPixel(Math.max(0, Math.min(GRID_COLS - 1, zCol)), z.row);
        dropSystemFile(zPos.x + CELL_W / 2 - 24, zPos.y + CELL_H / 2 - 24, z.row);
        State._magnetBlocked[magnetKey] = true;
        spawnParticles(plantPos.x + CELL_W/2, plantPos.y + CELL_H/2, '#4488ff', 8);
        SFX.play('snd-sun');
        break;
      }
    }
  }, cfg.attractInterval);
}

function triggerXSASExplosion(plant) {
  const cx = plant.col;
  const cy = plant.row;
  const radius = PLANTS.xsas_mushroom.explosionRadius;
  const pos = cellToPixel(cx, cy);

  removePlant(cx, cy);

  spawnParticles(pos.x + CELL_W/2, pos.y + CELL_H/2, '#ff00ff', 20);
  spawnParticles(pos.x + CELL_W/2, pos.y + CELL_H/2, '#ff6600', 15);
  SFX.play('snd-explosion');

  const o = getGridOrigin();
  for (const z of State.zombies) {
    if (!z.alive || z.isBoss) continue;
    const zCol = Math.floor((z.x - o.x) / CELL_W);
    const zRow = z.row;
    if (Math.abs(zCol - cx) <= radius && Math.abs(zRow - cy) <= radius) {
      damageZombie(z, 999);
    }
  }

  const artifactDuration = 30000;
  const screenW = window.innerWidth;
  const screenH = window.innerHeight;

  for (let r = cy - radius; r <= cy + radius; r++) {
    for (let c = cx - radius; c <= cx + radius; c++) {
      if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS) continue;
      const cp = cellToPixel(c, r);
      const count = rndInt(5, 8);
      for (let i = 0; i < count; i++) {
        const artifact = makeEl('div', 'xsas-artifact', entitiesLayer());
        artifact.style.position = 'absolute';
        artifact.style.left = (cp.x + rnd(-10, CELL_W + 10)) + 'px';
        artifact.style.top = (cp.y + rnd(-10, CELL_H + 10)) + 'px';
        const size = rndInt(15, 60);
        artifact.style.width = size + 'px';
        artifact.style.height = rndInt(8, 45) + 'px';
        artifact.style.background = ['#ff00ff','#00ffff','#ff6600','#ffff00','#00ff00','#ff0000','#0000ff','#ffffff'][rndInt(0,7)];
        artifact.style.opacity = String(rnd(0.4, 0.95));
        artifact.style.zIndex = '40';
        setTimeout(() => artifact.remove(), artifactDuration + rndInt(0, 5000));
      }
    }
  }

  for (let i = 0; i < rndInt(8, 15); i++) {
    const strip = makeEl('div', 'xsas-artifact xsas-strip', entitiesLayer());
    strip.style.position = 'fixed';
    strip.style.left = '0';
    strip.style.top = rnd(0, screenH) + 'px';
    strip.style.width = screenW + 'px';
    strip.style.height = rndInt(2, 8) + 'px';
    strip.style.background = ['#ff00ff','#00ffff','#ff6600','#ffff00'][rndInt(0,3)];
    strip.style.opacity = String(rnd(0.3, 0.7));
    strip.style.zIndex = '45';
    strip.style.pointerEvents = 'none';
    strip.style.mixBlendMode = 'screen';
    setTimeout(() => strip.remove(), artifactDuration + rndInt(0, 8000));
  }

  for (let i = 0; i < rndInt(20, 35); i++) {
    const artifact = makeEl('div', 'xsas-artifact', entitiesLayer());
    artifact.style.position = 'fixed';
    artifact.style.left = rnd(0, screenW) + 'px';
    artifact.style.top = rnd(0, screenH) + 'px';
    const size = rndInt(10, 50);
    artifact.style.width = size + 'px';
    artifact.style.height = rndInt(6, 35) + 'px';
    artifact.style.background = ['#ff00ff','#00ffff','#ff6600','#ffff00','#00ff00','#ff0000'][rndInt(0,5)];
    artifact.style.opacity = String(rnd(0.2, 0.6));
    artifact.style.zIndex = '38';
    artifact.style.pointerEvents = 'none';
    setTimeout(() => artifact.remove(), artifactDuration + rndInt(0, 10000));
  }
}

function checkPlantsEaten() {
  State.zombies.filter(z => z.alive).forEach(zombie => {
    const o = getGridOrigin();
    const col = Math.floor((zombie.x - o.x) / CELL_W);
    if (col < 0 || col >= GRID_COLS) return;

    const plant = State.plants[zombie.row][col];
    if (plant) {
      if (zombie.canArchive && !zombie.abilitiesDisabled && !zombie._archiveTimer && !plant.archived) {
        zombie._archiveTimer = setTimeout(() => {
          if (!zombie.alive || State.gameOver) { zombie._archiveTimer = null; return; }
          const p = State.plants[zombie.row][col];
          if (p && !p.archived) {
            p.archived = true;
            const img = p.el.querySelector('.icon-img');
            if (img) img.src = 'static/img/other/winrar.jpg';
            p.el.style.opacity = '0.85';
            clearTimer(`plant_sun_${col}_${zombie.row}`);
            clearTimer(`plant_shoot_${col}_${zombie.row}`);
            addFilenameLabel(p.el, '.rar', 'archive-label');
          }
          zombie._archiveTimer = null;
        }, 2000);
      }

      if (zombie.canArchive) return;

      if (!zombie._eatTimer) {
        zombie._eatTimer = setInterval(() => {
          if (!zombie.alive) { clearInterval(zombie._eatTimer); zombie._eatTimer = null; return; }
          if (State.paused || State.gameOver) return;
          const p = State.plants[zombie.row][col];
          if (!p) { clearInterval(zombie._eatTimer); zombie._eatTimer = null; return; }
          p.hp--;
          if (p.hp <= 0) showDeleteDialog(col, zombie.row, p);
        }, 2000);
      }
    } else {
      if (zombie._eatTimer) { clearInterval(zombie._eatTimer); zombie._eatTimer = null; }
      if (zombie._archiveTimer) { clearTimeout(zombie._archiveTimer); zombie._archiveTimer = null; }
    }
  });
}

function unarchivePlant(col, row) {
  const plant = State.plants[row][col];
  if (!plant || !plant.archived) return false;
  plant.archived = false;
  const img = plant.el.querySelector('.icon-img');
  if (img) img.src = `static/img/plants/${PLANTS[plant.type].file}`;
  plant.el.style.filter = '';
  plant.el.style.opacity = '';
  const archLabel = plant.el.querySelector('.archive-label');
  if (archLabel) archLabel.remove();
  if (plant.type === 'sunflower') scheduleSunflower(plant);
  else if (plant.type === 'peashooter') scheduleShoot(plant);
  else if (plant.type === 'siamese_peashooter') scheduleShoot(plant);
  return true;
}

function checkWaveComplete() {
}

function showDeleteDialog(col, row, plant) {
  const pos = cellToPixel(col, row);
  const fileName = PLANTS[plant.type]?.displayName || PLANTS[plant.type]?.file || 'файл';

  const dialog = makeEl('div', 'win-delete-dialog', entitiesLayer());
  dialog.style.position = 'absolute';
  dialog.style.left = (pos.x - 20) + 'px';
  dialog.style.top = (pos.y - 40) + 'px';
  dialog.style.zIndex = '50';

  dialog.innerHTML =
    '<div class="win-delete-titlebar">' +
      '<span>Подтверждение удаления</span>' +
      '<span class="win-delete-x">✕</span>' +
    '</div>' +
    '<div class="win-delete-body">' +
      '<span class="win-delete-icon">🗑️</span>' +
      '<span>Удалить «' + fileName + '»?</span>' +
    '</div>' +
    '<div class="win-delete-buttons">' +
      '<button class="win-delete-btn active">Удалить</button>' +
      '<button class="win-delete-btn">Отмена</button>' +
    '</div>';

  const mc = spawnMiniCursik(entitiesLayer());
  mc.style.zIndex = '51';
  const btnX = pos.x + 10;
  const btnY = pos.y + 40;
  posEl(mc, pos.x + 80, pos.y - 50);

  setTimeout(() => {
    posEl(mc, btnX, btnY);
    mc.style.transition = 'left 0.3s ease, top 0.3s ease';
  }, 200);

  setTimeout(() => {
    const btn = dialog.querySelector('.win-delete-btn.active');
    if (btn) btn.classList.add('pressed');
    SFX.play('snd-sun');

    setTimeout(() => {
      removePlant(col, row);
      spawnParticles(pos.x + CELL_W / 2, pos.y + CELL_H / 2, '#e74c3c', 8);
      dialog.style.transition = 'opacity 0.2s, transform 0.2s';
      dialog.style.opacity = '0';
      dialog.style.transform = 'scale(0.8)';
      mc.remove();
      setTimeout(() => dialog.remove(), 250);
    }, 300);
  }, 600);
}

function spawnParticles(x, y, color, count) {
  const layer = particlesLayer();
  for (let i = 0; i < count; i++) {
    const el = makeEl('div', 'particle', layer);
    el.style.position = 'absolute';
    el.style.width = el.style.height = rndInt(4, 8) + 'px';
    el.style.background = color;
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    const tx = rnd(-50, 50);
    const ty = rnd(-70, -20);
    el.style.setProperty('--tx', tx + 'px');
    el.style.setProperty('--ty', ty + 'px');
    el.style.setProperty('--dur', rnd(0.5, 1.2) + 's');
    el.style.animationDelay = rnd(0, 0.1) + 's';
    setTimeout(() => el.remove(), 1500);
  }
}

function flashSunCounter() {
  const el = document.getElementById('sun-counter');
  el.style.transition = 'none';
  el.style.borderColor = '#e74c3c';
  el.style.boxShadow = '0 0 12px rgba(231,76,60,0.5)';
  setTimeout(() => {
    el.style.transition = 'border-color 0.3s, box-shadow 0.3s';
    el.style.borderColor = '#ffd700';
    el.style.boxShadow = '';
  }, 400);
}

window.Engine = {
  State,
  PLANTS,
  ZOMBIE_TYPES,
  buildGrid,
  cellToPixel,
  pixelToCell,
  getGridOrigin,
  spawnZombie,
  spawnLawnmowers,
  spawnLawnmower,
  spawnSun,
  spawnFallingSun,
  placePlant,
  removePlant,
  unarchivePlant,
  killZombie,
  damageZombie,
  spawnParticles,
  startGameLoop,
  moveCursikTo,
  moveCursikToPoint,
  canPlacePlant,
  tryPlacePlant,
  triggerLawnmower,
  dropSystemFile,
  removeDroppedFile,
  posEl,
  rnd, rndInt,
  gameTimer, gameInterval, clearAllTimers, clearTimer,
  CELL_W, CELL_H, GRID_COLS, GRID_ROWS, HUD_H,
};
