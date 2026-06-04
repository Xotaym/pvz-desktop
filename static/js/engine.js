"use strict";

const GameLog = {
  _buffer: [],
  _flushInterval: null,
  _maxBuffer: 30,
  _flushMs: 2000,

  init() {
    this._flushInterval = setInterval(() => this.flush(), this._flushMs);
    this.log('SYSTEM', 'GameLog initialized');
  },

  log(category, msg) {
    const ts = new Date().toLocaleTimeString('ru-RU', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
    const line = `[${ts}] [${category}] ${msg}`;
    this._buffer.push(line);
    if (this._buffer.length >= this._maxBuffer) this.flush();
  },

  flush() {
    if (this._buffer.length === 0) return;
    const lines = this._buffer.splice(0);
    fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines }),
    }).catch(() => {});
  },

  clear() {
    return fetch('/api/log/clear', { method: 'POST' })
      .then(r => r.json())
      .catch(() => ({ ok: false }));
  },
};

window.GameLog = GameLog;

const GRID_COLS  = 9;
const GRID_ROWS  = 5;
const CELL_W     = 110;
const CELL_H     = 110;
const HUD_H      = 90;
const MOBILE_BP  = 768;
const CONTENT_BLEED_X = 140;
const CONTENT_BLEED_Y = 24;
let _scaleFactor = 1;

function getScale() { return _scaleFactor; }

function editorInsets() {
  if (!document.body.classList.contains('editor-mode')) return null;
  const vw = window.innerWidth, vh = window.innerHeight;
  const compact = vw < MOBILE_BP || vh <= 540;
  if (!compact) return null;
  const b = document.body.classList;
  return {
    top: 6,
    bottom: b.contains('ed-m-deck-open') ? 86 : 44,
    left: 74,
    right: b.contains('ed-m-dock-open') ? 72 : 8
  };
}

function updateScale() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const gw = document.getElementById('game-world');
  const isTouchLike = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const isAndroidLike = /Android/i.test(navigator.userAgent || '');
  const ed = editorInsets();
  const shouldScaleMobile = vw < MOBILE_BP || vh < 820 || ((isTouchLike || isAndroidLike) && vh < 900) || !!ed;

  invalidateGridOrigin();
  if (!shouldScaleMobile) {
    _scaleFactor = 1;
    if (gw) {
      gw.style.transform = '';
      gw.style.transformOrigin = '';
      gw.style.width = '';
      gw.style.height = '';
      gw.style.marginTop = '';
      gw.style.marginLeft = '';
    }
    document.documentElement.style.setProperty('--game-scale', '1');
    document.documentElement.style.setProperty('--game-scale-inv', '1');
    return;
  }
  const topInset = ed ? ed.top : 38;
  const bottomInset = ed ? ed.bottom : 62;
  const leftInset = ed ? (ed.left || 0) : 0;
  const rightInset = ed ? (ed.right || 0) : 0;
  const availH = window.innerHeight - topInset - bottomInset;
  const availW = vw - leftInset - rightInset;
  const contentW = GRID_COLS * CELL_W + CONTENT_BLEED_X * 2;
  const contentH = GRID_ROWS * CELL_H + CONTENT_BLEED_Y * 2;
  const scaleW = availW / contentW;
  const scaleH = availH / contentH;
  _scaleFactor = Math.min(scaleW, scaleH, 1);
  _scaleFactor = Math.max(_scaleFactor, 0.3);
  if (gw) {
    const widthPx = Math.ceil(availW / _scaleFactor) + 2;
    const heightPx = Math.ceil(availH / _scaleFactor) + 2;
    gw.style.width = widthPx + 'px';
    gw.style.height = heightPx + 'px';
    gw.style.transform = 'scale(' + _scaleFactor + ')';
    gw.style.transformOrigin = 'top left';
    gw.style.marginTop = ed ? (topInset + 'px') : '';
    gw.style.marginLeft = ed && leftInset ? (leftInset + 'px') : '';
  }
  document.documentElement.style.setProperty('--game-scale', String(_scaleFactor));
  document.documentElement.style.setProperty('--game-scale-inv', String(1 / _scaleFactor));
}

function viewportToGame(cx, cy) {
  if (_scaleFactor === 1) return { x: cx, y: cy - HUD_H };
  const gw = document.getElementById('game-world');
  if (!gw) return { x: cx / _scaleFactor, y: cy / _scaleFactor };
  const rect = gw.getBoundingClientRect();
  return {
    x: (cx - rect.left) / _scaleFactor,
    y: (cy - rect.top) / _scaleFactor
  };
}

var _gridOriginCache = null;
var _gridOriginKey = '';
function invalidateGridOrigin() { _gridOriginCache = null; _gridOriginKey = ''; }
function getGridOrigin() {
  const key = window.innerWidth + 'x' + window.innerHeight + '@' + _scaleFactor;
  if (_gridOriginCache && _gridOriginKey === key) return _gridOriginCache;
  const totalW = GRID_COLS * CELL_W;
  const totalH = GRID_ROWS * CELL_H;
  const ed = editorInsets();
  var areaW, areaH;
  if (_scaleFactor < 1) {
    const topInset = ed ? ed.top : 38;
    const bottomInset = ed ? ed.bottom : 62;
    const hInset = ed ? ((ed.left || 0) + (ed.right || 0)) : 0;
    areaW = (window.innerWidth - hInset) / _scaleFactor;
    areaH = (window.innerHeight - topInset - bottomInset) / _scaleFactor;
  } else if (ed) {
    areaW = window.innerWidth - (ed.left || 0) - (ed.right || 0);
    areaH = window.innerHeight - ed.top - ed.bottom;
  } else {
    areaW = window.innerWidth;
    areaH = window.innerHeight - HUD_H;
  }
  _gridOriginCache = {
    x: Math.round((areaW - totalW) / 2),
    y: Math.round((areaH - totalH) / 2)
  };
  _gridOriginKey = key;
  return _gridOriginCache;
}

function cellToPixel(col, row) {
  const o = getGridOrigin();
  return { x: o.x + col * CELL_W, y: o.y + row * CELL_H };
}

function pixelToCell(px, py) {
  const o = getGridOrigin();
  const gp = viewportToGame(px, py);
  const col = Math.floor((gp.x - o.x) / CELL_W);
  const row = Math.floor((gp.y - o.y) / CELL_H);
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
  funMode:       false,
  selectedPlant: null,
  nextZombieId: 0,
  nextPeaId:    0,
  nextSunId:    0,
  nextFileId:   0,

  droppedFiles:    [],
  _sysFolder:      null,
  _magnetBlocked:  {},
  _zombieCopyCount: 0,
  _freePlant:      null,
  _freePlantSource: null,
  _customPlants:   null,
  _customWave:     false,

  _torrentPairId:      0,
  _torrentSlots:       [],
  _torrentBatchCleanup: false,

  _xsasHistory: [],

  cursorProjectiles: [],
  nextCursorProjId: 0,

  petyaPct: 0,
  _petyaDecayAccel: 0,

  zombieMutations: {},

  _timers: {},
};

function rnd(min, max) { return min + Math.random() * (max - min); }
function rndInt(min, max) { return Math.floor(rnd(min, max + 1)); }

function _clearNative(rec) {
  if (!rec) return;
  if (rec.handle != null) {
    if (rec.kind === 'interval') clearInterval(rec.handle);
    else clearTimeout(rec.handle);
    rec.handle = null;
  }
}

function _armTimeout(key, rec) {
  rec.startedAt = performance.now();
  rec.handle = setTimeout(() => {
    if (State.paused || State.gameOver) return;
    const fn = rec.fn;
    delete State._timers[key];
    fn();
  }, rec.remaining);
}

function _armInterval(key, rec) {
  rec.startedAt = performance.now();
  rec.handle = setInterval(() => {
    if (State.paused || State.gameOver) return;
    rec.startedAt = performance.now();
    rec.fn();
  }, rec.interval);
}

function gameTimer(key, fn, delay) {
  clearTimer(key);
  const rec = { kind: 'timeout', fn, remaining: delay, startedAt: 0, handle: null };
  State._timers[key] = rec;
  if (State.paused) return;
  _armTimeout(key, rec);
}

function gameInterval(key, fn, interval) {
  clearTimer(key);
  const rec = { kind: 'interval', fn, interval, startedAt: 0, handle: null };
  State._timers[key] = rec;
  if (State.paused) return;
  _armInterval(key, rec);
}

function pauseAllTimers() {
  const now = performance.now();
  for (const key in State._timers) {
    const rec = State._timers[key];
    if (!rec || typeof rec !== 'object' || rec.handle == null) continue;
    if (rec.kind === 'timeout') {
      const elapsed = now - rec.startedAt;
      rec.remaining = Math.max(0, rec.remaining - elapsed);
    }
    _clearNative(rec);
  }
}

function resumeAllTimers() {
  for (const key in State._timers) {
    const rec = State._timers[key];
    if (!rec || typeof rec !== 'object' || rec.handle != null) continue;
    if (rec.kind === 'timeout') _armTimeout(key, rec);
    else _armInterval(key, rec);
  }
}

