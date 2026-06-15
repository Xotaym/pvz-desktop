"use strict";

const SFX = {
  _volume: 0.8,
  _sfxMuted: false,
  _musicMuted: false,
  _musicIds: ['snd-menu'],

  _ctx: null,
  _masterGain: null,
  _musicGain: null,
  _sfxGain: null,
  _buffers: new Map(),
  _active: new Map(),
  _suspended: false,

  _isMusic(id) { return this._musicIds.includes(id); },

  _ensureCtx() {
    if (this._ctx) return this._ctx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try {
      this._ctx = new Ctx();
    } catch (e) {
      return null;
    }
    this._masterGain = this._ctx.createGain();
    this._masterGain.gain.value = this._volume;
    this._masterGain.connect(this._ctx.destination);
    this._musicGain = this._ctx.createGain();
    this._musicGain.gain.value = this._musicMuted ? 0 : 1;
    this._musicGain.connect(this._masterGain);
    this._sfxGain = this._ctx.createGain();
    this._sfxGain.gain.value = this._sfxMuted ? 0 : 1;
    this._sfxGain.connect(this._masterGain);
    return this._ctx;
  },

  async _loadBuffer(id) {
    const ctx = this._ensureCtx();
    if (!ctx) return null;
    if (this._buffers.has(id)) return this._buffers.get(id);
    const el = document.getElementById(id);
    if (!el) return null;
    const url = el.src || (el.querySelector('source') && el.querySelector('source').src);
    if (!url) return null;
    try {
      const res = await fetch(url);
      const arr = await res.arrayBuffer();
      const buf = await new Promise((resolve, reject) => {
        ctx.decodeAudioData(arr, resolve, reject);
      });
      this._buffers.set(id, buf);
      return buf;
    } catch (e) {
      if (window.GameLog) GameLog.log('SFX', 'decode failed for ' + id + ': ' + (e && e.message || e));
      return null;
    }
  },

  init() {
    this._ensureCtx();
    const audios = document.querySelectorAll('audio[id^="snd-"]');
    audios.forEach(a => { this._loadBuffer(a.id); });
  },

  play(id) {
    if (this._isMusic(id) && this._musicMuted) return;
    if (!this._isMusic(id) && this._sfxMuted) return;
    const ctx = this._ensureCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      this._suspended = false;
      ctx.resume().catch(() => {});
    }

    const buf = this._buffers.get(id);
    if (!buf) {
      this._loadBuffer(id).then(b => { if (b && !this._suspended) this.play(id); });
      return;
    }

    if (this._isMusic(id)) this.stop(id);

    const source = ctx.createBufferSource();
    source.buffer = buf;
    source.loop = this._isMusic(id);
    source.connect(this._isMusic(id) ? this._musicGain : this._sfxGain);
    try { source.start(0); } catch (e) { return; }

    let set = this._active.get(id);
    if (!set) { set = new Set(); this._active.set(id, set); }
    set.add(source);
    source.onended = () => { set.delete(source); };
  },

  stop(id) {
    const set = this._active.get(id);
    if (!set) return;
    for (const s of set) {
      try { s.stop(); } catch (e) {}
    }
    set.clear();
  },

  stopAll() {
    for (const id of Array.from(this._active.keys())) this.stop(id);
  },

  suspend() {
    if (this._suspended) return;
    this._suspended = true;
    if (this._ctx && this._ctx.state === 'running') {
      this._ctx.suspend().catch(() => {});
    }
  },

  resume() {
    if (!this._suspended) return;
    this._suspended = false;
    if (this._ctx && this._ctx.state === 'suspended') {
      this._ctx.resume().catch(() => {});
    }
  },

  applyVolume() {
    const v = Math.max(0, Math.min(1, this._volume));
    this._volume = v;
    if (this._masterGain) this._masterGain.gain.value = v;
  },

  duckMusic(level = 0.2, duration = 0.4) {
    if (!this._musicGain || !this._ctx) return;
    if (this._musicMuted) return;
    const now = this._ctx.currentTime;
    this._musicGain.gain.cancelScheduledValues(now);
    this._musicGain.gain.setValueAtTime(this._musicGain.gain.value, now);
    this._musicGain.gain.linearRampToValueAtTime(level, now + duration);
  },

  unduckMusic(duration = 0.4) {
    if (!this._musicGain || !this._ctx) return;
    if (this._musicMuted) return;
    const now = this._ctx.currentTime;
    this._musicGain.gain.cancelScheduledValues(now);
    this._musicGain.gain.setValueAtTime(this._musicGain.gain.value, now);
    this._musicGain.gain.linearRampToValueAtTime(1, now + duration);
  },

  _applyMutes() {
    if (this._musicGain) this._musicGain.gain.value = this._musicMuted ? 0 : 1;
    if (this._sfxGain) this._sfxGain.gain.value = this._sfxMuted ? 0 : 1;
  },

  loadSettings() {
    try {
      const raw = localStorage.getItem('pvz_settings');
      if (!raw) return;
      const s = JSON.parse(raw);
      if (typeof s.volume === 'number') this._volume = Math.max(0, Math.min(1, s.volume));
      if (typeof s.sfxMuted === 'boolean') this._sfxMuted = s.sfxMuted;
      if (typeof s.musicMuted === 'boolean') this._musicMuted = s.musicMuted;
    } catch (e) {}
    this.applyVolume();
    this._applyMutes();
  },

  saveSettings() {
    localStorage.setItem('pvz_settings', JSON.stringify({
      volume: this._volume,
      sfxMuted: this._sfxMuted,
      musicMuted: this._musicMuted,
    }));
    this._applyMutes();
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

  document.addEventListener('pointermove', (e) => {
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
  { key: 'sunflower',          name: 'sunflower.png',              cost: 50,  file: 'sunflower.png' },
  { key: 'peashooter',         name: 'peashooter.png',             cost: 75,  file: 'peashooter.png' },
  { key: 'folder_magnet',      name: 'folder-magnet.png',          cost: 75,  file: 'folder-magnet.png' },
  { key: 'siamese_peashooter', name: 'siamese-peashooter.png',     cost: 125, file: 'siamese-peashooter.png' },
  { key: 'double_peashooter',  name: 'double-peashooter.jpg',      cost: 125, file: 'double-peashooter.jpg' },
  { key: 'snow_peashooter',   name: 'snow-peashooter.jpg',        cost: 100, file: 'snow-peashooter.jpg' },
  { key: 'xsas_mushroom',      name: 'xsas-mushroom.png',         cost: 150, file: 'xsas-mushroom.png' },
  { key: 'sun_mushroom',       name: 'sun-mushroom.png',          cost: 25,  file: 'sun-mushroom.png', nightOnly: true },
  { key: 'unarchiver',         name: 'unarchiver.png',            cost: 50,  file: 'unarchiver.png', isItem: true },
  { key: 'kaspersky_bean',    name: 'kaspersky-bean.png',         cost: 50,  file: 'kaspersky-bean.png', isItem: true },
  { key: 'daisy',             name: 'daisy.jpg',                  cost: 75,  file: 'daisy.jpg' },
  { key: 'cherry',            name: 'cherry.webp',                cost: 80,  file: 'cherry.webp' },
  { key: 'avast_nut',         name: 'avast-nut.jpg',              cost: 100, file: 'avast-nut.jpg' },
  { key: 'torchwall',         name: 'torchwall.png',              cost: 175, file: 'torchwall.png' },
  { key: 'logic_mine',       name: 'mine.jpg',                   cost: 25,  file: 'mine.jpg' },
  { key: 'torrent_lantern', name: 'torrent-lantern.jpg',        cost: 75,  file: 'torrent-lantern.jpg' },
  { key: 'basket_chomper',   name: 'basket-chomper.jpg',         cost: 75,  file: 'basket-chomper.jpg' },
  { key: 'catmouse',         name: 'catmouse.png',               cost: 175, file: 'catmouse.png' },
  { key: 'pirate_mushroom',  name: 'pirate-mushroom.jpg',        cost: 15,  file: 'pirate-mushroom.jpg' },
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
  img.src = file.kind === 'table' ? 'static/img/other/table.png' : 'static/img/other/sys.png';
  img.draggable = false;
  preview.appendChild(img);
  document.body.appendChild(preview);
  preview.style.left = event.clientX + 'px';
  preview.style.top = event.clientY + 'px';
  fileDragState.previewEl = preview;

  showSysFolder(file.kind === 'table' ? 'table' : 'sys');
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
      file.kind === 'table' ? '#1a7a3a' : '#2ecc71', 12
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

function showSysFolder(kind) {
  const S = Engine.State;
  if (S._sysFolder) return;
  document.querySelectorAll('.sys-folder').forEach(el => el.remove());

  var isMobile = window.matchMedia('(max-width: 767px), (pointer: coarse) and (max-height: 900px)').matches;
  var parent = isMobile ? document.getElementById('screen-game') : document.getElementById('hud-top');
  var folder = document.createElement('div');
  var folderKind = kind === 'table' ? 'table' : 'sys';
  folder.className = 'sys-folder' + (isMobile ? ' sys-folder-mobile' : '') + ' sys-folder-' + folderKind;

  const img = document.createElement('img');
  img.src = 'static/img/ui/folder.png';
  img.draggable = false;
  img.onerror = () => { img.remove(); folder.insertAdjacentHTML('afterbegin', '<span style="font-size:28px">📁</span>'); };
  folder.appendChild(img);

  const label = document.createElement('span');
  label.textContent = folderKind === 'table' ? 'Работа-2026' : 'system32';
  folder.appendChild(label);

  parent.appendChild(folder);
  S._sysFolder = { el: folder, kind: folderKind };
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
  var cell = Engine.pixelToCell(clientX, clientY);
  plantDragState.previewEl.classList.toggle('out-of-bounds', !cell);
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
  document.body.style.touchAction = '';
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
  document.body.style.touchAction = 'none';
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
  document.body.style.touchAction = 'none';
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

function ensureMobilePlantBar() {
  var isMobile = window.matchMedia('(max-width: 767px), (pointer: coarse) and (max-height: 900px)').matches;
  var bar = document.getElementById('plant-bar');
  var game = document.getElementById('screen-game');
  if (!bar || !game) return;
  if (isMobile && bar.parentElement.id === 'hud-top') {
    game.appendChild(bar);
  } else if (!isMobile && bar.parentElement.id !== 'hud-top') {
    var hud = document.getElementById('hud-top');
    var waveInfo = document.getElementById('wave-info');
    if (hud && waveInfo) hud.insertBefore(bar, waveInfo);
    else if (hud) hud.appendChild(bar);
  }
}

function buildPlantBar() {
  ensureMobilePlantBar();
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
      if (e.pointerType !== 'touch') {
        e.preventDefault();
        card.classList.add('dragging');
        startPlantDrag(plant.key, e);
        return;
      }

      const startX = e.clientX, startY = e.clientY;
      let armed = false;
      let cancelled = false;

      const arm = (ev) => {
        if (armed || cancelled) return;
        armed = true;
        card.classList.add('dragging');
        try { card.releasePointerCapture && card.releasePointerCapture(ev.pointerId); } catch (_) {}
        startPlantDrag(plant.key, ev);
      };

      const onMove = (ev) => {
        if (armed || cancelled) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          cleanup();
          return;
        }
        if (Math.abs(dy) > 8 || Math.abs(dx) > 24) {
          arm(ev);
        }
      };
      const onEnd = (ev) => {
        if (!armed) {
          cleanup();
        }
      };
      const holdTimer = setTimeout(() => {
        if (!cancelled && !armed) {
          const fakeEvt = { clientX: startX, clientY: startY, pointerId: e.pointerId, pointerType: 'touch', preventDefault: () => {} };
          arm(fakeEvt);
        }
      }, 220);
      const cleanup = () => {
        cancelled = true;
        clearTimeout(holdTimer);
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onEnd);
        document.removeEventListener('pointercancel', onEnd);
      };
      document.addEventListener('pointermove', onMove, { passive: true });
      document.addEventListener('pointerup', onEnd, { passive: true });
      document.addEventListener('pointercancel', onEnd, { passive: true });
    });
  });

  updatePlantBar();
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
  el.innerHTML = '';
  if (localStorage.getItem('pvz_devmode') === 'true') {
    var badge = document.createElement('span');
    badge.className = 'dev-badge';
    badge.textContent = 'DEV';
    badge.addEventListener('click', function() {
      var panel = document.getElementById('dev-panel');
      if (panel) panel.classList.toggle('hidden');
    });
    el.appendChild(document.createTextNode(' ['));
    el.appendChild(badge);
    if (Engine.State.funMode) el.appendChild(document.createTextNode(' | FUN'));
    el.appendChild(document.createTextNode(']'));
  } else if (Engine.State.funMode) {
    el.textContent = ' [FUN]';
  }
}

