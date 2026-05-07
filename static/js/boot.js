"use strict";

function getFakeIcons() {
  return [
    { name: Lang.t('boot.my_computer'),  icon: '💻' },
    { name: Lang.t('boot.recycle_bin'),   icon: '🗑️' },
    { name: Lang.t('boot.documents'),     icon: '📁' },
    { name: Lang.t('boot.downloads'),     icon: '⬇️' },
    { name: Lang.t('boot.explorer'),      icon: '📂' },
    { name: 'pvz_desktop.exe',            icon: '🌻' },
    { name: Lang.t('boot.browser'),       icon: '🌐' },
    { name: Lang.t('boot.notepad'),       icon: '📝' },
    { name: 'calc.exe',                   icon: '🖩' },
    { name: Lang.t('boot.music'),         icon: '🎵' },
    { name: Lang.t('boot.photo'),         icon: '🖼️' },
    { name: Lang.t('boot.video'),         icon: '🎬' },
    { name: 'README.md',                  icon: '📄' },
    { name: Lang.t('boot.game_copy'),     icon: '🎮' },
    { name: Lang.t('boot.passwords'),     icon: '🔐' },
    { name: 'backup.zip',                 icon: '📦' },
  ];
}

const BOOT_ICON_W = 76;
const BOOT_ICON_H = 92;
const BOOT_ICON_START_X = 18;
const BOOT_ICON_START_Y = 18;

function generateIconPositions(count) {
  const positions = [];
  const rows = Math.max(1, Math.floor((window.innerHeight - BOOT_ICON_START_Y * 2) / BOOT_ICON_H));

  for (let i = 0; i < count; i++) {
    const col = Math.floor(i / rows);
    const row = i % rows;
    positions.push({
      x: BOOT_ICON_START_X + col * BOOT_ICON_W,
      y: BOOT_ICON_START_Y + row * BOOT_ICON_H,
      row,
    });
  }
  return positions;
}

