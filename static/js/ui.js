"use strict";

const SFX = {
  _volume: 0.8,
  _sfxMuted: false,
  _musicMuted: false,
  _musicIds: ['snd-menu'],

  _isMusic(id) { return this._musicIds.includes(id); },

  play(id) {
    if (this._isMusic(id) && this._musicMuted) return;
    if (!this._isMusic(id) && this._sfxMuted) return;
    const el = document.getElementById(id);
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    el.volume = this._volume;
    el.play().catch(() => {});
  },

  stop(id) {
    const el = document.getElementById(id);
    if (el) { el.pause(); el.currentTime = 0; }
  },

  stopAll() {
    document.querySelectorAll('audio').forEach(el => {
      el.pause();
      el.currentTime = 0;
    });
  },

  applyVolume() {
    var v = Math.max(0, Math.min(1, this._volume));
    document.querySelectorAll('audio').forEach(el => { el.volume = v; });
  },

  loadSettings() {
    try {
      const raw = localStorage.getItem('pvz_settings');
      if (!raw) return;
      const s = JSON.parse(raw);
      if (typeof s.volume === 'number') this._volume = Math.max(0, Math.min(1, s.volume));
      if (typeof s.sfxMuted === 'boolean') this._sfxMuted = s.sfxMuted;
      if (typeof s.musicMuted === 'boolean') this._musicMuted = s.musicMuted;
    } catch(e) {}
  },

  saveSettings() {
    localStorage.setItem('pvz_settings', JSON.stringify({
      volume: this._volume,
      sfxMuted: this._sfxMuted,
      musicMuted: this._musicMuted,
    }));
  }
};
window.SFX = SFX;

function initCursik() {
  const ck = Engine.State.cursik;
  ck.el = document.getElementById('cursik');
  ck.bubbleEl = document.getElementById('cursik-bubble');

  const o = Engine.getGridOrigin();
  ck.x = o.x - 60;
  ck.y = o.y + (Engine.GRID_ROWS * Engine.CELL_H) / 2;
  ck.el.style.left = (ck.x - 20) + "px";
  ck.el.style.top  = (ck.y - 20) + "px";

  document.addEventListener('mousemove', (e) => {
    if (Engine.State.selectedPlant && Engine.State.started) {
      highlightCell(e.clientX, e.clientY);
    }
  });
}

let lastHighlightedCell = null;
let plantDragHandlersBound = false;
let plantDragState = {
  active: false,
  key: null,
  previewEl: null,
  lastX: 0,
  lastY: 0,
  lastTime: 0,
  velocityX: 0,
};

function clearHighlightedCell() {
  if (!lastHighlightedCell) return;
  lastHighlightedCell.classList.remove('highlight', 'blocked');
  lastHighlightedCell = null;
}

function highlightCell(mx, my) {
  const cell = Engine.pixelToCell(mx, my);
  clearHighlightedCell();

  if (!cell) return;
  const cellEl = document.querySelector(`.grid-cell[data-col="${cell.col}"][data-row="${cell.row}"]`);
  if (!cellEl) return;

  const hasPlant = Engine.State.plants[cell.row][cell.col];
  cellEl.classList.add(hasPlant ? 'blocked' : 'highlight');
  lastHighlightedCell = cellEl;
}

const PLANT_DISPLAY = [
  { key: 'sunflower',          name: 'подсолнух.png',              cost: 50,  file: 'подсолнух.png' },
  { key: 'peashooter',         name: 'горохострел.png',            cost: 75,  file: 'горохострел.png' },
  { key: 'folder_magnet',      name: 'папка-магнит.png',           cost: 75,  file: 'папка-магнит.png' },
  { key: 'siamese_peashooter', name: 'сиам-горохострел.png',       cost: 125, file: 'сиамский-горохострел.png' },
  { key: 'double_peashooter',  name: 'дв-горохострел.png',          cost: 125, file: 'двойной-горохострел.png' },
  { key: 'snow_peashooter',   name: 'запретострел.png',            cost: 100, file: 'запретострел.png' },
  { key: 'xsas_mushroom',      name: 'xsas-гриб.png',             cost: 150, file: 'xsas-гриб.png' },
  { key: 'sun_mushroom',       name: 'солнце-гриб.png',           cost: 25,  file: 'солнце-гриб.png', nightOnly: true },
  { key: 'unarchiver',         name: 'разархиватор.png',          cost: 50,  file: 'разархиватор.png', isItem: true },
  { key: 'kaspersky_bean',    name: 'касп-боб.png',              cost: 50,  file: 'касперский-боб.png', isItem: true },
  { key: 'daisy',             name: 'ромашка.jpg',               cost: 75,  file: 'ромашка.jpg' },
  { key: 'cherry',            name: 'вишня.webp',                cost: 80,  file: 'вишня.webp' },
  { key: 'avast_nut',         name: 'авасторех.jpg',             cost: 100, file: 'авасторех.jpg' },
  { key: 'logic_mine',       name: 'мина.png',                  cost: 25,  file: 'мина.png' },
  { key: 'torrent_lantern', name: 'торент-фонарь.png',         cost: 75,  file: 'торент-фонарь.png' },
  { key: 'basket_chomper',   name: 'корзинокусалка.png',        cost: 75,  file: 'корзинокусалка.png' },
];