function initPauseMenu() {
  document.getElementById('pause-resume').addEventListener('click', resumeGame);
  document.getElementById('pause-info').addEventListener('click', () => {
    document.getElementById('pause-menu').classList.add('hidden');
    showScreen('docs');
    document.getElementById('screen-docs').dataset.from = 'pause';
  });
  document.getElementById('pause-settings').addEventListener('click', () => {
    openSettings('pause');
  });
  document.getElementById('pause-menu-btn').addEventListener('click', () => {
    resumeGame();
    returnToMenu();
  });
  document.getElementById('pause-exit').addEventListener('click', () => {
    try { fetch('/api/exit', { method: 'POST' }); } catch (e) {}
    try { window.close(); } catch (e) {}
    setTimeout(() => { window.location.href = 'about:blank'; }, 400);
  });

  var mobilePauseBtn = document.getElementById('mobile-pause-btn');
  if (mobilePauseBtn) {
    mobilePauseBtn.addEventListener('click', () => {
      if (Engine.State.started && !Engine.State.gameOver) {
        Engine.State.paused ? resumeGame() : pauseGame();
      }
    });
  }

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

  const onHide = () => {
    if (Engine.State.started && !Engine.State.gameOver && !Engine.State.paused) {
      pauseGame();
    }
    SFX.suspend();
  };
  const onShow = () => {
    if (Engine.State.started && Engine.State.paused) return;
    SFX.resume();
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) onHide();
    else onShow();
  });
  window.addEventListener('blur', onHide);
  window.addEventListener('focus', onShow);
  window.addEventListener('pagehide', onHide);
}