function clearAllTimers() {
  Object.values(State._timers).forEach(rec => {
    if (rec && typeof rec === 'object') _clearNative(rec);
    else { clearTimeout(rec); clearInterval(rec); }
  });
  State._timers = {};
  dismissChomperMenu();
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

function isAvastShielded(col, row) {
  var r = PLANTS.avast_nut.shieldRadius;
  for (var dr = -r; dr <= r; dr++) {
    for (var dc = -r; dc <= r; dc++) {
      var rr = row + dr, cc = col + dc;
      if (rr < 0 || rr >= GRID_ROWS || cc < 0 || cc >= GRID_COLS) continue;
      var p = State.plants[rr][cc];
      if (p && p.type === 'avast_nut' && !p.archived && !p.infected) return true;
    }
  }
  return false;
}

function isFirewallShielded(col, row) {
  var p = State.plants[row] && State.plants[row][col - 1];
  if (p && p.type === 'torchwall' && !p.archived && !p.infected) return true;
  return false;
}

function findFirewallInRowBefore(row, beforeCol) {
  if (row < 0 || row >= GRID_ROWS) return null;
  for (var c = 0; c < beforeCol; c++) {
    var p = State.plants[row][c];
    if (p && p.type === 'torchwall' && !p.archived && !p.infected) return p;
  }
  return null;
}

function burnFirewall(fw) {
  if (!fw || fw.type !== 'torchwall') return;
  const pos = cellToPixel(fw.col, fw.row);
  spawnParticles(pos.x + CELL_W / 2, pos.y + CELL_H / 2, '#ff4400', 8);
  if (fw.el) {
    fw.el.classList.add('torchwall-burst');
    setTimeout(() => { if (fw.el) fw.el.classList.remove('torchwall-burst'); }, 350);
  }
}

function igniteAlongPath(pea) {
  if (pea._fireIgnited) return;
  if (pea.noFire) return;
  const o = getGridOrigin();
  const peaCol = Math.floor((pea.x - o.x) / CELL_W);
  if (peaCol < 0 || peaCol >= GRID_COLS) return;
  const fw = State.plants[pea.row] && State.plants[pea.row][peaCol];
  if (fw && fw.type === 'torchwall' && !fw.archived && !fw.infected) {
    pea._fireIgnited = true;
    const wasSlow = pea.slow;
    pea.fire = true;
    if (pea.el) {
      const img = pea.el.querySelector('img');
      if (img) {
        if (wasSlow) {
          img.style.filter = 'sepia(1) saturate(3) hue-rotate(-30deg) brightness(0.55)';
        } else {
          img.style.filter = 'brightness(0.55) sepia(1) saturate(2.5) hue-rotate(-20deg)';
        }
      }
      pea.el.classList.add(wasSlow ? 'pea-slow-fire' : 'pea-fire');
    }
    const label = pea.el && pea.el.querySelector('.entity-file-label');
    if (label) label.textContent = Lang.t(wasSlow ? 'entity.pea_slow_fire' : 'entity.pea_fire');
    GameLog.log('FIREWALL', `Pea #${pea.id} ignited by torchwall at [${peaCol},${pea.row}]${wasSlow ? ' (was slow)' : ''}`);
  }
}

const Graphics = {
  _mode: null,
  _applyClass() {
    try {
      const root = document.documentElement;
      if (!root) return;
      root.classList.toggle('gfx-low', this._mode === 'low');
    } catch (e) {}
  },
  isLow() {
    if (this._mode === null) {
      try {
        const saved = localStorage.getItem('pvz_graphics');
        if (saved === 'low' || saved === 'high') {
          this._mode = saved;
        } else {
          const isMobile = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
                           window.innerWidth < 900;
          this._mode = isMobile ? 'low' : 'high';
        }
      } catch (e) { this._mode = 'high'; }
      this._applyClass();
    }
    return this._mode === 'low';
  },
  set(mode) {
    this._mode = mode;
    try { localStorage.setItem('pvz_graphics', mode); } catch (e) {}
    this._applyClass();
  },
};
window.Graphics = Graphics;
try { Graphics.isLow(); } catch (e) {}

function addFilenameLabel(parent, text, extraClass = '') {
  const label = makeEl('span', `icon-label entity-file-label ${extraClass}`.trim(), parent);
  label.textContent = text;
  return label;
}

let _showZombieIds = false;
function _attachZombieIdBadge(zombie) {
  if (!zombie || !zombie.el || zombie._idBadge) return;
  const badge = makeEl('span', 'zombie-id-badge', zombie.el);
  badge.textContent = '#' + zombie.id;
  zombie._idBadge = badge;
}
function _detachZombieIdBadge(zombie) {
  if (zombie && zombie._idBadge) {
    zombie._idBadge.remove();
    zombie._idBadge = null;
  }
}
function setShowZombieIds(show) {
  _showZombieIds = !!show;
  for (const z of State.zombies) {
    if (!z.alive) continue;
    if (_showZombieIds) _attachZombieIdBadge(z);
    else _detachZombieIdBadge(z);
  }
}
function isShowZombieIds() { return _showZombieIds; }

function posEl(el, x, y) {
  if (el._x !== x) { el.style.left = x + 'px'; el._x = x; }
  if (el._y !== y) { el.style.top  = y + 'px'; el._y = y; }
}

function spawnMiniCursik(parent) {
  const mc = makeEl('div', 'mini-cursik', parent || entitiesLayer());
  mc.style.position = 'absolute';
  const img = makeEl('img', null, mc);
  img.src = 'static/img/ui/cursik.png';
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
        dismissChomperMenu();
        const p = State.plants[r] && State.plants[r][c];
        if (State.selectedPlant) {
          tryPlacePlant(State.selectedPlant, c, r);
        } else if (p && p.type === 'basket_chomper') {
          showChomperContextMenu(c, r, e);
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

  if (type === 'torrent_lantern') {
    var tlRadius = PLANTS.torrent_lantern.pairRadius;
    var tlCount = 0;
    for (var tr = 0; tr < GRID_ROWS; tr++) {
      for (var tc = 0; tc < GRID_COLS; tc++) {
        if (State.plants[tr][tc] && State.plants[tr][tc].type === 'torrent_lantern') {
          tlCount++;
          if (Math.abs(tr - row) <= tlRadius * 2 && Math.abs(tc - col) <= tlRadius * 2) {
            flashPlantCard('torrent_lantern');
            return false;
          }
        }
      }
    }
    if (tlCount >= PLANTS.torrent_lantern.maxOnGrid) {
      flashPlantCard('torrent_lantern');
      return false;
    }
  }

  var torrentSlot = type !== 'torrent_lantern' ? State._torrentSlots.find(s => s.col === col && s.row === row && s.sourceType === type) : null;
  if (torrentSlot) {
    if (State.paused || State.gameOver) return false;
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return false;
    if (State.plants[row][col]) return false;
    placePlant(type, col, row);
    trackTorrentMirrorPlant(torrentSlot.pairId, col, row);
    recalcTorrentSlots();
    GameLog.log('TORRENT', `Free-placed ${type} at [${col},${row}] via torrent pair #${torrentSlot.pairId}`);
    UI.updateSun();
    UI.updatePlantBar();
    return true;
  }

  const free = State._freePlant === type;
  const halfCost = free ? Math.floor(PLANTS[type].cost / 2) : 0;

  if (!free && State.sun < PLANTS[type].cost) {
    GameLog.log('PLANT', `Not enough sun for ${type} (have ${State.sun}, need ${PLANTS[type].cost})`);
    flashSunCounter();
    return false;
  }
  if (free && State.sun < halfCost) {
    GameLog.log('PLANT', `Not enough sun for daisy ${type} (have ${State.sun}, need ${halfCost})`);
    flashSunCounter();
    return false;
  }

  if (type === 'unarchiver') {
    const plant = State.plants[row]?.[col];
    if (!plant || !plant.archived) return false;
    if (free) State.sun -= halfCost;
    else State.sun -= PLANTS[type].cost;
    State._freePlant = null;
    State._freePlantSource = null;
    GameLog.log('PLANT', `Unarchived plant at [${col},${row}], sun=${State.sun}${free ? ' (free)' : ''}`);
    unarchivePlant(col, row);
    spawnParticles(plant.el.offsetLeft + CELL_W/2, plant.el.offsetTop + CELL_H/2, '#f39c12', 8);
    UI.updateSun();
    UI.updatePlantBar();
    return true;
  }

  if (type === 'kaspersky_bean') {
    const plant = State.plants[row]?.[col];
    if (!plant || !plant.infected) return false;
    if (free) State.sun -= halfCost;
    else State.sun -= PLANTS[type].cost;
    State._freePlant = null;
    State._freePlantSource = null;
    GameLog.log('PLANT', `Kaspersky bean cured plant at [${col},${row}], sun=${State.sun}${free ? ' (free)' : ''}`);
    cureInfection(col, row);
    spawnParticles(plant.el.offsetLeft + CELL_W/2, plant.el.offsetTop + CELL_H/2, '#00ff00', 8);
    UI.updateSun();
    UI.updatePlantBar();
    return true;
  }

  if (!free && !canPlacePlant(type, col, row)) return false;
  if (free) {
    if (State.paused || State.gameOver) return false;
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return false;
    if (State.plants[row][col]) return false;
  }
  placePlant(type, col, row);
  if (free) State.sun -= halfCost;
  else State.sun -= PLANTS[type].cost;
  State._freePlant = null;
  State._freePlantSource = null;
  GameLog.log('PLANT', `Placed ${type} at [${col},${row}], sun=${State.sun}${free ? ` (daisy, -${halfCost})` : ''}`);
  UI.updateSun();
  UI.updatePlantBar();
  return true;
}

const PLANTS = {
  sunflower: {
    name: 'sunflower.png',
    cost: 50,
    file: 'sunflower.png',
    folder: 'plants',
    shootInterval: null,
    sunInterval: [6000, 9000],
    cooldown: 5000,
    displayName: 'sunflower.png',
  },
  peashooter: {
    name: 'peashooter.png',
    cost: 75,
    file: 'peashooter.png',
    folder: 'plants',
    shootInterval: 2000,
    sunInterval: null,
    cooldown: 3000,
    displayName: 'peashooter.png',
  },
  folder_magnet: {
    name: 'folder-magnet.png',
    cost: 75,
    file: 'folder-magnet.png',
    folder: 'plants',
    shootInterval: null,
    sunInterval: null,
    cooldown: 6000,
    displayName: 'folder-magnet.png',
    attractRadius: 3,
    attractInterval: 2000,
  },
  siamese_peashooter: {
    name: 'siamese-peashooter.png',
    cost: 125,
    file: 'siamese-peashooter.png',
    folder: 'plants',
    shootInterval: 2200,
    sunInterval: null,
    cooldown: 5000,
    displayName: 'siamese-peashooter.png',
    shootsBothWays: true,
  },
  double_peashooter: {
    name: 'double-peashooter.jpg',
    cost: 125,
    file: 'double-peashooter.jpg',
    folder: 'plants',
    shootInterval: 2000,
    sunInterval: null,
    cooldown: 5000,
    displayName: 'double-peashooter.jpg',
    shootsDouble: true,
  },
  snow_peashooter: {
    name: 'snow-peashooter.jpg',
    cost: 100,
    file: 'snow-peashooter.jpg',
    folder: 'plants',
    shootInterval: 2000,
    sunInterval: null,
    cooldown: 5000,
    displayName: 'snow-peashooter.jpg',
    shootsSlow: true,
  },
  pirate_mushroom: {
    name: 'pirate-mushroom.jpg',
    cost: 15,
    file: 'pirate-mushroom.jpg',
    folder: 'plants',
    shootInterval: 2400,
    sunInterval: null,
    cooldown: 8000,
    displayName: 'pirate-mushroom.jpg',
    shootRange: 3,
    startsInfected: true,
    lifespanMs: 30000,
    hp: 1,
  },
  xsas_mushroom: {
    name: 'xsas-mushroom.png',
    cost: 150,
    file: 'xsas-mushroom.png',
    folder: 'plants',
    shootInterval: null,
    sunInterval: null,
    cooldown: 30000,
    displayName: 'xsas-mushroom.png',
    isExplosive: true,
    explosionRadius: 2,
  },
  sun_mushroom: {
    name: 'sun-mushroom.png',
    cost: 25,
    file: 'sun-mushroom.png',
    folder: 'plants',
    shootInterval: null,
    sunInterval: [5000, 8000],
    cooldown: 4000,
    displayName: 'sun-mushroom.png',
    nightOnly: true,
    sunValue: 15,
  },
  unarchiver: {
    name: 'unarchiver.png',
    cost: 50,
    file: 'unarchiver.png',
    folder: 'plants',
    shootInterval: null,
    sunInterval: null,
    cooldown: 2000,
    displayName: 'unarchiver.png',
    isItem: true,
  },
  kaspersky_bean: {
    name: 'kaspersky-bean.png',
    cost: 50,
    file: 'kaspersky-bean.png',
    folder: 'plants',
    shootInterval: null,
    sunInterval: null,
    cooldown: 3000,
    displayName: 'kaspersky-bean.png',
    isItem: true,
  },
  daisy: {
    name: 'daisy.jpg',
    cost: 75,
    file: 'daisy.jpg',
    folder: 'plants',
    shootInterval: null,
    sunInterval: null,
    cooldown: 8000,
    displayName: 'daisy.jpg',
    dropInterval: [8000, 12000],
  },
  cherry: {
    name: 'cherry.webp',
    cost: 80,
    file: 'cherry.webp',
    folder: 'plants',
    shootInterval: null,
    sunInterval: null,
    cooldown: 0,
    displayName: 'cherry.webp',
    isExplosive: true,
    explosionRadius: 1,
    explosionDelay: 2000,
    maxTargets: 5,
  },
  avast_nut: {
    name: 'avast-nut.jpg',
    cost: 100,
    file: 'avast-nut.jpg',
    folder: 'plants',
    shootInterval: null,
    sunInterval: null,
    cooldown: 20000,
    displayName: 'avast-nut.jpg',
    isWall: true,
    shieldRadius: 1,
  },
  torchwall: {
    name: 'torchwall.png',
    cost: 175,
    file: 'torchwall.png',
    folder: 'plants',
    shootInterval: null,
    sunInterval: null,
    cooldown: 15000,
    displayName: 'torchwall.png',
    isFirewall: true,
    shieldRadius: 1,
    shieldOnlyForward: true,
  },
  logic_mine: {
    name: 'mine.jpg',
    cost: 25,
    file: 'mine.jpg',
    folder: 'plants',
    shootInterval: null,
    sunInterval: null,
    cooldown: 5000,
    displayName: 'mine.jpg',
    isMine: true,
  },
  basket_chomper: {
    name: 'basket-chomper.jpg',
    cost: 75,
    file: 'basket-chomper.jpg',
    fileFull: 'basket-chomper-full.jpg',
    folder: 'plants',
    shootInterval: null,
    sunInterval: null,
    cooldown: 8000,
    displayName: 'basket-chomper.jpg',
    digestTime: 18000,
  },
  torrent_lantern: {
    name: 'torrent-lantern.jpg',
    cost: 75,
    file: 'torrent-lantern.jpg',
    folder: 'plants',
    shootInterval: null,
    sunInterval: null,
    cooldown: 10000,
    displayName: 'torrent-lantern.jpg',
    pairRadius: 1,
    maxOnGrid: 2,
  },
  catmouse: {
    name: 'catmouse.png',
    cost: 175,
    file: 'catmouse.png',
    fileReload: 'catmouse-2.png',
    folder: 'plants',
    shootInterval: null,
    sunInterval: null,
    cooldown: 7500,
    displayName: 'catmouse.png',
    isAimed: true,
    aimCooldown: 5000,
    projectileDamage: 2,
  },
};

function initTorrentLantern(plant) {
  plant._lanternPairId = null;
  plant._lanternPartner = null;
  plant._mirrorPlants = [];

  var other = null;
  for (var r = 0; r < GRID_ROWS; r++) {
    for (var c = 0; c < GRID_COLS; c++) {
      var p = State.plants[r][c];
      if (p && p.type === 'torrent_lantern' && p !== plant && !p._lanternPartner) {
        other = p;
      }
    }
  }

  if (other) {
    var pairId = ++State._torrentPairId;
    plant._lanternPairId = pairId;
    other._lanternPairId = pairId;
    plant._lanternPartner = { col: other.col, row: other.row };
    other._lanternPartner = { col: plant.col, row: plant.row };
    GameLog.log('TORRENT', `Pair #${pairId} formed: [${other.col},${other.row}] + [${plant.col},${plant.row}]`);
  }
}

function activateTorrentPair(lanternA, lanternB, pairId) {
  var radius = PLANTS.torrent_lantern.pairRadius;
  var slots = [];

  function scanLantern(src, dst) {
    for (var dr = -radius; dr <= radius; dr++) {
      for (var dc = -radius; dc <= radius; dc++) {
        if (dr === 0 && dc === 0) continue;
        var sr = src.row + dr, sc = src.col + dc;
        if (sr < 0 || sr >= GRID_ROWS || sc < 0 || sc >= GRID_COLS) continue;
        var p = State.plants[sr][sc];
        if (!p || p.type === 'torrent_lantern' || p.archived) continue;
        var mr = dst.row + dr, mc = dst.col + dc;
        if (mr < 0 || mr >= GRID_ROWS || mc < 0 || mc >= GRID_COLS) continue;
        if (mr === dst.row && mc === dst.col) continue;
        if (State.plants[mr][mc]) continue;
        if (!slots.find(s => s.col === mc && s.row === mr)) {
          slots.push({ col: mc, row: mr, sourceCol: sc, sourceRow: sr, sourceType: p.type, pairId: pairId });
        }
      }
    }
  }

  scanLantern(lanternA, lanternB);
  scanLantern(lanternB, lanternA);
  return slots;
}

function recalcTorrentSlots() {
  if (State._torrentBatchCleanup) return;
  State._torrentSlots = [];

  var lanterns = [];
  for (var r = 0; r < GRID_ROWS; r++) {
    for (var c = 0; c < GRID_COLS; c++) {
      var p = State.plants[r][c];
      if (p && p.type === 'torrent_lantern' && p._lanternPartner) lanterns.push(p);
    }
  }

  var processed = {};
  for (var i = 0; i < lanterns.length; i++) {
    var la = lanterns[i];
    if (processed[la._lanternPairId]) continue;
    processed[la._lanternPairId] = true;
    var lb = State.plants[la._lanternPartner.row]?.[la._lanternPartner.col];
    if (!lb || lb.type !== 'torrent_lantern') continue;
    var slots = activateTorrentPair(la, lb, la._lanternPairId);
    State._torrentSlots = State._torrentSlots.concat(slots);
  }

  renderTorrentSlots();
}

function trackTorrentMirrorPlant(pairId, col, row) {
  var plant = State.plants[row]?.[col];
  if (plant) plant._placedByTorrent = pairId;

  for (var r = 0; r < GRID_ROWS; r++) {
    for (var c = 0; c < GRID_COLS; c++) {
      var p = State.plants[r][c];
      if (p && p.type === 'torrent_lantern' && p._lanternPairId === pairId) {
        p._mirrorPlants.push({ col: col, row: row });
      }
    }
  }
}

function cleanupTorrentPair(pairId) {
  var mirrors = [];
  var survivingLantern = null;

  for (var r = 0; r < GRID_ROWS; r++) {
    for (var c = 0; c < GRID_COLS; c++) {
      var p = State.plants[r][c];
      if (!p) continue;
      if (p.type === 'torrent_lantern' && p._lanternPairId === pairId) {
        for (var j = 0; j < p._mirrorPlants.length; j++) {
          var mp = p._mirrorPlants[j];
          if (!mirrors.find(m => m.col === mp.col && m.row === mp.row)) {
            mirrors.push(mp);
          }
        }
      }
    }
  }

  State._torrentBatchCleanup = true;
  for (var i = 0; i < mirrors.length; i++) {
    var mp = mirrors[i];
    var pl = State.plants[mp.row]?.[mp.col];
    if (pl && pl._placedByTorrent === pairId) {
      removePlant(mp.col, mp.row, true);
    }
  }
  State._torrentBatchCleanup = false;

  for (var r = 0; r < GRID_ROWS; r++) {
    for (var c = 0; c < GRID_COLS; c++) {
      var p = State.plants[r][c];
      if (p && p.type === 'torrent_lantern' && p._lanternPairId === pairId) {
        p._lanternPartner = null;
        p._lanternPairId = null;
        p._mirrorPlants = [];
      }
    }
  }
}

function renderTorrentSlots() {
  document.querySelectorAll('.grid-cell.torrent-slot').forEach(el => el.classList.remove('torrent-slot'));
  document.querySelectorAll('.torrent-hologram').forEach(el => el.remove());
  for (var i = 0; i < State._torrentSlots.length; i++) {
    var s = State._torrentSlots[i];
    var cell = document.querySelector('.grid-cell[data-col="' + s.col + '"][data-row="' + s.row + '"]');
    if (!cell) continue;
    cell.classList.add('torrent-slot');
    var cfg = PLANTS[s.sourceType];
    if (cfg) {
      var holo = makeEl('div', 'torrent-hologram', entitiesLayer());
      holo.style.position = 'absolute';
      var pos = cellToPixel(s.col, s.row);
      holo.style.left = pos.x + 'px';
      holo.style.top = pos.y + 'px';
      holo.style.width = CELL_W + 'px';
      holo.style.height = CELL_H + 'px';
      holo.style.pointerEvents = 'none';
      holo.style.display = 'flex';
      holo.style.alignItems = 'center';
      holo.style.justifyContent = 'center';
      var img = makeEl('img', '', holo);
      img.src = 'static/img/' + (cfg.folder || 'plants') + '/' + cfg.file;
      img.draggable = false;
      img.style.width = '48px';
      img.style.height = '48px';
      img.style.objectFit = 'contain';
    }
  }
}

function placePlant(type, col, row) {
  const pos = cellToPixel(col, row);
  const el = makeEl('div', 'plant-entity icon-entity', entitiesLayer());
  el.dataset.type = type;
  el.classList.add(type.replace(/_/g, '-'));
  el.style.left   = pos.x + 'px';
  el.style.top    = pos.y + 'px';
  el.style.width  = CELL_W + 'px';
  el.style.height = CELL_H + 'px';
  el.style.position = 'absolute';

  const img = makeEl('img', 'icon-img', el);
  img.src = `static/img/${PLANTS[type].folder || 'plants'}/${PLANTS[type].file}`;
  img.alt = PLANTS[type].file;
  addFilenameLabel(el, Lang.t('plant.name.' + type));
  img.draggable = false;
  img.onerror = () => {
    img.remove();
    el.classList.add('asset-missing', `asset-missing-${type}`);
  };

  const cfgP = PLANTS[type];
  const hpBase = cfgP.hp != null ? cfgP.hp : (cfgP.isWall ? 10 : 3);
  const plantData = { type, col, row, el, hp: hpBase, archived: false };
  if (type === 'basket_chomper') plantData.isFull = false;
  State.plants[row][col] = plantData;

  if (cfgP.startsInfected) {
    plantData.infected = true;
    plantData.trojanCount = 1;
    el.classList.add('infected');
    GameLog.log('PIRATE', `${type} at [${col},${row}] placed pre-infected`);
  }

  if (cfgP.lifespanMs) {
    gameTimer(`lifespan_${col}_${row}`, () => {
      const cur = State.plants[row] && State.plants[row][col];
      if (cur === plantData) removePlant(col, row);
    }, cfgP.lifespanMs);
  }

  if (type === 'sunflower' || type === 'sun_mushroom') {
    scheduleSunflower(plantData);
  } else if (type === 'peashooter' || type === 'siamese_peashooter' || type === 'double_peashooter' || type === 'snow_peashooter' || type === 'pirate_mushroom') {
    scheduleShoot(plantData);
  } else if (type === 'folder_magnet') {
    scheduleFolderMagnet(plantData);
  } else if (type === 'daisy') {
    scheduleDaisy(plantData);
  } else if (type === 'xsas_mushroom') {
    var now = performance.now();
    State._xsasHistory = State._xsasHistory.filter(function(t) { return now - t < 10000; });
    State._xsasHistory.push(now);
    if (State._xsasHistory.length >= 3) {
      GameLog.log('BSOD', 'XSAS overload: ' + State._xsasHistory.length + ' placements in 10s');
      gameTimer('xsas_overload_bsod', function() {
        if (typeof Game !== 'undefined' && Game.triggerGameOver) {
          Game.triggerGameOver(null, 'xsas_overload');
        }
      }, 500);
    }
    plantData._xsasPlanted = now;
    plantData._xsasDelay = 3000;
    gameTimer(`xsas_${col}_${row}`, () => {
      if (!State.plants[row][col]) return;
      if (State.plants[row][col].archived || State.plants[row][col].infected) return;
      triggerXSASExplosion(plantData);
    }, 3000);
  } else if (type === 'cherry') {
    plantData._cherryPlanted = performance.now();
    plantData._cherryDelay = PLANTS.cherry.explosionDelay;
    gameTimer(`cherry_${col}_${row}`, () => {
      if (!State.plants[row][col]) return;
      if (State.plants[row][col].archived || State.plants[row][col].infected) return;
      triggerCherryExplosion(plantData);
    }, PLANTS.cherry.explosionDelay);
  } else if (type === 'torrent_lantern') {
    initTorrentLantern(plantData);
  }

  el.style.transform = 'scale(0)';
  el.style.transition = 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)';
  requestAnimationFrame(() => { el.style.transform = 'scale(1)'; });

  spawnParticles(pos.x + CELL_W/2, pos.y + CELL_H/2, '#7fff00', 6);
  recalcTorrentSlots();
}

function removePlant(col, row, safe) {
  const p = State.plants[row][col];
  if (!p) return;

  if (p.type === 'folder_magnet') {
    const heldFile = State.droppedFiles.find(f =>
      !f.collected && f.heldByMagnet && f.magnetCol === col && f.magnetRow === row
    );
    if (heldFile) {
      var eatingZombie = State.zombies.find(z => z.alive && z.row === row && z._eatTimer);
      var reason = eatingZombie ? 'magnet_destroyed' : 'magnet_self_destruct';
      GameLog.log('BSOD', `Magnet at [${col},${row}] lost sys file (${reason})`);
      spawnParticles(heldFile.x + 24, heldFile.y + 20, '#ff0000', 15);
      p.el.remove();
      State.plants[row][col] = null;
      Game.triggerGameOver(null, reason);
      return;
    }
  }

  if (p.type === 'torrent_lantern' && p._lanternPairId) {
    cleanupTorrentPair(p._lanternPairId);
  }

  if (p._placedByTorrent) {
    for (var r2 = 0; r2 < GRID_ROWS; r2++) {
      for (var c2 = 0; c2 < GRID_COLS; c2++) {
        var lp = State.plants[r2][c2];
        if (lp && lp.type === 'torrent_lantern' && lp._mirrorPlants) {
          lp._mirrorPlants = lp._mirrorPlants.filter(m => !(m.col === col && m.row === row));
        }
      }
    }
  }

  const shouldSpawnZombie = !safe && p.infected && p.trojanCount > 0;
  const savedTrojanCount = p.trojanCount || 0;

  GameLog.log('PLANT', `Removed ${p.type} at [${col},${row}]${safe ? ' (safe)' : ''}`);
  p.el.remove();
  State.plants[row][col] = null;
  clearTimer(`plant_sun_${col}_${row}`);
  clearTimer(`plant_shoot_${col}_${row}`);
  clearTimer(`magnet_${col}_${row}`);
  clearTimer(`xsas_${col}_${row}`);
  clearTimer(`cherry_${col}_${row}`);
  clearTimer(`plant_drop_${col}_${row}`);
  clearTimer(`chomper_digest_${col}_${row}`);
  clearTimer(`lifespan_${col}_${row}`);

  if (shouldSpawnZombie) {
    spawnInfectedZombie(col, row, savedTrojanCount);
  }

  recalcTorrentSlots();
}

function chomperEatZombie(plant, zombie) {
  plant.isFull = true;
  const img = plant.el.querySelector('.icon-img');
  if (img) img.src = 'static/img/plants/' + PLANTS.basket_chomper.fileFull;
  plant.el.classList.add('chomper-full');
  const lbl = plant.el.querySelector('.entity-file-label');
  if (lbl) lbl.textContent = Lang.t('plant.name.basket_chomper');

  killZombie(zombie, { dropFile: true });
  spawnParticles(
    parseInt(plant.el.style.left) + CELL_W / 2,
    parseInt(plant.el.style.top) + CELL_H / 2,
    '#e74c3c', 10
  );

  gameTimer(`chomper_digest_${plant.col}_${plant.row}`, function() {
    emptyChomper(plant.col, plant.row);
  }, PLANTS.basket_chomper.digestTime);
}

function emptyChomper(col, row) {
  const p = State.plants[row] && State.plants[row][col];
  if (!p || p.type !== 'basket_chomper' || !p.isFull) return;
  p.isFull = false;
  p.el.classList.remove('chomper-full');
  if (!p.archived) {
    const img = p.el.querySelector('.icon-img');
    if (img) img.src = 'static/img/plants/' + PLANTS.basket_chomper.file;
  }
  spawnParticles(
    parseInt(p.el.style.left) + CELL_W / 2,
    parseInt(p.el.style.top) + CELL_H / 2,
    '#7fff00', 6
  );
}

var _chomperMenuCleanup = null;

function dismissChomperMenu() {
  var m = document.querySelector('.win-ctx-menu');
  if (m) m.remove();
  if (_chomperMenuCleanup) {
    document.removeEventListener('pointerdown', _chomperMenuCleanup, true);
    _chomperMenuCleanup = null;
  }
}

function showChomperContextMenu(col, row, e) {
  dismissChomperMenu();
  var p = State.plants[row] && State.plants[row][col];
  if (!p || p.type !== 'basket_chomper') return;

  var menu = makeEl('div', 'win-ctx-menu', entitiesLayer());
  menu.style.position = 'absolute';
  menu.style.zIndex = '60';
  menu.style.pointerEvents = 'auto';

  var pos = cellToPixel(col, row);
  menu.style.left = (pos.x - 10) + 'px';
  var flipUp = row >= GRID_ROWS - 2;
  if (flipUp) {
    menu.style.top = (pos.y - 72) + 'px';
  } else {
    menu.style.top = (pos.y + CELL_H + 2) + 'px';
  }

  var onCooldown = p._lastManualEmpty && (performance.now() - p._lastManualEmpty < 5000);
  var canEmpty = p.isFull && !p.archived && !p.infected && !onCooldown;
  var emptyItem = makeEl('div', 'win-ctx-item' + (canEmpty ? '' : ' disabled'), menu);
  emptyItem.textContent = Lang.t('context.empty_basket');
  if (canEmpty) {
    emptyItem.addEventListener('click', function() {
      p._lastManualEmpty = performance.now();
      emptyChomper(col, row);
      clearTimer('chomper_digest_' + col + '_' + row);
      dismissChomperMenu();
      SFX.play('snd-sun');
    });
  }

  makeEl('div', 'win-ctx-sep', menu);

  var removeItem = makeEl('div', 'win-ctx-item', menu);
  removeItem.textContent = Lang.t('context.remove_plant');
  removeItem.addEventListener('click', function() {
    dismissChomperMenu();
    removePlant(col, row);
  });

  _chomperMenuCleanup = function(ev) {
    if (!menu.contains(ev.target)) dismissChomperMenu();
  };
  setTimeout(function() {
    document.addEventListener('pointerdown', _chomperMenuCleanup, true);
  }, 0);
}

function clearTimer(key) {
  const rec = State._timers[key];
  if (rec == null) return;
  if (typeof rec === 'object') _clearNative(rec);
  else { clearTimeout(rec); clearInterval(rec); }
  delete State._timers[key];
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

function scheduleDaisy(plant) {
  const cfg = PLANTS.daisy;
  const d = rndInt(cfg.dropInterval[0], cfg.dropInterval[1]);
  const key = `plant_drop_${plant.col}_${plant.row}`;
  State._timers[key] = setTimeout(() => {
    if (!State.plants[plant.row][plant.col]) return;
    if (State.plants[plant.row][plant.col].archived) return;
    if (State.plants[plant.row][plant.col].infected) return;
    if (State.gameOver) return;
    if (State.paused) { scheduleDaisy(plant); return; }
    if (plant._hasDrop && !State.funMode) { scheduleDaisy(plant); return; }
    daisyDrop(plant);
    scheduleDaisy(plant);
  }, d);
}

function daisyDrop(plant) {
  const pos = cellToPixel(plant.col, plant.row);
  const roll = Math.random() * 100;

  if (roll < 2) {
    GameLog.log('DAISY', `Dropped CHERRY at [${plant.col},${plant.row}] - surprise!`);
    const cherryEl = makeEl('img', 'daisy-cherry-preview', sunsLayer());
    cherryEl.src = 'static/img/plants/' + PLANTS.cherry.file;
    cherryEl.style.position = 'absolute';
    cherryEl.style.width = '50px';
    cherryEl.style.height = '50px';
    cherryEl.style.pointerEvents = 'none';
    cherryEl.style.zIndex = '60';
    posEl(cherryEl, pos.x + CELL_W / 2 - 25, pos.y + CELL_H / 2 - 25);
    cherryEl.style.transform = 'scale(0)';
    cherryEl.style.transition = 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)';
    requestAnimationFrame(() => { cherryEl.style.transform = 'scale(1.2)'; });
    setTimeout(() => {
      cherryEl.remove();
      triggerCherryExplosion({ col: plant.col, row: plant.row, type: 'cherry' });
      spawnParticles(pos.x + CELL_W / 2, pos.y + CELL_H / 2, '#ff69b4', 10);
    }, 1500);
  } else if (roll < 57) {
    const plantRolls = [
      { type: State.nightMode ? 'sun_mushroom' : 'sunflower', weight: 15 },
      { type: 'peashooter', weight: 14 },
      { type: 'folder_magnet', weight: 10 },
      { type: State.nightMode ? 'sunflower' : 'sun_mushroom', weight: 8 },
      { type: 'siamese_peashooter', weight: 5 },
      { type: 'xsas_mushroom', weight: 3 },
    ];
    let total = 0;
    const r2 = Math.random() * plantRolls.reduce((s, p) => s + p.weight, 0);
    let picked = plantRolls[0].type;
    for (const p of plantRolls) {
      total += p.weight;
      if (r2 < total) { picked = p.type; break; }
    }
    spawnDaisyPlantDrop(plant, picked);
    GameLog.log('DAISY', `Dropped plant ${picked} at [${plant.col},${plant.row}]`);
  } else if (roll < 72) {
    const fx = pos.x + rnd(-10, 20);
    const fy = pos.y + rnd(10, 30);
    dropSystemFile(fx, fy, plant.row);
    spawnParticles(pos.x + CELL_W / 2, pos.y + CELL_H / 2, '#ff4444', 6);
    GameLog.log('DAISY', `Dropped sys file at [${plant.col},${plant.row}]`);
  } else if (roll < 85) {
    const zombieRolls = [
      { type: 'zombie', weight: 8 },
      { type: 'hdd_zombie', weight: 4 },
      { type: 'ssd_zombie', weight: 2 },
      { type: 'trojan_catapult', weight: 1 },
    ];
    let total = 0;
    const r2 = Math.random() * zombieRolls.reduce((s, z) => s + z.weight, 0);
    let picked = zombieRolls[0].type;
    for (const z of zombieRolls) {
      total += z.weight;
      if (r2 < total) { picked = z.type; break; }
    }
    const zombie = spawnZombie(picked, plant.row);
    if (zombie) {
      zombie.x = pos.x + CELL_W;
      posEl(zombie.el, zombie.x, zombie.y);
    }
    spawnParticles(pos.x + CELL_W / 2, pos.y + CELL_H / 2, '#8b00ff', 6);
    GameLog.log('DAISY', `Dropped zombie ${picked} at [${plant.col},${plant.row}]`);
  } else {
    const sx = pos.x + CELL_W / 2 - 25;
    const sy = pos.y + 20;
    spawnSun(sx, sy, false, 25);
    spawnParticles(pos.x + CELL_W / 2, pos.y + CELL_H / 2, '#ffd700', 6);
    GameLog.log('DAISY', `Dropped sun at [${plant.col},${plant.row}]`);
  }

  SFX.play('snd-sun');
}

function spawnDaisyPlantDrop(daisy, plantType) {
  const pos = cellToPixel(daisy.col, daisy.row);
  const cfg = PLANTS[plantType];
  if (!cfg) return;
  const realPlant = State.plants[daisy.row]?.[daisy.col];
  if (realPlant) realPlant._hasDrop = true;

  const el = makeEl('div', 'daisy-drop-entity icon-entity', sunsLayer());
  el.style.position = 'absolute';
  const dx = pos.x + rnd(-15, 25);
  const dy = pos.y + rnd(15, 40);
  posEl(el, dx, dy);

  const img = makeEl('img', 'icon-img', el);
  img.src = `static/img/plants/${cfg.file}`;
  img.draggable = false;
  img.onerror = () => { img.remove(); el.textContent = '🌱'; el.style.fontSize = '28px'; };

  addFilenameLabel(el, Lang.t('plant.name.' + plantType));

  el.style.transform = 'scale(0) translateY(-10px)';
  el.style.transition = 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)';
  requestAnimationFrame(() => { el.style.transform = 'scale(1) translateY(0)'; });

  spawnParticles(pos.x + CELL_W / 2, pos.y + CELL_H / 2, '#7fff00', 6);

  function clearDrop() {
    var p = State.plants[daisy.row]?.[daisy.col];
    if (p) p._hasDrop = false;
  }

  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (State.paused || State.gameOver) return;
    el.remove();
    clearDrop();
    UI.startFreePlantDrag(plantType, e, { col: daisy.col, row: daisy.row });
  });

  setTimeout(() => {
    if (el.parentNode) {
      clearDrop();
      el.style.transition = 'opacity 0.4s';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 400);
    }
  }, 12000);
}

