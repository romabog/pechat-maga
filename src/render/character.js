/**
 * ПРОЦЕДУРНАЯ АНИМЕ-ГРАФИКА
 * ========================
 * Персонажи рисуются кодом в аниме-стилистике: крупная голова, большие глаза,
 * выразительные причёски, аура силы. Это даёт полную независимость от внешних файлов.
 *
 * Второй слой — ASSET_OVERRIDES: если рядом лежит файл спрайта, он подставляется
 * вместо процедурного рисунка. Проверяется наличие файла по заранее заданному списку
 * путей, чтобы не ловить 404 на каждый кадр.
 */

const assetCache = new Map();

import { SPECIES } from '../data/enemies.js';
import { staffGeometry, drawStaff } from './staves.js';
import { drawCreatureHead, drawCreatureWings, drawCreatureTail, drawSpeciesExtra, drawSpeciesRegalia } from './creatures.js';
import { drawBossCreature } from './bosses.js';
import { drawBody } from './bodies.js';

/**
 * Превращает имя врага в безопасное имя файла.
 *
 * Имена боссов содержат запятую: «Юмэ, Хранительница Порога».
 * Наивное `name.split(' ')[0]` давало «юмэ,» и путь `юмэ,.png` —
 * файл с таким именем никто не создаст, поэтому запасной вариант
 * пути молча не работал для 6 боссов из 70.
 */
function slugify(name) {
  return String(name)
    .split(/[\s,]+/)[0]      // первое слово, запятые — разделители
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\-_]/gu, ''); // убираем всё, что недопустимо в имени файла
}

/**
 * Пытается загрузить внешний спрайт для врага.
 * Возвращает Image или null. Проверка кэшируется, чтобы не долбить сеть.
 */
export function tryLoadSprite(enemy) {
  const key = enemy.id;
  if (assetCache.has(key)) return assetCache.get(key);

  const slug = slugify(enemy.name);
  const candidates = [
    `assets/enemies/${enemy.id}.png`,
    `assets/enemies/${enemy.id}.webp`,
    // Запасной вариант — по имени. Добавляем только если он осмысленный
    // и не дублирует уже проверенные пути.
    ...(slug ? [`assets/enemies/${slug}.png`] : []),
  ];

  const img = new Image();
  const slot = { img, ready: false, tried: 0 };
  assetCache.set(key, slot);

  const tryNext = () => {
    if (slot.tried >= candidates.length) return; // все попытки исчерпаны — остаёмся на процедурке
    const src = candidates[slot.tried++];
    img.onload = () => { slot.ready = true; };
    img.onerror = () => { tryNext(); };
    img.src = src;
  };
  tryNext();

  return slot;
}