function pauseGame() {
  Engine.State.paused = true;
  Engine.pauseAllTimers();
  Engine.dismissChomperMenu();
  GameLog.log('GAME', 'Game paused');
  document.getElementById('pause-menu').classList.remove('hidden');
  SFX.suspend();
}

function resumeGame() {
  Engine.State.paused = false;
  Engine.resumeAllTimers();
  GameLog.log('GAME', 'Game resumed');
  document.getElementById('pause-menu').classList.add('hidden');
  SFX.resume();
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

  document.querySelectorAll('.wave-banner').forEach(el => el.remove());
  const bsod = document.getElementById('screen-end');
  if (bsod) {
    bsod.style.display = 'none';
    bsod.classList.remove('active', 'visible');
  }

  hideScreen('game');
  hideScreen('docs');
  const docsEl = document.getElementById('screen-docs');
  if (docsEl) delete docsEl.dataset.from;
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
  S.deathCursors = [];
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
  S._xsasHistory = [];
  S.petyaPct = 0;
  S._petyaDecayAccel = 0;
  S.zombieMutations = {};
  document.getElementById('petya-meter')?.remove();
  document.querySelectorAll('.txt-mutation-pop').forEach(el => el.remove());

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
  if (window.Discord) {
    if (name === 'menu') Discord.menu();
    else if (name === 'docs') Discord.docs();
    else if (name === 'end') Discord.bsod();
  }
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
    const mime = window._bootData.wallpaper_mime || 'image/png';
    window._desktopWallpaper = `data:${mime};base64,` + window._bootData.wallpaper;
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
      const mime = data.wallpaper_mime || 'image/png';
      const url = `data:${mime};base64,` + data.wallpaper;
      desktop.style.backgroundImage = `url(${url})`;
      desktop.style.backgroundSize = 'cover';
      desktop.style.backgroundPosition = 'center';
      window._desktopWallpaper = url;
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

  const gfxCb = document.getElementById('settings-gfx-cb');
  const gfxLabel = document.getElementById('settings-gfx-label');
  function refreshGfxLabel() {
    const isHigh = !!(window.Graphics && !window.Graphics.isLow());
    gfxCb.checked = isHigh;
    gfxLabel.textContent = isHigh ? Lang.t('settings.gfx.high') : Lang.t('settings.gfx.low');
  }
  refreshGfxLabel();
  gfxCb.addEventListener('change', () => {
    if (window.Graphics) window.Graphics.set(gfxCb.checked ? 'high' : 'low');
    refreshGfxLabel();
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

  const discordCb = document.getElementById('settings-discord-cb');
  const discordHint = document.getElementById('settings-discord-hint');
  const savedDiscord = localStorage.getItem('pvz_discord') !== 'false';
  discordCb.checked = savedDiscord;
  discordCb.closest('.toggle-3d').querySelector('.toggle-3d-label').textContent = savedDiscord ? Lang.t('settings.toggle.on') : Lang.t('settings.toggle.off');

  function showDiscordHint(text) {
    if (!discordHint) return;
    if (text) {
      discordHint.textContent = text;
      discordHint.style.display = '';
    } else {
      discordHint.style.display = 'none';
    }
  }

  if (savedDiscord && window.Discord) {
    Discord.available().then(res => {
      if (!res.available) {
        if (res.reason === 'android_unsupported') {
          showDiscordHint(Lang.t('settings.discord.android'));
        } else if (res.reason && (res.reason.indexOf('pypresence_missing') === 0 || res.reason === 'module_unavailable')) {
          showDiscordHint(Lang.t('settings.discord.unavailable'));
        } else {
          showDiscordHint(Lang.t('settings.discord.disconnected'));
        }
      } else {
        showDiscordHint('');
      }
    });
  }

  discordCb.addEventListener('change', async () => {
    const on = discordCb.checked;
    discordCb.closest('.toggle-3d').querySelector('.toggle-3d-label').textContent = on ? Lang.t('settings.toggle.on') : Lang.t('settings.toggle.off');
    localStorage.setItem('pvz_discord', String(on));
    if (!window.Discord) return;
    if (on) {
      const avail = await Discord.available();
      const hardFail = !avail.available && avail.reason &&
        (avail.reason === 'android_unsupported' || avail.reason === 'module_unavailable' || avail.reason.indexOf('pypresence_missing') === 0);
      if (hardFail) {
        showDiscordHint(Lang.t(avail.reason === 'android_unsupported' ? 'settings.discord.android' : 'settings.discord.unavailable'));
        discordCb.checked = false;
        discordCb.closest('.toggle-3d').querySelector('.toggle-3d-label').textContent = Lang.t('settings.toggle.off');
        localStorage.setItem('pvz_discord', 'false');
        return;
      }
      const res = await Discord.enable();
      if (res && res.available === false) {
        showDiscordHint(Lang.t('settings.discord.disconnected'));
      } else {
        showDiscordHint('');
      }
      const screen = document.querySelector('.game-screen.active, [id^="screen-"].active');
      const id = screen ? screen.id : '';
      if (id === 'screen-menu') Discord.menu();
      else if (id === 'screen-docs') Discord.docs();
      else if (id === 'screen-game') Discord.game(Engine.State.wave || 1);
    } else {
      Discord.disable();
      showDiscordHint('');
    }
  });

  if (!savedDiscord && window.Discord) {
    Discord.disable();
  }

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
    document.getElementById('btn-editor')?.classList.toggle('hidden', !on);
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

  const openLogsBtn = document.getElementById('settings-open-logs');
  const logsModal = document.getElementById('logs-modal');
  const logsTextarea = document.getElementById('logs-content');
  const logsStatus = document.getElementById('logs-status');
  const logsCopyBtn = document.getElementById('logs-copy');
  const logsSaveBtn = document.getElementById('logs-save');
  const logsRefreshBtn = document.getElementById('logs-refresh');
  const logsCloseBtn = document.getElementById('logs-close');

  function setLogsStatus(text) {
    if (logsStatus) logsStatus.textContent = text || '';
  }

  async function loadLogContent() {
    setLogsStatus(Lang.t('logs.loading'));
    try {
      if (window.GameLog && GameLog.flush) { try { await GameLog.flush(); } catch (_) {} }
      const res = await fetch('/api/logs/read');
      const data = await res.json().catch(() => ({}));
      const content = (data && data.content) || '';
      logsTextarea.value = content;
      logsTextarea.scrollTop = logsTextarea.scrollHeight;
      setLogsStatus(content ? '' : Lang.t('logs.empty'));
    } catch (e) {
      logsTextarea.value = '';
      setLogsStatus(e.message);
    }
  }

  if (openLogsBtn) {
    openLogsBtn.addEventListener('click', async () => {
      logsModal.classList.remove('hidden');
      await loadLogContent();
    });
  }

  if (logsRefreshBtn) {
    logsRefreshBtn.addEventListener('click', loadLogContent);
  }

  if (logsCloseBtn) {
    logsCloseBtn.addEventListener('click', () => logsModal.classList.add('hidden'));
  }
  if (logsModal) {
    logsModal.addEventListener('click', (e) => {
      if (e.target === logsModal) logsModal.classList.add('hidden');
    });
  }

  if (logsCopyBtn) {
    logsCopyBtn.addEventListener('click', async () => {
      const text = logsTextarea.value || '';
      let ok = false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          ok = true;
        }
      } catch (_) {}
      if (!ok) {
        try {
          logsTextarea.focus();
          logsTextarea.select();
          ok = document.execCommand('copy');
        } catch (_) {}
      }
      setLogsStatus(ok ? Lang.t('logs.copied') : Lang.t('logs.copy_failed'));
    });
  }

  if (logsSaveBtn) {
    logsSaveBtn.addEventListener('click', async () => {
      const text = logsTextarea.value || '';
      const isAndroid = /Android/i.test(navigator.userAgent || '');
      if (isAndroid) {
        try {
          const res = await fetch('/api/logs/share', { method: 'POST' });
          const data = await res.json().catch(() => ({}));
          if (data.ok) {
            if (data.path) {
              setLogsStatus(Lang.t('logs.saved') + ': ' + data.path);
            } else {
              setLogsStatus(Lang.t('logs.saved'));
            }
          } else {
            setLogsStatus(Lang.t('logs.save_failed') + (data.error ? ': ' + data.error : ''));
          }
        } catch (e) {
          setLogsStatus(Lang.t('logs.save_failed') + ': ' + e.message);
        }
        return;
      }
      try {
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        a.download = `pvz-game-${ts}.log`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        setLogsStatus(Lang.t('logs.saved'));
      } catch (e) {
        setLogsStatus(Lang.t('logs.save_failed') + ': ' + e.message);
      }
    });
  }

  const exportSelect = document.getElementById('settings-export-select');
  const exportBtn = document.getElementById('settings-export-btn');
  const exportStatus = document.getElementById('settings-export-status');

  function setExportStatus(text) {
    if (!exportStatus) return;
    exportStatus.textContent = text || '';
    exportStatus.style.display = text ? 'block' : 'none';
  }

  if (exportSelect && exportBtn) {
    exportBtn.addEventListener('click', async () => {
      const fname = exportSelect.value;
      if (!fname) { setExportStatus(Lang.t('settings.export_wave.none')); return; }
      setExportStatus(Lang.t('settings.export_wave.working'));
      try {
        const res = await fetch('/api/export_wave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: fname }),
        });
        const data = await res.json().catch(() => ({}));
        if (data.ok) {
          if (data.method === 'intent') {
            setExportStatus(Lang.t('settings.export_wave.shared'));
          } else if (data.path) {
            setExportStatus(Lang.t('settings.export_wave.saved') + ': ' + data.path);
          } else {
            setExportStatus(Lang.t('settings.export_wave.saved'));
          }
        } else {
          setExportStatus(Lang.t('settings.export_wave.failed') + (data.error ? ': ' + data.error : ''));
        }
      } catch (e) {
        setExportStatus(Lang.t('settings.export_wave.failed') + ': ' + e.message);
      }
    });
  }

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