function scheduleShoot(plant) {
  const cfg = PLANTS[plant.type] || PLANTS.peashooter;
  const key = `plant_shoot_${plant.col}_${plant.row}`;
  State._timers[key] = setInterval(() => {
    const cur = State.plants[plant.row] && State.plants[plant.row][plant.col];
    if (!cur) { clearTimer(key); return; }
    if (cur.archived) return;
    if (cur.infected && plant.type !== 'pirate_mushroom') return;
    if (State.paused || State.gameOver) return;
    const plantX = cellToPixel(plant.col, plant.row).x;
    const range = cfg.shootRange;
    const inRange = z => {
      if (!z.alive || z.row !== plant.row) return false;
      if (z.x < plantX) return false;
      if (range == null) return true;
      return (z.x - plantX) <= range * CELL_W;
    };
    const hasZombie = State.zombies.some(inRange);
    if (hasZombie) {
      shootPea(plant, 1);
      if (cfg.shootsDouble) shootPea(plant, 1);
    }
    if (cfg.shootsBothWays) {
      const hasZombieLeft = State.zombies.some(z => z.row === plant.row && z.alive && z.x < plantX);
      if (hasZombieLeft) {
        shootPea(plant, -1);
        shootPea(plant, -1);
      }
    }
  }, cfg.shootInterval || 2000);
}

function shootPea(plant, direction = 1) {
  const cfg = PLANTS[plant.type] || PLANTS.peashooter;
  const isSlow = cfg.shootsSlow || false;
  const isPirate = plant.type === 'pirate_mushroom';
  const pos = cellToPixel(plant.col, plant.row);
  const el = makeEl('div', 'pea-entity icon-pea', entitiesLayer());
  el.style.position = 'absolute';
  if (isPirate) el.classList.add('pea-spore');
  const startX = direction > 0 ? pos.x + CELL_W : pos.x;
  const peaY = isPirate ? pos.y + CELL_H * 0.55 : pos.y + CELL_H * 0.22;
  posEl(el, startX, peaY);

  const img = makeEl('img', 'pea-img', el);
  img.draggable = false;
  img.onerror = () => {
    img.remove();
    el.classList.add('pea-fallback');
  };
  img.src = 'static/img/other/pea.png';
  if (direction < 0) img.style.transform = 'scaleX(-1)';
  if (isSlow) img.style.filter = 'hue-rotate(160deg) saturate(2) brightness(0.85)';

  addFilenameLabel(el, Lang.t(isPirate ? 'entity.spore' : 'entity.pea'), isPirate ? 'spore-file-label' : 'pea-file-label');
  const mc = spawnMiniCursik();
  posEl(mc, startX + (direction > 0 ? 10 : -10), peaY - 8);
  const id = State.nextPeaId++;
  const pea = { id, row: plant.row, x: startX, el, alive: true, mc, peaY, direction, slow: isSlow };
  if (cfg.shootRange != null) {
    pea.maxX = startX + cfg.shootRange * CELL_W * direction;
  }
  if (isPirate) {
    pea.pirate = true;
    pea.noFire = true;
    pea.boosted = isInTorrentZone(plant.col, plant.row);
    const baseFilter = pea.boosted
      ? 'sepia(1) hue-rotate(220deg) saturate(4) brightness(1.1)'
      : 'sepia(1) hue-rotate(220deg) saturate(2.8) brightness(0.85)';
    img.style.filter = baseFilter;
    img.style.width = '60%';
    img.style.height = '60%';
    img.style.margin = '20%';
  }
  State.peas.push(pea);
  SFX.play('snd-pea');
}

function isInTorrentZone(col, row) {
  var radius = PLANTS.torrent_lantern.pairRadius;
  for (var r = 0; r < GRID_ROWS; r++) {
    for (var c = 0; c < GRID_COLS; c++) {
      var p = State.plants[r] && State.plants[r][c];
      if (!p || p.type !== 'torrent_lantern' || !p._lanternPairId || !p._lanternPartner) continue;
      if (Math.abs(r - row) <= radius && Math.abs(c - col) <= radius) return true;
    }
  }
  return false;
}

function fireCursorProjectile(plant, targetX, targetY) {
  const cfg = PLANTS[plant.type] || PLANTS.catmouse;
  const pos = cellToPixel(plant.col, plant.row);
  const sx = pos.x + CELL_W / 2;
  const sy = pos.y + CELL_H / 2;
  const el = makeEl('div', 'cursor-projectile', entitiesLayer());
  el.style.position = 'absolute';
  posEl(el, sx - 16, sy - 16);
  const img = makeEl('img', 'cursor-projectile-img', el);
  img.src = 'static/img/ui/cursik.png';
  img.draggable = false;
  img.onerror = () => { img.remove(); el.classList.add('asset-missing'); };
  addFilenameLabel(el, Lang.t('entity.cursor_projectile'), 'cursor-proj-file-label');
  const dx = targetX - sx;
  const dy = targetY - sy;
  const dist = Math.max(1, Math.sqrt(dx*dx + dy*dy));
  const mc = spawnMiniCursik(entitiesLayer());
  posEl(mc, sx - 6, sy - 12);
  const arcUp = Math.random() < 0.5 ? -1 : 1;
  const arcHeight = Math.max(80, Math.min(220, dist * 0.45)) * arcUp;
  const midX = (sx + targetX) / 2 + (Math.random() - 0.5) * 60;
  const midY = (sy + targetY) / 2 + arcHeight;
  const flightMs = Math.max(280, Math.min(900, dist * 1.1));
  const id = State.nextCursorProjId++;
  const proj = {
    id, el, img, mc,
    x: sx, y: sy,
    sx, sy, tx: targetX, ty: targetY,
    cx: midX, cy: midY,
    t: 0,
    flightMs,
    alive: true,
    damage: cfg.projectileDamage || 2,
    spawnedAt: performance.now(),
    _jitterAcc: 0,
  };
  State.cursorProjectiles.push(proj);
}

function updateCursorProjectiles(dt) {
  if (!State.cursorProjectiles.length) return;
  const ZOMBIE_HALF_W = 45;
  const ZOMBIE_HALF_H = 60;
  const lowGfx = Graphics.isLow();
  for (let i = State.cursorProjectiles.length - 1; i >= 0; i--) {
    const p = State.cursorProjectiles[i];
    if (!p.alive) continue;
    p.t += dt / p.flightMs;
    const t = Math.min(1, p.t);
    const omt = 1 - t;
    const bx = omt * omt * p.sx + 2 * omt * t * p.cx + t * t * p.tx;
    const by = omt * omt * p.sy + 2 * omt * t * p.cy + t * t * p.ty;
    const dxT = 2 * omt * (p.cx - p.sx) + 2 * t * (p.tx - p.cx);
    const dyT = 2 * omt * (p.cy - p.sy) + 2 * t * (p.ty - p.cy);
    const tangent = Math.atan2(dyT, dxT) * 180 / Math.PI;
    const tw = performance.now() * 0.02;
    const sway = Math.sin(tw + p.id) * 6 + Math.sin(tw * 2.3 + p.id) * 3;
    const jx = (Math.random() - 0.5) * 8 + sway;
    const jy = (Math.random() - 0.5) * 8 + Math.cos(tw * 1.7 + p.id) * 5;
    p.x = bx + jx;
    p.y = by + jy;
    posEl(p.el, p.x - 16, p.y - 16);
    const wobble = (Math.random() - 0.5) * 30;
    if (p.img) p.img.style.transform = `rotate(${tangent + 45 + wobble}deg)`;
    if (p.mc) posEl(p.mc, p.x - 4, p.y - 12);
    p._jitterAcc += dt;
    if (!lowGfx && p._jitterAcc > 30) {
      p._jitterAcc = 0;
      const trail = document.createElement('div');
      trail.className = 'cursor-trail-bit';
      trail.style.left = (bx - 4 + (Math.random() - 0.5) * 4) + 'px';
      trail.style.top = (by - 4 + (Math.random() - 0.5) * 4) + 'px';
      entitiesLayer().appendChild(trail);
      setTimeout(() => trail.remove(), 360);
    }
    let hit = false;
    for (let j = 0; j < State.zombies.length; j++) {
      const z = State.zombies[j];
      if (!z.alive) continue;
      const zCy = z.y + 50;
      if (p.x >= z.x - ZOMBIE_HALF_W && p.x <= z.x + ZOMBIE_HALF_W &&
          p.y >= zCy - ZOMBIE_HALF_H && p.y <= zCy + ZOMBIE_HALF_H) {
        damageZombie(z, p.damage);
        spawnParticles(p.x, p.y, '#ffffff', 6);
        hit = true;
        break;
      }
    }
    const reachedEnd = t >= 1;
    if (hit || reachedEnd) {
      if (reachedEnd && !hit) spawnParticles(p.x, p.y, '#bfe8ff', 4);
      p.alive = false;
      p.el.remove();
      if (p.mc) p.mc.remove();
      State.cursorProjectiles.splice(i, 1);
    }
  }
}

function fireAllCatmice(targetX, targetY) {
  if (State.paused || State.gameOver) return;
  const now = performance.now();
  let fired = 0;
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const p = State.plants[r] && State.plants[r][c];
      if (!p || p.type !== 'catmouse') continue;
      if (p.archived || p.infected) continue;
      const cd = (PLANTS.catmouse.aimCooldown || 5000);
      if (p._reloading) continue;
      p._reloading = true;
      fireCursorProjectile(p, targetX, targetY);
      if (p.el) {
        p.el.classList.add('catmouse-fire');
        gameTimer(`catmouse_fire_${p.col}_${p.row}`, () => {
          if (p.el) p.el.classList.remove('catmouse-fire');
        }, 250);
        const imgEl = p.el.querySelector('img.icon-img');
        if (imgEl) {
          imgEl.src = `static/img/plants/${PLANTS.catmouse.fileReload || 'catmouse-2.png'}`;
        }
        gameTimer(`catmouse_reload_${p.col}_${p.row}`, () => {
          p._reloading = false;
          const stillThere = State.plants[p.row] && State.plants[p.row][p.col];
          if (stillThere === p && p.el) {
            const im = p.el.querySelector('img.icon-img');
            if (im) im.src = `static/img/plants/${PLANTS.catmouse.file}`;
          }
        }, cd);
      } else {
        gameTimer(`catmouse_reload_${p.col}_${p.row}`, () => { p._reloading = false; }, cd);
      }
      fired++;
    }
  }
  if (fired > 0) SFX.play('snd-pea');
  return fired;
}

