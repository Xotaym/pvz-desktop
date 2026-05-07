try {
  fetch('/api/log', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({lines: ['[' + new Date().toLocaleTimeString() + '] [UPDATER] updater.js LOADED']}),
  });
} catch (e) {}

const Updater = (() => {
  const STATE = {
    IDLE: 'idle',
    CHECKING: 'checking',
    UP_TO_DATE: 'up_to_date',
    AVAILABLE: 'available',
    DOWNLOADING: 'downloading',
    APPLYING: 'applying',
    DONE: 'done',
    ERROR: 'error',
    NO_NET: 'no_net',
  };

  let _info = null;
  let _state = STATE.IDLE;
  let _polling = false;
  let _pollTimer = null;

  const $ = (id) => document.getElementById(id);
  const log = (msg) => {
    if (window.GameLog && GameLog.log) {
      GameLog.log('UPDATER', msg);
      try { GameLog.flush(); } catch (e) {}
    }
  };
  const t = (key, fb) => {
    if (window.Lang && Lang.t) {
      const v = Lang.t(key);
      if (v && v !== key) return v;
    }
    return fb;
  };

  const STATE_CONFIG = {
    [STATE.IDLE]:        { icon: '⟳', cls: '',           msg: () => '—' },
    [STATE.CHECKING]:    { icon: '⟳', cls: 'spin',       msg: () => t('update.checking', 'Проверяем обновления...') },
    [STATE.UP_TO_DATE]:  { icon: '✓', cls: 'success',    msg: () => t('update.uptodate', 'У вас последняя версия') },
    [STATE.AVAILABLE]:   { icon: '⬇', cls: 'highlight',  msg: () => t('update.available', 'Доступна новая версия!') },
    [STATE.DOWNLOADING]: { icon: '⬇', cls: 'pulse',      msg: () => t('update.downloading', 'Скачиваем...') },
    [STATE.APPLYING]:    { icon: '⚙', cls: 'spin',       msg: () => t('update.applying', 'Применяем обновление...') },
    [STATE.DONE]:        { icon: '✓', cls: 'success',    msg: () => t('update.done', 'Готово! Перезапуск...') },
    [STATE.ERROR]:       { icon: '✕', cls: 'error',      msg: () => t('update.error', 'Ошибка обновления') },
    [STATE.NO_NET]:      { icon: '⚠', cls: 'error',      msg: () => t('update.no_internet', 'Нет соединения с GitHub') },
  };

  function setState(state, customMessage) {
    _state = state;
    const cfg = STATE_CONFIG[state] || STATE_CONFIG[STATE.IDLE];
    const icon = $('update-icon');
    if (icon) {
      icon.textContent = cfg.icon;
      icon.className = 'update-icon ' + cfg.cls;
    }
    setMessage(customMessage || cfg.msg());

    const progressWrap = $('update-progress-wrap');
    const checkBtn = $('update-check-btn');
    const applyBtn = $('update-apply-btn');
    const closeBtn = $('update-close');

    if (progressWrap) progressWrap.classList.toggle('hidden',
      state !== STATE.DOWNLOADING && state !== STATE.APPLYING);
    if (checkBtn) checkBtn.classList.toggle('hidden',
      state === STATE.CHECKING || state === STATE.DOWNLOADING || state === STATE.APPLYING || state === STATE.DONE);
    if (applyBtn) applyBtn.classList.toggle('hidden', state !== STATE.AVAILABLE);
    if (closeBtn) closeBtn.classList.toggle('hidden',
      state === STATE.DOWNLOADING || state === STATE.APPLYING || state === STATE.DONE);
  }

  function setMessage(text) {
    const el = $('update-message');
    if (el) el.textContent = text;
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function renderMarkdown(src) {
    if (!src) return '';
    const lines = src.replace(/\r\n/g, '\n').split('\n');
    const out = [];
    let inList = null;
    let inCode = false;
    let para = [];

    const flushPara = () => {
      if (para.length) {
        out.push('<p>' + inline(para.join(' ')) + '</p>');
        para = [];
      }
    };
    const closeList = () => {
      if (inList) { out.push('</' + inList + '>'); inList = null; }
    };

    function inline(text) {
      let s = escapeHtml(text);
      s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
      s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      s = s.replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s.,!?)]|$)/g, '$1<em>$2</em>');
      s = s.replace(/(^|[\s(])_([^_\s][^_]*?)_(?=[\s.,!?)]|$)/g, '$1<em>$2</em>');
      s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
      s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      s = s.replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
      return s;
    }

    for (const raw of lines) {
      const line = raw;

      if (/^```/.test(line.trim())) {
        flushPara(); closeList();
        if (inCode) { out.push('</code></pre>'); inCode = false; }
        else { out.push('<pre><code>'); inCode = true; }
        continue;
      }
      if (inCode) { out.push(escapeHtml(line)); continue; }

      if (/^\s*$/.test(line)) { flushPara(); closeList(); continue; }

      const h = line.match(/^(#{1,6})\s+(.+)$/);
      if (h) {
        flushPara(); closeList();
        const lvl = Math.min(h[1].length + 2, 6);
        out.push('<h' + lvl + '>' + inline(h[2]) + '</h' + lvl + '>');
        continue;
      }

      if (/^\s*([-*+])\s+/.test(line)) {
        flushPara();
        if (inList !== 'ul') { closeList(); out.push('<ul>'); inList = 'ul'; }
        out.push('<li>' + inline(line.replace(/^\s*[-*+]\s+/, '')) + '</li>');
        continue;
      }
      if (/^\s*\d+\.\s+/.test(line)) {
        flushPara();
        if (inList !== 'ol') { closeList(); out.push('<ol>'); inList = 'ol'; }
        out.push('<li>' + inline(line.replace(/^\s*\d+\.\s+/, '')) + '</li>');
        continue;
      }

      if (/^\s*>\s?/.test(line)) {
        flushPara(); closeList();
        out.push('<blockquote>' + inline(line.replace(/^\s*>\s?/, '')) + '</blockquote>');
        continue;
      }
      if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
        flushPara(); closeList();
        out.push('<hr>');
        continue;
      }

      closeList();
      para.push(line);
    }
    flushPara(); closeList();
    if (inCode) out.push('</code></pre>');
    return out.join('\n');
  }

  function renderVersions(data) {
    if (!data) return;
    if ($('update-current')) $('update-current').textContent = 'v' + (data.current || '-');
    if ($('update-latest')) $('update-latest').textContent = data.latest ? 'v' + data.latest : '-';
    if ($('update-buildtype')) $('update-buildtype').textContent = data.build_type || '-';
    const wrap = $('update-notes-wrap');
    const notesEl = $('update-notes');
    if (data.notes && wrap && notesEl) {
      wrap.classList.remove('hidden');
      notesEl.innerHTML = renderMarkdown(data.notes);
    } else if (wrap) {
      wrap.classList.add('hidden');
    }
  }

  function setProgress(pct, label) {
    const fill = $('update-progress-fill');
    const txt = $('update-progress-text');
    if (fill) fill.style.width = (pct || 0) + '%';
    if (txt) txt.textContent = (pct || 0) + '%' + (label ? ' — ' + label : '');
  }

  function openModal() {
    const modal = $('update-modal');
    if (!modal) {
      log('ERROR update-modal not found in DOM');
      return;
    }
    modal.classList.remove('hidden');
    if (!_info || _state === STATE.IDLE) {
      check(false);
    } else {
      renderVersions(_info);
    }
  }

  function closeModal() {
    const modal = $('update-modal');
    if (modal) modal.classList.add('hidden');
    stopPolling();
  }

  async function check(silent) {
    if (!silent) {
      setState(STATE.CHECKING);
      setProgress(0);
    }
    let data;
    try {
      const res = await fetch('/api/update/check');
      data = await res.json();
    } catch (e) {
      log('check network error: ' + (e && e.message ? e.message : e));
      _info = null;
      if (!silent) setState(STATE.NO_NET);
      return null;
    }
    _info = data;
    log('check result: ' + JSON.stringify(data).slice(0, 300));

    if (data.error) {
      const detail = data.error_detail ? ' — ' + data.error_detail : '';
      log('check error: ' + data.error + detail);
      if (!silent) {
        const isNet = ['network', 'dns', 'ssl', 'timeout'].indexOf(data.error) !== -1;
        if (isNet) {
          setState(STATE.NO_NET, t('update.no_internet', 'Нет соединения с GitHub') + ' (' + data.error + ')' + detail);
        } else {
          setState(STATE.ERROR, t('update.error', 'Ошибка') + ': ' + data.error + detail);
        }
      }
      return data;
    }

    renderVersions(data);

    if (data.available) {
      const badge = $('menu-update-badge');
      if (badge) badge.classList.remove('hidden');
      if (silent) {
        showToast(t('update.available', 'Доступна новая версия!') + ' v' + data.latest);
      } else {
        setState(STATE.AVAILABLE);
      }
    } else {
      if (!silent) setState(STATE.UP_TO_DATE);
    }
    return data;
  }

  async function apply() {
    if (!_info || !_info.available) return;
    setState(STATE.DOWNLOADING);
    setProgress(0, t('update.downloading', 'Скачиваем'));
    try {
      const res = await fetch('/api/update/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(_info),
      });
      const data = await res.json();
      if (!data.ok) {
        setState(STATE.ERROR, t('update.error', 'Ошибка') + ': ' + (data.error || ''));
        return;
      }
      startPolling();
    } catch (e) {
      setState(STATE.ERROR, t('update.error', 'Ошибка') + ': ' + e.message);
    }
  }

  function startPolling() {
    if (_polling) return;
    _polling = true;
    _pollTimer = setInterval(pollStatus, 700);
  }
  function stopPolling() {
    _polling = false;
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
  }

  async function pollStatus() {
    try {
      const res = await fetch('/api/update/status');
      const s = await res.json();
      const stage = s.stage;
      const progress = s.progress || 0;

      if (stage === 'downloading') {
        if (_state !== STATE.DOWNLOADING) setState(STATE.DOWNLOADING);
        setProgress(progress, s.message || '');
      } else if (stage === 'applying') {
        if (_state !== STATE.APPLYING) setState(STATE.APPLYING);
        setProgress(progress, s.message || '');
      } else if (stage === 'done') {
        setState(STATE.DONE);
        setProgress(100);
        stopPolling();
      } else if (stage === 'error') {
        setState(STATE.ERROR, t('update.error', 'Ошибка') + ': ' + (s.message || ''));
        stopPolling();
      }
    } catch (e) {}
  }

  let _toastTimer = null;
  function showToast(text) {
    let toast = $('update-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'update-toast';
      toast.className = 'update-toast';
      toast.addEventListener('click', () => {
        hideToast();
        openModal();
      });
      document.body.appendChild(toast);
    }
    toast.textContent = text + '  ▸';
    toast.classList.remove('hidden');
    toast.classList.add('visible');
    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(hideToast, 8000);
  }
  function hideToast() {
    const toast = $('update-toast');
    if (toast) {
      toast.classList.remove('visible');
      toast.classList.add('hidden');
    }
  }

  function bind() {
    log('bind() called, readyState=' + document.readyState);
    const handlers = [
      ['btn-update', () => openModal()],
      ['update-close', () => closeModal()],
      ['update-check-btn', () => { _info = null; check(false); }],
      ['update-apply-btn', () => apply()],
      ['menu-update-badge', () => openModal()],
    ];
    for (const [id, handler] of handlers) {
      const el = $(id);
      if (!el) {
        log('bind: missing element #' + id);
        continue;
      }
      if (el._updaterBound) {
        log('bind: already bound #' + id);
        continue;
      }
      el._updaterBound = true;
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        log('click: ' + id);
        try {
          handler();
        } catch (err) {
          log('handler error for ' + id + ': ' + (err && err.message ? err.message : err));
        }
      });
      log('bind: bound #' + id);
    }
  }

  function init() {
    log('init() called, readyState=' + document.readyState);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bind);
    } else {
      bind();
    }
    setTimeout(bind, 500);
    setTimeout(bind, 1500);
  }

  function refreshLang() {
    const cfg = STATE_CONFIG[_state] || STATE_CONFIG[STATE.IDLE];
    setMessage(cfg.msg());
    if (_info) renderVersions(_info);
  }

  return { init, bind, check, openModal, closeModal, apply, showToast, refreshLang, STATE };
})();

window.Updater = Updater;
