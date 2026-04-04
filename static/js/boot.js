"use strict";

const FAKE_ICONS = [
  { name: 'Мой компьютер',      icon: '💻' },
  { name: 'Корзина',            icon: '🗑️' },
  { name: 'Документы',          icon: '📁' },
  { name: 'Загрузки',           icon: '⬇️' },
  { name: 'Проводник',          icon: '📂' },
  { name: 'pvz_desktop.exe',    icon: '🌻' },
  { name: 'браузер.lnk',        icon: '🌐' },
  { name: 'блокнот.txt',        icon: '📝' },
  { name: 'calc.exe',           icon: '🖩' },
  { name: 'музыка',             icon: '🎵' },
  { name: 'фото.jpg',           icon: '🖼️' },
  { name: 'видео.mp4',          icon: '🎬' },
  { name: 'README.md',          icon: '📄' },
  { name: 'игра-копия.exe',     icon: '🎮' },
  { name: 'пароли.txt',         icon: '🔐' },
  { name: 'backup.zip',         icon: '📦' },
];

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

async function runBootSequence(onComplete) {
  const screen = document.getElementById('screen-boot');
  const iconsContainer = document.getElementById('boot-icons');
  const barFill = document.querySelector('.defender-bar-fill');

  const desktopData = await loadBootData();

  if (desktopData && desktopData.wallpaper) {
    screen.style.backgroundImage = `url(data:image/png;base64,${desktopData.wallpaper})`;
    screen.style.backgroundSize = 'cover';
    screen.style.backgroundPosition = 'center';
    window._desktopWallpaper = 'data:image/png;base64,' + desktopData.wallpaper;
  }

  screen.style.display = 'flex';
  await delay(50);
  screen.style.opacity = '1';
  screen.classList.add('visible');

  await delay(300);
  const sourceIcons = (desktopData && desktopData.icons) || FAKE_ICONS;
  const visibleIcons = sourceIcons.slice(0, 48);
  const positions = generateIconPositions(visibleIcons.length);
  const iconEls = [];

  for (let i = 0; i < visibleIcons.length; i++) {
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
  }

  await delay(1500);

  const defender = document.querySelector('.boot-defender');
  defender.style.display = 'block';
  defender.style.opacity = '0';
  defender.style.transform = 'scale(0.8) translateY(20px)';
  await delay(50);
  defender.style.transition = 'all 0.5s cubic-bezier(0.34,1.56,0.64,1)';
  defender.style.opacity = '1';
  defender.style.transform = 'scale(1) translateY(0)';

  await delay(600);
  barFill.style.width = '100%';
  await delay(4000);

  SFX.play('snd-delete');

  const rows = [...new Set(iconEls.map(el => el.dataset.row))].sort((a, b) => Number(a) - Number(b));
  for (const row of rows) {
    const rowIcons = iconEls.filter(el => el.dataset.row === row);
    rowIcons.forEach(el => el.classList.add('erasing'));
    await delay(400);
  }

  await delay(600);
  defender.style.transition = 'all 0.5s ease';
  defender.style.opacity = '0';
  defender.style.transform = 'scale(0.9)';
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

window.Boot = { runBootSequence };
