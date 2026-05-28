"use strict";

const WaveEditor = (() => {
  const DEFAULT_TIMELINE_MS = 30000;
  const TIMELINE_PAD_MS = 8000;
  const CURSIK_MOVE_MS = 250;
  const CURSIK_DRAG_MS = 500;
  const CURSIK_COOLDOWN_MS = 200;
  const PALETTE_EXCLUDE = new Set(['your_death']);
  const ALL_PLANTS = [
    'sunflower', 'peashooter', 'folder_magnet', 'siamese_peashooter',
    'double_peashooter', 'snow_peashooter', 'pirate_mushroom', 'xsas_mushroom',
    'sun_mushroom', 'unarchiver', 'kaspersky_bean', 'daisy',
    'cherry', 'avast_nut', 'torchwall', 'logic_mine',
    'basket_chomper', 'torrent_lantern', 'catmouse',
  ];

  const S = {
    active: false,
    level: null,
    currentWave: 0,
    timelineMs: 0,
    maxTimelineMs: DEFAULT_TIMELINE_MS,
    selectedKeyId: null,
    paletteSelected: null,
    isPlaying: false,
    nextKeyId: 1,
    rafId: null,
    lastFrameTs: 0,
    spawnedKeyIds: new Set(),
    loadedFilename: null,
    existingFiles: [],
    confirmCb: null,
  };

  function freshLevel() {
    return {
      name: 'untitled',
      author: '',
      description: '',
      startSun: 150,
      nightMode: false,
      plants: ['sunflower', 'peashooter', 'folder_magnet', 'snow_peashooter', 'cherry', 'avast_nut'],
      lawnmowers: true,
      next_level: null,
      waves: [{ zombies: [] }],
    };
  }

  function $(id) { return document.getElementById(id); }

  function paletteTypes() {
    const types = window.Engine && Engine.ZOMBIE_TYPES;
    if (!types) return [];
    return Object.keys(types).filter(k => !PALETTE_EXCLUDE.has(k));
  }

  function open() {
    console.log('[WaveEditor] open()');
    if (S.active) return;
    if (window.SFX) SFX.stop('snd-menu');
    if (!window.Engine || !window.Game) {
      console.error('[WaveEditor] Engine/Game not ready');
      return;
    }
    S.active = true;
    S.level = freshLevel();
    S.currentWave = 0;
    S.timelineMs = 0;
    S.selectedKeyId = null;
    S.paletteSelected = null;
    S.isPlaying = false;
    S.nextKeyId = 1;
    S.spawnedKeyIds = new Set();
    S.loadedFilename = null;

    bootGameScreen().then(() => {
      installOverlay();
      bindEvents();
      buildPalette();
      buildWaveTabs();
      syncConfigInputs();
      refreshRowTags();
      renderTimeline();
      updateStatus('STANDBY');
      updateTimecode();
      renderZombies();
      fetchExistingFiles();
      console.log('[WaveEditor] ready');
    }).catch(err => {
      console.error('[WaveEditor] boot failed:', err);
      S.active = false;
    });
  }

  async function bootGameScreen() {
    document.body.classList.add('editor-mode');
    const devPanel = document.getElementById('dev-panel');
    if (devPanel) devPanel.classList.add('hidden');

    document.querySelectorAll('.screen').forEach(scr => {
      scr.classList.remove('active', 'visible');
      scr.style.opacity = '0';
      scr.style.display = 'none';
    });

    const Engine = window.Engine;
    const Game = window.Game;
    const S_eng = Engine.State;

    Engine.clearAllTimers();
    if (Game.cleanupWaves) Game.cleanupWaves();
    if (Engine.clearAllZombies) Engine.clearAllZombies();

    S_eng.sun = S.level.startSun;
    S_eng.wave = 0;
    S_eng.paused = false;
    S_eng.gameOver = false;
    S_eng.started = false;
    S_eng.selectedPlant = null;
    S_eng.peas = [];
    S_eng.suns = [];
    S_eng.cursik.queue = [];
    S_eng.cursik.busy = false;
    S_eng.cursik._editorPrevX = undefined;
    S_eng.cursik._editorPrevY = undefined;
    S_eng.nextZombieId = 0;
    S_eng.nextPeaId = 0;
    S_eng.nextSunId = 0;
    S_eng.droppedFiles = [];
    S_eng._sysFolder = null;
    S_eng._magnetBlocked = {};
    S_eng._zombieCopyCount = 0;
    S_eng._customPlants = null;
    S_eng._customWave = false;
    S_eng.zombieMutations = {};
    S_eng.plants = Array.from({ length: Engine.GRID_ROWS }, () => Array(Engine.GRID_COLS).fill(null));
    S_eng.lawnmowers = Array(Engine.GRID_ROWS).fill(null);
    S_eng.nightMode = !!S.level.nightMode;

    document.getElementById('entities-layer').innerHTML = '';
    document.getElementById('suns-layer').innerHTML = '';
    document.getElementById('particles-layer').innerHTML = '';
    document.getElementById('grid-container').innerHTML = '';

    const bgEl = document.getElementById('pvz-bg');
    if (bgEl) {
      bgEl.style.backgroundImage = S_eng.nightMode
        ? "url('static/img/ui/night-bg.jpg')"
        : "url('static/img/ui/game-bg.png')";
    }
    const nightEl = document.getElementById('night-overlay');
    if (nightEl) nightEl.classList.toggle('hidden', !S_eng.nightMode);

    const gameScreen = document.getElementById('screen-game');
    gameScreen.style.display = 'flex';
    gameScreen.style.opacity = '1';
    gameScreen.classList.add('active', 'visible');
    bgEl?.classList.add('visible');

    Engine.updateScale();
    Engine.buildGrid();
    if (S.level.lawnmowers !== false) Engine.spawnLawnmowers();

    S_eng.started = false;
  }

  function installOverlay() {
    const overlay = $('editor-overlay');
    if (!overlay) {
      console.error('[WaveEditor] #editor-overlay missing');
      return;
    }
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
  }

  function close() {
    console.log('[WaveEditor] close()');
    if (!S.active) return;
    stopPlayback();
    S.active = false;

    const overlay = $('editor-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
      overlay.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('editor-mode');

    const Engine = window.Engine;
    if (Engine) {
      Engine.clearAllTimers();
      if (Engine.clearAllZombies) Engine.clearAllZombies();
      Engine.State.started = false;
    }

    const gameScreen = document.getElementById('screen-game');
    if (gameScreen) {
      gameScreen.style.display = 'none';
      gameScreen.style.opacity = '0';
      gameScreen.classList.remove('active', 'visible');
    }

    const menu = document.getElementById('screen-menu');
    if (menu) {
      menu.style.display = 'flex';
      menu.style.opacity = '1';
      menu.classList.add('active', 'visible');
    }
    if (window.SFX) SFX.play('snd-menu');
  }

  function zombieIconPath(type) {
    const cfg = window.Engine && Engine.ZOMBIE_TYPES[type];
    return cfg ? `static/img/zombies/${cfg.file}` : '';
  }
  function plantIconPath(type) {
    const cfg = window.Engine && Engine.PLANTS[type];
    return cfg ? `static/img/plants/${cfg.file}` : '';
  }
  function shortName(type) {
    return type.replace(/_zombie$/, '').replace(/_/g, ' ');
  }

  function buildPalette() {
    const list = $('editor-palette-list');
    const countEl = $('editor-dock-count');
    if (!list) return;
    list.innerHTML = '';
    const types = paletteTypes();
    types.forEach(type => {
      const item = document.createElement('div');
      item.className = 'ed-dock-item';
      item.dataset.type = type;
      item.title = type;
      item.innerHTML = `
        <img src="${zombieIconPath(type)}" alt="${type}" onerror="this.style.opacity='0.25'">
        <span class="ed-dock-item-label">${shortName(type)}</span>
      `;
      item.addEventListener('click', () => {
        if (S.paletteSelected === type) {
          S.paletteSelected = null;
        } else {
          S.paletteSelected = type;
        }
        document.querySelectorAll('.ed-dock-item').forEach(el => {
          el.classList.toggle('selected', el.dataset.type === S.paletteSelected);
        });
        updateGridHighlight();
      });
      list.appendChild(item);
    });
    if (countEl) countEl.textContent = `${types.length} unit${types.length !== 1 ? 's' : ''}`;
  }

  function refreshRowTags() {
    const wrap = $('editor-row-tags');
    if (!wrap) return;
    const tags = wrap.querySelectorAll('.ed-row-tag');
    tags.forEach((tag, idx) => {
      tag.onclick = () => onRowClicked(idx);
      tag.onmouseenter = () => tag.classList.add('hover');
      tag.onmouseleave = () => tag.classList.remove('hover');
    });

    document.querySelectorAll('#grid-container .grid-cell').forEach(cell => {
      if (cell._editorBound) return;
      cell._editorBound = true;
      cell.addEventListener('click', (e) => {
        if (S.paletteSelected) {
          e.stopPropagation();
          const row = parseInt(cell.dataset.row, 10);
          spawnAndRecord(S.paletteSelected, row);
        }
      });
    });
    updateGridHighlight();
  }

  function updateGridHighlight() {
    document.querySelectorAll('#grid-container .grid-cell').forEach(c => {
      c.classList.toggle('ed-armed', !!S.paletteSelected);
    });
  }

  function onRowClicked(row) {
    if (!S.paletteSelected) {
      toast('select a subject first', false);
      return;
    }
    spawnAndRecord(S.paletteSelected, row);
  }

  function spawnAndRecord(type, row) {
    const delay = Math.round(S.timelineMs);
    const key = { id: S.nextKeyId++, type, row, delay };
    currentWave().zombies.push(key);
    currentWave().zombies.sort((a, b) => a.delay - b.delay);
    extendTimelineIfNeeded();
    buildWaveTabs();
    renderTimeline();
    renderZombies();
  }

  function buildWaveTabs() {
    const root = $('editor-wave-tabs');
    if (!root) return;
    root.innerHTML = '';
    S.level.waves.forEach((w, i) => {
      const tab = document.createElement('button');
      tab.className = 'ed-wave-tab';
      if (i === S.currentWave) tab.classList.add('active');
      tab.innerHTML = `<span>W${String(i + 1).padStart(2, '0')}</span><span class="ed-wave-tab-count">[${w.zombies.length}]</span>`;
      tab.addEventListener('click', () => switchWave(i));
      if (S.level.waves.length > 1) {
        const x = document.createElement('span');
        x.className = 'ed-wave-tab-close';
        x.textContent = '✕';
        x.addEventListener('click', (e) => {
          e.stopPropagation();
          confirmDialog('DELETE WAVE',
            `Удалить волну ${i + 1}? Зомби этой волны будут потеряны.`,
            () => deleteWave(i));
        });
        tab.appendChild(x);
      }
      root.appendChild(tab);
    });
    const add = document.createElement('button');
    add.className = 'ed-wave-tab-add';
    add.textContent = '+ NEW.WAVE';
    add.addEventListener('click', addWave);
    root.appendChild(add);
  }

  function switchWave(i) {
    if (i === S.currentWave) return;
    stopPlayback();
    S.currentWave = i;
    S.timelineMs = 0;
    buildWaveTabs();
    renderTimeline();
    updateTimecode();
    renderZombies();
  }
  function addWave() {
    stopPlayback();
    S.level.waves.push({ zombies: [] });
    S.currentWave = S.level.waves.length - 1;
    S.timelineMs = 0;
    buildWaveTabs();
    renderTimeline();
    updateTimecode();
    renderZombies();
  }
  function deleteWave(i) {
    stopPlayback();
    S.level.waves.splice(i, 1);
    if (S.level.waves.length === 0) S.level.waves.push({ zombies: [] });
    S.currentWave = Math.max(0, Math.min(S.currentWave, S.level.waves.length - 1));
    S.timelineMs = 0;
    buildWaveTabs();
    renderTimeline();
    updateTimecode();
    renderZombies();
  }

  function currentWave() {
    return S.level.waves[S.currentWave];
  }

  function clearLiveZombies() {
    if (window.Engine && Engine.clearAllZombies) Engine.clearAllZombies();
    S.spawnedKeyIds = new Set();
  }

  const BUNGEE_DESCEND_MS = 1500;
  const BUNGEE_HOLD_MS = 1500;
  const BUNGEE_ASCEND_MS = 1000;
  const BUNGEE_TOTAL_MS = BUNGEE_DESCEND_MS + BUNGEE_HOLD_MS + BUNGEE_ASCEND_MS;
  const BUNGEE_DROP_COL = 3;

  function isBungeeType(type) {
    const cfg = window.Engine && Engine.ZOMBIE_TYPES[type];
    return !!(cfg && cfg.isBungee);
  }

  function simulateWave(wave, t) {
    const colsTotal = window.Engine.GRID_COLS;
    const startCol = colsTotal - 1;
    const bungeeEvents = [];
    const walkerKeyframes = [];
    for (const k of wave.zombies) {
      if (isBungeeType(k.type)) bungeeEvents.push(k);
      else walkerKeyframes.push(k);
    }
    const events = walkerKeyframes
      .slice()
      .sort((a, b) => a.delay - b.delay || a.id - b.id);

    const sim = new Map();
    const queue = [];
    let evIdx = 0;
    let cursikBusyUntil = 0;
    let inProgress = null;

    function spawnUpTo(time) {
      while (evIdx < events.length && events[evIdx].delay <= time) {
        const ev = events[evIdx++];
        sim.set(ev.id, {
          id: ev.id, type: ev.type, row: ev.row,
          col: startCol, alive: true,
        });
        queue.push(ev.id);
      }
    }

    while (true) {
      spawnUpTo(cursikBusyUntil);

      if (queue.length === 0) {
        if (evIdx >= events.length) break;
        const next = events[evIdx].delay;
        if (next > t) break;
        cursikBusyUntil = next;
        continue;
      }

      const headId = queue[0];
      const head = sim.get(headId);
      const opStart = cursikBusyUntil;
      const opEnd = opStart + CURSIK_MOVE_MS + CURSIK_DRAG_MS;

      if (opEnd > t) {
        spawnUpTo(t);
        inProgress = { id: headId, opStart };
        break;
      }

      queue.shift();
      head.col -= 1;
      if (head.col < -1) {
        head.alive = false;
      } else {
        queue.push(headId);
      }
      cursikBusyUntil = opEnd + CURSIK_COOLDOWN_MS;
    }

    spawnUpTo(t);

    const cellW = window.Engine.CELL_W;
    const cellH = window.Engine.CELL_H;
    const o = window.Engine.getGridOrigin();
    const result = [];
    const positions = new Map();
    for (const z of sim.values()) {
      if (!z.alive) continue;
      let drawCol = z.col;
      let dragProgress = 0;

      if (inProgress && inProgress.id === z.id) {
        const opStart = inProgress.opStart;
        if (t >= opStart + CURSIK_MOVE_MS && t < opStart + CURSIK_MOVE_MS + CURSIK_DRAG_MS) {
          dragProgress = (t - (opStart + CURSIK_MOVE_MS)) / CURSIK_DRAG_MS;
        }
      }

      const xCells = drawCol - dragProgress;
      const x = o.x + xCells * cellW;
      const y = o.y + z.row * cellH;
      const entry = { id: z.id, type: z.type, row: z.row, x, y, col: drawCol };
      result.push(entry);
      positions.set(z.id, entry);
    }

    for (const k of bungeeEvents) {
      const phase = t - k.delay;
      if (phase < 0 || phase >= BUNGEE_TOTAL_MS) continue;
      const targetCol = Math.max(0, Math.min(colsTotal - 1, BUNGEE_DROP_COL));
      const targetX = o.x + targetCol * cellW;
      const targetY = o.y + k.row * cellH;
      const startY = targetY - cellH * 4;
      let y;
      let bungeePhase;
      if (phase < BUNGEE_DESCEND_MS) {
        const p = phase / BUNGEE_DESCEND_MS;
        const eased = 1 - Math.pow(1 - p, 3);
        y = startY + (targetY - startY) * eased;
        bungeePhase = 'descend';
      } else if (phase < BUNGEE_DESCEND_MS + BUNGEE_HOLD_MS) {
        y = targetY;
        bungeePhase = 'hold';
      } else {
        const p = (phase - BUNGEE_DESCEND_MS - BUNGEE_HOLD_MS) / BUNGEE_ASCEND_MS;
        const eased = p * p;
        y = targetY + (startY - targetY) * eased;
        bungeePhase = 'ascend';
      }
      result.push({
        id: k.id, type: k.type, row: k.row,
        x: targetX, y, col: targetCol, isBungee: true, bungeePhase,
      });
    }

    let cursik = null;
    if (inProgress) {
      const opStart = inProgress.opStart;
      const target = positions.get(inProgress.id);
      if (target) {
        const targetX = target.x + 37;
        const targetY = target.y + 48;
        const ck = window.Engine.State.cursik;
        const fromX = (typeof ck._editorPrevX === 'number') ? ck._editorPrevX : (o.x - 60);
        const fromY = (typeof ck._editorPrevY === 'number') ? ck._editorPrevY : (o.y + 2 * cellH);
        if (t < opStart + CURSIK_MOVE_MS) {
          const k = Math.min(1, Math.max(0, (t - opStart) / CURSIK_MOVE_MS));
          cursik = { x: fromX + (targetX - fromX) * k, y: fromY + (targetY - fromY) * k, dragging: false };
        } else {
          cursik = { x: targetX, y: targetY, dragging: true };
        }
      }
    } else {
      const ck = window.Engine.State.cursik;
      if (typeof ck._editorPrevX === 'number') {
        cursik = { x: ck._editorPrevX, y: ck._editorPrevY, dragging: false };
      } else {
        cursik = { x: o.x - 60, y: o.y + 2 * cellH, dragging: false };
      }
    }

    return { zombies: result, cursik };
  }

  function renderZombies() {
    const Eng = window.Engine;
    if (!Eng) return;
    const wave = currentWave();
    const t = S.timelineMs;

    Eng.clearAllZombies();
    S.spawnedKeyIds = new Set();

    const sim = simulateWave(wave, t);
    const positions = sim.zombies;

    for (const p of positions) {
      let z;
      try {
        z = Eng.spawnZombie(p.type, Math.max(0, Math.min(4, p.row)), { editor: true, col: Math.max(-1, p.col) });
      } catch (err) {
        console.warn('[WaveEditor] render spawn failed', err);
        continue;
      }
      if (!z) continue;
      S.spawnedKeyIds.add(p.id);

      z.x = p.x;
      if (z.el) {
        z.el.style.left = p.x + 'px';
        if (p.isBungee) {
          z.y = p.y;
          z.el.style.top = p.y + 'px';
          z.el.classList.remove('bp-descend', 'bp-hold', 'bp-ascend');
          z.el.classList.add('bp-' + p.bungeePhase);
        }
        z.el.dataset.keyId = p.id;
        z.el.style.cursor = 'pointer';
        z.el.addEventListener('click', (ev) => {
          ev.stopPropagation();
          openKeyframeModal(p.id);
        });
      }
    }

    const ck = Eng.State.cursik;
    if (ck && ck.el && sim.cursik) {
      ck.x = sim.cursik.x;
      ck.y = sim.cursik.y;
      ck._editorPrevX = sim.cursik.x;
      ck._editorPrevY = sim.cursik.y;
      ck.el.style.left = (sim.cursik.x - 20) + 'px';
      ck.el.style.top = (sim.cursik.y - 20) + 'px';
      ck.el.classList.toggle('dragging', !!sim.cursik.dragging);
      ck.el.style.display = '';
    }
  }

  function extendTimelineIfNeeded() {
    let maxDelay = DEFAULT_TIMELINE_MS;
    for (const w of S.level.waves) {
      for (const k of w.zombies) {
        if (k.delay + TIMELINE_PAD_MS > maxDelay) maxDelay = k.delay + TIMELINE_PAD_MS;
      }
    }
    S.maxTimelineMs = maxDelay;
  }

  function renderTimeline() {
    const canvas = $('editor-timeline');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = rect.width;
    const H = rect.height;

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#070b13');
    grad.addColorStop(1, '#0a1018');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    const pxPerMs = W / S.maxTimelineMs;

    ctx.strokeStyle = '#141b27';
    ctx.lineWidth = 1;
    for (let t = 0; t <= S.maxTimelineMs; t += 1000) {
      const x = Math.round(t * pxPerMs) + 0.5;
      const major = (t % 5000) === 0;
      ctx.beginPath();
      ctx.moveTo(x, major ? 0 : H * 0.7);
      ctx.lineTo(x, H);
      ctx.strokeStyle = major ? '#202a38' : '#121925';
      ctx.stroke();
      if (major) {
        ctx.fillStyle = '#3a4658';
        ctx.font = '9px "JetBrains Mono", Consolas, monospace';
        ctx.fillText((t / 1000) + 's', x + 4, 11);
      }
    }

    const topPad = 16;
    const rowH = (H - topPad) / 5;
    ctx.strokeStyle = '#0f1620';
    for (let r = 1; r < 5; r++) {
      const y = topPad + r * rowH;
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(W, y + 0.5);
      ctx.stroke();
    }
    ctx.fillStyle = '#2a3340';
    ctx.font = '8px "JetBrains Mono", Consolas, monospace';
    for (let r = 0; r < 5; r++) {
      ctx.fillText('R' + r, 3, topPad + r * rowH + rowH / 2 + 3);
    }

    const wave = currentWave();
    for (const k of wave.zombies) {
      const x = k.delay * pxPerMs;
      const y = topPad + k.row * rowH + rowH / 2;
      const isSel = S.selectedKeyId === k.id;
      const isSpawned = S.spawnedKeyIds.has(k.id);

      ctx.strokeStyle = '#0a0e13';
      ctx.lineWidth = 1;
      ctx.fillStyle = isSel ? '#b6ff5c' : isSpawned ? '#5d6b7e' : '#ffb84d';
      ctx.beginPath();
      ctx.arc(x, y, isSel ? 6 : 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (isSel) {
        ctx.strokeStyle = 'rgba(182, 255, 92, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    const px = S.timelineMs * pxPerMs;
    ctx.strokeStyle = '#ff4d6e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.round(px) + 0.5, 0);
    ctx.lineTo(Math.round(px) + 0.5, H);
    ctx.stroke();
    ctx.fillStyle = '#ff4d6e';
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px - 5, 7);
    ctx.lineTo(px + 5, 7);
    ctx.closePath();
    ctx.fill();
  }

  function updateTimecode() {
    const tc = $('editor-timecode');
    if (!tc) return;
    const ms = Math.max(0, Math.round(S.timelineMs));
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const f = ms % 1000;
    tc.textContent =
      String(m).padStart(2, '0') + ':' +
      String(s).padStart(2, '0') + '.' +
      String(f).padStart(3, '0');
  }

  function updateStatus(text) {
    const el = $('editor-status');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('rec', text === 'REC');
    el.classList.toggle('play', text === 'PLAY');
  }

  function timelineHitTest(clientX, clientY) {
    const canvas = $('editor-timeline');
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const W = rect.width;
    const H = rect.height;
    const pxPerMs = W / S.maxTimelineMs;
    const topPad = 16;
    const rowH = (H - topPad) / 5;
    const wave = currentWave();
    for (const k of wave.zombies) {
      const kx = k.delay * pxPerMs;
      const ky = topPad + k.row * rowH + rowH / 2;
      if ((kx - x) ** 2 + (ky - y) ** 2 < 100) return k.id;
    }
    return null;
  }

  function bindEvents() {
    bindOnce('editor-back', 'click', () => {
      confirmDialog('ВЫХОД',
        'Выйти из редактора? Несохранённые изменения будут потеряны.',
        () => close());
    });
    bindOnce('editor-name', 'input', (e) => {
      S.level.name = e.target.value || 'untitled';
      const c = $('editor-cfg-name');
      if (c) c.value = S.level.name;
    });

    bindOnce('editor-save', 'click', () => {
      $('editor-save-modal').classList.remove('hidden');
      updateSaveTarget();
    });
    bindOnce('editor-save-close', 'click', () => $('editor-save-modal').classList.add('hidden'));
    bindOnce('editor-save-server', 'click', () => attemptSaveServer());
    bindOnce('editor-save-download', 'click', () => downloadJson());

    bindOnce('editor-load', 'click', openLoadModal);
    bindOnce('editor-load-close', 'click', () => $('editor-load-modal').classList.add('hidden'));

    bindOnce('editor-settings-toggle', 'click', () => {
      $('editor-settings-panel').classList.toggle('hidden');
      syncConfigInputs();
    });
    bindOnce('editor-settings-close', 'click', () => $('editor-settings-panel').classList.add('hidden'));

    bindOnce('editor-transport-play', 'click', togglePlay);
    bindOnce('editor-transport-rewind', 'click', () => {
      stopPlayback();
      S.timelineMs = 0;
      renderTimeline();
      updateTimecode();
      updateStatus('STANDBY');
      renderZombies();
    });
    bindOnce('editor-transport-clear', 'click', () => {
      const count = currentWave().zombies.length;
      if (count === 0) { toast('wave already empty'); return; }
      confirmDialog('ОЧИСТИТЬ ВОЛНУ',
        `Удалить всех зомби текущей волны (${count} шт.)? Действие необратимо.`,
        () => {
          currentWave().zombies = [];
          stopPlayback();
          S.timelineMs = 0;
          buildWaveTabs();
          renderTimeline();
          updateTimecode();
          renderZombies();
          toast('wave cleared');
        });
    });

    bindOnce('editor-kf-close', 'click', () => $('editor-keyframe-modal').classList.add('hidden'));
    bindOnce('editor-kf-apply', 'click', applyKeyframeEdit);
    bindOnce('editor-kf-delete', 'click', () => deleteKeyframe(S.selectedKeyId));

    bindOnce('editor-confirm-close', 'click', () => $('editor-confirm-modal').classList.add('hidden'));
    bindOnce('editor-confirm-no', 'click', () => $('editor-confirm-modal').classList.add('hidden'));
    bindOnce('editor-confirm-yes', 'click', () => {
      $('editor-confirm-modal').classList.add('hidden');
      if (S.confirmCb) { const cb = S.confirmCb; S.confirmCb = null; cb(); }
    });

    bindCanvas();
    bindConfig();
    bindKeyboard();

    window.addEventListener('resize', () => { if (S.active) renderTimeline(); });
  }

  function bindKeyboard() {
    if (window._editorKbBound) return;
    window._editorKbBound = true;
    window.addEventListener('keydown', (e) => {
      if (!S.active) return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const anyModalOpen = document.querySelector('#editor-overlay .ed-modal:not(.hidden)');
      if (e.code === 'Space') {
        if (anyModalOpen) return;
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'Escape') {
        const open = document.querySelectorAll('#editor-overlay .ed-modal:not(.hidden)');
        if (open.length) open.forEach(m => m.classList.add('hidden'));
      }
    });
  }

  function bindCanvas() {
    const canvas = $('editor-timeline');
    if (!canvas || canvas._bound) return;
    canvas._bound = true;
    let dragging = false;
    let startedOnKey = false;

    const seekToClientX = (clientX) => {
      const rect = canvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      S.timelineMs = (x / rect.width) * S.maxTimelineMs;
      renderTimeline();
      updateTimecode();
      renderZombies();
    };

    canvas.addEventListener('mousedown', (e) => {
      const hit = timelineHitTest(e.clientX, e.clientY);
      if (hit != null) {
        startedOnKey = true;
        openKeyframeModal(hit);
        return;
      }
      stopPlayback();
      dragging = true;
      startedOnKey = false;
      seekToClientX(e.clientX);
    });
    window.addEventListener('mousemove', (e) => {
      if (dragging) seekToClientX(e.clientX);
    });
    window.addEventListener('mouseup', () => { dragging = false; });

    canvas.addEventListener('touchstart', (e) => {
      const t = e.touches[0]; if (!t) return;
      const hit = timelineHitTest(t.clientX, t.clientY);
      if (hit != null) { openKeyframeModal(hit); return; }
      stopPlayback();
      dragging = true;
      seekToClientX(t.clientX);
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const t = e.touches[0]; if (t) seekToClientX(t.clientX);
    }, { passive: true });
    window.addEventListener('touchend', () => { dragging = false; });
  }

  function bindOnce(id, evt, fn) {
    const el = $(id);
    if (!el) return;
    const k = '_b_' + evt;
    if (el[k]) return;
    el[k] = true;
    el.addEventListener(evt, fn);
  }

  function bindConfig() {
    const fields = [
      ['editor-cfg-name', 'name', 'string'],
      ['editor-cfg-author', 'author', 'string'],
      ['editor-cfg-desc', 'description', 'string'],
      ['editor-cfg-sun', 'startSun', 'int'],
      ['editor-cfg-night', 'nightMode', 'bool'],
      ['editor-cfg-lawnmowers', 'lawnmowers', 'bool'],
      ['editor-cfg-next', 'next_level', 'string'],
    ];
    fields.forEach(([id, key, kind]) => {
      const el = $(id);
      if (!el || el._cbound) return;
      el._cbound = true;
      el.addEventListener('input', (e) => {
        let v = e.target.value;
        if (kind === 'int') v = parseInt(v, 10) || 0;
        if (kind === 'bool') v = e.target.checked;
        if (kind === 'string' && key === 'next_level') v = v.trim() || null;
        S.level[key] = v;
        if (key === 'name') {
          const n = $('editor-name');
          if (n) n.value = v;
        }
        if (key === 'nightMode') applyNightMode();
        if (key === 'lawnmowers') applyLawnmowers();
      });
    });
    buildPlantPicker();
  }

  function applyNightMode() {
    const bg = document.getElementById('pvz-bg');
    const night = document.getElementById('night-overlay');
    if (bg) {
      bg.style.backgroundImage = S.level.nightMode
        ? "url('static/img/ui/night-bg.jpg')"
        : "url('static/img/ui/game-bg.png')";
    }
    if (night) night.classList.toggle('hidden', !S.level.nightMode);
    Engine.State.nightMode = !!S.level.nightMode;
  }

  function applyLawnmowers() {
    const Eng = window.Engine;
    if (!Eng) return;
    if (S.level.lawnmowers === false) {
      Eng.State.lawnmowers.forEach((m, i) => {
        if (m && m.el) m.el.remove();
        Eng.State.lawnmowers[i] = null;
      });
    } else if (Eng.State.lawnmowers.every(m => !m)) {
      Eng.spawnLawnmowers();
    }
  }

  function buildPlantPicker() {
    const root = $('editor-cfg-plants');
    if (!root) return;
    root.innerHTML = '';
    ALL_PLANTS.forEach(type => {
      const cfg = window.Engine && Engine.PLANTS[type];
      if (!cfg) return;
      const chip = document.createElement('div');
      chip.className = 'ed-plant-chip';
      if (S.level.plants.includes(type)) chip.classList.add('selected');
      chip.title = type;
      chip.innerHTML = `<img src="${plantIconPath(type)}" alt="${type}" onerror="this.style.opacity='0.15'">`;
      chip.addEventListener('click', () => {
        const i = S.level.plants.indexOf(type);
        if (i >= 0) S.level.plants.splice(i, 1);
        else S.level.plants.push(type);
        chip.classList.toggle('selected');
      });
      root.appendChild(chip);
    });
  }

  function syncConfigInputs() {
    const lv = S.level;
    setVal('editor-cfg-name', lv.name);
    setVal('editor-cfg-author', lv.author);
    setVal('editor-cfg-desc', lv.description);
    setVal('editor-cfg-sun', lv.startSun);
    setVal('editor-name', lv.name);
    setVal('editor-cfg-next', lv.next_level || '');
    const n = $('editor-cfg-night'); if (n) n.checked = !!lv.nightMode;
    const m = $('editor-cfg-lawnmowers'); if (m) m.checked = lv.lawnmowers !== false;
    buildPlantPicker();
  }
  function setVal(id, v) {
    const el = $(id);
    if (el && el.value !== String(v ?? '')) el.value = v ?? '';
  }

  function togglePlay() {
    if (S.isPlaying) stopPlayback();
    else startPlayback();
  }
  function startPlayback() {
    S.isPlaying = true;
    S.lastFrameTs = performance.now();
    const ico = $('editor-play-icon');
    if (ico) ico.textContent = '⏸';
    $('editor-transport-play').classList.add('playing');
    updateStatus('PLAY');

    const tick = (ts) => {
      if (!S.isPlaying) return;
      const dt = ts - S.lastFrameTs;
      S.lastFrameTs = ts;
      S.timelineMs += dt;
      if (S.timelineMs >= S.maxTimelineMs) {
        S.timelineMs = S.maxTimelineMs;
        stopPlayback();
      }
      renderTimeline();
      updateTimecode();
      renderZombies();
      if (S.isPlaying) S.rafId = requestAnimationFrame(tick);
    };
    S.rafId = requestAnimationFrame(tick);
  }
  function stopPlayback() {
    S.isPlaying = false;
    if (S.rafId) cancelAnimationFrame(S.rafId);
    S.rafId = null;
    const ico = $('editor-play-icon');
    if (ico) ico.textContent = '▶';
    const btn = $('editor-transport-play');
    if (btn) btn.classList.remove('playing');
    updateStatus('STANDBY');
  }

  function openKeyframeModal(id) {
    const wave = currentWave();
    const k = wave.zombies.find(z => z.id === id);
    if (!k) return;
    S.selectedKeyId = id;
    const sel = $('editor-kf-type');
    sel.innerHTML = '';
    paletteTypes().forEach(t => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      if (t === k.type) opt.selected = true;
      sel.appendChild(opt);
    });
    $('editor-kf-row').value = String(k.row);
    $('editor-kf-delay').value = String(k.delay);
    $('editor-keyframe-modal').classList.remove('hidden');
    renderTimeline();
  }
  function applyKeyframeEdit() {
    const wave = currentWave();
    const k = wave.zombies.find(z => z.id === S.selectedKeyId);
    if (!k) return;
    k.type = $('editor-kf-type').value;
    k.row = parseInt($('editor-kf-row').value, 10) || 0;
    k.delay = Math.max(0, parseInt($('editor-kf-delay').value, 10) || 0);
    wave.zombies.sort((a, b) => a.delay - b.delay);
    extendTimelineIfNeeded();
    $('editor-keyframe-modal').classList.add('hidden');
    buildWaveTabs();
    renderTimeline();
    renderZombies();
  }
  function deleteKeyframe(id) {
    const wave = currentWave();
    const i = wave.zombies.findIndex(z => z.id === id);
    if (i >= 0) wave.zombies.splice(i, 1);
    S.selectedKeyId = null;
    $('editor-keyframe-modal').classList.add('hidden');
    buildWaveTabs();
    renderTimeline();
    renderZombies();
  }

  function confirmDialog(title, msg, cb) {
    const modal = $('editor-confirm-modal');
    if (!modal) return;
    $('editor-confirm-title').textContent = title;
    $('editor-confirm-msg').textContent = msg;
    S.confirmCb = cb;
    modal.classList.remove('hidden');
  }

  function buildPayload() {
    return {
      name: S.level.name || 'untitled',
      author: S.level.author || '',
      description: S.level.description || '',
      startSun: S.level.startSun || 150,
      nightMode: !!S.level.nightMode,
      plants: S.level.plants.slice(),
      lawnmowers: S.level.lawnmowers !== false,
      next_level: S.level.next_level || null,
      waves: S.level.waves.map(w => ({
        zombies: w.zombies.map(k => ({ type: k.type, row: k.row, delay: k.delay })),
      })),
    };
  }

  function safeFilename() {
    return (S.level.name || 'untitled').replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 48) || 'untitled';
  }

  function updateSaveTarget() {
    const el = $('editor-save-target');
    if (el) el.textContent = '→ custom_waves/' + safeFilename() + '.json';
  }

  function attemptSaveServer() {
    const fname = safeFilename();
    const exists = S.existingFiles.some(f => f.replace(/\.json$/, '') === fname);
    if (exists && S.loadedFilename !== fname) {
      confirmDialog('OVERWRITE',
        `Файл "${fname}.json" уже существует в custom_waves/. Перезаписать?`,
        () => doSaveServer());
    } else {
      doSaveServer();
    }
  }

  function doSaveServer() {
    const payload = buildPayload();
    payload._filename = safeFilename();
    fetch('/api/save_wave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(r => r.json()).then(res => {
      if (res.ok) {
        toast('saved → ' + res.filename);
        S.loadedFilename = res.filename.replace(/\.json$/, '');
        $('editor-save-modal').classList.add('hidden');
        fetchExistingFiles();
      } else {
        toast('save failed: ' + (res.error || '?'), true);
      }
    }).catch(err => toast('save failed: ' + err.message, true));
  }

  function downloadJson() {
    const payload = buildPayload();
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fname = safeFilename() + '.json';
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 200);
    toast('downloaded → ' + fname);
    $('editor-save-modal').classList.add('hidden');
  }

  function fetchExistingFiles() {
    fetch('/api/custom_waves').then(r => r.json()).then(data => {
      const waves = (data && data.waves) || [];
      S.existingFiles = waves.map(w => (w._filename || w.name) + '.json');
    }).catch(() => {});
  }

  function openLoadModal() {
    const modal = $('editor-load-modal');
    const list = $('editor-load-list');
    list.innerHTML = '<div class="ed-load-empty">// FETCHING...</div>';
    modal.classList.remove('hidden');
    fetch('/api/custom_waves').then(r => r.json()).then(data => {
      const waves = (data && data.waves) || [];
      list.innerHTML = '';
      if (waves.length === 0) {
        list.innerHTML = '<div class="ed-load-empty">// NO SAVED WAVES</div>';
        return;
      }
      waves.forEach(w => {
        const fname = w._filename || w.name || 'untitled';
        const zCount = (w.waves || []).reduce((sum, x) => sum + (x.zombies || []).length, 0);
        const item = document.createElement('div');
        item.className = 'ed-load-item';
        item.innerHTML = `
          <span class="ed-load-item-name">${w.name || fname}</span>
          <span class="ed-load-item-meta">${(w.waves || []).length}W · ${zCount}Z</span>
        `;
        item.addEventListener('click', () => loadWaveData(w));
        list.appendChild(item);
      });
    }).catch(err => {
      list.innerHTML = `<div class="ed-load-empty">err: ${err.message}</div>`;
    });
  }

  function loadWaveData(data) {
    if (!data || !data.waves) { toast('bad file', true); return; }
    const fname = data._filename || data.name || 'untitled';
    S.level = {
      name: data.name || fname,
      author: data.author || '',
      description: data.description || '',
      startSun: data.startSun || 150,
      nightMode: !!data.nightMode,
      plants: Array.isArray(data.plants) ? data.plants.slice() : [],
      lawnmowers: data.lawnmowers !== false,
      next_level: data.next_level || null,
      waves: data.waves.map(w => ({
        zombies: (w.zombies || []).map(z => ({
          id: S.nextKeyId++,
          type: z.type,
          row: z.row || 0,
          delay: z.delay || 0,
        })),
      })),
    };
    if (S.level.waves.length === 0) S.level.waves = [{ zombies: [] }];
    S.currentWave = 0;
    S.timelineMs = 0;
    S.loadedFilename = fname;
    extendTimelineIfNeeded();
    syncConfigInputs();
    applyNightMode();
    applyLawnmowers();
    buildWaveTabs();
    renderTimeline();
    updateTimecode();
    renderZombies();
    $('editor-load-modal').classList.add('hidden');
    toast('loaded ← ' + fname);
  }

  function toast(msg, isError) {
    const overlay = $('editor-overlay');
    const t = document.createElement('div');
    t.className = 'ed-toast' + (isError ? ' error' : '');
    t.textContent = msg;
    overlay.appendChild(t);
    setTimeout(() => {
      t.style.transition = 'opacity 0.3s, transform 0.3s';
      t.style.opacity = '0';
      t.style.transform = 'translateX(20px)';
      setTimeout(() => t.remove(), 320);
    }, 2200);
  }

  return { open, close, _S: S };
})();

window.WaveEditor = WaveEditor;