var CAT_HOLD_DELAY_MS = 350;
var CAT_CHARGE_MS = 600;
var _catAimState = {
  pressing: false,
  ringVisible: false,
  startedAt: 0,
  appearAt: 0,
  fireAt: 0,
  ringEl: null,
  fillEl: null,
  viewX: 0, viewY: 0,
  rafId: 0,
};
function _ensureRingEl() {
  if (_catAimState.ringEl) return;
  const ring = document.createElement('div');
  ring.className = 'cat-aim-ring';
  const track = document.createElement('div');
  track.className = 'cat-aim-track';
  ring.appendChild(track);
  const fill = document.createElement('div');
  fill.className = 'cat-aim-fill';
  ring.appendChild(fill);
  const orbit = document.createElement('div');
  orbit.className = 'cat-aim-orbit';
  const mc = document.createElement('img');
  mc.className = 'cat-aim-cursik';
  mc.src = 'static/img/ui/cursik.png';
  mc.draggable = false;
  orbit.appendChild(mc);
  ring.appendChild(orbit);
  document.body.appendChild(ring);
  _catAimState.ringEl = ring;
  _catAimState.fillEl = fill;
  _catAimState.orbitEl = orbit;
}
function _positionRing() {
  if (!_catAimState.ringEl) return;
  _catAimState.ringEl.style.left = _catAimState.viewX + 'px';
  _catAimState.ringEl.style.top = _catAimState.viewY + 'px';
}
function _showRing() {
  _ensureRingEl();
  _positionRing();
  _catAimState.ringEl.classList.add('visible');
  _catAimState.ringVisible = true;
}
function _hideRing() {
  if (_catAimState.ringEl) _catAimState.ringEl.classList.remove('visible');
  _catAimState.ringVisible = false;
}
function _catAimTick() {
  if (!_catAimState.pressing) return;
  if (State.paused || State.gameOver) {
    _catAimStop();
    return;
  }
  const now = performance.now();
  if (!_catAimState.ringVisible && now >= _catAimState.appearAt) _showRing();
  if (_catAimState.ringVisible) {
    const total = CAT_CHARGE_MS;
    const elapsed = Math.min(total, now - _catAimState.appearAt);
    const pct = Math.max(0, Math.min(1, elapsed / total));
    if (_catAimState.fillEl) {
      const deg = Math.round(pct * 360);
      _catAimState.fillEl.style.setProperty('--fill-deg', deg + 'deg');
    }
    if (_catAimState.orbitEl) {
      const r = 22;
      const ang = (-90 + pct * 360) * Math.PI / 180;
      const cx = 22 + Math.cos(ang) * r;
      const cy = 22 + Math.sin(ang) * r;
      _catAimState.orbitEl.style.left = (cx - 9) + 'px';
      _catAimState.orbitEl.style.top = (cy - 9) + 'px';
    }
  }
  if (now >= _catAimState.fireAt) {
    const gp = viewportToGame(_catAimState.viewX, _catAimState.viewY);
    fireAllCatmice(gp.x, gp.y);
    _catAimState.fired = true;
    _hideRing();
    return;
  }
  _catAimState.rafId = requestAnimationFrame(_catAimTick);
}
function _catAimStop() {
  _catAimState.pressing = false;
  if (_catAimState.rafId) { cancelAnimationFrame(_catAimState.rafId); _catAimState.rafId = 0; }
  _hideRing();
}

function _catmouseOnPointerDown(e) {
  if (State.paused || State.gameOver) return;
  if (e.button !== 0) return;
  if (!State.plants || !State.plants.length) return;
  let any = false;
  for (let r = 0; r < GRID_ROWS && !any; r++) {
    for (let c = 0; c < GRID_COLS && !any; c++) {
      const p = State.plants[r] && State.plants[r][c];
      if (p && p.type === 'catmouse' && !p.archived && !p.infected) any = true;
    }
  }
  if (!any) return;
  const tgt = e.target;
  if (tgt && tgt.closest && (
    tgt.closest('.plant-bar') ||
    tgt.closest('.hud') ||
    tgt.closest('.pause-menu') ||
    tgt.closest('#screen-docs') ||
    tgt.closest('.modal') ||
    tgt.closest('.credits-modal') ||
    tgt.closest('.cherry-aoe') ||
    tgt.closest('.plant-card-drag') ||
    tgt.closest('.plant-card') ||
    tgt.closest('.sun-entity')
  )) return;
  _catAimState.pressing = true;
  _catAimState.viewX = e.clientX;
  _catAimState.viewY = e.clientY;
  const now = performance.now();
  _catAimState.startedAt = now;
  _catAimState.appearAt = now + CAT_HOLD_DELAY_MS;
  _catAimState.fireAt = _catAimState.appearAt + CAT_CHARGE_MS;
  if (_catAimState.rafId) cancelAnimationFrame(_catAimState.rafId);
  _catAimState.rafId = requestAnimationFrame(_catAimTick);
}
function _catmouseOnPointerMove(e) {
  if (!_catAimState.pressing) return;
  _catAimState.viewX = e.clientX;
  _catAimState.viewY = e.clientY;
  if (_catAimState.ringVisible) _positionRing();
}
function _catmouseOnPointerUp(e) {
  if (!_catAimState.pressing) return;
  _catAimStop();
}
function initCatmouseInput() {
  if (window._catmouseInputBound) return;
  window._catmouseInputBound = true;
  document.addEventListener('pointerdown', _catmouseOnPointerDown, true);
  document.addEventListener('pointermove', _catmouseOnPointerMove, true);
  document.addEventListener('pointerup', _catmouseOnPointerUp, true);
  document.addEventListener('pointercancel', _catmouseOnPointerUp, true);
}
initCatmouseInput();

const SUN_FALL_STEP_PX = 16;
const SUN_FALL_STEP_MS = 250;

function spawnSun(x, y, falling = true, value = 25) {
  const el = makeEl('div', 'sun-entity icon-entity', sunsLayer());
  el.style.position = 'absolute';
  posEl(el, x, y);

  const img = makeEl('img', 'icon-img', el);
  img.src = 'static/img/ui/sun.png';
  img.draggable = false;
  img.onerror = () => { img.remove(); const fb = makeEl('div', null, el); fb.textContent = '☀'; fb.style.fontSize='36px'; fb.style.width='48px'; fb.style.height='48px'; fb.style.textAlign='center'; };

  addFilenameLabel(el, Lang.t('entity.sun'), 'sun-file-label');
  const mc = falling ? spawnMiniCursik(sunsLayer()) : null;
  if (mc) posEl(mc, x + 20, y - 10);
  const id = State.nextSunId++;
  const sun = { id, el, collected: false, y, falling, mc, value };
  State.suns.push(sun);
  GameLog.log('SUN', `Spawned sun #${id} at (${Math.round(x)},${Math.round(y)}), falling=${falling}, value=${value}`);

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
  const despawnKey = `sun_despawn_${id}`;
  let despawnRemaining = 8000;
  let despawnLastTick = Date.now();
  function despawnTick() {
    if (sun.collected || State.gameOver) return;
    const now = Date.now();
    if (State.paused) {
      despawnLastTick = now;
      State._timers[despawnKey] = setTimeout(despawnTick, 100);
      return;
    }
    despawnRemaining -= (now - despawnLastTick);
    despawnLastTick = now;
    if (despawnRemaining <= 0) {
      if (!sun.collected) removeSun(sun);
      return;
    }
    State._timers[despawnKey] = setTimeout(despawnTick, Math.min(despawnRemaining, 200));
  }
  State._timers[despawnKey] = setTimeout(despawnTick, 200);
}

function spawnFallingSun() {
  const w = _scaleFactor < 1 ? window.innerWidth / _scaleFactor : window.innerWidth;
  const x = rnd(80, w - 80);
  const y = 20;
  spawnSun(x, y, true);
}

function collectSun(sun) {
  if (sun.collected) return;
  sun.collected = true;
  sun.el.classList.add('sun-collect');
  if (sun.mc) { sun.mc.remove(); sun.mc = null; }
  State.sun += sun.value || 25;
  GameLog.log('SUN', `Collected sun #${sun.id}, +${sun.value || 25}, total=${State.sun}`);
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
  const file = { id, x, y, row, el, collected: false, kind: 'sys' };
  State.droppedFiles.push(file);
  GameLog.log('FILE', `Dropped sys file #${id} at row ${row} (${Math.round(x)},${Math.round(y)})`);

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

const TABLE_FILE_LIFETIME_MS = 15000;

function dropTableFile(x, y, row) {
  const el = makeEl('div', 'dropped-file-entity dropped-table-entity icon-entity', sunsLayer());
  el.style.position = 'absolute';
  posEl(el, x, y);

  const img = makeEl('img', 'icon-img', el);
  img.src = 'static/img/other/table.png';
  img.draggable = false;
  img.onerror = () => { img.remove(); el.textContent = '📊'; el.style.fontSize = '36px'; };

  addFilenameLabel(el, 'table.xlsx');

  const id = State.nextFileId++;
  const file = { id, x, y, row, el, collected: false, kind: 'table' };
  State.droppedFiles.push(file);
  GameLog.log('FILE', `Dropped table file #${id} at row ${row} (${Math.round(x)},${Math.round(y)})`);

  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (State.paused || State.gameOver) return;
    UI.startFileDrag(file, e);
  });

  el.style.transform = 'scale(0) translateY(-20px)';
  el.style.transition = 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)';
  requestAnimationFrame(() => { el.style.transform = 'scale(1) translateY(0)'; });

  gameTimer(`table_decay_${id}`, () => {
    if (file.collected) return;
    GameLog.log('FILE', `Table file #${id} decayed`);
    file.el.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    file.el.style.opacity = '0';
    file.el.style.transform = 'scale(0.6) translateY(10px)';
    setTimeout(() => { if (!file.collected) removeDroppedFile(file); }, 400);
  }, TABLE_FILE_LIFETIME_MS);

  SFX.play('snd-sun');
  return file;
}

function removeDroppedFile(file) {
  file.collected = true;
  file.el.remove();
  if (file.kind === 'table') clearTimer(`table_decay_${file.id}`);
  if (file.heldByMagnet && file.magnetCol !== undefined && file.magnetRow !== undefined) {
    delete State._magnetBlocked[`${file.magnetCol}_${file.magnetRow}`];
  }
  State.droppedFiles = State.droppedFiles.filter(f => f.id !== file.id);
}

function checkWinrarFileCollision() {
  if (State.droppedFiles.length === 0) return;
  for (const z of State.zombies) {
    if (!z.alive || !z.canArchive) continue;
    for (const file of State.droppedFiles) {
      if (file.collected || file.heldByMagnet) continue;
      if (file.kind === 'table') continue;
      if (file.row === z.row && Math.abs(z.x - file.x) < CELL_W * 0.8) {
        GameLog.log('BSOD', `WinRAR zombie #${z.id} archived dropped sys file #${file.id} → BSOD`);
        spawnParticles(file.x + 24, file.y + 20, '#ff0000', 15);
        Game.triggerGameOver(null, 'winrar_file_collision');
        return;
      }
    }
  }
}

const ZOMBIE_TYPES = {
  zombie:      { name: 'zombie.webp', file: 'zombie.webp', hp: [5, 7], speed: 0.6, displayName: 'zombie.webp' },
  your_death:  { name: 'your-death.jpg', file: 'your-death.jpg', hp: 999, speed: 0.3, isBoss: true, displayName: 'your-death.jpg' },
  system_zombie: {
    name: 'system-zombie.jpg', file: 'system-zombie.jpg', displayName: 'system-zombie.jpg',
    hp: [5, 7], speed: 0.6,
    hasSystemFile: true, fileHp: 4,
  },
  hdd_zombie: {
    name: 'hdd-zombie.jpg', file: 'hdd-zombie.jpg', displayName: 'hdd-zombie.jpg',
    hp: [10, 12], speed: 0.4,
    armorHits: 3, armorType: 'hdd',
  },
  ssd_zombie: {
    name: 'ssd-zombie.jpg', file: 'ssd-zombie.jpg', displayName: 'ssd-zombie.jpg',
    hp: [3, 5], speed: 0.8,
    armorHits: 2, armorType: 'ssd',
  },
  winrar_zombie: {
    name: 'winrar-zombie.png', file: 'winrar-zombie.png', displayName: 'winrar-zombie.png',
    hp: [5, 7], speed: 0.5,
    canArchive: true,
  },
  trojan_catapult: {
    name: 'trojan-catapult.jpg', file: 'trojan-catapult.jpg',
    displayName: 'trojan-catapult.jpg',
    hp: [8, 10], speed: 0.4,
    isCatapult: true, trojanInterval: 5000,
  },
  bungee: {
    name: 'bungee.jpg', file: 'bungee.jpg',
    displayName: 'bungee.jpg',
    hp: 8, speed: 0,
    isBungee: true,
  },
  flag_zombie: {
    name: 'flag-zombie.webp', file: 'flag-zombie.webp',
    displayName: 'flag-zombie.webp',
    hp: [6, 8], speed: 0.5,
    isSupport: true,
    auraRadius: 1,
  },
  pole_loud: {
    name: 'pole-loud.png', file: 'pole-loud.png',
    displayName: 'pole-loud.png',
    hp: [4, 6], speed: 0.6,
    volumeShift: 0.1,
  },
  pole_quiet: {
    name: 'pole-quiet.png', file: 'pole-quiet.png',
    displayName: 'pole-quiet.png',
    hp: [4, 6], speed: 0.6,
    volumeShift: -0.1,
  },
  excel_zombie: {
    name: 'excel-zombie.png', file: 'excel-zombie.png',
    displayName: 'excel-zombie.png',
    hp: 1, speed: 0.4,
    isInvincible: true,
    armorHits: 3, armorType: 'excel',
    excelSlowPerN: 2,
    excelSlowPct: 0.1,
  },
  petya_zombie: {
    name: 'zombie-petya.png', file: 'zombie-petya.png',
    displayName: 'zombie-petya.png',
    hp: [10, 14], speed: 0.55,
    isPetya: true,
    petyaRate: 1.1,
    petyaSlowMult: 0.7,
    petyaKillDrop: 4,
  },
  chrome_zombie: {
    name: 'chrome-zombie.png', file: 'chrome-zombie.png',
    displayName: 'chrome-zombie.png',
    hp: [6, 8], speed: 0.5,
    isChrome: true,
    chromeDelayMin: 2000,
    chromeDelayMax: 3000,
  },
  txt_zombie: {
    name: 'txt-zombie.png', file: 'txt-zombie.png',
    displayName: 'txt-zombie.png',
    hp: [7, 10], speed: 0.5,
    isTxt: true,
    txtMutateCells: 2,
  },
};

const TXT_MUTATION_TARGETS = ['hdd_zombie', 'ssd_zombie', 'winrar_zombie', 'system_zombie', 'flag_zombie', 'pole_loud', 'pole_quiet', 'excel_zombie', 'trojan_catapult', 'zombie'];

const TXT_MUTATION_TABLE = {
  hdd_zombie:      { stat: 'speed',     delta: 0.08,  label: '+8% скорость' },
  ssd_zombie:      { stat: 'speed',     delta: 0.12,  label: '+12% скорость' },
  winrar_zombie:   { stat: 'armorHits', delta: 1,     label: '+1 броня' },
  system_zombie:   { stat: 'fileHp',    delta: 1,     label: '+1 hp файла' },
  flag_zombie:     { stat: 'hp',        delta: 1,     label: '+1 hp' },
  pole_loud:       { stat: 'volumeShift', delta: 0.05, label: '+5% громкость' },
  pole_quiet:      { stat: 'volumeShift', delta: -0.05, label: '-5% громкость' },
  excel_zombie:    { stat: 'armorHits', delta: 2,     label: '+2 броня' },
  trojan_catapult: { stat: 'trojanInterval', delta: -300, label: 'быстрее стрельба' },
  zombie:          { stat: 'hp',        delta: 1,     label: '+1 hp' },
};

const CHROME_SUMMON_WEIGHTS = {
  zombie: 50,
  pole_loud: 28,
  pole_quiet: 28,
  flag_zombie: 18,
  system_zombie: 14,
  winrar_zombie: 12,
  hdd_zombie: 9,
  ssd_zombie: 9,
  trojan_catapult: 6,
  excel_zombie: 5,
  petya_zombie: 3,
};

function spawnZombie(type, row, opts) {
  const cfg = ZOMBIE_TYPES[type];
  const editorMode = !!(opts && opts.editor);
  const mut = editorMode ? null : (State.zombieMutations[type] || null);
  let maxHp = Array.isArray(cfg.hp) ? rndInt(cfg.hp[0], cfg.hp[1]) : cfg.hp;
  if (mut && mut.hp) maxHp += mut.hp;

  if (cfg.isBungee && !editorMode) return spawnBungeeZombie(row, opts && opts.col, maxHp);
  if (cfg.isBungee && editorMode) return spawnBungeeEditorGhost(type, row, opts && opts.col);

  const rightEdge = getGridOrigin().x + GRID_COLS * CELL_W;
  const useCol = opts && typeof opts.col === 'number';
  const colPos = useCol ? cellToPixel(opts.col, row) : null;
  const startX = useCol ? colPos.x : rightEdge + 80;
  const pos = useCol ? colPos : cellToPixel(GRID_COLS - 1, row);
  const y = pos.y;

  const el = makeEl('div', 'zombie-entity icon-entity', entitiesLayer());
  el.dataset.type = type;
  el.style.position = 'absolute';
  posEl(el, startX, y);

  const img = makeEl('img', 'icon-img', el);
  img.src = `static/img/zombies/${cfg.file}`;
  img.alt = cfg.file;
  img.draggable = false;
  img.onerror = () => { el.textContent = '🧟'; el.style.fontSize = '60px'; };

  let label = Lang.t('zombie.name.' + type);
  if (type === 'zombie') {
    const c = State._zombieCopyCount++;
    if (c === 0) label = Lang.t('zombie.name.zombie');
    else if (c === 1) label = Lang.t('zombie.copy');
    else label = Lang.t('zombie.copy_n', c - 1);
  }
  addFilenameLabel(el, label);

  const hpBar = makeEl('div', 'zombie-hp-bar', el);
  const hpChrome = makeEl('div', 'zombie-hp-chrome', hpBar);
  const hpFill = makeEl('div', 'zombie-hp-fill', hpChrome);
  const hpText = makeEl('span', 'zombie-hp-text', hpBar);
  hpFill.style.width = '100%';
  hpText.textContent = maxHp + '/' + maxHp;

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
    isCatapult: cfg.isCatapult || false,
    isBungee: false,
    isSupport: cfg.isSupport || false,
    auraRadius: cfg.auraRadius || 0,
    volumeShift: cfg.volumeShift || 0,
    isInvincible: cfg.isInvincible || false,
    isPetya: cfg.isPetya || false,
    isChrome: cfg.isChrome || false,
    isTxt: cfg.isTxt || false,
  };

  if (editorMode) {
    zombie._editorGhost = true;
    el.classList.add('editor-zombie-ghost');
    if (hpBar) hpBar.style.display = 'none';
    return zombie;
  }

  if (mut) {
    if (mut.speed) zombie.speed = (zombie.speed || cfg.speed) * (1 + mut.speed);
    if (mut.damage) zombie.bonusDamage = (zombie.bonusDamage || 0) + mut.damage;
    if (mut.armorHits) zombie.armorHits = (zombie.armorHits || 0) + mut.armorHits;
    if (mut.fileHp) zombie.fileHp = (zombie.fileHp || 0) + mut.fileHp;
    if (mut.volumeShift) zombie.volumeShift = (zombie.volumeShift || 0) + mut.volumeShift;
    if (mut.trojanInterval) zombie._mutTrojanIntervalDelta = mut.trojanInterval;
  }

  if (zombie.isTxt) {
    zombie._txtSpawnX = startX;
    zombie._txtMutationsApplied = 0;
  }

  if (zombie.isChrome) {
    const delay = rndInt(cfg.chromeDelayMin || 2000, cfg.chromeDelayMax || 3000);
    zombie._chromeStartAt = performance.now() + delay;
    zombie._chromeState = 'walking';
  }

  if (zombie.isInvincible) {
    hpBar.style.display = 'none';
  }

  if (zombie.hasSystemFile) {
    zombie._fileEl = null;
  }

  if (zombie.armorType) {
    zombie._armorEl = null;
  }

  if (type === 'excel_zombie') {
    zombie._excelDmgAccum = 0;
    zombie._excelSpeedMod = 0;
    zombie._excelReversed = false;
  }

  if (zombie.isCatapult) {
    const trojanKey = `trojan_${id}`;
    const baseInterval = cfg.trojanInterval || 5000;
    const interval = Math.max(1500, baseInterval + (zombie._mutTrojanIntervalDelta || 0));
    gameInterval(trojanKey, () => fireTrojan(zombie), interval);
  }

  if (zombie.volumeShift) {
    SFX._volume = Math.max(0, SFX._volume + zombie.volumeShift);
    SFX.applyVolume();
    UI.syncVolumeSlider();
  }

  State.zombies.push(zombie);
  if (_showZombieIds) _attachZombieIdBadge(zombie);
  GameLog.log('ZOMBIE', `Spawned ${type} #${id} on row ${row}, hp=${maxHp}, armor=${zombie.armorHits}, sysFile=${zombie.hasSystemFile}, mut=${mut ? JSON.stringify(mut) : 'none'}`);

  State.cursik.queue.push(id);
  if (!State.cursik.busy) processCursikQueue();

  return zombie;
}