function bindPlantDragHandlers() {
  if (plantDragHandlersBound) return;
  plantDragHandlersBound = true;

  document.addEventListener('pointermove', (e) => {
    if (!plantDragState.active) return;
    updatePlantDrag(e.clientX, e.clientY);
  });

  document.addEventListener('pointerup', (e) => {
    if (!plantDragState.active) return;
    finishPlantDrag(e.clientX, e.clientY);
  });

  document.addEventListener('pointercancel', () => {
    if (!plantDragState.active) return;
    cancelPlantDrag();
  });
}

let fileDragState = { active: false, fileObj: null, previewEl: null };
let fileDragHandlersBound = false;

function bindFileDragHandlers() {
  if (fileDragHandlersBound) return;
  fileDragHandlersBound = true;

  document.addEventListener('pointermove', (e) => {
    if (!fileDragState.active) return;
    updateFileDrag(e.clientX, e.clientY);
  });

  document.addEventListener('pointerup', (e) => {
    if (!fileDragState.active) return;
    finishFileDrag(e.clientX, e.clientY);
  });

  document.addEventListener('pointercancel', () => {
    if (!fileDragState.active) return;
    cancelFileDrag();
  });
}

function startFileDrag(file, event) {
  if (plantDragState.active || fileDragState.active) return;
  if (Engine.State.paused || Engine.State.gameOver) return;

  bindFileDragHandlers();

  fileDragState.active = true;
  fileDragState.fileObj = file;

  file.el.style.visibility = 'hidden';

  const preview = document.createElement('div');
  preview.className = 'file-drag-preview';
  const img = document.createElement('img');
  img.src = 'static/img/other/sys.png';
  img.draggable = false;
  preview.appendChild(img);
  document.body.appendChild(preview);
  preview.style.left = event.clientX + 'px';
  preview.style.top = event.clientY + 'px';
  fileDragState.previewEl = preview;

  showSysFolder();
}

function updateFileDrag(clientX, clientY) {
  if (!fileDragState.previewEl) return;
  fileDragState.previewEl.style.left = clientX + 'px';
  fileDragState.previewEl.style.top = clientY + 'px';

  const S = Engine.State;
  if (S._sysFolder) {
    const rect = S._sysFolder.el.getBoundingClientRect();
    const over = clientX >= rect.left && clientX <= rect.right &&
                 clientY >= rect.top && clientY <= rect.bottom;
    S._sysFolder.el.classList.toggle('drop-highlight', over);
  }
}

function finishFileDrag(clientX, clientY) {
  const file = fileDragState.fileObj;
  const S = Engine.State;

  let success = false;
  if (S._sysFolder) {
    const rect = S._sysFolder.el.getBoundingClientRect();
    success = clientX >= rect.left && clientX <= rect.right &&
              clientY >= rect.top && clientY <= rect.bottom;
  }

  if (success) {
    Engine.removeDroppedFile(file);
    Engine.spawnParticles(
      S._sysFolder.el.getBoundingClientRect().left + 30,
      S._sysFolder.el.getBoundingClientRect().top + 30,
      '#2ecc71', 12
    );
    SFX.play('snd-sun');
    S._magnetBlocked = {};
    hideSysFolder();
  } else {
    if (file && file.el) file.el.style.visibility = 'visible';
    hideSysFolder();
  }

  if (fileDragState.previewEl) {
    fileDragState.previewEl.remove();
  }
  fileDragState = { active: false, fileObj: null, previewEl: null };
}

