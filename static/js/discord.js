const Discord = (() => {
  let _last = { details: null, state: null };
  let _enabled = (() => {
    try { return localStorage.getItem('pvz_discord') !== 'false'; }
    catch (e) { return true; }
  })();

  async function _post(path, body) {
    if (!_enabled) return;
    try {
      await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      });
    } catch (e) {}
  }

  function set(details, state, opts) {
    if (!_enabled) return;
    opts = opts || {};
    if (details === _last.details && state === _last.state && !opts.reset_timer) return;
    _last.details = details;
    _last.state = state;
    _post('/api/discord/status', {
      details: details,
      state: state,
      reset_timer: !!opts.reset_timer,
    });
  }

  function disable() {
    _enabled = false;
    _last = { details: null, state: null };
    _post('/api/discord/disable', {});
  }

  async function enable() {
    _enabled = true;
    _last = { details: null, state: null };
    try {
      const r = await fetch('/api/discord/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      return await r.json();
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }

  async function available() {
    try {
      const r = await fetch('/api/discord/available');
      return await r.json();
    } catch (e) {
      return { available: false, reason: String(e) };
    }
  }

  function menu() {
    set('В главном меню', 'Ожидание битвы', { reset_timer: true });
  }

  function tutorial() {
    set('Обучение', 'Изучает основы', { reset_timer: true });
  }

  function game(wave, totalWaves) {
    const w = wave || 1;
    const total = totalWaves ? `/${totalWaves}` : '';
    set(`Волна ${w}${total}`, 'Защищает рабочий стол', { reset_timer: w === 1 });
  }

  function bsod(reason) {
    set('Синий экран смерти', reason ? `Причина: ${reason}` : 'Поражение');
  }

  function bossFight() {
    set('Битва с боссом', 'Финальное противостояние', { reset_timer: true });
  }

  function settings() {
    set('Настройки', 'Подкручивает параметры');
  }

  function docs() {
    set('Документация', 'Изучает игру');
  }

  return { set, disable, enable, available, menu, tutorial, game, bsod, bossFight, settings, docs };
})();

window.Discord = Discord;

(function syncInitial() {
  try {
    if (localStorage.getItem('pvz_discord') === 'false') {
      fetch('/api/discord/disable', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {});
    }
  } catch (e) {}
})();