function populateExportSelect() {
  var sel = document.getElementById('settings-export-select');
  if (!sel) return;
  var status = document.getElementById('settings-export-status');
  if (status) status.style.display = 'none';
  fetch('/api/custom_waves').then(function (r) { return r.json(); }).then(function (data) {
    var waves = (data && data.waves) || [];
    sel.innerHTML = '';
    if (!waves.length) {
      var opt = document.createElement('option');
      opt.value = '';
      opt.textContent = Lang.t('settings.export_wave.empty');
      sel.appendChild(opt);
      sel.disabled = true;
      var btn = document.getElementById('settings-export-btn');
      if (btn) btn.disabled = true;
      return;
    }
    sel.disabled = false;
    var btn2 = document.getElementById('settings-export-btn');
    if (btn2) btn2.disabled = false;
    waves.forEach(function (w) {
      var fname = w._filename || w.name || 'untitled';
      var opt = document.createElement('option');
      opt.value = fname;
      opt.textContent = (w.name || fname) + ' (' + fname + '.json)';
      sel.appendChild(opt);
    });
  }).catch(function () {});
}

function openSettings(from) {
  settingsOpenedFrom = from;
  document.getElementById('settings-modal').classList.remove('hidden');
  populateExportSelect();
}

function closeSettings() {
  document.getElementById('settings-modal').classList.add('hidden');
  settingsOpenedFrom = null;
}