function cancelFileDrag() {
  const file = fileDragState.fileObj;
  if (file && file.el) file.el.style.visibility = 'visible';
  if (fileDragState.previewEl) fileDragState.previewEl.remove();
  hideSysFolder();
  fileDragState = { active: false, fileObj: null, previewEl: null };
}

function showSysFolder() {
  const S = Engine.State;
  if (S._sysFolder) return;
  document.querySelectorAll('.sys-folder').forEach(el => el.remove());

  const hud = document.getElementById('hud-top');
  const folder = document.createElement('div');
  folder.className = 'sys-folder';

  const img = document.createElement('img');
  img.src = 'static/img/ui/папка.png';
  img.draggable = false;
  img.onerror = () => { img.remove(); folder.insertAdjacentHTML('afterbegin', '<span style="font-size:28px">📁</span>'); };
  folder.appendChild(img);

  const label = document.createElement('span');
  label.textContent = 'system32';
  folder.appendChild(label);

  hud.appendChild(folder);
  S._sysFolder = { el: folder };
}

function hideSysFolder() {
  const S = Engine.State;
  if (!S._sysFolder) return;
  const el = S._sysFolder.el;
  el.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
  el.style.transform = 'translateY(-100%)';
  el.style.opacity = '0';
  setTimeout(() => el.remove(), 300);
  S._sysFolder = null;
}

function setPlantSelection(key) {
  Engine.State.selectedPlant = key;
  document.querySelectorAll('.plant-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.key === key);
  });
}

function createPlantPreview(plant) {
  const preview = document.createElement('div');
  preview.className = 'plant-drag-preview';

  const img = document.createElement('img');
  img.src = `static/img/plants/${plant.file}`;
  img.alt = plant.file;
  img.draggable = false;
  img.onerror = () => {
    img.remove();
    preview.classList.add('asset-missing', `asset-missing-${plant.key}`);
  };

  preview.appendChild(img);
  document.body.appendChild(preview);
  return preview;
}

function updatePlantDrag(clientX, clientY) {
  if (!plantDragState.active || !plantDragState.previewEl) return;
  const now = performance.now();
  if (plantDragState.lastTime) {
    const dt = Math.max(16, now - plantDragState.lastTime);
    const dx = clientX - plantDragState.lastX;
    const dy = clientY - plantDragState.lastY;
    const vx = dx / dt;
    const vy = dy / dt;
    const prevVx = plantDragState.velocityX;
    const reverseX = plantDragState.velocityX !== 0 && Math.sign(vx) !== Math.sign(plantDragState.velocityX);

    plantDragState.velocityX = vx;
    plantDragState.previewEl.style.setProperty('--drag-tilt', `${Math.max(-18, Math.min(18, vx * 18))}deg`);
    plantDragState.previewEl.style.setProperty('--drag-shift-y', `${Math.max(-6, Math.min(6, vy * 4))}px`);

    if (reverseX && Math.abs(vx - prevVx) > 0.6) {
      plantDragState.previewEl.classList.remove('drag-snap');
      void plantDragState.previewEl.offsetWidth;
      plantDragState.previewEl.classList.add('drag-snap');
    }
  }

  plantDragState.previewEl.style.left = clientX + 'px';
  plantDragState.previewEl.style.top = clientY + 'px';
  plantDragState.lastX = clientX;
  plantDragState.lastY = clientY;
  plantDragState.lastTime = now;
  highlightCell(clientX, clientY);
}

function clearPlantDragState() {
  if (plantDragState.previewEl) plantDragState.previewEl.remove();
  plantDragState.active = false;
  plantDragState.key = null;
  plantDragState.previewEl = null;
  plantDragState.lastX = 0;
  plantDragState.lastY = 0;
  plantDragState.lastTime = 0;
  plantDragState.velocityX = 0;
  Engine.State.selectedPlant = null;
  Engine.State._freePlant = null;
  Engine.State._freePlantSource = null;
  document.body.classList.remove('plant-dragging');
  document.getElementById('grid-container')?.classList.remove('dragging-grid');
  document.querySelectorAll('.plant-card').forEach(card => card.classList.remove('selected', 'dragging'));
  clearHighlightedCell();
}

