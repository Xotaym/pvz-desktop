"use strict";

async function init() {
  GameLog.init();
  GameLog.log('SYSTEM', 'Game init started');
  document.addEventListener('dragstart', (e) => e.preventDefault());

  const bootDataPromise = Boot.preloadBootData();

  await UI.loadManifest();
  UI.initCursik();
  UI.initPauseMenu();
  UI.initSettings();
  Lang.applyDOM();

  document.getElementById('btn-play').addEventListener('click', onPlayClicked);
  document.getElementById('btn-docs').addEventListener('click', () => {
    UI.showScreen('docs');
    UI.hideScreen('menu');
  });
  document.getElementById('btn-settings').addEventListener('click', () => {
    UI.openSettings('menu');
  });
  document.getElementById('btn-docs-close').addEventListener('click', () => {
    UI.showScreen('menu');
    UI.hideScreen('docs');
  });
  document.getElementById('btn-end-menu').addEventListener('click', () => {
    SFX.stopAll();
    UI.hideScreen('end');
    UI.showScreen('menu');
    SFX.play('snd-menu');
  });

  document.getElementById('screen-docs').addEventListener('click', (e) => {
    if (e.target === document.getElementById('screen-docs') || e.target === document.querySelector('.docs-overlay')) {
      UI.showScreen('menu');
      UI.hideScreen('docs');
    }
  });

  if (!localStorage.getItem('pvz_boot_shown')) {
    UI.showScreen('welcome');

    await new Promise(resolve => {
      document.getElementById('btn-welcome-start').addEventListener('click', resolve, { once: true });
    });

    UI.hideScreen('welcome');
    await delay(600);
    await bootDataPromise;

    document.getElementById('screen-boot').style.display = 'flex';
    await delay(100);
    document.getElementById('screen-boot').style.opacity = '1';

    await Boot.runBootSequence(async () => {
      localStorage.setItem('pvz_boot_shown', '1');
      await startGame();
    });
  } else {
    showMainMenu();
  }
}

function showMainMenu() {
  UI.showScreen('menu');
  SFX.play('snd-menu');
}

async function onPlayClicked() {
  SFX.stopAll();

  document.body.style.transition = 'background 0.8s';
  document.body.style.background = '#000';

  UI.hideScreen('menu');
  await delay(600);

  await UI.loadDesktopData();
  await startGame();
}

async function startGame() {
  GameLog.log('GAME', 'Starting new game');
  SFX.stopAll();
  await UI.loadDesktopData();

  const S = Engine.State;

  resetFullGameState();

  const gamemode = localStorage.getItem('pvz_gamemode') || 'day';
  if (gamemode === 'night') {
    S.nightMode = true;
  } else if (gamemode === 'random') {
    S.nightMode = Math.random() < 0.5;
  } else {
    S.nightMode = false;
  }

  const nightEl = document.getElementById('night-overlay');
  const bgEl = document.getElementById('pvz-bg');
  if (S.nightMode) {
    nightEl.classList.remove('hidden');
    bgEl.style.backgroundImage = "url('static/img/ui/ночной-фон-игры.png')";
  } else {
    nightEl.classList.add('hidden');
    bgEl.style.backgroundImage = "url('static/img/ui/фон-игры.png')";
  }

  const gameScreen = document.getElementById('screen-game');
  gameScreen.style.display = 'flex';
  gameScreen.style.opacity = '0';
  gameScreen.style.transition = 'opacity 0.8s';

  Engine.buildGrid();
  UI.buildPlantBar();
  UI.updateSun();
  UI.updateWave();

  await delay(300);
  gameScreen.style.opacity = '1';
  bgEl.classList.add('visible');

  await delay(600);
  Engine.spawnLawnmowers();

  await delay(Engine.GRID_ROWS * 200 + 500);

  const hud = document.getElementById('hud-top');
  hud.style.transform = 'translateY(-100%)';
  hud.style.transition = 'transform 0.6s cubic-bezier(0.34,1.56,0.64,1)';
  await delay(100);
  hud.style.transform = 'translateY(0)';

  await delay(600);

  S.started = true;

  initDevPanel();

  const tutorialDone = localStorage.getItem('pvz_tutorial_done');
  if (!tutorialDone) {
    S.paused = true;
    Game.startTutorial(() => {
      S.paused = false;
      Engine.startGameLoop();
      Game.startSunSpawner();
      startWaves();
    });
  } else {
    Engine.startGameLoop();
    Game.startSunSpawner();
    startWaves();
  }
}