function refreshToggleLabels() {
  var musicCb = document.getElementById('settings-music-cb');
  if (musicCb) musicCb.closest('.toggle-3d').querySelector('.toggle-3d-label').textContent = musicCb.checked ? Lang.t('settings.toggle.on') : Lang.t('settings.toggle.off');
  var sfxCb = document.getElementById('settings-sfx-cb');
  if (sfxCb) sfxCb.closest('.toggle-3d').querySelector('.toggle-3d-label').textContent = sfxCb.checked ? Lang.t('settings.toggle.on') : Lang.t('settings.toggle.off');
  var devCb = document.getElementById('settings-devmode-cb');
  if (devCb) devCb.closest('.toggle-3d').querySelector('.toggle-3d-label').textContent = devCb.checked ? Lang.t('settings.toggle.on') : Lang.t('settings.toggle.off');
  var funCb = document.getElementById('settings-funmode-cb');
  if (funCb) funCb.closest('.toggle-3d').querySelector('.toggle-3d-label').textContent = funCb.checked ? Lang.t('settings.toggle.on') : Lang.t('settings.toggle.off');
  var gfxLabel = document.getElementById('settings-gfx-label');
  var gfxCb = document.getElementById('settings-gfx-cb');
  if (gfxLabel && gfxCb) {
    var isHigh = !!(window.Graphics && !window.Graphics.isLow());
    gfxLabel.textContent = isHigh ? Lang.t('settings.gfx.high') : Lang.t('settings.gfx.low');
  }
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
  refreshToggleLabels,
  ensureMobilePlantBar,
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

(function(){
  var _typedEl = null, _fired = false;
  function _key(){ return (window.__qa || '') + (window.__qc || ''); }
  function _dec(s){ return window.__qz ? window.__qz(s, _key()) : ''; }
  function _ensure(){
    if (!_typedEl){
      _typedEl = document.createElement('div');
      _typedEl.style.cssText = 'position:fixed;left:0;right:0;bottom:32px;text-align:center;font-family:"Segoe UI","Arial",sans-serif;font-weight:700;font-size:32px;color:#fff;text-shadow:0 2px 6px rgba(0,0,0,0.85),0 0 14px rgba(0,0,0,0.6);letter-spacing:0.4em;pointer-events:none;z-index:99999;opacity:0;transition:opacity 0.2s;';
      document.body.appendChild(_typedEl);
    }
  }
  function _showTyped(text){
    _ensure();
    _typedEl.textContent = text.toUpperCase();
    _typedEl.style.opacity = '1';
    clearTimeout(_typedEl._t);
    _typedEl._t = setTimeout(function(){ if (_typedEl) _typedEl.style.opacity = '0'; }, 2000);
  }
  function _gate(){
    return window.Engine && Engine.State && Engine.State.funMode === true && Engine.State.started === true && !Engine.State.gameOver;
  }
  document.addEventListener('keydown', function(e){
    if (!_gate() || _fired) return;
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    var code = e.code || '';
    var map = { KeyL: 'l', KeyE: 'e', KeyN: 'n', KeyI: 'i' };
    var ch = map[code];
    if (!ch) return;
    var buf = window.__qbPush(ch);
    var target = _dec(window.__qt.tg);
    if (!target) return;
    var matchLen = 0;
    for (var m = Math.min(buf.length, target.length); m > 0; m--){
      if (buf.slice(-m) === target.slice(0, m)){ matchLen = m; break; }
    }
    if (matchLen >= 3){
      _showTyped(buf.slice(-matchLen));
    }
    if (matchLen >= target.length){
      _fired = true;
      window.__qb = [];
      setTimeout(function(){
        if (typeof window.__qp === 'function') {
          try { window.__qp(); } catch(err){ if (window.GameLog) GameLog.log('SYSTEM', '__qp error: ' + (err && err.message || err)); }
        } else {
          if (window.GameLog) GameLog.log('SYSTEM', '__qp not defined');
        }
      }, 600);
    }
  }, true);
})();