function finishPlantDrag(clientX, clientY) {
  const key = plantDragState.key;
  const wasFree = Engine.State._freePlant === key;
  const freeSource = Engine.State._freePlantSource;
  const cell = Engine.pixelToCell(clientX, clientY);
  const placed = cell ? Engine.tryPlacePlant(key, cell.col, cell.row) : false;
  if (!placed && wasFree && freeSource) {
    var src = Engine.State.plants[freeSource.row]?.[freeSource.col];
    if (src && src.type === 'daisy') {
      Engine.spawnDaisyPlantDrop(freeSource, key);
    }
  }
  clearPlantDragState();
}

function startPlantDrag(key, event) {
  const plant = PLANT_DISPLAY.find(item => item.key === key);
  if (!plant || Engine.State.paused || Engine.State.gameOver) return;

  cancelPlantDrag();
  bindPlantDragHandlers();

  plantDragState.active = true;
  plantDragState.key = key;
  plantDragState.previewEl = createPlantPreview(plant);
  plantDragState.lastX = event.clientX;
  plantDragState.lastY = event.clientY;
  plantDragState.lastTime = performance.now();
  plantDragState.velocityX = 0;
  document.body.classList.add('plant-dragging');
  document.getElementById('grid-container')?.classList.add('dragging-grid');

  setPlantSelection(key);
  updatePlantDrag(event.clientX, event.clientY);
}

function startFreePlantDrag(key, event, source) {
  const cfg = Engine.PLANTS[key];
  if (!cfg || Engine.State.paused || Engine.State.gameOver) return;

  cancelPlantDrag();
  bindPlantDragHandlers();

  Engine.State._freePlant = key;
  Engine.State._freePlantSource = source || null;

  plantDragState.active = true;
  plantDragState.key = key;
  plantDragState.previewEl = createPlantPreview({ key, file: cfg.file });
  plantDragState.lastX = event.clientX;
  plantDragState.lastY = event.clientY;
  plantDragState.lastTime = performance.now();
  plantDragState.velocityX = 0;
  document.body.classList.add('plant-dragging');
  document.getElementById('grid-container')?.classList.add('dragging-grid');

  Engine.State.selectedPlant = key;
  updatePlantDrag(event.clientX, event.clientY);
}

function cancelPlantDrag() {
  var key = plantDragState.key;
  var wasFree = key && Engine.State._freePlant === key;
  var freeSource = Engine.State._freePlantSource;
  clearPlantDragState();
  if (wasFree && freeSource) {
    var src = Engine.State.plants[freeSource.row]?.[freeSource.col];
    if (src && src.type === 'daisy') {
      Engine.spawnDaisyPlantDrop(freeSource, key);
    }
  }
}

function buildPlantBar() {
  const bar = document.getElementById('plant-bar');
  bar.innerHTML = '';
  bindPlantDragHandlers();

  PLANT_DISPLAY.forEach(plant => {
    if (Engine.State._customPlants && !Engine.State._customPlants.includes(plant.key)) return;
    if (plant.nightOnly && !Engine.State.nightMode) return;
    if (plant.key === 'sunflower' && Engine.State.nightMode) return;

    const card = document.createElement('div');
    card.className = 'plant-card';
    card.dataset.key = plant.key;
    card.title = `${Lang.t('plant.name.' + plant.key)} (${plant.cost} ☀)`;

    const img = document.createElement('img');
    img.src = `static/img/${plant.imgFolder || 'plants'}/${plant.file}`;
    img.alt = plant.file;
    img.onerror = () => { img.style.display='none'; card.innerHTML += `<span style="font-size:24px">${plant.key==='sunflower'?'🌻':'🌿'}</span>`; };

    const cost = document.createElement('span');
    cost.className = 'card-cost';
    cost.textContent = plant.cost + ' ☀';

    const cd = document.createElement('div');
    cd.className = 'card-cd';

    card.appendChild(img);
    card.appendChild(cost);
    card.appendChild(cd);
    bar.appendChild(card);

    card.addEventListener('pointerdown', (e) => {
      if (Engine.State.paused || Engine.State.gameOver) return;
      e.preventDefault();
      card.classList.add('dragging');
      startPlantDrag(plant.key, e);
    });
  });
}

function selectPlant(key) {
  setPlantSelection(key);
}