function spawnBungeeEditorGhost(type, row, col) {
  if (col == null) col = 3;
  const targetPos = cellToPixel(col, row);
  const startY = targetPos.y - CELL_H * 4;

  const el = makeEl('div', 'bungee-entity editor-zombie-ghost editor-bungee', entitiesLayer());
  el.style.position = 'absolute';
  el.style.zIndex = '40';
  posEl(el, targetPos.x, startY);

  makeEl('div', 'bungee-cube', el);
  const content = makeEl('div', 'bungee-content', el);

  const vgaWrap = makeEl('div', 'bungee-part-wrap bungee-vga-wrap', content);
  const vga = makeEl('img', 'bungee-part bungee-vga', vgaWrap);
  vga.src = 'static/img/zombies/vga.png';
  vga.draggable = false;
  addFilenameLabel(vgaWrap, 'vga.png');

  const wiresWrap = makeEl('div', 'bungee-wires', content);
  const wireCount = 8;
  for (let i = 0; i < wireCount; i++) {
    const wireDiv = makeEl('div', 'bungee-wire-wrap', wiresWrap);
    const wire = makeEl('img', 'bungee-wire', wireDiv);
    wire.src = 'static/img/zombies/wire.png';
    wire.draggable = false;
    addFilenameLabel(wireDiv, 'wire.png');
  }

  const tarzWrap = makeEl('div', 'bungee-part-wrap', content);
  const tarz = makeEl('img', 'bungee-part bungee-tarz', tarzWrap);
  tarz.src = 'static/img/zombies/bungee.jpg';
  tarz.draggable = false;
  addFilenameLabel(tarzWrap, Lang.t('entity.bungee_label'));

  const id = State.nextZombieId++;
  return {
    id, type, row, col,
    x: targetPos.x, y: startY,
    hp: 0, maxHp: 0,
    alive: true,
    el,
    _editorGhost: true,
    isBungee: true,
  };
}

function spawnBungeeZombie(row, col, maxHp) {
  if (col == null) {
    const candidates = [];
    for (let c = 0; c < GRID_COLS; c++) {
      if (State.plants[row] && State.plants[row][c]) candidates.push(c);
    }
    if (candidates.length === 0) {
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          if (State.plants[r] && State.plants[r][c]) candidates.push({ r, c });
        }
      }
      if (candidates.length === 0) return null;
      const pick = candidates[rndInt(0, candidates.length - 1)];
      row = pick.r;
      col = pick.c;
    } else {
      col = candidates[rndInt(0, candidates.length - 1)];
    }
  }

  const targetPos = cellToPixel(col, row);
  const targetY = targetPos.y - 180;
  const startY = -400;

  const el = makeEl('div', 'bungee-entity', entitiesLayer());
  el.style.position = 'absolute';
  el.style.zIndex = '35';
  posEl(el, targetPos.x, startY);

  const cube = makeEl('div', 'bungee-cube', el);

  const content = makeEl('div', 'bungee-content', el);

  const vgaWrap = makeEl('div', 'bungee-part-wrap bungee-vga-wrap', content);
  const vga = makeEl('img', 'bungee-part bungee-vga', vgaWrap);
  vga.src = 'static/img/zombies/vga.png';
  vga.draggable = false;
  addFilenameLabel(vgaWrap, 'vga.png');

  const wiresWrap = makeEl('div', 'bungee-wires', content);
  const wireCount = rndInt(7, 8);
  for (let i = 0; i < wireCount; i++) {
    const wireDiv = makeEl('div', 'bungee-wire-wrap', wiresWrap);
    const wire = makeEl('img', 'bungee-wire', wireDiv);
    wire.src = 'static/img/zombies/wire.png';
    wire.draggable = false;
    addFilenameLabel(wireDiv, 'wire.png');
  }

  const tarzWrap = makeEl('div', 'bungee-part-wrap', content);
  const tarz = makeEl('img', 'bungee-part bungee-tarz', tarzWrap);
  tarz.src = 'static/img/zombies/bungee.jpg';
  tarz.draggable = false;
  addFilenameLabel(tarzWrap, Lang.t('entity.bungee_label'));

  const hpBar = makeEl('div', 'zombie-hp-bar', el);
  const hpChrome = makeEl('div', 'zombie-hp-chrome', hpBar);
  const hpFill = makeEl('div', 'zombie-hp-fill', hpChrome);
  const hpText = makeEl('span', 'zombie-hp-text', hpBar);
  hpFill.style.width = '100%';
  hpText.textContent = maxHp + '/' + maxHp;

  const mc = spawnMiniCursik();

  const id = State.nextZombieId++;
  const zombie = {
    id, type: 'bungee', row, col,
    x: targetPos.x, y: startY,
    hp: maxHp, maxHp,
    speed: 0,
    isBoss: false,
    alive: true,
    el, hpFill, hpText,
    selected: false,
    reachedEnd: false,
    hasSystemFile: false, fileHp: 0,
    armorHits: 0, armorType: null, armorBroken: false,
    canArchive: false, _archiveTimer: null,
    abilitiesDisabled: false,
    isCatapult: false,
    isBungee: true,
    _bungeePhase: 'descending',
    _bungeeCol: col,
    _bungeeTargetY: targetY,
    _bungeeMc: mc,
    _bungeeGrabbedPlant: null,
  };

  State.zombies.push(zombie);
  if (_showZombieIds) _attachZombieIdBadge(zombie);
  GameLog.log('ZOMBIE', `Spawned bungee #${id} targeting [${col},${row}]`);

  posEl(mc, targetPos.x + 20, startY + 180);

  startBungeeDescend(zombie);
  return zombie;
}

function startBungeeDescend(zombie) {
  const targetY = zombie._bungeeTargetY;
  const duration = 1000;
  const startY = zombie.y;
  const startTime = performance.now();

  function step() {
    if (!zombie.alive || State.gameOver) return;
    if (State.paused) { setTimeout(step, 100); return; }
    const elapsed = performance.now() - startTime;
    const t = Math.min(1, elapsed / duration);
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    zombie.y = startY + (targetY - startY) * eased;
    posEl(zombie.el, zombie.x, zombie.y);
    if (zombie._bungeeMc) posEl(zombie._bungeeMc, zombie.x + 20, zombie.y + 180);

    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      zombie._bungeePhase = 'grabbing';
      startBungeeGrab(zombie);
    }
  }
  requestAnimationFrame(step);
}

function startBungeeGrab(zombie) {
  const col = zombie._bungeeCol;
  const row = zombie.row;
  const plant = State.plants[row][col];

  if (plant && plant.type === 'logic_mine' && !plant.archived && !plant.infected) {
    GameLog.log('BUNGEE', `Bungee #${zombie.id} grabbed mine at [${col},${row}] → instant detonation`);
    triggerMineExplosion(plant);
    if (zombie.alive) killBungee(zombie);
    return;
  }

  if (plant) {
    zombie._bungeeGrabbedPlant = { col, row };
    plant._bungeeGrabbed = true;
    plant.el.style.opacity = '0.5';
    plant.el.style.filter = 'brightness(0.6)';
    clearTimer(`plant_sun_${col}_${row}`);
    clearTimer(`plant_shoot_${col}_${row}`);
    clearTimer(`magnet_${col}_${row}`);
    clearTimer(`plant_drop_${col}_${row}`);
    GameLog.log('BUNGEE', `Bungee #${zombie.id} grabbed plant ${plant.type} at [${col},${row}]`);
  }

  gameTimer(`bungee_ascend_${zombie.id}`, () => {
    if (!zombie.alive) return;
    zombie._bungeePhase = 'ascending';
    startBungeeAscend(zombie);
  }, 2000);
}

function killBungee(zombie) {
  if (!zombie || !zombie.alive) return;
  zombie.alive = false;
  if (zombie._bungeeGrabbedPlant) {
    const g = zombie._bungeeGrabbedPlant;
    const p = State.plants[g.row] && State.plants[g.row][g.col];
    if (p) {
      p._bungeeGrabbed = false;
      p.el.style.opacity = '';
      p.el.style.filter = '';
    }
    zombie._bungeeGrabbedPlant = null;
  }
  clearTimer(`bungee_ascend_${zombie.id}`);
  spawnParticles(zombie.x + 40, zombie.y + 80, '#ff3300', 8);
  if (zombie.el) zombie.el.remove();
  if (zombie._bungeeMc) zombie._bungeeMc.remove();
  State.zombies = State.zombies.filter(z => z.id !== zombie.id);
  GameLog.log('BUNGEE', `Bungee #${zombie.id} killed by plant explosion`);
}

function startBungeeAscend(zombie) {
  const startY = zombie.y;
  const targetY = -450;
  const duration = 800;
  const startTime = performance.now();

  const grabbed = zombie._bungeeGrabbedPlant;
  let plantEl = null;
  let plantStartY = 0;
  if (grabbed) {
    const plant = State.plants[grabbed.row][grabbed.col];
    if (plant && plant._bungeeGrabbed) {
      plantEl = plant.el;
      plantStartY = parseInt(plantEl.style.top) || cellToPixel(grabbed.col, grabbed.row).y;
      plantEl.style.transition = 'none';
      plantEl.style.zIndex = '34';
    }
  }

  function step() {
    if (!zombie.alive || State.gameOver) {
      if (plantEl) { plantEl.style.zIndex = ''; }
      return;
    }
    if (State.paused) { setTimeout(step, 100); return; }
    const elapsed = performance.now() - startTime;
    const t = Math.min(1, elapsed / duration);
    zombie.y = startY + (targetY - startY) * t;
    posEl(zombie.el, zombie.x, zombie.y);
    if (zombie._bungeeMc) posEl(zombie._bungeeMc, zombie.x + 20, zombie.y + 180);

    if (plantEl) {
      const py = plantStartY + (targetY - startY) * t;
      plantEl.style.top = py + 'px';
      plantEl.style.opacity = String(1 - t * 0.5);
    }

    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      if (grabbed) {
        const plant = State.plants[grabbed.row][grabbed.col];
        if (plant && plant._bungeeGrabbed) {
          removePlant(grabbed.col, grabbed.row, true);
          GameLog.log('BUNGEE', `Bungee #${zombie.id} stole plant at [${grabbed.col},${grabbed.row}]`);
        }
        zombie._bungeeGrabbedPlant = null;
      }
      zombie.alive = false;
      zombie.el.remove();
      if (zombie._bungeeMc) zombie._bungeeMc.remove();
      State.zombies = State.zombies.filter(z => z.id !== zombie.id);
    }
  }
  requestAnimationFrame(step);
}

function isShieldedByFlag(zombie) {
  var ox = getGridOrigin().x;
  var zCol = Math.floor((zombie.x - ox) / CELL_W);
  for (var i = 0; i < State.zombies.length; i++) {
    var f = State.zombies[i];
    if (!f.alive || !f.isSupport || f.id === zombie.id) continue;
    var fCol = Math.floor((f.x - ox) / CELL_W);
    var rowDiff = Math.abs(f.row - zombie.row);
    if (rowDiff >= 1 && rowDiff <= f.auraRadius) {
      if (zCol >= fCol && zCol <= fCol + 1) return true;
    }
  }
  return false;
}

function damageZombie(zombie, dmg) {
  if (!zombie.alive) return;
  if (isShieldedByFlag(zombie)) {
    spawnParticles(zombie.x + 40, zombie.y + 20, '#4488ff', 3);
    return;
  }

  if (zombie.armorType === 'excel') {
    if (!zombie.armorBroken && zombie.armorHits > 0) {
      zombie.armorHits -= dmg;
      GameLog.log('ZOMBIE', `Damage ${dmg} to excel #${zombie.id} door, armorHits=${zombie.armorHits}`);
      if (zombie.armorHits <= 0) {
        zombie.armorBroken = true;
        zombie.armorHits = 0;
        const img = zombie.el.querySelector('.icon-img');
        if (img) img.src = 'static/img/zombies/zombie.webp';
        spawnParticles(zombie.x + 40, zombie.y + 30, '#888', 6);
        GameLog.log('ZOMBIE', `Excel zombie #${zombie.id} door broken, can be slowed now`);
      }
    } else {
      excelSpeedCheck(zombie, dmg);
    }
    return;
  }

  if (zombie.isInvincible) {
    excelSpeedCheck(zombie, dmg);
    return;
  }

  if (zombie.armorType && !zombie.armorBroken && zombie.armorHits > 0) {
    zombie.armorHits -= dmg;
    GameLog.log('ZOMBIE', `Damage ${dmg} to ${zombie.type} #${zombie.id} armor, armorHits=${zombie.armorHits}`);
    if (zombie.armorHits <= 0) {
      GameLog.log('ZOMBIE', `Armor broken on ${zombie.type} #${zombie.id}`);
      zombie.armorBroken = true;
      if (zombie._armorEl) { zombie._armorEl.remove(); zombie._armorEl = null; }
      const img = zombie.el.querySelector('.icon-img');
      if (img) img.src = 'static/img/zombies/zombie.webp';
      spawnParticles(zombie.x + 40, zombie.y + 30, '#888', 6);
      const overflow = -zombie.armorHits;
      if (overflow > 0) {
        zombie.hp = Math.max(0, zombie.hp - overflow);
        if (zombie.hp <= 0) killZombie(zombie);
      }
    }
    return;
  }

  zombie.hp = Math.max(0, zombie.hp - dmg);
  GameLog.log('ZOMBIE', `Damage ${dmg} to ${zombie.type} #${zombie.id}, hp=${zombie.hp}/${zombie.maxHp}`);
  const pct = (zombie.hp / zombie.maxHp) * 100;
  zombie.hpFill.style.width = pct + '%';
  if (zombie.hpText) zombie.hpText.textContent = Math.max(0, zombie.hp) + '/' + zombie.maxHp;

  if (zombie.hp <= 0) killZombie(zombie);
  excelSpeedCheck(zombie, dmg);
}

function excelSpeedCheck(zombie, dmg) {
  if (zombie.type !== 'excel_zombie' || !zombie.alive) return;
  const cfg = ZOMBIE_TYPES.excel_zombie;
  zombie._excelDmgAccum += dmg;
  while (zombie._excelDmgAccum >= cfg.excelSlowPerN) {
    zombie._excelDmgAccum -= cfg.excelSlowPerN;
    if (!zombie._excelReversed) {
      zombie._excelSpeedMod -= cfg.excelSlowPct;
      if (zombie._excelSpeedMod <= -0.7) {
        zombie._excelReversed = true;
        zombie._excelSpeedMod = 0;
        GameLog.log('ZOMBIE', `Excel zombie #${zombie.id} REVERSED!`);
      }
    } else {
      zombie._excelSpeedMod += cfg.excelSlowPct;
    }
  }
}

function killZombie(zombie, opts) {
  zombie.alive = false;
  const devKill = opts === true || (opts && opts.dev);
  const dropFile = opts && opts.dropFile;
  GameLog.log('ZOMBIE', `Killed ${zombie.type} #${zombie.id} at row ${zombie.row} x=${Math.round(zombie.x)} (dev=${devKill}, dropFile=${!!dropFile})`);

  if (zombie.isPetya) {
    const drop = ZOMBIE_TYPES.petya_zombie.petyaKillDrop || 4;
    State.petyaPct = Math.max(0, State.petyaPct - drop);
    State._petyaDecayAccel = 0;
  }

  if (zombie.hasSystemFile && zombie.fileHp > 0) {
    zombie.hasSystemFile = false;
    zombie.fileHp = 0;
    if (zombie._fileEl) { zombie._fileEl.remove(); zombie._fileEl = null; }
    if (dropFile) {
      const o = getGridOrigin();
      const zCol = Math.round((zombie.x - o.x) / CELL_W);
      const zPos = cellToPixel(Math.max(0, Math.min(GRID_COLS - 1, zCol)), zombie.row);
      dropSystemFile(zPos.x + CELL_W / 2 - 24, zPos.y + CELL_H / 2 - 24, zombie.row);
      spawnParticles(zombie.x + 40, zombie.y + 20, '#4488ff', 10);
    } else if (!devKill) {
      const o = getGridOrigin();
      const zCol = Math.round((zombie.x - o.x) / CELL_W);
      const safeCol = Math.max(0, Math.min(GRID_COLS - 1, zCol));
      GameLog.log('BSOD', `System file destroyed on zombie #${zombie.id} → BSOD`);
      spawnParticles(zombie.x + 40, zombie.y + 20, '#ff0000', 15);
      Game.triggerGameOver(null, 'system_file_destroyed');
      return;
    }
  }

  if (zombie.isCatapult) clearTimer(`trojan_${zombie.id}`);

  if (zombie.isChrome) chromeCleanup(zombie);

  if (zombie.volumeShift) {
    SFX._volume = Math.min(1, SFX._volume - zombie.volumeShift);
    SFX.applyVolume();
    UI.syncVolumeSlider();
  }

  if (zombie.isBungee) {
    clearTimer(`bungee_ascend_${zombie.id}`);
    if (zombie._bungeeGrabbedPlant) {
      const g = zombie._bungeeGrabbedPlant;
      const plant = State.plants[g.row][g.col];
      if (plant && plant._bungeeGrabbed) {
        plant._bungeeGrabbed = false;
        var originalPos = cellToPixel(g.col, g.row);
        plant.el.style.top = originalPos.y + 'px';
        plant.el.style.left = originalPos.x + 'px';
        plant.el.style.zIndex = '';
        plant.el.style.filter = '';
        plant.el.style.opacity = '0';
        plant.el.style.transform = 'translateY(-40px) scale(0.8)';
        plant.el.style.transition = 'opacity 0.4s ease, transform 0.4s cubic-bezier(0.34,1.56,0.64,1)';
        requestAnimationFrame(() => {
          plant.el.style.opacity = '1';
          plant.el.style.transform = 'translateY(0) scale(1)';
        });
        setTimeout(() => {
          if (plant.el) { plant.el.style.transition = ''; plant.el.style.transform = ''; }
        }, 500);
        var pt = plant.type;
        if (pt === 'sunflower' || pt === 'sun_mushroom') scheduleSunflower(plant);
        else if (pt === 'peashooter' || pt === 'siamese_peashooter' || pt === 'double_peashooter' || pt === 'snow_peashooter') scheduleShoot(plant);
        else if (pt === 'folder_magnet') scheduleFolderMagnet(plant);
        else if (pt === 'daisy') scheduleDaisy(plant);
        GameLog.log('BUNGEE', `Bungee #${zombie.id} killed, plant at [${g.col},${g.row}] rescued`);
        spawnParticles(zombie.x + 40, zombie.y + 100, '#7fff00', 10);
      }
      zombie._bungeeGrabbedPlant = null;
    }
    spawnParticles(zombie.x + 40, zombie.y + 50, '#4488ff', 15);
    zombie.el.style.transition = 'opacity 0.3s, transform 0.3s';
    zombie.el.style.opacity = '0';
    zombie.el.style.transform = 'scale(0.5) translateY(-30px)';
    if (zombie._bungeeMc) zombie._bungeeMc.remove();
    setTimeout(() => {
      zombie.el.remove();
      State.zombies = State.zombies.filter(z => z.id !== zombie.id);
    }, 350);
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
    setTimeout(processCursikQueue, getCursikCooldown());
  }

  setTimeout(() => {
    zombie.el.remove();
    State.zombies = State.zombies.filter(z => z.id !== zombie.id);
  }, 350);
}