function startWaves() {
  if (localStorage.getItem('pvz_devmode') === 'true') return;
  setTimeout(() => {
    Game.startWave(0);
  }, 3000);
}

function resetFullGameState() {
  Engine.clearAllTimers();
  Game.cleanupWaves();

  const S = Engine.State;
  S.sun    = 150;
  S.wave   = 0;
  S.paused = false;
  S.gameOver = false;
  S.started  = false;
  S.selectedPlant = null;
  S.zombies = [];
  S.peas    = [];
  S.suns    = [];
  S.cursik.queue = [];
  S.cursik.busy  = false;
  S.nextZombieId = 0;
  S.nextPeaId    = 0;
  S.nextSunId    = 0;
  S.nextFileId   = 0;
  S.droppedFiles = [];
  S._sysFolder   = null;
  S._magnetBlocked = {};
  S._zombieCopyCount = 0;
  S._freePlant = null;
  S._customPlants = null;
  S._customWave = false;
  S._customWaveConfigs = null;
  S.plants = Array.from({ length: Engine.GRID_ROWS }, () => Array(Engine.GRID_COLS).fill(null));
  S.lawnmowers = Array(Engine.GRID_ROWS).fill(null);

  UI.cancelFileDrag();
  document.querySelector('.sys-folder')?.remove();
  document.querySelector('.file-drag-preview')?.remove();

  document.getElementById('entities-layer').innerHTML = '';
  document.getElementById('suns-layer').innerHTML = '';
  document.getElementById('particles-layer').innerHTML = '';
  document.getElementById('grid-container').innerHTML = '';
  document.getElementById('pvz-bg').classList.remove('visible');

  const hud = document.getElementById('hud-top');
  hud.style.transition = 'none';
  hud.style.transform  = 'translateY(-100%)';

  document.getElementById('pause-menu').classList.add('hidden');
  document.getElementById('tutorial-overlay').classList.add('hidden');
  document.getElementById('cursik-bubble').classList.add('hidden');
  UI.cancelPlantDrag?.();

  const gw = document.getElementById('game-world');
  if (gw) {
    gw.style.transition = 'none';
    gw.style.transform = 'none';
    gw.style.transformOrigin = '';
  }

  const gs = document.getElementById('screen-game');
  gs.style.display = 'none';
  gs.style.opacity = '0';
}

let devPanelInited = false;

function toggleDevPanel(panel) {
  panel.classList.toggle('hidden');
  if (!panel.classList.contains('hidden')) {
    const consoleTab = document.getElementById('dev-tab-console');
    if (consoleTab && consoleTab.classList.contains('active')) {
      document.getElementById('dev-console-input')?.focus();
    }
  }
}

function closeDevPanel(panel) {
  panel.classList.add('hidden');
}