function updatePlantBar() {
  document.querySelectorAll('.plant-card').forEach(card => {
    const key  = card.dataset.key;
    const cost = PLANT_DISPLAY.find(p => p.key === key)?.cost || 0;
    card.classList.toggle('cannot-afford', Engine.State.sun < cost);
  });
}

function updateSun() {
  const el = document.getElementById('sun-count');
  if (el) el.textContent = Engine.State.sun;
  updatePlantBar();
}

function updateWave() {
  const el = document.getElementById('wave-num');
  if (el) el.textContent = Engine.State.wave;
}

function updateModeIndicators() {
  var el = document.getElementById('mode-indicators');
  if (!el) return;
  var parts = [];
  if (localStorage.getItem('pvz_devmode') === 'true') parts.push('DEV');
  if (Engine.State.funMode) parts.push('FUN');
  el.textContent = parts.length ? ' [' + parts.join(' | ') + ']' : '';
}

function initPauseMenu() {
  document.getElementById('pause-resume').addEventListener('click', resumeGame);
  document.getElementById('pause-info').addEventListener('click', () => {
    resumeGame();
    showScreen('docs');
  });
  document.getElementById('pause-settings').addEventListener('click', () => {
    openSettings('pause');
  });
  document.getElementById('pause-menu-btn').addEventListener('click', () => {
    resumeGame();
    returnToMenu();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!document.getElementById('settings-modal').classList.contains('hidden')) {
        closeSettings();
        return;
      }
      if (Engine.State.started && !Engine.State.gameOver) {
        Engine.State.paused ? resumeGame() : pauseGame();
      }
    }
  });
}

function pauseGame() {
  Engine.State.paused = true;
  Engine.dismissChomperMenu();
  GameLog.log('GAME', 'Game paused');
  document.getElementById('pause-menu').classList.remove('hidden');
  SFX.stop('snd-menu');
}

function resumeGame() {
  Engine.State.paused = false;
  GameLog.log('GAME', 'Game resumed');
  document.getElementById('pause-menu').classList.add('hidden');
}

function returnToMenu() {
  GameLog.log('GAME', 'Returning to menu');
  GameLog.flush();
  const S = Engine.State;
  S.gameOver = true;
  S.started  = false;
  S.paused   = false;

  Engine.clearAllTimers();
  Game.cleanupWaves();

  SFX.stopAll();
  resetGameState();

  hideScreen('game');
  showScreen('menu');
  SFX.play('snd-menu');
}

function resetGameState() {
  const S = Engine.State;
  S.sun  = 150;
  S.wave = 0;
  S.zombies = [];
  S.peas    = [];
  S.suns    = [];
  S.cursik.queue = [];
  S.cursik.busy  = false;
  S.cursik.dragZombieId = null;
  S.selectedPlant = null;
  S.nightMode = false;
  S.plants = Array.from({ length: Engine.GRID_ROWS }, () => Array(Engine.GRID_COLS).fill(null));
  S.lawnmowers = Array(Engine.GRID_ROWS).fill(null);
  S.gameOver = false;
  S.started  = false;
  S.droppedFiles = [];
  S.nextFileId = 0;
  S._sysFolder = null;
  S._magnetBlocked = {};
  S._zombieCopyCount = 0;
  S._torrentPairId = 0;
  S._torrentSlots = [];
  S._torrentBatchCleanup = false;

  cancelFileDrag();
  document.querySelector('.sys-folder')?.remove();
  document.querySelector('.file-drag-preview')?.remove();

  document.getElementById('entities-layer').innerHTML = '';
  document.getElementById('suns-layer').innerHTML = '';
  document.getElementById('particles-layer').innerHTML = '';
  document.getElementById('grid-container').innerHTML = '';
}

const SCREENS = ['boot', 'menu', 'docs', 'game', 'end'];

function showScreen(name) {
  const el = document.getElementById(`screen-${name}`);
  if (!el) return;
  el.style.display = 'flex';
  requestAnimationFrame(() => el.style.opacity = '1');
  el.classList.add('active', 'visible');
}

function hideScreen(name) {
  const el = document.getElementById(`screen-${name}`);
  if (!el) return;
  el.style.opacity = '0';
  el.style.transition = 'opacity 0.5s';
  setTimeout(() => {
    el.style.display = 'none';
    el.classList.remove('active', 'visible');
  }, 500);
}