function tickTxtZombie(zombie) {
  if (!zombie.isTxt || !zombie.alive) return;
  const cellsPassed = Math.floor((zombie._txtSpawnX - zombie.x) / CELL_W);
  const dueCount = Math.floor(cellsPassed / (ZOMBIE_TYPES.txt_zombie.txtMutateCells || 2));
  if (dueCount > zombie._txtMutationsApplied) {
    const need = dueCount - zombie._txtMutationsApplied;
    for (let i = 0; i < need; i++) applyTxtMutation(zombie);
    zombie._txtMutationsApplied = dueCount;
  }
}

function applyTxtMutation(zombie) {
  const liveTypes = new Set();
  for (const z of State.zombies) {
    if (!z.alive || z.id === zombie.id || z.isBoss) continue;
    if (TXT_MUTATION_TABLE[z.type]) liveTypes.add(z.type);
  }
  if (liveTypes.size === 0) {
    GameLog.log('TXT', `No mutable zombies on field, skipping`);
    return;
  }
  const arr = Array.from(liveTypes);
  const targetType = arr[Math.floor(Math.random() * arr.length)];
  const rule = TXT_MUTATION_TABLE[targetType];
  if (!rule) return;

  if (!State.zombieMutations[targetType]) State.zombieMutations[targetType] = {};
  const bucket = State.zombieMutations[targetType];
  bucket[rule.stat] = (bucket[rule.stat] || 0) + rule.delta;

  showTxtMutationPopup(zombie, targetType, rule.label);
  GameLog.log('TXT', `Mutation: ${targetType} ${rule.stat} ${rule.delta > 0 ? '+' : ''}${rule.delta}`);

  applyMutationToLiveZombies(targetType, rule);
}

function applyMutationToLiveZombies(targetType, rule) {
  for (const z of State.zombies) {
    if (!z.alive || z.type !== targetType) continue;
    if (rule.stat === 'speed') z.speed = z.speed * (1 + rule.delta);
    else if (rule.stat === 'damage') z.bonusDamage = (z.bonusDamage || 0) + rule.delta;
    else if (rule.stat === 'armorHits') z.armorHits = (z.armorHits || 0) + rule.delta;
    else if (rule.stat === 'fileHp') {
      if (z.hasSystemFile) z.fileHp = (z.fileHp || 0) + rule.delta;
    }
    else if (rule.stat === 'hp') {
      z.maxHp += rule.delta;
      z.hp += rule.delta;
      const pct = Math.max(0, Math.min(100, 100 * z.hp / z.maxHp));
      if (z.hpFill) z.hpFill.style.width = pct + '%';
      if (z.hpText) z.hpText.textContent = z.hp + '/' + z.maxHp;
    }
  }
}

function showTxtMutationPopup(zombie, targetType, label) {
  const pop = makeEl('div', 'txt-mutation-pop', entitiesLayer());
  pop.style.position = 'absolute';
  posEl(pop, zombie.x + 10, zombie.y - 8);
  const name = (ZOMBIE_TYPES[targetType] && ZOMBIE_TYPES[targetType].file) || targetType;
  pop.textContent = `${name.replace(/\.[^.]+$/, '')}: ${label}`;
  setTimeout(() => { pop.classList.add('out'); }, 600);
  setTimeout(() => { pop.remove(); }, 1400);
}

function pickWeightedChromeZombie() {
  const entries = Object.entries(CHROME_SUMMON_WEIGHTS);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [type, w] of entries) {
    r -= w;
    if (r <= 0) return type;
  }
  return entries[0][0];
}

function startChromeSearch(zombie) {
  if (!zombie.alive || zombie._chromeState !== 'walking') return;
  zombie._chromeState = 'searching';

  const bar = makeEl('div', 'chrome-search-bar', entitiesLayer());
  bar.style.position = 'absolute';
  posEl(bar, zombie.x - 30, zombie.y - 56);
  const icon = makeEl('span', 'chrome-search-icon', bar);
  icon.textContent = '🔍';
  const txt = makeEl('span', 'chrome-search-text', bar);
  txt.textContent = '';
  zombie._chromeBar = bar;

  const mc = spawnMiniCursik();
  mc.classList.add('medium-cursik');
  zombie._chromeMc = mc;
  posEl(mc, zombie.x + 20, zombie.y - 80);

  const word = 'Зомби';
  let charIdx = 0;

  function clickBar() {
    if (!zombie.alive) return chromeCleanup(zombie);
    posEl(mc, zombie.x + 30, zombie.y - 40);
    gameTimer(`chrome_type_${zombie.id}`, typeChar, 350);
  }

  function typeChar() {
    if (!zombie.alive) return chromeCleanup(zombie);
    if (charIdx < word.length) {
      txt.textContent += word[charIdx++];
      gameTimer(`chrome_type_${zombie.id}`, typeChar, 150 + Math.random() * 80);
    } else {
      gameTimer(`chrome_click_search_${zombie.id}`, clickSearch, 300);
    }
  }

  function clickSearch() {
    if (!zombie.alive) return chromeCleanup(zombie);
    posEl(mc, zombie.x - 18, zombie.y - 40);
    gameTimer(`chrome_open_modal_${zombie.id}`, () => {
      if (zombie._chromeBar) { zombie._chromeBar.remove(); zombie._chromeBar = null; }
      openChromeModal(zombie);
    }, 250);
  }

  gameTimer(`chrome_click_bar_${zombie.id}`, clickBar, 400);
}

function openChromeModal(zombie) {
  if (!zombie.alive) return chromeCleanup(zombie);
  zombie._chromeState = 'modal';

  const picks = [];
  let flagCount = 0;
  let guard = 0;
  while (picks.length < 4 && guard++ < 64) {
    let t = pickWeightedChromeZombie();
    if (t === 'flag_zombie') {
      if (flagCount >= 1) continue;
      flagCount++;
    }
    picks.push(t);
  }
  while (picks.length < 4) picks.push('zombie');
  zombie._chromePicks = picks;

  const modal = makeEl('div', 'chrome-search-modal', entitiesLayer());
  modal.style.position = 'absolute';
  posEl(modal, zombie.x - 90, zombie.y - 130);
  zombie._chromeModal = modal;
  zombie._chromeItems = [];

  picks.forEach((t, i) => {
    const item = makeEl('div', 'chrome-search-item', modal);
    item.dataset.type = t;
    const img = makeEl('img', null, item);
    img.src = `static/img/zombies/${ZOMBIE_TYPES[t].file}`;
    img.draggable = false;
    img.onerror = () => { img.style.display = 'none'; };
    zombie._chromeItems.push(item);
  });

  gameTimer(`chrome_pick_${zombie.id}`, () => {
    if (!zombie.alive) return chromeCleanup(zombie);
    summonNextChromeZombie(zombie, 0);
  }, 500);
}

function getChromeOriginCell(zombie) {
  const o = getGridOrigin();
  const col = Math.max(0, Math.min(GRID_COLS - 1, Math.floor((zombie.x - o.x) / CELL_W)));
  return { col, row: zombie.row };
}

function getChromePlusTarget(zombie, idx) {
  const origin = getChromeOriginCell(zombie);
  const offsets = [
    { dc: 0,  dr: -1 },
    { dc: 1,  dr: 0  },
    { dc: 0,  dr: 1  },
    { dc: -1, dr: 0  },
  ];
  const o = offsets[idx];
  let col = origin.col + o.dc;
  let row = origin.row + o.dr;
  if (col < 0 || col >= GRID_COLS) col = origin.col;
  if (row < 0 || row >= GRID_ROWS) row = origin.row;
  return { col, row };
}

function summonNextChromeZombie(zombie, idx) {
  if (!zombie.alive) return chromeCleanup(zombie);
  if (idx >= 4) {
    chromeCleanup(zombie);
    zombie._chromeState = 'done';
    return;
  }

  zombie._chromeState = 'summoning';
  const mc = zombie._chromeMc;
  const item = zombie._chromeItems && zombie._chromeItems[idx];
  const summonType = zombie._chromePicks[idx];
  const target = getChromePlusTarget(zombie, idx);
  const targetPos = cellToPixel(target.col, target.row);
  const targetX = targetPos.x + CELL_W / 2;
  const targetY = targetPos.y + CELL_H / 2;

  function moveCursik(toX, toY, durationMs, cb) {
    if (!mc) { cb && cb(); return; }
    const startX = parseFloat(mc.style.left) || (zombie.x);
    const startY = parseFloat(mc.style.top) || (zombie.y);
    const steps = Math.max(4, Math.round(durationMs / 40));
    let s = 0;
    function step() {
      if (State.paused) { setTimeout(step, 100); return; }
      if (!zombie.alive) return chromeCleanup(zombie);
      s++;
      const t = s / steps;
      posEl(mc, startX + (toX - startX) * t, startY + (toY - startY) * t);
      if (s < steps) setTimeout(step, 40);
      else cb && cb();
    }
    setTimeout(step, 40);
  }

  const itemRect = item ? item.getBoundingClientRect() : null;
  let pickX, pickY;
  if (itemRect) {
    const gp = viewportToGame(itemRect.left + itemRect.width / 2, itemRect.top + itemRect.height / 2);
    pickX = gp.x - 16;
    pickY = gp.y - 16;
  } else {
    pickX = zombie.x - 60 + idx * 50;
    pickY = zombie.y - 90;
  }

  moveCursik(pickX, pickY, 300, () => {
    if (item) item.classList.add('chrome-search-picked');
    moveCursik(targetX - 16, targetY - 16, 400, () => {
      if (item) { item.style.opacity = '0'; }
      spawnZombie(summonType, target.row, { col: target.col });
      gameTimer(`chrome_next_${zombie.id}`, () => summonNextChromeZombie(zombie, idx + 1), 250);
    });
  });
}

function chromeCleanup(zombie) {
  if (zombie._chromeBar) { zombie._chromeBar.remove(); zombie._chromeBar = null; }
  if (zombie._chromeModal) { zombie._chromeModal.remove(); zombie._chromeModal = null; }
  if (zombie._chromeMc) { zombie._chromeMc.remove(); zombie._chromeMc = null; }
  zombie._chromeItems = null;
  zombie._chromePicks = null;
  clearTimer(`chrome_click_bar_${zombie.id}`);
  clearTimer(`chrome_type_${zombie.id}`);
  clearTimer(`chrome_click_search_${zombie.id}`);
  clearTimer(`chrome_open_modal_${zombie.id}`);
  clearTimer(`chrome_pick_${zombie.id}`);
  clearTimer(`chrome_drag_${zombie.id}`);
  clearTimer(`chrome_wait_${zombie.id}`);
  clearTimer(`chrome_next_${zombie.id}`);
}

const CURSIK_BASE_COOLDOWN = 200;
const CURSIK_DRAG_TIME = 500;

function getCursikCooldown() {
  const aliveZombies = State.zombies.filter(z => z.alive).length;
  const wave = State.wave || 0;
  const zombieFactor = Math.min(0.6, aliveZombies * 0.06);
  const waveFactor = Math.min(0.3, wave * 0.05);
  return Math.max(20, Math.round(CURSIK_BASE_COOLDOWN * (1 - zombieFactor - waveFactor)));
}