async function loadBootData() {
  try {
    const res = await fetch("/api/desktop");
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function preloadBootData() {
  window._bootData = await loadBootData();
}

async function runBootSequence(onComplete) {
  const screen = document.getElementById('screen-boot');
  const iconsContainer = document.getElementById('boot-icons');
  const barFill = document.querySelector('.defender-bar-fill');

  const desktopData = window._bootData || await loadBootData();

  if (desktopData && desktopData.wallpaper) {
    const mime = desktopData.wallpaper_mime || 'image/png';
    const url = `data:${mime};base64,${desktopData.wallpaper}`;
    screen.style.backgroundImage = `url(${url})`;
    screen.style.backgroundSize = 'cover';
    screen.style.backgroundPosition = 'center';
    window._desktopWallpaper = url;
  }

  screen.style.display = 'flex';
  await delay(50);
  screen.style.opacity = '1';
  screen.classList.add('visible');

  const defender = document.querySelector('.boot-defender');
  const defTitle = document.getElementById('defender-title');
  const defDesc = document.getElementById('defender-desc');
  const defStatus = document.getElementById('defender-status');
  const defAction = document.getElementById('defender-action');
  const defProgressLabel = document.getElementById('defender-progress-label');
  const defConfirm = document.getElementById('defender-confirm');
  const btnYes = document.getElementById('defender-btn-yes');
  const btnNo = document.getElementById('defender-btn-no');

  const setScanningMode = () => {
    defTitle.textContent = Lang.t('defender.scan_title');
    defDesc.textContent = Lang.t('defender.scan_desc');
    defStatus.textContent = Lang.t('defender.status_scanning');
    defStatus.className = 'defender-status-scanning';
    defAction.textContent = Lang.t('defender.action_scanning');
    defProgressLabel.textContent = Lang.t('defender.progress_scan');
    barFill.classList.add('scanning');
    barFill.style.width = '';
    barFill.style.transition = '';
    defConfirm.style.display = 'none';
  };
  const setThreatMode = (active) => {
    defTitle.textContent = Lang.t(active ? 'defender.threat_active_title' : 'defender.alert_title');
    defDesc.textContent = Lang.t(active ? 'defender.threat_active_desc' : 'defender.alert_desc');
    defStatus.textContent = Lang.t('defender.status');
    defStatus.className = active ? 'defender-status-warning' : 'defender-status-active';
    defAction.textContent = Lang.t('defender.action');
    defProgressLabel.textContent = Lang.t('defender.progress');
    barFill.classList.remove('scanning');
    barFill.style.width = '0%';
    barFill.style.transition = '';
    defConfirm.style.display = 'block';
  };

  setScanningMode();
  defender.style.display = 'block';
  defender.style.opacity = '0';
  defender.style.transform = 'translateY(-10px) scale(0.96)';
  await delay(50);
  defender.style.transition = 'all 0.5s cubic-bezier(0.34,1.56,0.64,1)';
  defender.style.opacity = '1';
  defender.style.transform = 'translateY(0) scale(1)';

  await delay(300);
  const sourceIcons = (desktopData && desktopData.icons) || getFakeIcons();
  const visibleIcons = sourceIcons.slice(0, 48);
  const positions = generateIconPositions(visibleIcons.length);
  const iconEls = [];

  const SCAN_TIMEOUT_MS = 6000;
  const scanStartedAt = performance.now();

  for (let i = 0; i < visibleIcons.length; i++) {
    if (performance.now() - scanStartedAt > SCAN_TIMEOUT_MS) break;

    const icon = visibleIcons[i];
    const pos  = positions[i];

    const el = document.createElement('div');
    el.className = 'boot-icon';
    el.style.left = pos.x + 'px';
    el.style.top  = pos.y + 'px';
    el.style.animation = 'none';
    el.style.opacity = '1';
    el.dataset.row = String(pos.row);

    const iconData = icon.icon || '';
    const isImageData = iconData.startsWith('data:') || (iconData.length > 20 && /^[A-Za-z0-9+/=]+$/.test(iconData));

    if (isImageData) {
      const img = document.createElement('img');
      img.src = iconData.startsWith('data:') ? iconData : `data:image/png;base64,${iconData}`;
      img.alt = icon.name || '';
      el.appendChild(img);
    } else {
      const span = document.createElement('div');
      span.style.fontSize = '34px';
      span.textContent = iconData || '📄';
      el.appendChild(span);
    }

    const label = document.createElement('span');
    label.textContent = icon.name;
    el.appendChild(label);
    iconsContainer.appendChild(el);
    iconEls.push(el);
    await delay(40);
  }

  const elapsed = performance.now() - scanStartedAt;
  if (elapsed < 1500) await delay(1500 - elapsed);

  setThreatMode(false);

  const userChoice = await new Promise(resolve => {
    const onYes = () => { cleanup(); resolve('yes'); };
    const onNo = () => { cleanup(); resolve('no'); };
    function cleanup() {
      btnYes.removeEventListener('click', onYes);
      btnNo.removeEventListener('click', onNo);
    }
    btnYes.addEventListener('click', onYes);
    btnNo.addEventListener('click', onNo);
  });

  if (userChoice === 'no') {
    defender.style.transition = 'all 0.4s ease';
    defender.style.opacity = '0';
    defender.style.transform = 'translateY(-8px) scale(0.96)';
    await delay(450);
    defender.style.display = 'none';
    await delay(1000);

    setThreatMode(true);
    defender.style.display = 'block';
    defender.style.opacity = '0';
    defender.style.transform = 'translateY(-10px) scale(0.96)';
    await delay(50);
    defender.style.opacity = '1';
    defender.style.transform = 'translateY(0) scale(1)';

    await new Promise(resolve => {
      const onYes = () => { cleanup(); resolve(); };
      function cleanup() { btnYes.removeEventListener('click', onYes); btnNo.removeEventListener('click', onYes); }
      btnYes.addEventListener('click', onYes);
      btnNo.addEventListener('click', onYes);
    });
  }

  defConfirm.style.display = 'none';
  defProgressLabel.textContent = Lang.t('defender.progress');
  defAction.textContent = Lang.t('defender.action');
  await delay(400);

  defTitle.textContent = Lang.t('defender.error_title');
  defDesc.textContent = Lang.t('defender.error_desc');
  defStatus.textContent = Lang.t('defender.status');
  defStatus.className = 'defender-status-warning';
  const alertIcon = document.querySelector('.defender-alert-icon');
  if (alertIcon) {
    alertIcon.innerHTML = '<svg viewBox="0 0 24 24" width="48" height="48" fill="#e74c3c">' +
      '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg>';
  }
  SFX.play('snd-explosion');

  await delay(2000);

  const rows = [...new Set(iconEls.map(el => el.dataset.row))].sort((a, b) => Number(a) - Number(b));
  const eraseStepMs = window.innerWidth < 900 ? 260 : 320;
  const totalEraseMs = Math.max(1200, rows.length * eraseStepMs);

  barFill.style.transition = `width ${totalEraseMs}ms linear`;
  barFill.style.width = '100%';
  SFX.play('snd-delete');

  for (const row of rows) {
    const rowIcons = iconEls.filter(el => el.dataset.row === row);
    rowIcons.forEach(el => {
      el.style.animation = '';
      el.classList.add('erasing');
    });
    await delay(eraseStepMs);
  }

  await delay(400);

  await delay(300);
  defender.style.transition = 'all 0.5s ease';
  defender.style.opacity = '0';
  defender.style.transform = 'translateY(-8px) scale(0.96)';
  await delay(500);
  defender.style.display = 'none';

  await delay(800);

  const crackOverlay = document.createElement('div');
  crackOverlay.className = 'crack-overlay';
  screen.appendChild(crackOverlay);

  const pvzBehind = document.createElement('div');
  pvzBehind.className = 'boot-pvz-behind';
  screen.insertBefore(pvzBehind, crackOverlay);

  const crackStages = [
    { count: 3, delay: 800, intensity: 'light' },
    { count: 5, delay: 600, intensity: 'medium' },
    { count: 8, delay: 400, intensity: 'heavy' },
    { count: 12, delay: 300, intensity: 'shatter' },
  ];

  for (const stage of crackStages) {
    SFX.play('snd-explosion');
    screen.classList.add('screen-shake');

    for (let i = 0; i < stage.count; i++) {
      const crack = document.createElement('div');
      crack.className = `crack-line crack-${stage.intensity}`;
      const cx = 20 + Math.random() * 60;
      const cy = 20 + Math.random() * 60;
      const angle = Math.random() * 360;
      const length = 80 + Math.random() * 200;
      crack.style.left = cx + '%';
      crack.style.top = cy + '%';
      crack.style.width = length + 'px';
      crack.style.transform = `rotate(${angle}deg)`;
      crackOverlay.appendChild(crack);
    }

    await delay(stage.delay);
    screen.classList.remove('screen-shake');

    pvzBehind.style.opacity = String(Math.min(1, parseFloat(pvzBehind.style.opacity || 0) + 0.25));

    await delay(stage.delay);
  }

  await delay(300);
  SFX.play('snd-explosion');
  screen.classList.add('screen-shake');
  crackOverlay.classList.add('crack-shatter-final');
  pvzBehind.style.opacity = '1';

  await delay(1500);
  screen.classList.remove('screen-shake');

  crackOverlay.classList.add('crack-fall-away');

  await delay(2000);

  screen.style.transition = 'opacity 1.5s ease';
  screen.style.opacity = '0';

  await delay(1600);
  screen.style.display = 'none';
  screen.classList.remove('active', 'visible');

  crackOverlay.remove();
  pvzBehind.remove();
  iconsContainer.innerHTML = '';

  onComplete && onComplete();
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

window.Boot = { runBootSequence, preloadBootData };