/** Свечение ауры вокруг персонажа. */
function drawAura(ctx, x, y, w, h, enemy, time) {
  const intensity = enemy.aura;
  if (intensity <= 0.02) return;
  const pulse = 0.85 + Math.sin(time * 2.2) * 0.15;
  const r = w * (1.5 + intensity * 0.9) * pulse;

  const g = ctx.createRadialGradient(x, y - h * 0.15, w * 0.15, x, y - h * 0.15, r);
  g.addColorStop(0, hexA(enemy.palette.glow, 0.30 * intensity));
  g.addColorStop(0.5, hexA(enemy.palette.accent, 0.14 * intensity));
  g.addColorStop(1, hexA(enemy.palette.accent, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y - h * 0.15, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Преобразование hex + альфа в rgba(). */
function hexA(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

/** Причёска — главный маркер аниме-стиля. */
function drawHair(ctx, cx, headY, headR, style, color, t) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = headR * 0.18;

  const sway = Math.sin(t * 1.4) * headR * 0.05;

  switch (style) {
    case 'long':
      ctx.beginPath();
      ctx.moveTo(cx - headR * 1.05, headY - headR * 0.15);
      ctx.quadraticCurveTo(cx - headR * 1.5, headY + headR * 2.6, cx - headR * 0.75 + sway, headY + headR * 3.4);
      ctx.lineTo(cx + headR * 0.75 + sway, headY + headR * 3.4);
      ctx.quadraticCurveTo(cx + headR * 1.5, headY + headR * 2.6, cx + headR * 1.05, headY - headR * 0.15);
      ctx.closePath(); ctx.fill();
      break;
    case 'twin':
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + s * headR * 0.9, headY - headR * 0.3);
        ctx.quadraticCurveTo(cx + s * headR * 2.3, headY + headR * 0.8, cx + s * headR * 1.7 + sway, headY + headR * 2.8);
        ctx.quadraticCurveTo(cx + s * headR * 1.2, headY + headR * 1.4, cx + s * headR * 0.9, headY + headR * 0.2);
        ctx.closePath(); ctx.fill();
      }
      break;
    case 'ponytail':
      ctx.beginPath();
      ctx.moveTo(cx + headR * 0.7, headY - headR * 0.6);
      ctx.quadraticCurveTo(cx + headR * 2.1, headY + headR * 0.9, cx + headR * 1.5 + sway, headY + headR * 3.0);
      ctx.quadraticCurveTo(cx + headR * 1.1, headY + headR * 1.2, cx + headR * 0.75, headY + headR * 0.1);
      ctx.closePath(); ctx.fill();
      break;
    case 'bun':
      ctx.beginPath();
      ctx.arc(cx, headY - headR * 1.15, headR * 0.55, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'wild':
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI * 0.1 - (i / 6) * Math.PI * 0.8;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * headR * 0.95, headY + Math.sin(a) * headR * 0.95);
        ctx.lineTo(cx + Math.cos(a) * headR * (1.55 + (i % 3) * 0.15),
                   headY + Math.sin(a) * headR * (1.55 + (i % 3) * 0.15));
        ctx.stroke();
      }
      break;
    case 'braid':
      ctx.beginPath();
      ctx.moveTo(cx - headR * 1.5, headY + headR * 0.2);
      ctx.quadraticCurveTo(cx - headR * 1.9, headY + headR * 2.2, cx - headR * 1.2 + sway, headY + headR * 3.4);
      ctx.lineWidth = headR * 0.42;
      ctx.stroke();
      break;
    case 'bob':
      ctx.beginPath();
      ctx.moveTo(cx - headR * 1.05, headY - headR * 0.1);
      ctx.quadraticCurveTo(cx - headR * 1.1, headY + headR * 1.3, cx - headR * 0.5, headY + headR * 1.35);
      ctx.lineTo(cx + headR * 0.5, headY + headR * 1.35);
      ctx.quadraticCurveTo(cx + headR * 1.1, headY + headR * 1.3, cx + headR * 1.05, headY - headR * 0.1);
      ctx.closePath(); ctx.fill();
      break;
    default: // short
      break;
  }

  // ВЕРХНЯЯ МАССА ВОЛОС — общая для всех стрижек.
  //
  // Раньше это была дуга радиусом 1.06 от центра лица. Голова при этом
  // имеет череп до 1.04 — волосы ложились впритык и сверху читалась
  // лысина с плоским верхом. Теперь: макушка выше (1.22), объём по
  // бокам и несколько прядей вразнобой — причёска перестала быть
  // накладкой.
  const hairDark = (() => {
    // Затемнение цвета волос — тень внутри массы.
    const m = /^#([0-9a-f]{6})$/i.exec(color);
    if (!m) return color;
    const n = parseInt(m[1], 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
      .map((v) => Math.max(0, Math.round(v * 0.62)));
    return '#' + ch.map((v) => v.toString(16).padStart(2, '0')).join('');
  })();
  const hairLight = (() => {
    const m = /^#([0-9a-f]{6})$/i.exec(color);
    if (!m) return color;
    const n = parseInt(m[1], 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
      .map((v) => Math.min(255, Math.round(v + (255 - v) * 0.34)));
    return '#' + ch.map((v) => v.toString(16).padStart(2, '0')).join('');
  })();

  ctx.fillStyle = color;
  ctx.beginPath();
  // Макушка: шире черепа, с небольшим подъёмом над ним.
  ctx.moveTo(cx - headR * 0.98, headY - headR * 0.44);
  ctx.quadraticCurveTo(cx - headR * 1.10, headY - headR * 1.00,
                       cx - headR * 0.48, headY - headR * 1.30);
  ctx.quadraticCurveTo(cx, headY - headR * 1.48,
                       cx + headR * 0.48, headY - headR * 1.30);
  ctx.quadraticCurveTo(cx + headR * 1.10, headY - headR * 1.00,
                       cx + headR * 0.98, headY - headR * 0.44);
  // Линия роста: высокий лоб, виски открыты.
  ctx.quadraticCurveTo(cx + headR * 0.72, headY - headR * 0.86,
                       cx + headR * 0.36, headY - headR * 0.92);
  ctx.quadraticCurveTo(cx, headY - headR * 0.98,
                       cx - headR * 0.36, headY - headR * 0.92);
  ctx.quadraticCurveTo(cx - headR * 0.72, headY - headR * 0.86,
                       cx - headR * 0.98, headY - headR * 0.44);
  ctx.closePath();
  ctx.fill();

  // Объём: тень внизу массы, блик на макушке.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - headR * 0.98, headY - headR * 0.44);
  ctx.quadraticCurveTo(cx - headR * 1.10, headY - headR * 1.00,
                       cx - headR * 0.48, headY - headR * 1.30);
  ctx.quadraticCurveTo(cx, headY - headR * 1.48,
                       cx + headR * 0.48, headY - headR * 1.30);
  ctx.quadraticCurveTo(cx + headR * 1.10, headY - headR * 1.00,
                       cx + headR * 0.98, headY - headR * 0.44);
  ctx.quadraticCurveTo(cx + headR * 0.72, headY - headR * 0.86,
                       cx + headR * 0.36, headY - headR * 0.92);
  ctx.quadraticCurveTo(cx, headY - headR * 0.98,
                       cx - headR * 0.36, headY - headR * 0.92);
  ctx.quadraticCurveTo(cx - headR * 0.72, headY - headR * 0.86,
                       cx - headR * 0.98, headY - headR * 0.44);
  ctx.closePath();
  ctx.clip();
  const hg = ctx.createLinearGradient(
    cx - headR * 0.4, headY - headR * 1.4, cx + headR * 0.3, headY - headR * 0.5);
  hg.addColorStop(0, hairLight);
  hg.addColorStop(0.55, color);
  hg.addColorStop(1, hairDark);
  ctx.fillStyle = hg;
  ctx.fillRect(cx - headR * 1.4, headY - headR * 1.5, headR * 2.8, headR * 1.6);

  // Пряди — несколько дуг вразнобой, чтобы масса не была пятном.
  ctx.strokeStyle = hexA(hairDark, 0.55);
  ctx.lineWidth = headR * 0.055;
  ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const k = (i - 2) / 2;
    const x0 = cx + k * headR * 0.62;
    const y0 = headY - headR * (1.28 - Math.abs(k) * 0.16);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(
      x0 + k * headR * 0.34, headY - headR * 0.94,
      x0 + k * headR * 0.52, headY - headR * 0.68);
    ctx.stroke();
  }
  ctx.restore();

  // Контур причёски.
  ctx.strokeStyle = hexA(hairDark, 0.45);
  ctx.lineWidth = headR * 0.022;
  ctx.beginPath();
  ctx.moveTo(cx - headR * 0.98, headY - headR * 0.44);
  ctx.quadraticCurveTo(cx - headR * 1.10, headY - headR * 1.00,
                       cx - headR * 0.48, headY - headR * 1.30);
  ctx.quadraticCurveTo(cx, headY - headR * 1.48,
                       cx + headR * 0.48, headY - headR * 1.30);
  ctx.quadraticCurveTo(cx + headR * 1.10, headY - headR * 1.00,
                       cx + headR * 0.98, headY - headR * 0.44);
  ctx.stroke();
}

/** Глаза — второй ключевой маркер аниме. */
function drawEyes(ctx, cx, eyeY, headR, style, palette, t) {
  const eyeW = headR * 0.34;
  const eyeH = headR * 0.42;
  const off = headR * 0.42;

  // --- МОРГАНИЕ ---
  //
  // Прежнее условие Math.sin(t*1.1) > 0.985 давало вспышку в один кадр:
  // на 60 FPS глаз «щёлкал» так быстро, что движения не было видно.
  // Теперь моргание — короткое, но заметное событие: раз в ~4 секунды
  // глаз закрывается на 0.12 с и открывается плавно.
  //
  // Фаза считается от t без хранения состояния, поэтому все звери
  // моргают синхронно — это единственная поблажка: разные фазы
  // потребовали бы генератора случайных чисел в отрисовке.
  const blinkCycle = t % 4.2;
  let blink = 1;
  if (blinkCycle < 0.12) {
    // Закрытие и открытие: парабола от 1 до 0.06 и обратно.
    const k = blinkCycle / 0.12;
    blink = 1 - Math.sin(k * Math.PI) * 0.94;
  }

  // --- ВЗГЛЯД ---
  //
  // Зрачок и белок смещаются вместе, будто зверь осматривается.
  // Медленное блуждание + редкий «толчок» в сторону — так взгляд не
  // выглядит механическим качанием маятника.
  const gazeX = Math.sin(t * 0.6) * headR * 0.05 + Math.sin(t * 2.3) * headR * 0.012;
  const gazeY = Math.cos(t * 0.9) * headR * 0.028;

  if (style === 'closed') {
    ctx.strokeStyle = '#2a2a3a';
    ctx.lineWidth = headR * 0.07;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + s * off, eyeY, eyeW * 0.7, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
    return;
  }

  for (const s of [-1, 1]) {
    const ex = cx + s * off;
    const isGlow = style === 'glowing' || (style === 'heterochromia' && s > 0);

    // Белок
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, eyeW, eyeH * blink, 0, 0, Math.PI * 2);
    ctx.fill();

    if (style === 'hollow') {
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.ellipse(ex + gazeX, eyeY + gazeY, eyeW * 0.5, eyeH * blink, 0, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    // Радужка — сдвигается со взглядом.
    const irisCol = isGlow ? '#ffffff' : palette.accent;
    ctx.fillStyle = irisCol;
    ctx.beginPath();
    ctx.ellipse(ex + gazeX, eyeY + eyeH * 0.08 + gazeY, eyeW * 0.72, eyeH * 0.78 * blink, 0, 0, Math.PI * 2);
    ctx.fill();

    // Лёгкое затемнение по краю радужки — объём, а не плоский кружок.
    if (blink > 0.4) {
      const rg = ctx.createRadialGradient(
        ex + gazeX, eyeY + eyeH * 0.08 + gazeY, eyeW * 0.25,
        ex + gazeX, eyeY + eyeH * 0.08 + gazeY, eyeW * 0.78
      );
      rg.addColorStop(0, 'rgba(0,0,0,0)');
      rg.addColorStop(1, 'rgba(0,0,0,0.32)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.ellipse(ex + gazeX, eyeY + eyeH * 0.08 + gazeY, eyeW * 0.72, eyeH * 0.78 * blink, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (isGlow) {
      const g = ctx.createRadialGradient(ex + gazeX, eyeY + gazeY, 0, ex + gazeX, eyeY + gazeY, eyeW * 1.6);
      g.addColorStop(0, hexA(palette.glow, 0.9));
      g.addColorStop(1, hexA(palette.glow, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(ex + gazeX, eyeY + gazeY, eyeW * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Зрачок
    ctx.fillStyle = 'rgba(10,10,20,0.85)';
    ctx.beginPath();
    ctx.ellipse(ex + gazeX, eyeY + eyeH * 0.1 + gazeY, eyeW * 0.3, eyeH * 0.36 * blink, 0, 0, Math.PI * 2);
    ctx.fill();

    // Блик — два пятна: большой и малый. Второй делает глаз «влажным».
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(ex - eyeW * 0.28 + gazeX, eyeY - eyeH * 0.28 * blink + gazeY, eyeW * 0.2, 0, Math.PI * 2);
    ctx.fill();
    if (blink > 0.5) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.arc(ex + eyeW * 0.26 + gazeX, eyeY + eyeH * 0.3 * blink + gazeY, eyeW * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }

    // Форма глаза: резкий взгляд — более angular.
    if (style === 'sharp') {
      ctx.strokeStyle = '#1a1a2a';
      ctx.lineWidth = headR * 0.075;
      ctx.beginPath();
      ctx.moveTo(ex - eyeW * 1.15, eyeY - eyeH * 0.75);
      ctx.lineTo(ex + eyeW * 1.0, eyeY - eyeH * 0.95);
      ctx.stroke();
    } else if (style === 'wide') {
      ctx.strokeStyle = '#1a1a2a';
      ctx.lineWidth = headR * 0.06;
      ctx.beginPath();
      ctx.arc(ex, eyeY, eyeW * 1.1, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
    }
  }
}

/** Аксессуары. */
function drawAccessory(ctx, cx, headY, headR, acc, palette, t) {
  const sway = Math.sin(t * 1.8) * headR * 0.08;
  switch (acc) {
    case 'ribbon':
      ctx.fillStyle = palette.accent;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(cx + s * headR * 0.85, headY - headR * 0.95, headR * 0.36, headR * 0.24, s * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(cx, headY - headR * 0.95, headR * 0.16, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'mask':
      ctx.fillStyle = 'rgba(240,240,255,0.9)';
      ctx.beginPath();
      ctx.moveTo(cx - headR * 0.85, headY + headR * 0.25);
      ctx.lineTo(cx + headR * 0.85, headY + headR * 0.25);
      ctx.lineTo(cx + headR * 0.7, headY + headR * 0.85);
      ctx.lineTo(cx - headR * 0.7, headY + headR * 0.85);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = headR * 0.07;
      ctx.stroke();
      break;
    case 'talisman':
      ctx.save();
      ctx.translate(cx + headR * 1.05, headY - headR * 0.3 + sway);
      ctx.rotate(0.2);
      ctx.fillStyle = '#f5f0e0';
      ctx.fillRect(-headR * 0.15, -headR * 0.5, headR * 0.3, headR * 1.0);
      ctx.strokeStyle = '#c0392b';
      ctx.lineWidth = headR * 0.05;
      ctx.strokeRect(-headR * 0.15, -headR * 0.5, headR * 0.3, headR * 1.0);
      ctx.restore();
      break;
    case 'bell':
      ctx.fillStyle = palette.accent;
      ctx.beginPath();
      ctx.arc(cx, headY + headR * 1.35 + sway, headR * 0.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'scarf':
      ctx.fillStyle = palette.accent;
      ctx.beginPath();
      ctx.moveTo(cx - headR * 0.9, headY + headR * 1.1);
      ctx.quadraticCurveTo(cx - headR * 1.9, headY + headR * 1.9, cx - headR * 1.3 + sway, headY + headR * 3.0);
      ctx.lineTo(cx - headR * 0.85, headY + headR * 2.9);
      ctx.quadraticCurveTo(cx - headR * 1.2, headY + headR * 1.8, cx - headR * 0.6, headY + headR * 1.2);
      ctx.closePath(); ctx.fill();
      break;
    case 'fan':
      ctx.save();
      ctx.translate(cx + headR * 1.25, headY + headR * 0.9);
      ctx.rotate(-0.4 + sway * 0.5);
      ctx.fillStyle = hexA(palette.accent, 0.85);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, headR * 0.95, -Math.PI * 0.7, -Math.PI * 0.05);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = palette.glow;
      ctx.lineWidth = headR * 0.04;
      ctx.stroke();
      ctx.restore();
      break;
    case 'flute':
      ctx.strokeStyle = '#8b6f3d';
      ctx.lineWidth = headR * 0.1;
      ctx.beginPath();
      ctx.moveTo(cx + headR * 0.9, headY + headR * 1.2);
      ctx.lineTo(cx + headR * 2.0, headY + headR * 1.6);
      ctx.stroke();
      break;
    default:
      break;
  }
}

/** Головной убор по архетипу. */
function drawHat(ctx, cx, headY, headR, hat, palette, t) {
  switch (hat) {
    case 'kasa': // коническая шляпа странника
      ctx.fillStyle = '#c9a227';
      ctx.beginPath();
      ctx.moveTo(cx, headY - headR * 2.1);
      ctx.lineTo(cx + headR * 2.0, headY - headR * 0.55);
      ctx.lineTo(cx - headR * 2.0, headY - headR * 0.55);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#8a6f18'; ctx.lineWidth = headR * 0.05; ctx.stroke();
      break;
    case 'eboshi': // высокая шапка онмёдзи
      ctx.fillStyle = '#1a1a2e';
      ctx.beginPath();
      ctx.moveTo(cx - headR * 0.6, headY - headR * 0.9);
      ctx.lineTo(cx - headR * 0.35, headY - headR * 2.3);
      ctx.lineTo(cx + headR * 0.35, headY - headR * 2.3);
      ctx.lineTo(cx + headR * 0.6, headY - headR * 0.9);
      ctx.closePath(); ctx.fill();
      break;
    case 'hood':
      ctx.fillStyle = hexA(palette.robe, 0.95);
      ctx.beginPath();
      ctx.arc(cx, headY - headR * 0.15, headR * 1.35, Math.PI * 0.95, Math.PI * 2.05);
      ctx.lineTo(cx + headR * 1.2, headY + headR * 0.9);
      ctx.lineTo(cx - headR * 1.2, headY + headR * 0.9);
      ctx.closePath(); ctx.fill();
      break;
    case 'kanzashi': // шпильки знатной особы
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = headR * 0.07;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * headR * 0.45, headY - headR * 0.9);
        ctx.lineTo(cx + i * headR * 0.75, headY - headR * 1.7);
        ctx.stroke();
        ctx.fillStyle = palette.glow;
        ctx.beginPath();
        ctx.arc(cx + i * headR * 0.75, headY - headR * 1.7, headR * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'horns':
      ctx.fillStyle = palette.accent;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + s * headR * 0.55, headY - headR * 0.9);
        ctx.quadraticCurveTo(cx + s * headR * 1.5, headY - headR * 1.9, cx + s * headR * 0.85, headY - headR * 2.3);
        ctx.quadraticCurveTo(cx + s * headR * 0.95, headY - headR * 1.5, cx + s * headR * 0.5, headY - headR * 0.95);
        ctx.closePath(); ctx.fill();
      }
      break;
    case 'kabuto': // шлем полководца
      ctx.fillStyle = '#2a2a3a';
      ctx.beginPath();
      ctx.arc(cx, headY - headR * 0.25, headR * 1.2, Math.PI, Math.PI * 2);
      ctx.lineTo(cx + headR * 1.2, headY + headR * 0.1);
      ctx.lineTo(cx - headR * 1.2, headY + headR * 0.1);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = palette.accent;
      ctx.beginPath();
      ctx.moveTo(cx, headY - headR * 1.7);
      ctx.lineTo(cx + headR * 0.22, headY - headR * 1.0);
      ctx.lineTo(cx - headR * 0.22, headY - headR * 1.0);
      ctx.closePath(); ctx.fill();
      break;
    case 'veil':
      ctx.fillStyle = hexA(palette.glow, 0.22);
      ctx.beginPath();
      ctx.moveTo(cx - headR * 1.3, headY - headR * 0.7);
      ctx.quadraticCurveTo(cx, headY - headR * 2.0, cx + headR * 1.3, headY - headR * 0.7);
      ctx.quadraticCurveTo(cx + headR * 1.8, headY + headR * 1.8, cx, headY + headR * 2.2);
      ctx.quadraticCurveTo(cx - headR * 1.8, headY + headR * 1.8, cx - headR * 1.3, headY - headR * 0.7);
      ctx.closePath(); ctx.fill();
      break;
    case 'antlers':
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = headR * 0.14;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + s * headR * 0.4, headY - headR * 0.9);
        ctx.quadraticCurveTo(cx + s * headR * 1.3, headY - headR * 2.4, cx + s * headR * 0.7, headY - headR * 2.9);
        ctx.moveTo(cx + s * headR * 0.95, headY - headR * 1.9);
        ctx.lineTo(cx + s * headR * 1.7, headY - headR * 2.2);
        ctx.stroke();
      }
      break;
    default:
      break;
  }
}

/**
 * ХВОСТ ЗВЕРЯ.
 *
 * Рисуется до тела, чтобы оказаться позади. Форма зависит от вида:
 * пышный лисий, тонкий кошачий, пушистый заячий комок, змеиный с
 * покачиванием, птичий веер перьев.
 */
function drawTail(ctx, cx, baseY, scale, bodyW, species, pal, t) {
  const kind = species.tail;
  if (kind === 'none') return;

  // Покачивание: хвост живой, а не приклеенный.
  const sway = Math.sin(t * 1.8) * scale * 0.18;
  const rootX = cx + bodyW * 0.35;
  const rootY = baseY - scale * 0.35;

  ctx.save();
  ctx.strokeStyle = pal.hair;
  ctx.fillStyle = pal.hair;

  if (kind === 'bushy') {
    // Пышный хвост: толстая дуга с утолщением на конце.
    ctx.lineCap = 'round';
    ctx.lineWidth = scale * 0.34;
    ctx.beginPath();
    ctx.moveTo(rootX, rootY);
    ctx.quadraticCurveTo(
      rootX + scale * 1.1, rootY - scale * 0.2 + sway,
      rootX + scale * 1.35, rootY - scale * 1.25 + sway * 1.4
    );
    ctx.stroke();
    // Кончик светлее — характерная примета лисы.
    ctx.strokeStyle = hexA(pal.glow, 0.85);
    ctx.lineWidth = scale * 0.2;
    ctx.beginPath();
    ctx.moveTo(rootX + scale * 1.2, rootY - scale * 0.95 + sway * 1.3);
    ctx.lineTo(rootX + scale * 1.35, rootY - scale * 1.25 + sway * 1.4);
    ctx.stroke();
  } else if (kind === 'thin') {
    ctx.lineCap = 'round';
    ctx.lineWidth = scale * 0.1;
    ctx.beginPath();
    ctx.moveTo(rootX, rootY);
    ctx.quadraticCurveTo(
      rootX + scale * 1.0, rootY - scale * 0.5 + sway,
      rootX + scale * 0.85, rootY - scale * 1.5 + sway * 1.6
    );
    ctx.stroke();
  } else if (kind === 'long') {
    ctx.lineCap = 'round';
    ctx.lineWidth = scale * 0.11;
    ctx.beginPath();
    ctx.moveTo(rootX, rootY);
    ctx.bezierCurveTo(
      rootX + scale * 1.2, rootY + scale * 0.3 + sway,
      rootX + scale * 0.4, rootY - scale * 1.0 + sway,
      rootX + scale * 1.1, rootY - scale * 1.7 + sway * 1.5
    );
    ctx.stroke();
  } else if (kind === 'puff') {
    // Заячий хвост — маленький круглый комок.
    const r = scale * 0.26;
    ctx.beginPath();
    ctx.arc(rootX + scale * 0.28, rootY - scale * 0.05 + sway * 0.5, r, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'serpent') {
    // Змеиный хвост — волнистая линия, уходящая в пол.
    ctx.lineCap = 'round';
    ctx.lineWidth = scale * 0.16;
    ctx.beginPath();
    ctx.moveTo(rootX, rootY);
    for (let i = 1; i <= 12; i++) {
      const p = i / 12;
      const x = rootX + p * scale * 1.5 + Math.sin(p * 6 + t * 2.2) * scale * 0.24;
      const yv = rootY + scale * 0.55 * p + Math.cos(p * 5 + t * 1.7) * scale * 0.2;
      ctx.lineTo(x, yv);
    }
    ctx.stroke();
  } else if (kind === 'feather' || kind === 'fan') {
    // Птичий хвост — несколько перьев веером.
    const n = kind === 'fan' ? 7 : 5;
    for (let i = 0; i < n; i++) {
      const a = -0.55 + (i / (n - 1)) * 1.1;
      const len = scale * (1.05 - Math.abs(a) * 0.35);
      ctx.save();
      ctx.translate(rootX, rootY);
      ctx.rotate(a * 0.5 + sway * 0.08);
      ctx.fillStyle = i % 2 === 0 ? pal.hair : hexA(pal.accent, 0.75);
      ctx.beginPath();
      ctx.ellipse(scale * 0.3, -len * 0.5, scale * 0.11, len * 0.55, 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.restore();
}

/**
 * Крылья птиц — за спиной, в раскрытом виде.
 *
 * Тихий взмах: амплитуда мала, чтобы игра не превращалась
 * в мельтешение.
 */
function drawWings(ctx, cx, robeTop, bodyH, bodyW, scale, pal, t) {
  const flap = Math.sin(t * 2.4) * 0.12;
  ctx.save();
  ctx.globalAlpha = 0.9;
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(cx + s * bodyW * 0.4, robeTop + bodyH * 0.28);
    ctx.rotate(s * (0.35 + flap));
    ctx.fillStyle = hexA(pal.accent, 0.55);
    ctx.strokeStyle = hexA(pal.glow, 0.7);
    ctx.lineWidth = scale * 0.02;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-s * scale * 1.5, -scale * 0.4, -s * scale * 2.0, scale * 0.55);
    ctx.quadraticCurveTo(-s * scale * 1.1, scale * 0.75, 0, scale * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Отдельные перья — три мазка.
    ctx.strokeStyle = hexA(pal.glow, 0.45);
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-s * scale * 0.2 * i, scale * 0.1);
      ctx.lineTo(-s * scale * (0.6 + i * 0.38), scale * (0.5 + i * 0.05));
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

/**
 * ГОЛОВА ЗВЕРЯ.
 *
 * Общая форма морды, затем уши/рога по типу. Глаза остаются
 * аниме-крупными, но силуэт — звериный.
 */
function drawBeastHead(ctx, cx, headY, headR, species, pal, eyeStyle, t) {
  const fur = pal.hair;
  const light = hexA(pal.skin, 0.92);

  // --- Уши / рога: рисуются ПОД головой, чтобы торчать из-за неё.
  drawEars(ctx, cx, headY, headR, species, pal, t);

  // --- Основа головы.
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.ellipse(cx, headY, headR * 0.95, headR * 1.0, 0, 0, Math.PI * 2);
  ctx.fill();

  // --- Морда.
  const muzzle = species.muzzle;
  if (muzzle === 'beak') {
    // Птичий клюв — треугольник вперёд.
    ctx.fillStyle = pal.accent;
    ctx.beginPath();
    ctx.moveTo(cx - headR * 0.22, headY + headR * 0.28);
    ctx.lineTo(cx + headR * 0.22, headY + headR * 0.28);
    ctx.lineTo(cx, headY + headR * 1.05);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = hexA(pal.robe, 0.8);
    ctx.lineWidth = headR * 0.04;
    ctx.stroke();
  } else if (muzzle === 'snout') {
    // Пятачок кабана.
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.ellipse(cx, headY + headR * 0.62, headR * 0.34, headR * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hexA(pal.robe, 0.75);
    ctx.beginPath();
    ctx.arc(cx - headR * 0.12, headY + headR * 0.62, headR * 0.055, 0, Math.PI * 2);
    ctx.arc(cx + headR * 0.12, headY + headR * 0.62, headR * 0.055, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Обычная морда: вытянутая или округлая.
    const long = muzzle === 'long' || muzzle === 'flat';
    const wMul = muzzle === 'wide' ? 0.72 : 0.52;
    const hMul = long ? 0.44 : 0.36;
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.ellipse(cx, headY + headR * 0.46, headR * wMul, headR * hMul, 0, 0, Math.PI * 2);
    ctx.fill();

    // Нос.
    if (muzzle !== 'snake') {
      ctx.fillStyle = hexA(pal.robe, 0.9);
      ctx.beginPath();
      const noseY = headY + headR * (long ? 0.72 : 0.56);
      const nr = headR * 0.11;
      ctx.moveTo(cx - nr, noseY);
      ctx.lineTo(cx + nr, noseY);
      ctx.lineTo(cx, noseY + nr * 0.85);
      ctx.closePath();
      ctx.fill();
    }

    // Рот — короткая линия под носом.
    ctx.strokeStyle = hexA(pal.robe, 0.55);
    ctx.lineWidth = headR * 0.035;
    ctx.beginPath();
    ctx.moveTo(cx, headY + headR * (long ? 0.82 : 0.66));
    ctx.lineTo(cx, headY + headR * 0.9);
    ctx.moveTo(cx - headR * 0.2, headY + headR * 0.94);
    ctx.quadraticCurveTo(cx, headY + headR * 1.06, cx + headR * 0.2, headY + headR * 0.94);
    ctx.stroke();
  }

  // --- Глаза: крупные, аниме. Поверх морды.
  const eyeY = headY + headR * 0.02;
  drawEyes(ctx, cx, eyeY, headR * 0.92, eyeStyle, pal, t);

  // --- ДЕТАЛИ МОРДЫ ---
  //
  // Мелкие штрихи, которые превращают общий «звериный силуэт» в
  // конкретное существо. Все они дёшевы (несколько десятков
  // примитивов), но именно они дают узнаваемость на крупном плане —
  // а с увеличением вдвое лицо стало видно гораздо лучше.
  drawBeastDetails(ctx, cx, headY, headR, species, pal, t);
}

/**
 * Детали морды: мех, усы, румянец, брови.
 *
 * Каждая деталь привязана к виду зверя, чтобы лиса, кот и волк не
 * выглядели «одной собакой в разных шапках».
 */
function drawBeastDetails(ctx, cx, headY, headR, species, pal, t) {
  const fur = pal.hair;

  // --- Мех по контуру: короткие штрихи, слегка дышат.
  ctx.strokeStyle = hexA(fur, 0.5);
  ctx.lineWidth = headR * 0.035;
  ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (1.08 + i * 0.105);
    const wob = Math.sin(t * 1.6 + i) * headR * 0.02;
    const r0 = headR * 0.98;
    const x0 = cx + Math.cos(a) * r0;
    const y0 = headY + Math.sin(a) * r0;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + Math.cos(a) * headR * 0.1 + wob, y0 + Math.sin(a) * headR * 0.1);
    ctx.stroke();
  }

  // --- Усы: длинные, у кошачьих и лисьих — заметнее.
  const whiskers = species.muzzle === 'snout' ? 0 : (species.muzzle === 'beak' ? 0 : 3);
  if (whiskers > 0) {
    ctx.strokeStyle = hexA('#ffffff', 0.32);
    ctx.lineWidth = headR * 0.022;
    for (let i = 0; i < whiskers; i++) {
      const yy = headY + headR * (0.44 + i * 0.09);
      const wave = Math.sin(t * 2.2 + i * 0.7) * headR * 0.02;
      for (const d of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + d * headR * 0.2, yy);
        ctx.quadraticCurveTo(
          cx + d * headR * 0.62, yy - headR * 0.04 + wave,
          cx + d * headR * 0.92, yy + headR * 0.05 + wave
        );
        ctx.stroke();
      }
    }
  }

  // --- Румянец: очень слабый, только чтобы морда не была плоской.
  if (species.muzzle !== 'beak') {
    for (const d of [-1, 1]) {
      const g = ctx.createRadialGradient(
        cx + d * headR * 0.52, headY + headR * 0.34, 0,
        cx + d * headR * 0.52, headY + headR * 0.34, headR * 0.3
      );
      g.addColorStop(0, 'rgba(255,140,150,0.16)');
      g.addColorStop(1, 'rgba(255,140,150,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx + d * headR * 0.52, headY + headR * 0.34, headR * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // --- Брови: у волка и кабана нахмурены, у кролика и кота — мягкие.
  const stern = species.ears === 'pointed' && (species.tail === 'bushy' || species.tail === 'curved');
  ctx.strokeStyle = hexA(pal.robe, 0.6);
  ctx.lineWidth = headR * 0.055;
  for (const d of [-1, 1]) {
    ctx.beginPath();
    if (stern) {
      // Нахмуренные: внутренние концы ниже.
      ctx.moveTo(cx + d * headR * 0.18, headY - headR * 0.18);
      ctx.lineTo(cx + d * headR * 0.46, headY - headR * 0.34);
    } else {
      // Мягкие: лёгкая дуга.
      ctx.moveTo(cx + d * headR * 0.2, headY - headR * 0.3);
      ctx.quadraticCurveTo(
        cx + d * headR * 0.34, headY - headR * 0.4,
        cx + d * headR * 0.48, headY - headR * 0.28
      );
    }
    ctx.stroke();
  }
}

/** Уши и рога по типу зверя. */
function drawEars(ctx, cx, headY, headR, species, pal, t) {
  const ears = species.ears;
  const fur = pal.hair;
  const inner = hexA(pal.accent, 0.55);

  // --- ПОДЁРГИВАНИЕ УХА ---
  //
  // Звериное ухо ловит звук даже когда голова неподвижна. Короткий
  // «твич» раз в ~3 секунды оживляет силуэт сильнее, чем постоянное
  // качание: рывок заметен, а ровное колыхание — нет.
  //
  // Амплитуда 0.32 рад (≈18°): прежние 0.13 рад на крупном плане
  // читались как погрешность отрисовки, а не как движение. 18° видно
  // боковым зрением, и при этом ухо не выглядит вывихнутым.
  const twitchAt = t % 3.4;
  const twitch = twitchAt < 0.22
    ? Math.sin(twitchAt / 0.22 * Math.PI) * 0.32
    : 0;

  const triangle = (s, hMul, wMul, tilt) => {
    ctx.save();
    ctx.translate(cx + s * headR * 0.58, headY - headR * 0.72);
    // Подёргивается только левое ухо (s = -1), как у настоящего зверя:
    // симметричное движение выдаёт анимацию.
    ctx.rotate(s * tilt + (s < 0 ? twitch : 0));
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.moveTo(-headR * wMul, 0);
    ctx.lineTo(0, -headR * hMul);
    ctx.lineTo(headR * wMul, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.moveTo(-headR * wMul * 0.5, -headR * 0.06);
    ctx.lineTo(0, -headR * hMul * 0.62);
    ctx.lineTo(headR * wMul * 0.5, -headR * 0.06);
    ctx.closePath();
    ctx.fill();
    // Кромка меха на ухе — тонкий светлый контур.
    ctx.strokeStyle = hexA('#ffffff', 0.18);
    ctx.lineWidth = headR * 0.03;
    ctx.beginPath();
    ctx.moveTo(-headR * wMul, 0);
    ctx.lineTo(0, -headR * hMul);
    ctx.lineTo(headR * wMul, 0);
    ctx.stroke();
    ctx.restore();
  };

  if (ears === 'pointed') {
    triangle(-1, 0.95, 0.34, 0.18);
    triangle(1, 0.95, 0.34, -0.18);
  } else if (ears === 'triangular') {
    triangle(-1, 0.7, 0.36, 0.34);
    triangle(1, 0.7, 0.36, -0.34);
  } else if (ears === 'round') {
    for (const s of [-1, 1]) {
      ctx.fillStyle = fur;
      ctx.beginPath();
      ctx.arc(cx + s * headR * 0.66, headY - headR * 0.66, headR * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = inner;
      ctx.beginPath();
      ctx.arc(cx + s * headR * 0.66, headY - headR * 0.66, headR * 0.17, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (ears === 'long') {
    // Кроличьи — длинные, слегка наклонены и покачиваются.
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(cx + s * headR * 0.36, headY - headR * 0.7);
      ctx.rotate(s * 0.16 + Math.sin(t * 1.7) * 0.04);
      ctx.fillStyle = fur;
      ctx.beginPath();
      ctx.ellipse(0, -headR * 0.85, headR * 0.2, headR * 0.9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = inner;
      ctx.beginPath();
      ctx.ellipse(0, -headR * 0.85, headR * 0.1, headR * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  } else if (ears === 'tufted') {
    triangle(-1, 0.62, 0.22, 0.45);
    triangle(1, 0.62, 0.22, -0.45);
  }

  // --- Рога поверх всего, если есть.
  if (species.horns === 'antlers') {
    // Оленьи рога — ветвистые.
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = headR * 0.1;
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * headR * 0.4, headY - headR * 0.8);
      ctx.quadraticCurveTo(
        cx + s * headR * 0.8, headY - headR * 1.4,
        cx + s * headR * 0.55, headY - headR * 1.9
      );
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + s * headR * 0.62, headY - headR * 1.3);
      ctx.lineTo(cx + s * headR * 1.05, headY - headR * 1.55);
      ctx.moveTo(cx + s * headR * 0.65, headY - headR * 1.6);
      ctx.lineTo(cx + s * headR * 0.3, headY - headR * 1.85);
      ctx.stroke();
    }
  } else if (species.horns === true) {
    // Прямые рога (кабан, бык).
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = headR * 0.13;
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * headR * 0.5, headY - headR * 0.76);
      ctx.quadraticCurveTo(
        cx + s * headR * 1.0, headY - headR * 1.1,
        cx + s * headR * 1.15, headY - headR * 1.65
      );
      ctx.stroke();
    }
  }
}


/**
/**
 * ОБЛАЧЕНИЕ ПРОТИВНИКА.
 *
 * Раньше здесь рисовалось D&D-снаряжение: кожаный нагрудник, железные
 * наплечники с заклёпками, ремни и подсумки. Это делало зверей похожими
 * на наёмников, а не на магов — а противник в этой игре колдует.
 *
 * Доспехи убраны полностью. Осталось то, что читается как одежда
 * заклинателя: пояс с узлом, поясной шнур и подвеска-талисман.
 * Оружие тоже ушло: у врага теперь посох (см. drawStaff в staves.js),
 * и он — единственный предмет в руках.
 */
function drawDnDEquipment(ctx, cx, robeTop, bodyH, bodyW, scale, enemy, t) {
  const pal = enemy.palette;
  const sway = Math.sin(t * 1.1) * scale * 0.025;

  // Пояс — мягкий, из той же ткани, с узлом сбоку. Никакого металла:
  // пряжка заменилась завязанным узлом, как на настоящем оби.
  const beltY = robeTop + bodyH * 0.5;
  ctx.save();
  ctx.fillStyle = hexA(pal.accent, 0.55);
  ctx.fillRect(cx - bodyW * 0.78, beltY, bodyW * 1.56, scale * 0.13);

  // Узел сбоку и два конца шнура, покачивающихся от дыхания.
  ctx.fillStyle = hexA(pal.accent, 0.8);
  ctx.beginPath();
  ctx.ellipse(cx + bodyW * 0.5, beltY + scale * 0.065, scale * 0.13, scale * 0.09, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = hexA(pal.accent, 0.65);
  ctx.lineWidth = scale * 0.035;
  ctx.lineCap = 'round';
  for (const d of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + bodyW * 0.5, beltY + scale * 0.1);
    ctx.quadraticCurveTo(
      cx + bodyW * 0.5 + d * scale * 0.1,
      beltY + scale * 0.3 + sway,
      cx + bodyW * 0.5 + d * scale * 0.16,
      beltY + scale * 0.5 + sway
    );
    ctx.stroke();
  }

  // Подвеска-талисман на груди: маленький ромб, светящийся в такт
  // дыханию. Единственный «блеск» на фигуре — и он магический,
  // а не металлический.
  const talY = robeTop + bodyH * 0.24 + sway * 0.4;
  const pulse = 0.55 + Math.sin(t * 2.1) * 0.2;
  ctx.fillStyle = hexA(pal.glow, pulse);
  ctx.beginPath();
  ctx.moveTo(cx, talY - scale * 0.11);
  ctx.lineTo(cx + scale * 0.08, talY);
  ctx.lineTo(cx, talY + scale * 0.11);
  ctx.lineTo(cx - scale * 0.08, talY);
  ctx.closePath();
  ctx.fill();

  // Тонкий шнурок от талисмана к шее.
  ctx.strokeStyle = hexA(pal.accent, 0.35);
  ctx.lineWidth = scale * 0.018;
  ctx.beginPath();
  ctx.moveTo(cx, talY - scale * 0.11);
  ctx.lineTo(cx, robeTop + bodyH * 0.02);
  ctx.stroke();
  ctx.restore();
}


/**
 * ОПОЗНАВАТЕЛЬНЫЕ ДЕТАЛИ СУЩЕСТВА — поверх головы и шеи.
 *
 * Борода дварфа, гало аасимара, клыки вампира, плавники ящера. Каждая
 * деталь мелкая, но именно она отвечает на вопрос «кто это», когда имя
 * на экране прочитано не будет.
 */
function drawCreatureDetails(ctx, cx, headY, headR, species, pal, t, scale) {
  // --- Борода дварфа: две пряди от щёк вниз, с плетением.
  if (species.beard) {
    ctx.fillStyle = pal.hair;
    ctx.beginPath();
    ctx.moveTo(cx - headR * 0.72, headY + headR * 0.18);
    ctx.quadraticCurveTo(cx - headR * 0.6, headY + headR * 1.15, cx, headY + headR * 1.3);
    ctx.quadraticCurveTo(cx + headR * 0.6, headY + headR * 1.15, cx + headR * 0.72, headY + headR * 0.18);
    ctx.quadraticCurveTo(cx, headY + headR * 0.66, cx - headR * 0.72, headY + headR * 0.18);
    ctx.closePath();
    ctx.fill();
    // Кольцо плетения.
    ctx.strokeStyle = hexA(pal.accent, 0.85);
    ctx.lineWidth = headR * 0.045;
    ctx.beginPath();
    ctx.moveTo(cx - headR * 0.3, headY + headR * 0.82);
    ctx.lineTo(cx + headR * 0.3, headY + headR * 0.82);
    ctx.stroke();
  }

  // --- Гало аасимара: светящееся кольцо над головой.
  if (species.halo) {
    ctx.strokeStyle = hexA(pal.glow, 0.55 + Math.sin(t * 1.8) * 0.2);
    ctx.lineWidth = headR * 0.075;
    ctx.beginPath();
    ctx.ellipse(cx, headY - headR * 1.5, headR * 0.62, headR * 0.19, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Мягкое свечение вокруг кольца.
    const halo = ctx.createRadialGradient(cx, headY - headR * 1.5, 0, cx, headY - headR * 1.5, headR * 1.1);
    halo.addColorStop(0, hexA(pal.glow, 0.22));
    halo.addColorStop(1, hexA(pal.glow, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, headY - headR * 1.5, headR * 1.1, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Клыки вампира: два белых зуба из-под верхней губы.
  if (species.fangs) {
    ctx.fillStyle = '#fbf7ee';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * headR * 0.13, headY + headR * 0.5);
      ctx.lineTo(cx + s * headR * 0.24, headY + headR * 0.5);
      ctx.lineTo(cx + s * headR * 0.185, headY + headR * 0.76);
      ctx.closePath();
      ctx.fill();
    }
  }

  // --- Чешуйчатый гребень вдоль шеи у драконов и ящеров.
  if (species.anatomy === 'dragon') {
    ctx.fillStyle = hexA(pal.accent, 0.8);
    for (let i = 0; i < 3; i++) {
      const y = headY + headR * (0.95 + i * 0.24);
      const w = headR * (0.16 - i * 0.03);
      ctx.beginPath();
      ctx.moveTo(cx - w, y);
      ctx.lineTo(cx, y - headR * 0.2);
      ctx.lineTo(cx + w, y);
      ctx.closePath();
      ctx.fill();
    }
  }
}

/** Ролевые отметины лица: шрамы, war paint и старые клыки. */
function drawDnDFaceMarks(ctx, cx, headY, headR, species, pal, enemy, t) {  const mark = enemy.level >= 35 ? pal.accent : '#7a4038';
  ctx.save();
  ctx.strokeStyle = hexA(mark, 0.72);
  ctx.lineWidth = headR * 0.045;
  // Шрам появляется не у каждого: обычные уровни получают краску,
  // элитные — диагональный боевой шрам.
  if (enemy.level % 3 === 0 || enemy.isBoss) {
    ctx.beginPath();
    ctx.moveTo(cx - headR * 0.62, headY - headR * 0.24);
    ctx.lineTo(cx - headR * 0.38, headY + headR * 0.55);
    ctx.stroke();
  } else {
    ctx.fillStyle = hexA(mark, 0.48);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * headR * 0.62, headY - headR * 0.28);
      ctx.lineTo(cx + s * headR * 0.78, headY + headR * 0.12);
      ctx.lineTo(cx + s * headR * 0.58, headY + headR * 0.2);
      ctx.closePath();
      ctx.fill();
    }
  }
  // Небольшое дыхание амулета под мордой.
  if (enemy.level % 5 === 0) {
    ctx.fillStyle = hexA(pal.glow, 0.7 + Math.sin(t * 3) * 0.15);
    ctx.beginPath();
    ctx.arc(cx, headY + headR * 1.02, headR * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** D&D-акценты боссов: трофейные пластины, цепи и руническая метка. */
function drawDnDBossAccents(ctx, cx, baseY, scale, enemy, t) {
  const c = enemy.palette.accent;
  ctx.save();
  ctx.strokeStyle = hexA('#c59b55', 0.72);
  ctx.lineWidth = scale * 0.045;
  // Рунический круг за силуэтом, слегка «живой».
  const cy = baseY - scale * 2.15;
  const r = scale * (1.65 + Math.sin(t * 1.2) * 0.04);
  ctx.setLineDash([scale * 0.12, scale * 0.08]);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  // Центральная D&D-печать: ромб, крест, четыре малых руны.
  ctx.fillStyle = hexA(c, 0.55);
  ctx.beginPath();
  ctx.moveTo(cx, cy - scale * 0.22);
  ctx.lineTo(cx + scale * 0.22, cy);
  ctx.lineTo(cx, cy + scale * 0.22);
  ctx.lineTo(cx - scale * 0.22, cy);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 4; i++) {
    const a = t * 0.35 + i * Math.PI / 2;
    ctx.fillStyle = hexA('#e8c875', 0.7);
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, scale * 0.045, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}


/**
 * Полная отрисовка персонажа.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx центр по X
 * @param {number} baseY линия "ног"
 * @param {number} scale базовый масштаб в пикселях
 * @param {object} enemy данные врага
 * @param {number} t время в секундах
 * @param {object} state { casting, shieldUp, hurt }
 */
export function drawCharacter(ctx, cx, baseY, scale, enemy, t, state = {}) {
  const slot = tryLoadSprite(enemy);

  // --- МИКРОАНИМАЦИИ ОСНОВЫ ---
  //
  // Три независимых движения, наложенных друг на друга. Одно движение
  // (просто покачивание) выглядит механическим, а три с разными
  // периодами читаются как живое тело:
  //
  //   bob    — дыхание: фигура приподнимается и оседает
  //   sway   — перенос веса: тело чуть ходит из стороны в сторону
  //   tilt   — едва заметный наклон корпуса, как при разговоре
  //
  // Амплитуды намеренно малы (2-4% масштаба): на крупном плане даже
  // они заметны, а больше — уже качание на ветру, а не breathing.
  const breathe = Math.sin(t * 1.5);
  const weight = Math.sin(t * 0.62);
  const lean = Math.sin(t * 0.41 + 1.3);

  const bob = breathe * scale * 0.035;
  const y = baseY + bob;
  const swayX = weight * scale * 0.045;
  const tiltRad = lean * 0.012;

  // Наклон и перенос веса применяются к фигуре целиком, вокруг её
  // основания — иначе фигура «плывёт» по экрану.
  ctx.save();
  ctx.translate(cx + swayX, y);
  ctx.rotate(tiltRad);
  ctx.translate(-cx, -y);

  drawAura(ctx, cx, y - scale * 2.2, scale * 1.2, scale * 2.4, enemy, t);

  // Если есть внешний спрайт — рисуем его вместо процедурного персонажа.
  if (slot && slot.ready) {
    const h = scale * 5.2;
    // Пропорции считаем с защитой от битых значений.
    //
    // Наивное `naturalWidth / naturalHeight || 0.6` пропускает Infinity:
    // у повреждённой или недогруженной картинки naturalHeight может быть 0
    // при ненулевом naturalWidth, и тогда `Infinity || 0.6` даёт Infinity —
    // спрайт рисуется бесконечно широким, заливая весь экран.
    // Проверяем результат явно, а не полагаемся на truthiness.
    const nw = slot.img.naturalWidth;
    const nh = slot.img.naturalHeight;
    const ratio = (nw > 0 && nh > 0) ? nw / nh : 0.6;
    const w = h * (Number.isFinite(ratio) && ratio > 0 ? ratio : 0.6);
    ctx.drawImage(slot.img, cx - w / 2, y - h, w, h);
    drawStatusFx(ctx, cx, y, scale, enemy, t, state);
    ctx.restore();
    return;
  }

  // Боссы — не люди, а чудовища. У каждого свой силуэт.
  if (enemy.isBoss && enemy.creature) {
    // Сначала рунический круг за телом, затем само чудовище —
    // композиция ближе к иллюстрации из настольного бестиария.
    drawDnDBossAccents(ctx, cx, y, scale, enemy, t);
    drawBossCreature(ctx, cx, y, scale, enemy, t, state);
    drawStatusFx(ctx, cx, y, scale, enemy, t, state);
    ctx.restore();
    return;
  }

  const arch = enemy.archetype;
  const pal = enemy.palette;

  const species = enemy.species ? SPECIES[enemy.species] : null;

  // --- Хвост: рисуется ПОЗАДИ тела, иначе он перекроет одежду.
  //
  // Змеиное тело (serpent) рисует свой хвост само — второй был бы
  // лишним. У людей-драконов, кобольдов и василисков хвост нужен.
  const bodyKind = enemy.bodyKind || (species && species.body) || 'robe';
  if (species && species.tail && bodyKind !== 'serpent' && bodyKind !== 'quadruped') {
    drawCreatureTail(ctx, cx, y, scale, pal, t);
  }

  // --- ТЕЛО.
  //
  // Раньше здесь был один и тот же конус-мантия на всех: слизь,
  // призрак и дракон стояли в одинаковых халатах, и силуэт ничего не
  // сообщал. Теперь форма зависит от вида, а голова садится на то,
  // что вернуло тело.
  const geo = drawBody(ctx, cx, y, scale, pal, enemy, t);
  const robeTop = geo.robeTop;
  const bodyH = geo.bodyH;
  const bodyW = geo.bodyW;
  const headR = geo.headR;

  // --- Крылья — за спиной, поверх тела.
  //
  // У драконов кожистые перепонки, у гарпий перья, у горгулий каменные
  // пластины, у фей прозрачные стрекозиные. Одно крыло на все виды
  // читалось бы как «приделали что было».
  if (species && species.wings) {
    drawCreatureWings(ctx, cx, robeTop, scale, species.wings, pal, t);
  }

  // D&D-снаряжение — только на человеческой фигуре: ремни и подвески
  // на слизи или на змеином теле висели бы в воздухе.
  if (bodyKind === 'robe' || bodyKind === 'armor' || bodyKind === 'winged') {
    drawDnDEquipment(ctx, cx, robeTop, bodyH, bodyW, scale, enemy, t);
  }

  // --- ПОСОХ ---
  //
  // Только у тех, у кого есть РУКИ, чтобы его держать.
  //
  // Раньше посох был у всех подряд, включая слизь, бехолдера и
  // змеиное тело. Палка, парящая рядом с массой без рук, читается как
  // приставленный реквизит, а не как предмет существа. Теперь:
  //
  //   robe / armor / winged / giant / tree — посох есть
  //   quadruped / serpent / floating / blob / eye — нет
  //
  // Геометрия сохраняется в state.staff — по ней бой рисует заклинание
  // и связывает кончик посоха с линией знака. Если посоха нет, бой
  // берёт точку у ладоней (см. enemy-fx).
  const hasHands = bodyKind === 'robe' || bodyKind === 'armor' || bodyKind === 'winged'
    || bodyKind === 'giant' || bodyKind === 'tree';
  if (hasHands) {
    const staffG = staffGeometry(cx, robeTop, bodyH, bodyW, scale, t, !!state.casting, geo.grip);
    drawStaff(ctx, staffG, enemy, t, !!state.casting);
    if (state.staffOut) state.staffOut(staffG);
  } else if (state.staffOut) {
    // Без посоха заклинание всё равно должно откуда-то исходить:
    // берём центр груди, иначе эффект каста повиснет в пустоте.
    // Поля те же, что у настоящего посоха, — бой не должен знать
    // разницы между «есть посох» и «рук нет».
    const hx = cx;
    const hy = robeTop + bodyH * 0.42;
    state.staffOut({
      handX: hx, handY: hy,
      headX: hx, headY: hy,
      len: 0, tilt: 0, scale,
    });
  }

  // --- Шея и голова ---
  //
  // Высота головы приходит из drawBody: у зверя она ниже, у великана
  // выше, у слизи почти на земле. Считай её здесь по формуле от
  // robeTop — голова уехала бы от тела на всех нечеловеческих формах.
  //
  // Шея рисуется только у прямоходящих: у слизи, змеи и призрака её
  // просто нет, и прямоугольник висел бы в воздухе.
  const upright = bodyKind === 'robe' || bodyKind === 'armor' || bodyKind === 'winged' || bodyKind === 'giant';
  if (upright) {
    ctx.fillStyle = pal.skin;
    ctx.fillRect(cx - scale * 0.13, geo.headY + headR * 0.5, scale * 0.26, scale * 0.35);
  }

  const headY = geo.headY;

  // Голова существа рисуется своим кодом: у дварфа человеческое лицо
  // с бородой, у драконорождённого — челюсть с зубами и гребнем, у
  // иллитида — купол со щупальцами, у лича — череп. Перекраска звериной
  // морды этого не давала: подпись «Тифлинг», а на экране лис.
  if (species) {
    // ВОЛОСЫ — ДО головы, чтобы череп перекрыл их там, где надо.
    //
    // Раньше drawHair вызывался только в ветке без species. У всех
    // семидесяти врагов species есть — значит причёски не рисовались
    // НИ У КОГО, и все ходили с голым черепом. Для зверей и слизи
    // волосы пропускаются: шерсть у них рисует тело.
    const hairyAnat = species.anatomy === 'human' || species.anatomy === 'dragon'
      || species.anatomy === 'illithid';
    if (hairyAnat && enemy.hairStyle) {
      drawHair(ctx, cx, headY, headR, enemy.hairStyle, pal.hair, t);
    }

    drawCreatureHead(ctx, cx, headY, headR, species, pal, enemy.eyeStyle, t);
    // Детали поверх головы: борода, гало, клыки, гребень.
    drawCreatureDetails(ctx, cx, headY, headR, species, pal, t, scale);
    // Следы приключений: не косметика, а история боёв на лице.
    drawDnDFaceMarks(ctx, cx, headY, headR, species, pal, enemy, t);
    // ОСОБАЯ ДЕТАЛЬ ВИДА ────────────────────────────────────────
    //
    // Анатомий восемь, а видов семьдесят. Без детали дракон с рогами
    // и дракон с рогами неразличимы: меняется только цвет. Здесь
    // каждый вид показывает свой признак — гребень, иней, пламя,
    // корону из рогов, шрамы, перья.
    drawSpeciesExtra(ctx, cx, headY, headR, enemy.extra || species.extra, pal, t);
    // ЗНАКИ ВЕЛИЧИЯ ─────────────────────────────────────────────
    //
    // Чем дальше по кампании, тем внушительнее враг. Корона и аура
    // читаются с первого взгляда и отделяют элиту от рядовых.
    drawSpeciesRegalia(ctx, cx, headY, headR, enemy.regalia || species.regalia, pal, t, species.anatomy);
  } else {
    ctx.fillStyle = pal.skin;
    ctx.beginPath();
    ctx.ellipse(cx, headY, headR * 0.92, headR * 1.06, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = scale * 0.02;
    ctx.stroke();

    drawHair(ctx, cx, headY, headR, enemy.hairStyle, pal.hair, t);
    drawEyes(ctx, cx, headY + headR * 0.18, headR, enemy.eyeStyle, pal, t);

    // Рот — лёгкая линия
    ctx.strokeStyle = 'rgba(120,60,60,0.5)';
    ctx.lineWidth = scale * 0.022;
    ctx.beginPath();
    ctx.arc(cx, headY + headR * 0.62, headR * 0.18, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    drawAccessory(ctx, cx, headY, headR, enemy.accessory, pal, t);
    drawHat(ctx, cx, headY, headR, arch.hat, pal, t);
  }

  drawStatusFx(ctx, cx, y, scale, enemy, t, state);

  // Закрываем наклон/перенос веса, открытый в начале функции.
  // Без парного restore состояние canvas «протекало» бы между кадрами:
  // каждый вызов оставлял бы на стеке лишний трансформ.
  ctx.restore();
}

/** Эффекты состояния: щит, каст, полученный урон. */
function drawStatusFx(ctx, cx, baseY, scale, enemy, t, state) {
  // Щит — заметная сфера, чтобы игрок читал ситуацию мгновенно.
  if (state.shieldUp) {
    const pulse = 0.85 + Math.sin(t * 5) * 0.15;
    const r = scale * 2.5 * pulse;
    const g = ctx.createRadialGradient(cx, baseY - scale * 2.0, r * 0.6, cx, baseY - scale * 2.0, r);
    g.addColorStop(0, 'rgba(120,200,255,0)');
    g.addColorStop(0.75, 'rgba(120,200,255,0.22)');
    g.addColorStop(0.92, 'rgba(180,230,255,0.75)');
    g.addColorStop(1, 'rgba(120,200,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, baseY - scale * 2.0, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(200,240,255,0.85)';
    ctx.lineWidth = scale * 0.06;
    ctx.beginPath();
    ctx.arc(cx, baseY - scale * 2.0, r * 0.92, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Каст — вращающиеся руны у ладоней.
  if (state.casting) {
    const col = state.castColor || '#ffd166';
    for (let i = 0; i < 3; i++) {
      const a = t * 4 + (i / 3) * Math.PI * 2;
      const rr = scale * (0.9 + i * 0.35);
      ctx.strokeStyle = hexA(col, 0.7);
      ctx.lineWidth = scale * 0.05;
      ctx.beginPath();
      ctx.arc(cx, baseY - scale * 1.6, rr, a, a + Math.PI * 0.7);
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(cx, baseY - scale * 1.6, 0, cx, baseY - scale * 1.6, scale * 1.4);
    g.addColorStop(0, hexA(col, 0.5));
    g.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, baseY - scale * 1.6, scale * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
}