function processCursikQueue() {
  if (State.cursik.busy) return;
  if (State.cursik.queue.length === 0) return;
  if (State.gameOver) return;
  if (State.paused) {
    setTimeout(processCursikQueue, 300);
    return;
  }

  State.cursik.queue = State.cursik.queue.filter(id => {
    var z = State.zombies.find(zz => zz.id === id);
    return z && z.alive;
  });
  if (State.cursik.queue.length === 0) return;

  const zombieId = State.cursik.queue[0];
  const zombie = State.zombies.find(z => z.id === zombieId);

  if (!zombie || !zombie.alive) {
    State.cursik.queue.shift();
    setTimeout(processCursikQueue, getCursikCooldown());
    return;
  }

  if (zombie._eatTimer) {
    State.cursik.queue.shift();
    State.cursik.queue.push(zombieId);
    setTimeout(processCursikQueue, 500);
    return;
  }

  if (zombie.isChrome) {
    const now = performance.now();
    if (zombie._chromeState === 'walking' && now >= zombie._chromeStartAt) {
      startChromeSearch(zombie);
    }
    if (zombie._chromeState && zombie._chromeState !== 'walking' && zombie._chromeState !== 'done') {
      State.cursik.queue.shift();
      State.cursik.queue.push(zombieId);
      setTimeout(processCursikQueue, 600);
      return;
    }
  }

  const o = getGridOrigin();

  if (!State.funMode) {
    const zombieCol = Math.floor((zombie.x - o.x) / CELL_W);
    if (zombieCol >= 0 && zombieCol < GRID_COLS) {
      const cp = State.plants[zombie.row][zombieCol];
      if (cp && !(cp.type === 'basket_chomper' && !cp.isFull && !cp.archived && !cp.infected)) {
        State.cursik.queue.shift();
        State.cursik.queue.push(zombieId);
        setTimeout(processCursikQueue, 800);
        return;
      }
    }
  }

  State.cursik.busy = true;
  State.cursik.dragZombieId = zombie.id;
  GameLog.log('CURSIK', `Dragging ${zombie.type} #${zombie.id} on row ${zombie.row}, x=${Math.round(zombie.x)}`);

  zombie.el.classList.add('selected');
  zombie.selected = true;

  moveCursikTo(zombie.x + 37, zombie.y + 48, () => {
    if (!zombie.alive) {
      State.cursik.dragZombieId = null;
      State.cursik.busy = false;
      State.cursik.el.classList.remove('dragging');
      setTimeout(processCursikQueue, getCursikCooldown());
      return;
    }

    const targetX = zombie._excelReversed
      ? zombie.x + CELL_W
      : Math.max(zombie.x - CELL_W, o.x - CELL_W);

    animateZombieMove(zombie, targetX, CURSIK_DRAG_TIME, () => {
      if (zombie.el && zombie.el.parentNode) {
        zombie.el.classList.remove('selected');
      }
      zombie.selected = false;
      State.cursik.el.classList.remove('dragging');
      State.cursik.dragZombieId = null;

      if (zombie.alive) checkZombieRow(zombie);
      if (zombie.alive && zombie.isTxt) tickTxtZombie(zombie);

      const movedId = State.cursik.queue.shift();
      if (zombie.alive && zombie.x > o.x - CELL_W) {
        State.cursik.queue.push(movedId);
      }
      State.cursik.busy = false;

      setTimeout(processCursikQueue, getCursikCooldown());
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
const DRAG_BASE_MS = 140;

function getDragStepMs() {
  const aliveZombies = State.zombies.filter(z => z.alive).length;
  const wave = State.wave || 0;
  const zombieSpeedup = Math.min(0.5, aliveZombies * 0.04);
  const waveSpeedup = Math.min(0.25, wave * 0.04);
  return Math.max(40, Math.round(DRAG_BASE_MS * (1 - zombieSpeedup - waveSpeedup)));
}

function animateZombieMove(zombie, targetX, duration, cb) {
  const ck = State.cursik;
  const dir = targetX < zombie.x ? -1 : 1;
  const o = getGridOrigin();

  function dragStep() {
    if (!zombie.alive || zombie.reachedEnd) {
      ck.el.classList.remove('dragging');
      cb && cb();
      return;
    }
    if (State.paused) { setTimeout(dragStep, 100); return; }
    if (State.gameOver) { cb && cb(); return; }

    var isSlowed = zombie._slowedUntil && performance.now() < zombie._slowedUntil;
    if (!isSlowed && zombie._slowedUntil) {
      zombie._slowedUntil = 0;
      if (zombie.el) zombie.el.style.filter = '';
    }
    const remaining = Math.abs(targetX - zombie.x);
    var baseStep = isSlowed ? DRAG_STEP_PX * 0.5 : DRAG_STEP_PX;
    if (zombie._excelSpeedMod) baseStep = Math.max(1, baseStep * (1 + zombie._excelSpeedMod));
    const step = Math.min(baseStep, remaining);
    const newX = zombie.x + dir * step;

    if (dir === 1 && zombie._excelReversed) {
      const rightEdge = o.x + GRID_COLS * CELL_W + 80;
      if (newX >= rightEdge) {
        zombie.x = newX;
        posEl(zombie.el, zombie.x, zombie.y);
        killZombie(zombie, { dev: true });
        cb && cb();
        return;
      }
    }

    if (dir === -1 && !State.funMode) {
      const oldCol = Math.floor((zombie.x - o.x) / CELL_W);
      const newCol = Math.floor((newX - o.x) / CELL_W);
      if (newCol >= 0 && newCol < GRID_COLS && newCol < oldCol) {
        const pl = State.plants[zombie.row][newCol];
        if (pl && !(pl.type === 'basket_chomper' && !pl.isFull && !pl.archived && !pl.infected)) {
          zombie.x = o.x + newCol * CELL_W + CELL_W - 1;
          posEl(zombie.el, zombie.x, zombie.y);
          ck.x = zombie.x + 37;
          ck.y = zombie.y + 48;
          posEl(ck.el, ck.x - 20, ck.y - 20);
          cb && cb();
          return;
        }
      }
    }

    zombie.x = newX;
    posEl(zombie.el, zombie.x, zombie.y);

    ck.x = zombie.x + 37;
    ck.y = zombie.y + 48;
    posEl(ck.el, ck.x - 20, ck.y - 20);

    if (remaining > 1) {
      setTimeout(dragStep, getDragStepMs());
    } else {
      cb && cb();
    }
  }
  setTimeout(dragStep, getDragStepMs());
}

function spawnLawnmowers() {
  State.lawnmowers.forEach((m, i) => {
    if (m && m.el) m.el.remove();
    State.lawnmowers[i] = null;
  });
  for (let row = 0; row < GRID_ROWS; row++) {
    spawnLawnmower(row);
  }
}

function spawnLawnmower(row) {
  const o = getGridOrigin();
  const x = o.x - 80;
  const y = o.y + row * CELL_H;

  const el = makeEl('div', 'lawnmower-entity icon-entity', entitiesLayer());
  el.style.position = 'absolute';
  posEl(el, x, y);

  const img = makeEl('img', 'icon-img', el);
  img.src = 'static/img/ui/lawnmower.png';
  img.draggable = false;
  img.onerror = () => { img.remove(); const fb = makeEl('div', 'icon-img lawnmower-fallback', el); fb.textContent = '🚜'; };

  addFilenameLabel(el, Lang.t('entity.mower'), 'mower-file-label');
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
  GameLog.log('LAWNMOWER', `Triggered lawnmower on row ${row}`);
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
        killZombie(z, { dropFile: true });
      }
    });

    const rightEdge = getGridOrigin().x + GRID_COLS * CELL_W + 200;
    if (mower.x < rightEdge) {
      setTimeout(moveMower, 180);
    } else {
      if (!State.funMode) mower.el.remove();
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
      GameLog.log('ZOMBIE', `${zombie.type} #${zombie.id} reached end of row ${zombie.row} → lawnmower`);
      zombie.reachedEnd = true;
      State.cursik.queue = State.cursik.queue.filter(id => id !== zombie.id);
      if (State.cursik.dragZombieId === zombie.id) {
        State.cursik.dragZombieId = null;
        State.cursik.busy = false;
        State.cursik.el.classList.remove('dragging');
        zombie.el.classList.remove('selected');
        zombie.selected = false;
        setTimeout(processCursikQueue, getCursikCooldown());
      }
      triggerLawnmower(zombie.row);
    } else if (!mower || !mower.alive) {
      GameLog.log('BSOD', `${zombie.type} #${zombie.id} reached end of row ${zombie.row}, no lawnmower → BSOD`);
      zombie.reachedEnd = true;
      Game.triggerGameOver(zombie);
    }
  }
}

const PEA_STEP_PX = 30;
const PEA_STEP_MS = 100;

var _zombiesByRow = null;
function buildZombieRowIndex() {
  if (_zombiesByRow && _zombiesByRow.length === GRID_ROWS) {
    for (var r = 0; r < GRID_ROWS; r++) _zombiesByRow[r].length = 0;
  } else {
    _zombiesByRow = [];
    for (var r = 0; r < GRID_ROWS; r++) _zombiesByRow.push([]);
  }
  for (var i = 0; i < State.zombies.length; i++) {
    var z = State.zombies[i];
    if (!z.alive || z.isBungee) continue;
    if (z.row >= 0 && z.row < GRID_ROWS) _zombiesByRow[z.row].push(z);
  }
  return _zombiesByRow;
}

function updatePeas(dt) {
  if (State.peas.length === 0) return;
  const byRow = buildZombieRowIndex();
  const o = getGridOrigin();
  const rightEdge = o.x + GRID_COLS * CELL_W + 80;
  const leftEdge = o.x - 80;
  const lowGfx = Graphics.isLow();
  const now = performance.now();

  for (let i = State.peas.length - 1; i >= 0; i--) {
    const pea = State.peas[i];
    if (!pea.alive) continue;
    const dir = pea.direction || 1;

    const prevX = pea.x;
    pea._stepAcc = (pea._stepAcc || 0) + dt;
    if (pea._stepAcc >= PEA_STEP_MS) {
      pea._stepAcc -= PEA_STEP_MS;
      pea.x += PEA_STEP_PX * dir;
      posEl(pea.el, pea.x, pea.peaY);
      if (pea.mc) posEl(pea.mc, pea.x + 10 * dir, pea.peaY - 8);
      if (!pea._fireIgnited) igniteAlongPath(pea);
    }

    let hit = false;
    const rowZombies = byRow[pea.row];
    if (rowZombies) {
      const sweepLo = Math.min(prevX, pea.x);
      const sweepHi = Math.max(prevX, pea.x);
      const ZOMBIE_HALF_W = 45;
      for (let j = 0; j < rowZombies.length; j++) {
        const z = rowZombies[j];
        const zLo = z.x - ZOMBIE_HALF_W;
        const zHi = z.x + ZOMBIE_HALF_W;
        if (sweepHi >= zLo && sweepLo <= zHi) {
          let dmg = (pea.fire && !pea.slow) ? 3 : 1;
          if (pea.pirate && pea.boosted) dmg *= 2;
          damageZombie(z, dmg);
          if (pea.slow) {
            z._slowedUntil = now + 3000;
            if (z.el) z.el.style.filter = 'brightness(0.9) sepia(1) hue-rotate(190deg) saturate(3)';
          }
          hit = true;
          if (!lowGfx) {
            const color = pea.fire ? (pea.slow ? '#8a5a2a' : '#ff8a2c') : (pea.slow ? '#4488ff' : '#7fff00');
            spawnParticles(pea.x, pea.peaY, color, 4);
          }
          break;
        }
      }
    }

    let outOfRange = false;
    if (pea.maxX != null) {
      if (dir > 0 && pea.x >= pea.maxX) outOfRange = true;
      else if (dir < 0 && pea.x <= pea.maxX) outOfRange = true;
    }
    if (hit || outOfRange || pea.x > rightEdge || pea.x < leftEdge) {
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

function updatePetyaVirus(dt) {
  let alivePetyas = 0;
  let totalRate = 0;
  const cfg = ZOMBIE_TYPES.petya_zombie;
  const baseRate = cfg.petyaRate || 0.5;
  const slowMult = cfg.petyaSlowMult || 0.7;
  const now = performance.now();
  for (let i = 0; i < State.zombies.length; i++) {
    const z = State.zombies[i];
    if (!z.alive || !z.isPetya) continue;
    alivePetyas++;
    const isSlowed = z._slowedUntil && z._slowedUntil > now;
    totalRate += baseRate * (isSlowed ? slowMult : 1);
  }

  if (alivePetyas > 0) {
    State._petyaDecayAccel = 0;
    State.petyaPct = Math.min(100, State.petyaPct + totalRate * (dt / 1000));
  } else if (State.petyaPct > 0) {
    State._petyaDecayAccel += dt / 1000;
    const decay = 1.5 + State._petyaDecayAccel * 1.8;
    State.petyaPct = Math.max(0, State.petyaPct - decay * (dt / 1000));
  }

  renderPetyaMeter();

  if (State.petyaPct >= 100 && !State.gameOver) {
    GameLog.log('PETYA', 'Petya virus download reached 100% → BSOD');
    Game.triggerGameOver(null, 'petya_encrypted');
  }
}

function renderPetyaMeter() {
  let el = document.getElementById('petya-meter');
  const visible = State.petyaPct > 0 || State.zombies.some(z => z.alive && z.isPetya);
  if (!visible) {
    if (el) el.style.display = 'none';
    return;
  }
  if (!el) {
    el = document.createElement('div');
    el.id = 'petya-meter';
    el.className = 'petya-meter';
    document.getElementById('hud-top').appendChild(el);
  }
  el.style.display = 'block';
  const pct = Math.floor(State.petyaPct);
  const tmpl = Lang.t('hud.petya_download') || 'WARNING: Downloading Petya virus: {0}%';
  el.textContent = tmpl.replace('{0}', pct);
  el.classList.toggle('petya-critical', pct >= 75);
}

function gameLoop(ts) {
  if (State.gameOver) return;
  const dt = Math.min(ts - lastTime, 50);
  lastTime = ts;

  if (!State.paused) {
    updateZombies(dt);
    updatePeas(dt);
    updateCursorProjectiles(dt);
    updateCursikIdle();
    checkPlantsEaten();
    checkWinrarFileCollision();
    updatePetyaVirus(dt);
    checkWaveComplete();
  }

  requestAnimationFrame(gameLoop);
}

function startGameLoop() {
  GameLog.log('GAME', 'Game loop started');
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
  gameInterval('cursik_watchdog', () => {
    if (State.cursik.busy && State.cursik.dragZombieId != null) {
      var dz = State.zombies.find(z => z.id === State.cursik.dragZombieId);
      if (!dz || !dz.alive) {
        State.cursik.dragZombieId = null;
        State.cursik.busy = false;
        State.cursik.el.classList.remove('dragging');
      }
    }
    State.cursik.queue = State.cursik.queue.filter(id => {
      var z = State.zombies.find(zz => zz.id === id);
      return z && z.alive;
    });
    for (var i = 0; i < State.zombies.length; i++) {
      var z = State.zombies[i];
      if (!z.alive || z.isBungee || z.reachedEnd) continue;
      if (State.cursik.queue.indexOf(z.id) === -1) {
        State.cursik.queue.push(z.id);
      }
    }
    if (!State.cursik.busy && State.cursik.queue.length > 0) {
      processCursikQueue();
    }
  }, 1000);
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
      const isExcelDoor = z.type === 'excel_zombie' && !z.armorBroken && z.armorHits > 0;
      const hasSysFile = z.hasSystemFile && z.fileHp > 0;
      if (!isExcelDoor && !hasSysFile) continue;
      const distX = Math.abs(z.x - plantPos.x) / CELL_W;
      const distY = Math.abs(z.row - plant.row);
      if (distX <= cfg.attractRadius && (State.funMode ? distY === 0 : distY <= cfg.attractRadius)) {
        if (isExcelDoor) {
          GameLog.log('MAGNET', `Folder-magnet [${plant.col},${plant.row}] pulled door off excel zombie #${z.id} on row ${z.row}`);
          z.armorBroken = true;
          z.armorHits = 0;
          const imgEl = z.el.querySelector('.icon-img');
          if (imgEl) imgEl.src = 'static/img/zombies/zombie.webp';
        } else {
          GameLog.log('MAGNET', `Folder-magnet [${plant.col},${plant.row}] attracted sys file from zombie #${z.id} on row ${z.row}`);
          z.hasSystemFile = false;
          z.fileHp = 0;
          if (z._fileEl) { z._fileEl.remove(); z._fileEl = null; }
          const imgEl = z.el.querySelector('.icon-img');
          if (imgEl) imgEl.src = 'static/img/zombies/zombie.webp';
        }

        State._magnetBlocked[magnetKey] = true;

        const flyEl = makeEl('div', 'magnet-fly-file', sunsLayer());
        flyEl.style.position = 'absolute';
        const flyImg = makeEl('img', 'icon-img', flyEl);
        flyImg.src = isExcelDoor ? 'static/img/other/table.png' : 'static/img/other/sys.png';
        flyImg.draggable = false;
        posEl(flyEl, z.x + 20, z.y + 10);
        flyEl.style.transition = 'left 0.6s cubic-bezier(0.2,0.8,0.3,1), top 0.6s cubic-bezier(0.2,0.8,0.3,1), transform 0.6s ease';
        flyEl.style.zIndex = '50';

        requestAnimationFrame(() => {
          posEl(flyEl, plantPos.x + CELL_W / 2 - 24, plantPos.y + CELL_H / 2 - 24);
          flyEl.style.transform = 'scale(0.8) rotate(-15deg)';
        });

        setTimeout(() => {
          flyEl.remove();
          spawnParticles(plantPos.x + CELL_W/2, plantPos.y + CELL_H/2, '#4488ff', 8);
          SFX.play('snd-sun');
          const dropX = plantPos.x + CELL_W / 2 - 24;
          const dropY = plantPos.y + CELL_H / 2 - 24;
          const file = isExcelDoor
            ? dropTableFile(dropX, dropY, plant.row)
            : dropSystemFile(dropX, dropY, plant.row);
          if (file) {
            file.heldByMagnet = true;
            file.magnetCol = plant.col;
            file.magnetRow = plant.row;
          }
        }, 650);

        break;
      }
    }

  }, cfg.attractInterval);
}

function fireTrojan(zombie) {
  if (!zombie.alive || State.paused || State.gameOver) return;

  const targets = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const p = State.plants[r][c];
      if (p && !p.archived) targets.push({ kind: 'plant', col: c, row: r });
    }
  }
  for (const f of State.droppedFiles) {
    if (!f.collected && !f.heldByMagnet && f.kind !== 'table') {
      targets.push({ kind: 'file', fileObj: f, x: f.x, y: f.y });
    }
  }
  if (targets.length === 0) return;

  const target = targets[rndInt(0, targets.length - 1)];
  let endX, endY;
  if (target.kind === 'plant') {
    const targetPos = cellToPixel(target.col, target.row);
    endX = targetPos.x + CELL_W / 2 - 16;
    endY = targetPos.y + CELL_H / 2 - 16;
    GameLog.log('TROJAN', `Catapult #${zombie.id} fires trojan at plant [${target.col},${target.row}]`);
  } else {
    endX = target.x + 8;
    endY = target.y + 8;
    GameLog.log('TROJAN', `Catapult #${zombie.id} fires trojan at dropped file #${target.fileObj.id}`);
  }

  const startX = zombie.x + 20;
  const startY = zombie.y;

  const proj = makeEl('div', 'trojan-projectile', sunsLayer());
  const projImg = makeEl('img', null, proj);
  projImg.src = 'static/img/other/trojan.webp';
  projImg.draggable = false;
  projImg.onerror = () => { proj.textContent = '🦠'; proj.style.fontSize = '24px'; };
  posEl(proj, startX, startY);

  const mc = spawnMiniCursik(sunsLayer());
  posEl(mc, startX + 10, startY - 8);

  const dx = endX - startX;
  const dy = endY - startY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const arcHeight = Math.max(150, dist * 0.4);
  const duration = 800;
  const startTime = performance.now();
  const interceptRow = (target.kind === 'plant') ? target.row : zombie.row;
  let intercepted = false;

  function animateArc() {
    if (intercepted) return;
    const elapsed = performance.now() - startTime;
    const t = Math.min(1, elapsed / duration);

    const x = startX + dx * t;
    const baseY = startY + dy * t;
    const arc = -4 * arcHeight * t * (t - 1);
    const y = baseY - arc;

    posEl(proj, x, y);
    posEl(mc, x + 10, y - 8);

    if (t > 0.15 && t < 0.95) {
      const o = getGridOrigin();
      const projCol = Math.floor((x - o.x) / CELL_W);
      if (projCol >= 0 && projCol < GRID_COLS) {
        const fw = State.plants[interceptRow] && State.plants[interceptRow][projCol];
        if (fw && fw.type === 'torchwall' && !fw.archived && !fw.infected) {
          intercepted = true;
          GameLog.log('FIREWALL', `Torchwall at [${projCol},${interceptRow}] intercepted trojan`);
          const burstX = x + 16, burstY = y + 16;
          spawnParticles(burstX, burstY, '#ff6600', 12);
          spawnParticles(burstX, burstY, '#ffaa00', 8);
          proj.remove();
          mc.remove();
          burnFirewall(fw);
          return;
        }
      }
    }

    if (t < 1) {
      requestAnimationFrame(animateArc);
    } else {
      proj.remove();
      mc.remove();
      spawnParticles(endX + 16, endY + 16, '#8b00ff', 6);
      if (target.kind === 'file') {
        GameLog.log('BSOD', `Trojan destroyed dropped sys file #${target.fileObj.id} → BSOD`);
        spawnParticles(endX + 16, endY + 16, '#ff0000', 12);
        Game.triggerGameOver(null, 'trojan_file_destroyed');
      } else {
        if (isAvastShielded(target.col, target.row)) {
          GameLog.log('AVAST', `Trojan blocked by Avast shield at [${target.col},${target.row}]`);
          spawnParticles(endX + 16, endY + 16, '#00cc44', 8);
          return;
        }
        const plant = State.plants[target.row]?.[target.col];
        if (plant && plant.type === 'folder_magnet') {
          const heldFile = State.droppedFiles.find(f =>
            !f.collected && f.heldByMagnet && f.magnetCol === target.col && f.magnetRow === target.row
          );
          if (heldFile) {
            GameLog.log('BSOD', `Trojan infected folder_magnet with held file at [${target.col},${target.row}] → BSOD`);
            spawnParticles(endX + 16, endY + 16, '#ff0000', 12);
            Game.triggerGameOver(null, 'trojan_magnet_infected');
            return;
          }
        }
        infectPlant(target.col, target.row);
      }
    }
  }
  requestAnimationFrame(animateArc);
}

function infectPlant(col, row) {
  const plant = State.plants[row]?.[col];
  if (!plant || plant.archived) return;
  if (isAvastShielded(col, row)) {
    GameLog.log('AVAST', `Trojan blocked by Avast shield at [${col},${row}]`);
    const pos = cellToPixel(col, row);
    spawnParticles(pos.x + CELL_W / 2, pos.y + CELL_H / 2, '#00cc44', 8);
    return;
  }
  if (isFirewallShielded(col, row)) {
    const fw = State.plants[row][col - 1];
    GameLog.log('FIREWALL', `Trojan absorbed by torchwall at [${col - 1},${row}] (protecting [${col},${row}])`);
    const pos = cellToPixel(col, row);
    spawnParticles(pos.x + CELL_W / 2, pos.y + CELL_H / 2, '#ff6600', 10);
    burnFirewall(fw);
    return;
  }

  if (!plant.infected) {
    plant.infected = true;
    plant.trojanCount = 1;
    clearTimer(`plant_sun_${col}_${row}`);
    clearTimer(`plant_shoot_${col}_${row}`);
    clearTimer(`plant_drop_${col}_${row}`);
    if (plant.type === 'xsas_mushroom') {
      const elapsed = performance.now() - (plant._xsasPlanted || 0);
      plant._xsasRemaining = Math.max(0, (plant._xsasDelay || 3000) - elapsed);
      clearTimer(`xsas_${col}_${row}`);
    }
    if (plant.type === 'cherry') {
      const elapsed = performance.now() - (plant._cherryPlanted || 0);
      plant._cherryRemaining = Math.max(0, (plant._cherryDelay || 2000) - elapsed);
      clearTimer(`cherry_${col}_${row}`);
    }
    GameLog.log('TROJAN', `Plant ${plant.type} at [${col},${row}] infected (count=1)`);
  } else {
    plant.trojanCount++;
    GameLog.log('TROJAN', `Plant ${plant.type} at [${col},${row}] trojan count → ${plant.trojanCount}`);
  }
  plant.el.classList.add('infected');

  if (plant.type === 'torrent_lantern' && plant._lanternPairId && !plant._torrentInfecting) {
    plant._torrentInfecting = true;
    var tr = PLANTS.torrent_lantern.pairRadius;
    for (var dr = -tr; dr <= tr; dr++) {
      for (var dc = -tr; dc <= tr; dc++) {
        if (dr === 0 && dc === 0) continue;
        var rr = row + dr, cc = col + dc;
        if (rr < 0 || rr >= GRID_ROWS || cc < 0 || cc >= GRID_COLS) continue;
        if (State.plants[rr][cc] && !State.plants[rr][cc].archived) infectPlant(cc, rr);
      }
    }
    if (plant._mirrorPlants) {
      for (var i = 0; i < plant._mirrorPlants.length; i++) {
        var mp = plant._mirrorPlants[i];
        infectPlant(mp.col, mp.row);
      }
    }
    var partner = State.plants[plant._lanternPartner?.row]?.[plant._lanternPartner?.col];
    if (partner && partner._mirrorPlants) {
      for (var i = 0; i < partner._mirrorPlants.length; i++) {
        var mp = partner._mirrorPlants[i];
        infectPlant(mp.col, mp.row);
      }
    }
    plant._torrentInfecting = false;
  }
}