async function loadDesktopData() {
  const desktop = document.getElementById('fake-desktop');
  const shot = document.getElementById('desktop-screenshot');
  if (shot) shot.style.display = 'none';

  if (!window._desktopWallpaper && window._bootData && window._bootData.wallpaper) {
    window._desktopWallpaper = 'data:image/png;base64,' + window._bootData.wallpaper;
  }

  if (window._desktopWallpaper) {
    desktop.style.backgroundImage = `url(${window._desktopWallpaper})`;
    desktop.style.backgroundSize = 'cover';
    desktop.style.backgroundPosition = 'center';
    const layer = document.getElementById('desktop-icons-layer');
    if (layer) layer.innerHTML = '';
    return;
  }

  try {
    const res = await fetch('/api/desktop');
    const data = await res.json();

    if (data.wallpaper) {
      desktop.style.backgroundImage = 'url(data:image/png;base64,' + data.wallpaper + ')';
      desktop.style.backgroundSize = 'cover';
      desktop.style.backgroundPosition = 'center';
      window._desktopWallpaper = 'data:image/png;base64,' + data.wallpaper;
    }

    const layer = document.getElementById('desktop-icons-layer');
    if (layer) layer.innerHTML = '';
  } catch (e) {
    desktop.style.background = 'linear-gradient(135deg,#0a0a1a,#1a1a2a)';
  }
}

async function loadManifest() {
  try {
    const res = await fetch('/api/manifest');
    const data = await res.json();
    const el = document.getElementById('menu-version');
    if (el) el.textContent = `v${data.version}`;
  } catch (e) {}
}

let settingsOpenedFrom = null;

