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
  SFX.stop('snd-menu');
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
  S._devPaused = false;
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

function setDevPanelPause(paused) {
  Engine.State._devPaused = paused;
}

function toggleDevPanel(panel) {
  panel.classList.toggle('hidden');
  const isOpen = !panel.classList.contains('hidden');
  setDevPanelPause(isOpen);
  if (isOpen) {
    const consoleTab = document.getElementById('dev-tab-console');
    if (consoleTab && consoleTab.classList.contains('active')) {
      document.getElementById('dev-console-input')?.focus();
    }
  }
}

function closeDevPanel(panel) {
  panel.classList.add('hidden');
  setDevPanelPause(false);
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
      consolePrint('Доступные команды:', 'hint');
      consolePrint('  help                — список команд', 'hint');
      consolePrint('  sun <n>             — установить солнце', 'hint');
      consolePrint('  sun +<n>            — добавить солнце', 'hint');
      consolePrint('  kill <A1-I5>        — убить зомби (столбец A-I, ряд 1-5)', 'hint');
      consolePrint('  kill all            — убить всех зомби', 'hint');
      consolePrint('  spawn <type> <row>  — спавн зомби (1-5)', 'hint');
      consolePrint('  wave <n>            — запустить волну', 'hint');
      consolePrint('  mower <row>         — активировать косилку (1-5)', 'hint');
      consolePrint('  mowers              — респавн косилок', 'hint');
      consolePrint('  clear               — очистить консоль', 'hint');
      break;

    case 'sun': {
      const arg = parts[1];
      if (!arg) { consolePrint('Использование: sun <n> или sun +<n>', 'error'); break; }
      if (arg.startsWith('+')) {
        const v = parseInt(arg.slice(1));
        if (isNaN(v)) { consolePrint('Неверное число', 'error'); break; }
        S.sun += v;
        UI.updateSun();
        consolePrint('Солнце: ' + S.sun + ' (+' + v + ')', 'success');
      } else {
        const v = parseInt(arg);
        if (isNaN(v)) { consolePrint('Неверное число', 'error'); break; }
        S.sun = v;
        UI.updateSun();
        consolePrint('Солнце установлено: ' + v, 'success');
      }
      break;
    }

    case 'kill': {
      const arg = parts[1];
      if (!arg) { consolePrint('Использование: kill <A1-I5> или kill all', 'error'); break; }
      if (arg.toLowerCase() === 'all') {
        let count = 0;
        [...S.zombies].forEach(z => { if (z.alive) { Engine.killZombie(z, true); count++; } });
        consolePrint('Убито зомби: ' + count, 'success');
      } else {
        const cell = parseCell(arg);
        if (!cell) { consolePrint('Неверная клетка: ' + arg + ' (формат: A1-I5)', 'error'); break; }
        const o = Engine.getGridOrigin();
        const cellLeft = o.x + cell.col * Engine.CELL_W;
        const cellRight = cellLeft + Engine.CELL_W;
        const zombie = S.zombies.find(z =>
          z.alive && z.row === cell.row && z.x >= cellLeft - 20 && z.x <= cellRight + 20
        );
        if (zombie) {
          Engine.killZombie(zombie, true);
          consolePrint('Убит зомби на ' + arg.toUpperCase(), 'success');
        } else {
          consolePrint('Зомби не найден на ' + arg.toUpperCase(), 'error');
        }
      }
      break;
    }

    case 'spawn': {
      const type = parts[1];
      const rowStr = parts[2];
      if (!type || !rowStr) { consolePrint('Использование: spawn <type> <row 1-5>', 'error'); break; }
      const row = parseInt(rowStr) - 1;
      if (row < 0 || row > 4) { consolePrint('Ряд должен быть 1-5', 'error'); break; }
      const validTypes = ['zombie','system_zombie','hdd_zombie','ssd_zombie','winrar_zombie','trojan_catapult','your_death'];
      if (!validTypes.includes(type)) {
        consolePrint('Типы: ' + validTypes.join(', '), 'error');
        break;
      }
      Engine.spawnZombie(type, row);
      consolePrint('Спавн ' + type + ' в ряду ' + (row + 1), 'success');
      break;
    }

    case 'wave': {
      const n = parseInt(parts[1]);
      if (isNaN(n) || n < 1) { consolePrint('Использование: wave <n> (1-5)', 'error'); break; }
      Game.startWave(n - 1);
      consolePrint('Запущена волна ' + n, 'success');
      break;
    }

    case 'mower': {
      const row = parseInt(parts[1]) - 1;
      if (row < 0 || row > 4) { consolePrint('Ряд должен быть 1-5', 'error'); break; }
      Engine.triggerLawnmower(row);
      consolePrint('Косилка активирована: ряд ' + (row + 1), 'success');
      break;
    }

    case 'mowers':
      Engine.spawnLawnmowers();
      consolePrint('Косилки респавнены', 'success');
      break;

    case 'clear': {
      const output = document.getElementById('dev-console-output');
      if (output) output.innerHTML = '';
      break;
    }

    default:
      consolePrint('Неизвестная команда: ' + cmd + '. Введите help', 'error');
  }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

document.addEventListener('DOMContentLoaded', () => {
  init().catch(console.error);
});