function initDevPanel() {
  const devEnabled = localStorage.getItem('pvz_devmode') === 'true';
  if (!devEnabled) return;

  const panel = document.getElementById('dev-panel');
  if (!panel) return;

  if (!devPanelInited) {
    document.addEventListener('keydown', (e) => {
      if (e.key === '`' || e.key === '~' || e.code === 'Backquote') {
        if (localStorage.getItem('pvz_devmode') !== 'true') return;
        toggleDevPanel(panel);
      }
    });

    document.getElementById('dev-panel-close').addEventListener('click', () => {
      closeDevPanel(panel);
    });

    panel.querySelectorAll('.dev-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        panel.querySelectorAll('.dev-tab').forEach(t => t.classList.remove('active'));
        panel.querySelectorAll('.dev-tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        const target = document.getElementById('dev-tab-' + tab.dataset.tab);
        if (target) target.classList.add('active');
        if (tab.dataset.tab === 'console') {
          document.getElementById('dev-console-input')?.focus();
        }
      });
    });

    document.getElementById('dev-sun-give').addEventListener('click', () => {
      const v = parseInt(document.getElementById('dev-sun-input').value) || 0;
      Engine.State.sun += v;
      UI.updateSun();
    });

    document.getElementById('dev-sun-set').addEventListener('click', () => {
      const v = parseInt(document.getElementById('dev-sun-input').value) || 0;
      Engine.State.sun = v;
      UI.updateSun();
    });

    document.getElementById('dev-spawn-zombie').addEventListener('click', () => {
      const type = document.getElementById('dev-zombie-type').value;
      const row = parseInt(document.getElementById('dev-zombie-row').value);
      Engine.spawnZombie(type, row);
    });

    document.querySelectorAll('.dev-mower-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = parseInt(btn.dataset.row);
        Engine.triggerLawnmower(row);
      });
    });

    document.getElementById('dev-respawn-mowers').addEventListener('click', () => {
      Engine.spawnLawnmowers();
    });

    document.getElementById('dev-spawn-sun').addEventListener('click', () => {
      Engine.spawnFallingSun();
    });

    document.getElementById('dev-kill-all').addEventListener('click', () => {
      [...Engine.State.zombies].forEach(z => {
        if (z.alive) Engine.killZombie(z, true);
      });
    });

    let _cwaveCache = [];
    function loadCwaveList() {
      const sel = document.getElementById('dev-cwave-select');
      const info = document.getElementById('dev-cwave-info');
      sel.innerHTML = '<option value="">' + Lang.t('dev.gui.loading') + '</option>';
      fetch(`/api/custom_waves?token=${window._pvzToken}`)
        .then(r => r.json())
        .then(res => {
          const list = res.waves || [];
          const failed = res.failed || 0;
          _cwaveCache = list;
          sel.innerHTML = '';
          if (!list.length) {
            sel.innerHTML = '<option value="">' + Lang.t('dev.gui.no_waves') + '</option>';
            info.textContent = failed ? Lang.t('dev.gui.files_failed', failed) : '';
            return;
          }
          list.forEach(w => {
            const opt = document.createElement('option');
            opt.value = w._filename;
            opt.textContent = w.name || w._filename;
            sel.appendChild(opt);
          });
          updateCwaveInfo();
          if (failed) info.textContent += ' · ' + Lang.t('dev.gui.files_failed', failed);
        })
        .catch(() => { sel.innerHTML = '<option value="">' + Lang.t('dev.gui.error') + '</option>'; });
    }

    function updateCwaveInfo() {
      const sel = document.getElementById('dev-cwave-select');
      const info = document.getElementById('dev-cwave-info');
      const cfg = _cwaveCache.find(w => w._filename === sel.value);
      if (!cfg) { info.textContent = ''; return; }
      const parts = [];
      if (cfg.author) parts.push(cfg.author);
      parts.push(Lang.t('dev.gui.waves_count', cfg.waves.length));
      if (cfg.startSun != null) parts.push(cfg.startSun + '☀');
      if (cfg.nightMode) parts.push(Lang.t('dev.gui.night'));
      if (cfg.plants) parts.push(Lang.t('dev.gui.plants_count', cfg.plants.length));
      info.textContent = parts.join(' · ');
    }

    document.getElementById('dev-cwave-select').addEventListener('change', updateCwaveInfo);
    document.getElementById('dev-cwave-refresh').addEventListener('click', loadCwaveList);

    document.getElementById('dev-cwave-start').addEventListener('click', () => {
      const sel = document.getElementById('dev-cwave-select');
      const cfg = _cwaveCache.find(w => w._filename === sel.value);
      if (!cfg) return;
      Game.startCustomWave(cfg);
    });

    document.getElementById('dev-cwave-stop').addEventListener('click', () => {
      if (Engine.State._customWave) Game.stopCustomWave();
    });

    loadCwaveList();

    const consoleInput = document.getElementById('dev-console-input');
    let cmdHistory = [];
    let historyIdx = -1;

    consoleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const cmd = consoleInput.value.trim();
        if (!cmd) return;
        cmdHistory.unshift(cmd);
        historyIdx = -1;
        consolePrint('> ' + cmd, 'cmd');
        executeDevCommand(cmd);
        consoleInput.value = '';
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (historyIdx < cmdHistory.length - 1) {
          historyIdx++;
          consoleInput.value = cmdHistory[historyIdx];
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIdx > 0) {
          historyIdx--;
          consoleInput.value = cmdHistory[historyIdx];
        } else {
          historyIdx = -1;
          consoleInput.value = '';
        }
      }
      e.stopPropagation();
    });

    devPanelInited = true;
  }
}