function initSettings() {
  SFX.loadSettings();

  const modal    = document.getElementById('settings-modal');
  const slider   = document.getElementById('settings-volume');
  const valLabel = document.getElementById('settings-volume-val');
  const musicCb  = document.getElementById('settings-music-cb');
  const sfxCb    = document.getElementById('settings-sfx-cb');
  const closeBtn = document.getElementById('settings-close');

  slider.value = Math.round(SFX._volume * 100);
  valLabel.textContent = slider.value + '%';
  musicCb.checked = !SFX._musicMuted;
  musicCb.closest('.toggle-3d').querySelector('.toggle-3d-label').textContent = SFX._musicMuted ? Lang.t('settings.toggle.off') : Lang.t('settings.toggle.on');
  sfxCb.checked = !SFX._sfxMuted;
  sfxCb.closest('.toggle-3d').querySelector('.toggle-3d-label').textContent = SFX._sfxMuted ? Lang.t('settings.toggle.off') : Lang.t('settings.toggle.on');

  slider.addEventListener('input', () => {
    const v = parseInt(slider.value);
    valLabel.textContent = v + '%';
    SFX._volume = v / 100;
    SFX.applyVolume();
    SFX.saveSettings();
  });

  musicCb.addEventListener('change', () => {
    SFX._musicMuted = !musicCb.checked;
    musicCb.closest('.toggle-3d').querySelector('.toggle-3d-label').textContent = musicCb.checked ? Lang.t('settings.toggle.on') : Lang.t('settings.toggle.off');
    if (SFX._musicMuted) {
      SFX.stop('snd-menu');
    } else if (document.getElementById('screen-menu')?.classList.contains('active')) {
      SFX.play('snd-menu');
    }
    SFX.saveSettings();
  });

  sfxCb.addEventListener('change', () => {
    SFX._sfxMuted = !sfxCb.checked;
    sfxCb.closest('.toggle-3d').querySelector('.toggle-3d-label').textContent = sfxCb.checked ? Lang.t('settings.toggle.on') : Lang.t('settings.toggle.off');
    SFX.saveSettings();
  });

  const gamemodeEl = document.getElementById('settings-gamemode');
  const modes = ['day', 'night', 'random'];
  const savedMode = localStorage.getItem('pvz_gamemode') || 'day';
  const savedPos = modes.indexOf(savedMode);
  gamemodeEl.dataset.pos = String(savedPos >= 0 ? savedPos : 0);
  updateGamemodeLabels(gamemodeEl);

  gamemodeEl.addEventListener('click', () => {
    const cur = parseInt(gamemodeEl.dataset.pos);
    const next = (cur + 1) % 3;
    gamemodeEl.dataset.pos = String(next);
    updateGamemodeLabels(gamemodeEl);
    localStorage.setItem('pvz_gamemode', modes[next]);
  });

  const devCb = document.getElementById('settings-devmode-cb');
  const savedDev = localStorage.getItem('pvz_devmode') === 'true';
  devCb.checked = savedDev;
  devCb.closest('.toggle-3d').querySelector('.toggle-3d-label').textContent = savedDev ? Lang.t('settings.toggle.on') : Lang.t('settings.toggle.off');

  const clearLogsBtn = document.getElementById('settings-clear-logs');
  function updateClearLogsVisibility() {
    clearLogsBtn.style.display = devCb.checked ? '' : 'none';
  }
  updateClearLogsVisibility();

  const devModal = document.getElementById('confirm-devmode-modal');
  const devYesBtn = document.getElementById('confirm-devmode-yes');
  const devNoBtn = document.getElementById('confirm-devmode-no');
  let devCooldownTimer = null;

  function applyDevMode(on) {
    devCb.checked = on;
    devCb.closest('.toggle-3d').querySelector('.toggle-3d-label').textContent = on ? Lang.t('settings.toggle.on') : Lang.t('settings.toggle.off');
    localStorage.setItem('pvz_devmode', String(on));
    if (!on) document.getElementById('dev-panel')?.classList.add('hidden');
    updateClearLogsVisibility();
    updateModeIndicators();
  }

  devCb.addEventListener('change', () => {
    if (devCb.checked) {
      devCb.checked = false;
      devModal.classList.remove('hidden');
      devYesBtn.disabled = true;
      let sec = 5;
      devYesBtn.textContent = Lang.t('confirm.devmode_yes', sec);
      if (devCooldownTimer) clearInterval(devCooldownTimer);
      devCooldownTimer = setInterval(() => {
        sec--;
        if (sec <= 0) {
          clearInterval(devCooldownTimer);
          devCooldownTimer = null;
          devYesBtn.disabled = false;
          devYesBtn.textContent = Lang.t('confirm.devmode_yes_ready');
        } else {
          devYesBtn.textContent = Lang.t('confirm.devmode_yes', sec);
        }
      }, 1000);
    } else {
      applyDevMode(false);
    }
  });

  devYesBtn.addEventListener('click', () => {
    if (devCooldownTimer) { clearInterval(devCooldownTimer); devCooldownTimer = null; }
    devModal.classList.add('hidden');
    applyDevMode(true);
  });
  devNoBtn.addEventListener('click', () => {
    if (devCooldownTimer) { clearInterval(devCooldownTimer); devCooldownTimer = null; }
    devModal.classList.add('hidden');
  });
  devModal.addEventListener('click', (e) => {
    if (e.target === devModal) {
      if (devCooldownTimer) { clearInterval(devCooldownTimer); devCooldownTimer = null; }
      devModal.classList.add('hidden');
    }
  });

  const funCb = document.getElementById('settings-funmode-cb');
  const savedFun = localStorage.getItem('pvz_funmode') === 'true';
  funCb.checked = savedFun;
  Engine.State.funMode = savedFun;
  funCb.closest('.toggle-3d').querySelector('.toggle-3d-label').textContent = savedFun ? Lang.t('settings.toggle.on') : Lang.t('settings.toggle.off');

  const funModal = document.getElementById('confirm-funmode-modal');
  const funYesBtn = document.getElementById('confirm-funmode-yes');
  const funNoBtn = document.getElementById('confirm-funmode-no');
  let funCooldownTimer = null;

  function applyFunMode(on) {
    funCb.checked = on;
    funCb.closest('.toggle-3d').querySelector('.toggle-3d-label').textContent = on ? Lang.t('settings.toggle.on') : Lang.t('settings.toggle.off');
    localStorage.setItem('pvz_funmode', String(on));
    Engine.State.funMode = on;
    updateModeIndicators();
  }

  funCb.addEventListener('change', () => {
    if (funCb.checked) {
      funCb.checked = false;
      funModal.classList.remove('hidden');
      funYesBtn.disabled = true;
      let sec = 5;
      funYesBtn.textContent = Lang.t('confirm.funmode_yes', sec);
      if (funCooldownTimer) clearInterval(funCooldownTimer);
      funCooldownTimer = setInterval(() => {
        sec--;
        if (sec <= 0) {
          clearInterval(funCooldownTimer);
          funCooldownTimer = null;
          funYesBtn.disabled = false;
          funYesBtn.textContent = Lang.t('confirm.funmode_yes_ready');
        } else {
          funYesBtn.textContent = Lang.t('confirm.funmode_yes', sec);
        }
      }, 1000);
    } else {
      applyFunMode(false);
    }
  });

  funYesBtn.addEventListener('click', () => {
    if (funCooldownTimer) { clearInterval(funCooldownTimer); funCooldownTimer = null; }
    funModal.classList.add('hidden');
    applyFunMode(true);
  });
  funNoBtn.addEventListener('click', () => {
    if (funCooldownTimer) { clearInterval(funCooldownTimer); funCooldownTimer = null; }
    funModal.classList.add('hidden');
  });
  funModal.addEventListener('click', (e) => {
    if (e.target === funModal) {
      if (funCooldownTimer) { clearInterval(funCooldownTimer); funCooldownTimer = null; }
      funModal.classList.add('hidden');
    }
  });

  const confirmLogsModal = document.getElementById('confirm-logs-modal');
  clearLogsBtn.addEventListener('click', () => {
    confirmLogsModal.classList.remove('hidden');
  });
  document.getElementById('confirm-logs-yes').addEventListener('click', () => {
    GameLog.clear().then(() => {
      GameLog.log('SYSTEM', 'Logs cleared by user');
    });
    confirmLogsModal.classList.add('hidden');
  });
  document.getElementById('confirm-logs-no').addEventListener('click', () => {
    confirmLogsModal.classList.add('hidden');
  });
  confirmLogsModal.addEventListener('click', (e) => {
    if (e.target === confirmLogsModal) confirmLogsModal.classList.add('hidden');
  });

  const langCb = document.getElementById('settings-lang-cb');
  if (langCb) {
    langCb.checked = (Lang.current() === 'en');
    document.getElementById('settings-lang-label').textContent = Lang.t('settings.lang.name');
    langCb.addEventListener('change', () => {
      Lang.set(langCb.checked ? 'en' : 'ru');
    });
  }

  closeBtn.addEventListener('click', closeSettings);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeSettings();
  });

  const confirmModal = document.getElementById('confirm-modal');
  document.getElementById('settings-reset').addEventListener('click', () => {
    confirmModal.classList.remove('hidden');
  });
  document.getElementById('confirm-yes').addEventListener('click', () => {
    localStorage.clear();
    location.reload();
  });
  document.getElementById('confirm-no').addEventListener('click', () => {
    confirmModal.classList.add('hidden');
  });
  confirmModal.addEventListener('click', (e) => {
    if (e.target === confirmModal) confirmModal.classList.add('hidden');
  });

  updateModeIndicators();
}