function spawnInfectedZombie(col, row, trojanCount) {
  let type;
  if (trojanCount >= 3) type = 'ssd_zombie';
  else if (trojanCount === 2) type = 'hdd_zombie';
  else type = 'zombie';

  GameLog.log('TROJAN', `Infected plant at [${col},${row}] spawned ${type} (trojanCount=${trojanCount})`);
  const pos = cellToPixel(col, row);
  spawnParticles(pos.x + CELL_W / 2, pos.y + CELL_H / 2, '#8b00ff', 12);
  SFX.play('snd-explosion');
  const zombie = spawnZombie(type, row);
  if (zombie) {
    zombie.x = pos.x;
    posEl(zombie.el, zombie.x, zombie.y);
  }
}

function cureInfection(col, row) {
  const plant = State.plants[row]?.[col];
  if (!plant || !plant.infected) return;
  if (plant.type === 'pirate_mushroom') return;
  plant.infected = false;
  plant.trojanCount = 0;
  plant.el.classList.remove('infected');
  GameLog.log('TROJAN', `Cured infection on ${plant.type} at [${col},${row}]`);

  if (plant.type === 'sunflower' || plant.type === 'sun_mushroom') scheduleSunflower(plant);
  else if (plant.type === 'peashooter' || plant.type === 'siamese_peashooter' || plant.type === 'double_peashooter' || plant.type === 'snow_peashooter') scheduleShoot(plant);
  else if (plant.type === 'folder_magnet') scheduleFolderMagnet(plant);
  else if (plant.type === 'daisy') scheduleDaisy(plant);
  else if (plant.type === 'xsas_mushroom') {
    const remaining = plant._xsasRemaining != null ? plant._xsasRemaining : 3000;
    plant._xsasPlanted = performance.now();
    plant._xsasDelay = remaining;
    gameTimer(`xsas_${col}_${row}`, () => {
      if (!State.plants[row][col]) return;
      if (State.plants[row][col].archived || State.plants[row][col].infected) return;
      triggerXSASExplosion(plant);
    }, remaining);
  } else if (plant.type === 'cherry') {
    const remaining = plant._cherryRemaining != null ? plant._cherryRemaining : 2000;
    plant._cherryPlanted = performance.now();
    plant._cherryDelay = remaining;
    gameTimer(`cherry_${col}_${row}`, () => {
      if (!State.plants[row][col]) return;
      if (State.plants[row][col].archived || State.plants[row][col].infected) return;
      triggerCherryExplosion(plant);
    }, remaining);
  }
}

function triggerXSASExplosion(plant) {
  const cx = plant.col;
  const cy = plant.row;
  const radius = PLANTS.xsas_mushroom.explosionRadius;
  const pos = cellToPixel(cx, cy);

  GameLog.log('XSAS', `XSAS explosion at [${cx},${cy}], radius=${radius}`);
  removePlant(cx, cy, true);

  spawnParticles(pos.x + CELL_W/2, pos.y + CELL_H/2, '#ff00ff', 20);
  spawnParticles(pos.x + CELL_W/2, pos.y + CELL_H/2, '#ff6600', 15);
  SFX.play('snd-explosion');

  const o = getGridOrigin();
  let hitCursikZombie = false;
  var xsasTargets = [];
  for (var i = 0; i < State.zombies.length; i++) {
    var z = State.zombies[i];
    if (!z.alive || z.isBoss) continue;
    var zCol = Math.floor((z.x - o.x) / CELL_W);
    if (Math.abs(zCol - cx) <= radius && Math.abs(z.row - cy) <= radius) {
      xsasTargets.push(z);
    }
  }
  for (var i = 0; i < xsasTargets.length; i++) {
    var z = xsasTargets[i];
    if (!z.alive) continue;
    if (z.isBungee) {
      killBungee(z);
      continue;
    }
    if (State.cursik.dragZombieId === z.id) hitCursikZombie = true;
    if (z.type === 'excel_zombie') {
      z.isInvincible = false;
      z.hp = 0;
    }
    killZombie(z, { dropFile: true });
  }

  if (hitCursikZombie) {
    GameLog.log('XSAS', 'XSAS killed Cursik\'s dragged zombie → "Ай!" reaction');
    const ck = State.cursik;
    const bubble = ck.bubbleEl;
    if (bubble) {
      bubble.textContent = Lang.t('cursik.ouch');
      bubble.classList.remove('hidden');
      setTimeout(() => bubble.classList.add('hidden'), 1200);
    }
    if (ck.el) {
      ck.el.classList.add('cursik-flinch');
      setTimeout(() => ck.el.classList.remove('cursik-flinch'), 500);
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

function triggerCherryExplosion(plant) {
  const cx = plant.col;
  const cy = plant.row;
  const radius = PLANTS.cherry.explosionRadius;
  const pos = cellToPixel(cx, cy);

  GameLog.log('CHERRY', `Cherry explosion at [${cx},${cy}], radius=${radius}`);
  removePlant(cx, cy, true);

  spawnParticles(pos.x + CELL_W/2, pos.y + CELL_H/2, '#ff3300', 20);
  spawnParticles(pos.x + CELL_W/2, pos.y + CELL_H/2, '#ff8800', 12);
  SFX.play('snd-explosion');

  const topLeft = cellToPixel(Math.max(0, cx - radius), Math.max(0, cy - radius));
  const botRight = cellToPixel(Math.min(GRID_COLS - 1, cx + radius), Math.min(GRID_ROWS - 1, cy + radius));
  const explEl = makeEl('div', 'cherry-explosion', entitiesLayer());
  explEl.style.position = 'absolute';
  explEl.style.left = topLeft.x + 'px';
  explEl.style.top = topLeft.y + 'px';
  explEl.style.width = (botRight.x + CELL_W - topLeft.x) + 'px';
  explEl.style.height = (botRight.y + CELL_H - topLeft.y) + 'px';
  explEl.style.zIndex = '50';
  explEl.style.pointerEvents = 'none';
  const explImg = makeEl('img', '', explEl);
  explImg.src = 'static/effects/explosion.png';
  explImg.style.width = '100%';
  explImg.style.height = '100%';
  explImg.draggable = false;
  setTimeout(() => explEl.remove(), 800);

  const o = getGridOrigin();
  let hitCursikZombie = false;
  const inRange = [];
  for (const z of State.zombies) {
    if (!z.alive || z.isBoss) continue;
    const zCol = Math.floor((z.x - o.x) / CELL_W);
    const dCol = Math.abs(zCol - cx);
    const dRow = Math.abs(z.row - cy);
    if (dCol <= radius && dRow <= radius) {
      GameLog.log('CHERRY', `Hit candidate #${z.id} ${z.type} at [${zCol},${z.row}] dCol=${dCol} dRow=${dRow}`);
      inRange.push(z);
    }
  }

  inRange.sort((a, b) => {
    const sa = (a.armorHits || 0) + a.hp;
    const sb = (b.armorHits || 0) + b.hp;
    return sb - sa;
  });
  const targets = inRange.slice(0, PLANTS.cherry.maxTargets);

  for (const z of targets) {
    if (z.isBungee) {
      killBungee(z);
      continue;
    }
    if (z.type === 'excel_zombie') {
      excelSpeedCheck(z, 20);
      spawnParticles(z.x + 40, z.y + 30, '#ff3300', 6);
      continue;
    }
    if (State.cursik.dragZombieId === z.id) hitCursikZombie = true;
    killZombie(z, { dropFile: true });
  }

  if (hitCursikZombie) {
    GameLog.log('CHERRY', 'Cherry killed Cursik\'s dragged zombie');
    const ck = State.cursik;
    const bubble = ck.bubbleEl;
    if (bubble) {
      bubble.textContent = Lang.t('cursik.ouch');
      bubble.classList.remove('hidden');
      setTimeout(() => bubble.classList.add('hidden'), 1200);
    }
    if (ck.el) {
      ck.el.classList.add('cursik-flinch');
      setTimeout(() => ck.el.classList.remove('cursik-flinch'), 500);
    }
  }
}

function triggerMineExplosion(plant) {
  const cx = plant.col;
  const cy = plant.row;
  const pos = cellToPixel(cx, cy);
  const o = getGridOrigin();

  GameLog.log('MINE', `Logic mine exploded at [${cx},${cy}]`);
  removePlant(cx, cy, true);

  spawnParticles(pos.x + CELL_W / 2, pos.y + CELL_H / 2, '#ff3300', 16);
  spawnParticles(pos.x + CELL_W / 2, pos.y + CELL_H / 2, '#ff8800', 10);
  SFX.play('snd-explosion');

  const explEl = makeEl('div', 'cherry-explosion', entitiesLayer());
  explEl.style.position = 'absolute';
  explEl.style.left = pos.x + 'px';
  explEl.style.top = pos.y + 'px';
  explEl.style.width = CELL_W + 'px';
  explEl.style.height = CELL_H + 'px';
  explEl.style.zIndex = '50';
  explEl.style.pointerEvents = 'none';
  const explImg = makeEl('img', '', explEl);
  explImg.src = 'static/effects/explosion.png';
  explImg.style.width = '100%';
  explImg.style.height = '100%';
  explImg.draggable = false;
  setTimeout(() => explEl.remove(), 800);

  let hitCursikZombie = false;
  for (const z of State.zombies) {
    if (!z.alive || z.isBoss) continue;
    const zCol = Math.floor((z.x - o.x) / CELL_W);
    if (zCol === cx && z.row === cy) {
      if (z.isBungee) {
        killBungee(z);
        continue;
      }
      if (z.type === 'excel_zombie') {
        excelSpeedCheck(z, 20);
        spawnParticles(z.x + 40, z.y + 30, '#ff3300', 6);
        continue;
      }
      if (State.cursik.dragZombieId === z.id) hitCursikZombie = true;
      killZombie(z, { dropFile: true });
    }
  }

  if (hitCursikZombie) {
    const ck = State.cursik;
    const bubble = ck.bubbleEl;
    if (bubble) {
      bubble.textContent = Lang.t('cursik.ouch');
      bubble.classList.remove('hidden');
      setTimeout(() => bubble.classList.add('hidden'), 1200);
    }
    if (ck.el) {
      ck.el.classList.add('cursik-flinch');
      setTimeout(() => ck.el.classList.remove('cursik-flinch'), 500);
    }
  }
}

function checkPlantsEaten() {
  State.zombies.filter(z => z.alive && !z.isBungee).forEach(zombie => {
    if (zombie._excelReversed) return;
    const o = getGridOrigin();
    const col = Math.floor((zombie.x - o.x) / CELL_W);
    if (col < 0 || col >= GRID_COLS) return;

    const plant = State.plants[zombie.row][col];
    if (plant) {
      if (plant.type === 'logic_mine' && !plant.archived && !plant.infected) {
        triggerMineExplosion(plant);
        return;
      }
      if (plant.type === 'basket_chomper' && !plant.isFull && !plant.archived && !plant.infected && !zombie.isBoss) {
        if (zombie._eatTimer) { clearInterval(zombie._eatTimer); zombie._eatTimer = null; }
        if (zombie._archiveTimer) { clearTimeout(zombie._archiveTimer); zombie._archiveTimer = null; }
        chomperEatZombie(plant, zombie);
        return;
      }
      if (zombie.canArchive && !zombie.abilitiesDisabled && !zombie._archiveTimer && !plant.archived) {
        zombie._archiveTimer = setTimeout(() => {
          if (!zombie.alive || State.gameOver) { zombie._archiveTimer = null; return; }
          const p = State.plants[zombie.row][col];
          if (p && !p.archived) {
            p.archived = true;
            GameLog.log('ARCHIVE', `WinRAR zombie #${zombie.id} archived ${p.type} at [${col},${zombie.row}]`);
            const img = p.el.querySelector('.icon-img');
            if (img) img.src = 'static/img/other/winrar.jpg';
            p.el.style.opacity = '0.85';
            clearTimer(`plant_sun_${col}_${zombie.row}`);
            clearTimer(`plant_shoot_${col}_${zombie.row}`);
            if (p.type === 'xsas_mushroom') {
              const elapsed = performance.now() - (p._xsasPlanted || 0);
              p._xsasRemaining = Math.max(0, (p._xsasDelay || 3000) - elapsed);
              clearTimer(`xsas_${col}_${zombie.row}`);
            }
            if (p.type === 'cherry') {
              const elapsed = performance.now() - (p._cherryPlanted || 0);
              p._cherryRemaining = Math.max(0, (p._cherryDelay || 2000) - elapsed);
              clearTimer(`cherry_${col}_${zombie.row}`);
            }
            addFilenameLabel(p.el, '.rar', 'archive-label');
          }
          zombie._archiveTimer = null;
        }, 2000);
      }

      if (zombie.canArchive && !plant.archived) return;

      if (!zombie._eatTimer) {
        const eatSpeed = zombie.canArchive ? 4000 : 2000;
        zombie._eatTimer = setInterval(() => {
          if (!zombie.alive) { clearInterval(zombie._eatTimer); zombie._eatTimer = null; return; }
          if (State.paused || State.gameOver) return;
          const p = State.plants[zombie.row][col];
          if (!p) { clearInterval(zombie._eatTimer); zombie._eatTimer = null; return; }
          p.hp--;
          if (p.hp <= 0) {
            if (!State.funMode) {
              clearInterval(zombie._eatTimer);
              zombie._eatTimer = null;
            }
            showDeleteDialog(col, zombie.row, p);
          }
        }, eatSpeed);
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
  GameLog.log('ARCHIVE', `Unarchived ${plant.type} at [${col},${row}]`);
  plant.archived = false;
  const img = plant.el.querySelector('.icon-img');
  if (img) img.src = `static/img/plants/${PLANTS[plant.type].file}`;
  plant.el.style.filter = '';
  plant.el.style.opacity = '';
  const archLabel = plant.el.querySelector('.archive-label');
  if (archLabel) archLabel.remove();
  if (plant.type === 'sunflower' || plant.type === 'sun_mushroom') scheduleSunflower(plant);
  else if (plant.type === 'peashooter') scheduleShoot(plant);
  else if (plant.type === 'siamese_peashooter') scheduleShoot(plant);
  else if (plant.type === 'double_peashooter') scheduleShoot(plant);
  else if (plant.type === 'snow_peashooter') scheduleShoot(plant);
  else if (plant.type === 'daisy') scheduleDaisy(plant);
  else if (plant.type === 'xsas_mushroom') {
    const remaining = plant._xsasRemaining != null ? plant._xsasRemaining : 3000;
    plant._xsasPlanted = performance.now();
    plant._xsasDelay = remaining;
    gameTimer(`xsas_${col}_${row}`, () => {
      if (!State.plants[row][col]) return;
      if (State.plants[row][col].archived) return;
      triggerXSASExplosion(plant);
    }, remaining);
  } else if (plant.type === 'cherry') {
    const remaining = plant._cherryRemaining != null ? plant._cherryRemaining : 2000;
    plant._cherryPlanted = performance.now();
    plant._cherryDelay = remaining;
    gameTimer(`cherry_${col}_${row}`, () => {
      if (!State.plants[row][col]) return;
      if (State.plants[row][col].archived) return;
      triggerCherryExplosion(plant);
    }, remaining);
  }
  recalcTorrentSlots();
  return true;
}

function checkWaveComplete() {
}

function showDeleteDialog(col, row, plant) {
  GameLog.log('PLANT', `Plant ${plant.type} at [${col},${row}] eaten by zombie (hp=0)`);
  const pos = cellToPixel(col, row);
  const fileName = PLANTS[plant.type]?.displayName || PLANTS[plant.type]?.file || Lang.t('dialog.file_fallback');

  const dialog = makeEl('div', 'win-delete-dialog', entitiesLayer());
  dialog.style.position = 'absolute';
  dialog.style.left = (pos.x - 20) + 'px';
  dialog.style.top = (pos.y - 40) + 'px';
  dialog.style.zIndex = '50';

  dialog.innerHTML =
    '<div class="win-delete-titlebar">' +
      '<span>' + Lang.t('dialog.delete_title') + '</span>' +
      '<span class="win-delete-x">✕</span>' +
    '</div>' +
    '<div class="win-delete-body">' +
      '<span class="win-delete-icon">🗑️</span>' +
      '<span>' + Lang.t('dialog.delete_body', fileName) + '</span>' +
    '</div>' +
    '<div class="win-delete-buttons">' +
      '<button class="win-delete-btn active">' + Lang.t('dialog.delete_confirm') + '</button>' +
      '<button class="win-delete-btn">' + Lang.t('dialog.delete_cancel') + '</button>' +
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
  if (Graphics.isLow()) {
    if (count > 6) count = 2;
    else return;
  }
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

function flashPlantCard(type) {
  var card = document.querySelector('.plant-card[data-key="' + type + '"]');
  if (!card || card.classList.contains('card-reject')) return;
  card.classList.add('card-reject');
  setTimeout(function() { card.classList.remove('card-reject'); }, 600);
}

function clearAllZombies() {
  for (const z of State.zombies) {
    if (z.el && z.el.parentNode) z.el.remove();
    if (z._fileEl) z._fileEl.remove();
    if (z._armorEl) z._armorEl.remove();
    if (z._bungeeMc) z._bungeeMc.remove();
  }
  State.zombies = [];
  State.cursik.queue = [];
  State.cursik.busy = false;
  State.cursik.dragZombieId = null;
  document.querySelectorAll('.editor-zombie-ghost').forEach(el => el.remove());
}

window.Engine = {
  State,
  PLANTS,
  ZOMBIE_TYPES,
  buildGrid,
  clearAllZombies,
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
  dropTableFile,
  removeDroppedFile,
  posEl,
  rnd, rndInt,
  gameTimer, gameInterval, clearAllTimers, clearTimer, pauseAllTimers, resumeAllTimers,
  spawnBungeeZombie,
  dismissChomperMenu, emptyChomper,
  recalcTorrentSlots,
  spawnDaisyPlantDrop,
  CELL_W, CELL_H, GRID_COLS, GRID_ROWS, HUD_H,
  getScale, updateScale, viewportToGame,
  setShowZombieIds, isShowZombieIds,
  fireAllCatmice, fireCursorProjectile,
};

(function(){
  window.__qa = 'qm';
  window.__qz = function(s, k){
    try {
      var bin = atob(s), kk = k || '';
      var arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i) ^ kk.charCodeAt(i % kk.length);
      try { return new TextDecoder('utf-8').decode(arr); }
      catch(e){
        var out = '';
        for (var j = 0; j < arr.length; j++) out += String.fromCharCode(arr[j]);
        return out;
      }
    } catch(e){ return ''; }
  };
  window.__qb = [];
  window.__qbPush = function(ch){
    window.__qb.push(ch);
    if (window.__qb.length > 8) window.__qb.shift();
    return window.__qb.join('');
  };
})();