function consolePrint(text, type) {
  const output = document.getElementById('dev-console-output');
  if (!output) return;
  const line = document.createElement('div');
  line.className = 'dev-console-line' + (type ? ' ' + type : '');
  line.textContent = text;
  output.appendChild(line);
  output.scrollTop = output.scrollHeight;
}

function parseCell(str) {
  const m = str.toUpperCase().match(/^([A-I])([1-5])$/);
  if (!m) return null;
  return { col: m[1].charCodeAt(0) - 65, row: parseInt(m[2]) - 1 };
}

function executeDevCommand(input) {
  const parts = input.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const S = Engine.State;

  switch (cmd) {
    case 'help':
      consolePrint(Lang.t('dev.cmd.help'), 'hint');
      consolePrint(Lang.t('dev.cmd.help_help'), 'hint');
      consolePrint(Lang.t('dev.cmd.help_sun'), 'hint');
      consolePrint(Lang.t('dev.cmd.help_sun_add'), 'hint');
      consolePrint(Lang.t('dev.cmd.help_kill'), 'hint');
      consolePrint(Lang.t('dev.cmd.help_kill_all'), 'hint');
      consolePrint(Lang.t('dev.cmd.help_spawn'), 'hint');
      consolePrint(Lang.t('dev.cmd.help_wave'), 'hint');
      consolePrint(Lang.t('dev.cmd.help_mower'), 'hint');
      consolePrint(Lang.t('dev.cmd.help_mowers'), 'hint');
      consolePrint(Lang.t('dev.cmd.help_cwave_list'), 'hint');
      consolePrint(Lang.t('dev.cmd.help_cwave_load'), 'hint');
      consolePrint(Lang.t('dev.cmd.help_cwave_stop'), 'hint');
      consolePrint(Lang.t('dev.cmd.help_clear'), 'hint');
      break;

    case 'sun': {
      const arg = parts[1];
      if (!arg) { consolePrint(Lang.t('dev.cmd.sun_usage'), 'error'); break; }
      if (arg.startsWith('+')) {
        const v = parseInt(arg.slice(1));
        if (isNaN(v)) { consolePrint(Lang.t('dev.cmd.invalid_number'), 'error'); break; }
        S.sun += v;
        UI.updateSun();
        consolePrint(Lang.t('dev.cmd.sun_added', S.sun, v), 'success');
      } else {
        const v = parseInt(arg);
        if (isNaN(v)) { consolePrint(Lang.t('dev.cmd.invalid_number'), 'error'); break; }
        S.sun = v;
        UI.updateSun();
        consolePrint(Lang.t('dev.cmd.sun_set', v), 'success');
      }
      break;
    }

    case 'kill': {
      const arg = parts[1];
      if (!arg) { consolePrint(Lang.t('dev.cmd.kill_usage'), 'error'); break; }
      if (arg.toLowerCase() === 'all') {
        let count = 0;
        [...S.zombies].forEach(z => { if (z.alive) { Engine.killZombie(z, true); count++; } });
        consolePrint(Lang.t('dev.cmd.killed_count', count), 'success');
      } else {
        const cell = parseCell(arg);
        if (!cell) { consolePrint(Lang.t('dev.cmd.invalid_cell', arg), 'error'); break; }
        const o = Engine.getGridOrigin();
        const cellLeft = o.x + cell.col * Engine.CELL_W;
        const cellRight = cellLeft + Engine.CELL_W;
        const zombie = S.zombies.find(z =>
          z.alive && z.row === cell.row && z.x >= cellLeft - 20 && z.x <= cellRight + 20
        );
        if (zombie) {
          Engine.killZombie(zombie, true);
          consolePrint(Lang.t('dev.cmd.killed_at', arg.toUpperCase()), 'success');
        } else {
          consolePrint(Lang.t('dev.cmd.not_found_at', arg.toUpperCase()), 'error');
        }
      }
      break;
    }

    case 'spawn': {
      const type = parts[1];
      const rowStr = parts[2];
      if (!type || !rowStr) { consolePrint(Lang.t('dev.cmd.spawn_usage'), 'error'); break; }
      const row = parseInt(rowStr) - 1;
      if (row < 0 || row > 4) { consolePrint(Lang.t('dev.cmd.row_range'), 'error'); break; }
      const validTypes = ['zombie','system_zombie','hdd_zombie','ssd_zombie','winrar_zombie','trojan_catapult','your_death'];
      if (!validTypes.includes(type)) {
        consolePrint(Lang.t('dev.cmd.types', validTypes.join(', ')), 'error');
        break;
      }
      Engine.spawnZombie(type, row);
      consolePrint(Lang.t('dev.cmd.spawned', type, row + 1), 'success');
      break;
    }

    case 'wave': {
      const n = parseInt(parts[1]);
      if (isNaN(n) || n < 1) { consolePrint(Lang.t('dev.cmd.wave_usage'), 'error'); break; }
      Game.startWave(n - 1);
      consolePrint(Lang.t('dev.cmd.wave_started', n), 'success');
      break;
    }

    case 'mower': {
      const row = parseInt(parts[1]) - 1;
      if (row < 0 || row > 4) { consolePrint(Lang.t('dev.cmd.row_range'), 'error'); break; }
      Engine.triggerLawnmower(row);
      consolePrint(Lang.t('dev.cmd.mower_triggered', row + 1), 'success');
      break;
    }

    case 'mowers':
      Engine.spawnLawnmowers();
      consolePrint(Lang.t('dev.cmd.mowers_respawned'), 'success');
      break;

    case 'clear': {
      const output = document.getElementById('dev-console-output');
      if (output) output.innerHTML = '';
      break;
    }

    case 'cwave': {
      const sub = (parts[1] || '').toLowerCase();
      if (sub === 'list') {
        consolePrint(Lang.t('dev.cmd.loading_list'), 'hint');
        fetch(`/api/custom_waves?token=${window._pvzToken}`)
          .then(r => r.json())
          .then(res => {
            const list = res.waves || [];
            const failed = res.failed || 0;
            if (!list.length && !failed) { consolePrint(Lang.t('dev.cmd.no_waves'), 'error'); return; }
            if (list.length) {
              consolePrint(Lang.t('dev.cmd.waves_found', list.length), 'success');
              list.forEach(w => {
                const author = w.author ? ` (${w.author})` : '';
                const desc = w.description ? ` — ${w.description}` : '';
                consolePrint(`  ${w._filename}: ${w.name || '?'}${author}${desc}`, 'hint');
              });
            }
            if (failed) consolePrint(Lang.t('dev.cmd.files_failed', failed), 'error');
          })
          .catch(() => consolePrint(Lang.t('dev.cmd.load_error'), 'error'));
      } else if (sub === 'load') {
        const name = parts[2];
        if (!name) { consolePrint(Lang.t('dev.cmd.cwave_load_usage'), 'error'); break; }
        consolePrint(Lang.t('dev.cmd.loading_wave', name), 'hint');
        fetch(`/api/custom_waves?token=${window._pvzToken}`)
          .then(r => r.json())
          .then(res => {
            const list = res.waves || [];
            const cfg = list.find(w => w._filename === name);
            if (!cfg) { consolePrint(Lang.t('dev.cmd.wave_not_found', name), 'error'); return; }
            Game.startCustomWave(cfg);
            consolePrint(Lang.t('dev.cmd.cwave_started', cfg.name || name, cfg.waves.length), 'success');
          })
          .catch(() => consolePrint(Lang.t('dev.cmd.load_error'), 'error'));
      } else if (sub === 'stop') {
        if (!S._customWave) { consolePrint(Lang.t('dev.cmd.cwave_not_running'), 'error'); break; }
        Game.stopCustomWave();
        consolePrint(Lang.t('dev.cmd.cwave_stopped'), 'success');
      } else {
        consolePrint(Lang.t('dev.cmd.cwave_usage'), 'error');
      }
      break;
    }

    default:
      consolePrint(Lang.t('dev.cmd.unknown', cmd), 'error');
  }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

document.addEventListener('DOMContentLoaded', () => {
  init().catch(console.error);
});