function updateGamemodeLabels(el) {
  const pos = parseInt(el.dataset.pos);
  el.querySelectorAll('.toggle-3way-lbl').forEach(lbl => {
    lbl.classList.toggle('active', parseInt(lbl.dataset.pos) === pos);
  });
}

function openSettings(from) {
  settingsOpenedFrom = from;
  document.getElementById('settings-modal').classList.remove('hidden');
}

function closeSettings() {
  document.getElementById('settings-modal').classList.add('hidden');
  settingsOpenedFrom = null;
}

window.UI = {
  initCursik,
  buildPlantBar,
  updateSun,
  updateWave,
  updateModeIndicators,
  updatePlantBar,
  initPauseMenu,
  initSettings,
  openSettings,
  closeSettings,
  pauseGame,
  resumeGame,
  returnToMenu,
  showScreen,
  hideScreen,
  loadDesktopData,
  loadManifest,
  selectPlant,
  PLANT_DISPLAY,
  cancelPlantDrag,
  startFileDrag,
  cancelFileDrag,
  startFreePlantDrag,
  showSysFolder,
  hideSysFolder,
  syncVolumeSlider,
};

function syncVolumeSlider() {
  var slider = document.getElementById('settings-volume');
  var label = document.getElementById('settings-volume-val');
  if (!slider || !label) return;
  var pct = Math.round(SFX._volume * 100);
  slider.value = Math.max(0, Math.min(100, pct));
  slider.style.overflow = pct > 100 ? 'visible' : '';
  label.textContent = pct + '%';
  if (pct > 100) {
    label.style.color = '#ff4444';
  } else {
    label.style.color = '';
  }
}
