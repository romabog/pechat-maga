/**
 * СТРАЖИ ПОДЗЕМЕЛЬЯ — отрисовка боссов
 * ====================================
 * Семь могучих существ вместо прежних японских чудовищ. Каждое
 * строится из собственных фигур, поэтому узнаётся по силуэту.
 *
 * ДВЕ ФОРМЫ.
 *
 * На 40% здоровья страж сбрасывает облик: во второй форме добавляется
 * ореол, крылья, трещины, свечение — и он подрастает. Отличие видно
 * мгновенно, иначе игрок не поймёт, что правила боя изменились.
 *
 * Все координаты считаются в единицах масштаба `s`: фигура рисуется
 * от `baseY` (ноги на земле) вверх. Так босс остаётся цельным при
 * любом размере экрана.
 */

import { paintPath, scaleTexture, rimLight } from './painterly.js';

/**
 * Аварийный выключатель живописного слоя.
 *
 * Нужен для сравнения «до/после» при подборе силы света: включить
 * его можно только из отладочного превью, в самой игре он всегда
 * false.
 */
let PAINT_OFF = false;
export function setPaintOff(v) { PAINT_OFF = !!v; }

function hexA(hex, a) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function shade(hex, k) {
  const h = hex.replace('#', '');
  const num = parseInt(h.substring(0, 6), 16);
  let r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
  if (k >= 0) { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
  else { r *= 1 + k; g *= 1 + k; b *= 1 + k; }
  const to = (v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Ореол ярости второй формы — свет из-за спины. */
function rageAura(ctx, cx, baseY, s, pal, t) {
  const pulse = 0.75 + Math.sin(t * 2.4) * 0.15;
  const gr = ctx.createRadialGradient(cx, baseY - s * 2.2, s * 0.3, cx, baseY - s * 2.2, s * 4.6);
  gr.addColorStop(0, hexA(pal.glow, 0.34 * pulse));
  gr.addColorStop(0.55, hexA(pal.accent, 0.14 * pulse));
  gr.addColorStop(1, hexA(pal.accent, 0));
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.arc(cx, baseY - s * 2.2, s * 4.6, 0, Math.PI * 2);
  ctx.fill();

  // Лучи, медленно вращающиеся вокруг фигуры.
  ctx.save();
  ctx.translate(cx, baseY - s * 2.2);
  ctx.rotate(t * 0.25);
  ctx.strokeStyle = hexA(pal.glow, 0.18);
  ctx.lineWidth = s * 0.06;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * s * 1.6, Math.sin(a) * s * 1.6);
    ctx.lineTo(Math.cos(a) * s * 3.6, Math.sin(a) * s * 3.6);
    ctx.stroke();
  }
  ctx.restore();
}

/** Раскалённые трещины по телу во второй форме. */
function phaseCracks(ctx, cx, baseY, s, pal, t) {
  const glow = 0.55 + Math.sin(t * 4) * 0.25;
  ctx.strokeStyle = hexA(pal.glow, glow);
  ctx.lineWidth = s * 0.05;
  ctx.lineCap = 'round';
  const crack = (x0, y0, seedA) => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    let x = x0, y = y0;
    for (let i = 0; i < 4; i++) {
      x += Math.sin(seedA + i * 1.7) * s * 0.22;
      y -= s * 0.28;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  for (let i = 0; i < 6; i++) {
    crack(cx + (i - 2.5) * s * 0.34, baseY - s * 0.3, i * 0.9);
  }
}

/** Светящиеся глаза стража — общий признак всех семи. */
function bossEyes(ctx, cx, eyeY, s, pal, t, phase2, opts = {}) {
  const { spread = 0.32, size = 0.13, count = 2 } = opts;
  const pulse = 0.7 + Math.sin(t * 3.2) * 0.3;
  const r = s * size * (phase2 ? 1.18 : 1);
  for (let i = 0; i < count; i++) {
    const dx = count === 1 ? 0 : (i - (count - 1) / 2) * s * spread * 2;
    const ex = cx + dx;
    const gr = ctx.createRadialGradient(ex, eyeY, 0, ex, eyeY, r * 5);
    gr.addColorStop(0, hexA(pal.glow, 0.95 * pulse));
    gr.addColorStop(0.3, hexA(pal.glow, 0.5 * pulse));
    gr.addColorStop(1, hexA(pal.glow, 0));
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(ex, eyeY, r * 5, 0, Math.PI * 2);
    ctx.fill();
    // Ядро глаза.
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, r * 0.42, r * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ------------------------------------------------------------------
// 1. КОБОЛЬД-АРХИЖРЕЦ (уровень 10)
// ------------------------------------------------------------------
function drawKoboldPriest(ctx, cx, baseY, s, pal, t, b, phase2) {
  // ================================================================
  // КОБОЛЬД-АРХИЖРЕЦ (уровень 10) — стиль «хорошая игровая графика».
  //
  // ПОЗА. Кобольд стоит в три четверти, опираясь на посох-кадило.
  // Голова повёрнута к игроку, капюшон откинут назад — видно морду,
  // а не пустой тёмный овал, как было раньше.
  //
  // ПРОПОРЦИИ КОБОЛЬДА. Мелкий зверёк: большая голова относительно
  // тела, короткие лапы, длинный хвост, крупные уши. Именно
  // несоразмерная голова читается как «кобольд», а не как человек.
  //
  // ПОРЯДОК: хвост → мантия → капюшон → морда → посох → свет.
  // ================================================================

  const feet = baseY;
  const breathe = Math.sin(t * 1.15) * s * 0.035;

  // --- Материалы ---------------------------------------------------
  // Ткань — тёмно-зелёная (палитра jade даёт почти белую робу,
  // и на тёмном фоне мантия теряла объём).
  const robe = pal.hair || '#1f5c4a';
  const robeMid = shade(robe, -0.16);
  const robeDark = shade(robe, -0.42);
  const robeDeep = shade(robe, -0.62);
  const robeLight = shade(robe, 0.26);
  const trim = pal.accent;
  const scale = shade(pal.accent, -0.10);
  const scaleDark = shade(pal.accent, -0.44);
  const horn = '#d6c8a8';
  const hornDark = '#8a7a5c';

  // --- Каркас ------------------------------------------------------
  const hipY = feet - s * 0.92;
  const chestY = feet - s * 1.58 + breathe;
  const headY = feet - s * 2.24 + breathe;
  const bodyX = cx - s * 0.05;

  // ================================================================
  // 1. ХВОСТ — выходит из-под мантии и лежит на земле.
  // ================================================================
  {
    const swayTail = Math.sin(t * 1.1) * s * 0.07;
    const tailPath = (c) => {
      c.moveTo(bodyX - s * 0.34, feet - s * 0.28);
      c.quadraticCurveTo(
        bodyX - s * 0.92, feet - s * 0.22,
        bodyX - s * 1.34, feet - s * 0.10 + swayTail);
      c.quadraticCurveTo(
        bodyX - s * 1.62, feet - s * 0.02 + swayTail * 1.4,
        bodyX - s * 1.74, feet - s * 0.14 + swayTail * 1.6);
      c.quadraticCurveTo(
        bodyX - s * 1.52, feet - s * 0.06 + swayTail * 1.4,
        bodyX - s * 1.30, feet - s * 0.18 + swayTail);
      c.quadraticCurveTo(
        bodyX - s * 0.90, feet - s * 0.32,
        bodyX - s * 0.34, feet - s * 0.40);
      c.closePath();
    };
    const tg = ctx.createLinearGradient(0, feet - s * 0.5, 0, feet);
    tg.addColorStop(0, scale);
    tg.addColorStop(1, scaleDark);
    ctx.fillStyle = tg;
    ctx.beginPath();
    tailPath(ctx);
    ctx.fill();

    // Кончик хвоста — роговое острие.
    ctx.fillStyle = hornDark;
    ctx.beginPath();
    ctx.moveTo(bodyX - s * 1.70, feet - s * 0.20 + swayTail * 1.5);
    ctx.lineTo(bodyX - s * 1.62, feet - s * 0.02 + swayTail * 1.4);
    ctx.lineTo(bodyX - s * 1.86, feet - s * 0.08 + swayTail * 1.7);
    ctx.closePath();
    ctx.fill();
  }

  // ================================================================
  // 2. МАНТИЯ — объёмная, с подолом и рукавами.
  // ================================================================
  {
    const robePath = (c) => {
      // Подол: широкая дуга по земле.
      c.moveTo(bodyX - s * 1.02, feet - s * 0.03);
      c.quadraticCurveTo(bodyX - s * 1.04, feet - s * 0.62, bodyX - s * 0.80, feet - s * 1.06);
      // Стан сужается к груди.
      c.quadraticCurveTo(bodyX - s * 0.56, chestY + s * 0.10, bodyX - s * 0.48, chestY - s * 0.10);
      // Плечи.
      c.quadraticCurveTo(bodyX - s * 0.20, chestY - s * 0.30, bodyX + s * 0.26, chestY - s * 0.26);
      c.quadraticCurveTo(bodyX + s * 0.54, chestY + s * 0.02, bodyX + s * 0.62, feet - s * 1.04);
      c.quadraticCurveTo(bodyX + s * 0.84, feet - s * 0.56, bodyX + s * 0.94, feet - s * 0.03);
      // Низ — складки.
      c.quadraticCurveTo(bodyX + s * 0.50, feet + s * 0.06, bodyX + s * 0.10, feet - s * 0.02);
      c.quadraticCurveTo(bodyX - s * 0.44, feet + s * 0.06, bodyX - s * 1.02, feet - s * 0.03);
      c.closePath();
    };

    const rg = ctx.createLinearGradient(
      bodyX - s * 0.9, chestY - s * 0.3, bodyX + s * 0.8, feet);
    rg.addColorStop(0, robeLight);
    rg.addColorStop(0.38, robe);
    rg.addColorStop(0.74, robeMid);
    rg.addColorStop(1, robeDark);
    ctx.fillStyle = rg;
    ctx.beginPath();
    robePath(ctx);
    ctx.fill();

    // Складки ткани — вертикальные тени, читаются как объём.
    ctx.save();
    ctx.beginPath();
    robePath(ctx);
    ctx.clip();
    for (let i = 0; i < 5; i++) {
      const k = i / 4;
      const x0 = bodyX - s * 0.62 + k * s * 1.14;
      ctx.strokeStyle = hexA(robeDeep, 0.30);
      ctx.lineWidth = s * 0.030;
      ctx.beginPath();
      ctx.moveTo(x0, chestY + s * 0.06);
      ctx.quadraticCurveTo(x0 + s * 0.05, feet - s * 0.52, x0 + s * 0.10, feet - s * 0.02);
      ctx.stroke();
      // Светлая грань рядом с тенью.
      ctx.strokeStyle = hexA(robeLight, 0.22);
      ctx.lineWidth = s * 0.018;
      ctx.beginPath();
      ctx.moveTo(x0 + s * 0.035, chestY + s * 0.08);
      ctx.quadraticCurveTo(x0 + s * 0.085, feet - s * 0.52, x0 + s * 0.135, feet - s * 0.04);
      ctx.stroke();
    }
    ctx.restore();

    // Орнамент по подолу — ромбы.
    ctx.strokeStyle = hexA(trim, 0.80);
    ctx.lineWidth = s * 0.026;
    for (let i = -3; i <= 3; i++) {
      const px = bodyX + i * s * 0.27;
      const py = feet - s * 0.16;
      ctx.beginPath();
      ctx.moveTo(px, py - s * 0.07);
      ctx.lineTo(px + s * 0.055, py);
      ctx.lineTo(px, py + s * 0.07);
      ctx.lineTo(px - s * 0.055, py);
      ctx.closePath();
      ctx.stroke();
    }

    // Контур мантии.
    ctx.strokeStyle = hexA(robeDeep, 0.60);
    ctx.lineWidth = s * 0.024;
    ctx.beginPath();
    robePath(ctx);
    ctx.stroke();
  }

  // ================================================================
  // 3. ЛАПЫ ИЗ-ПОД МАНТИИ — короткие, когтистые.
  // ================================================================
  for (const q of [-1, 1]) {
    const lx = bodyX + q * s * 0.30;
    ctx.fillStyle = q < 0 ? scaleDark : scale;
    ctx.beginPath();
    ctx.ellipse(lx, feet - s * 0.09, s * 0.14, s * 0.085, 0, 0, Math.PI * 2);
    ctx.fill();
    // Когти.
    ctx.fillStyle = horn;
    for (let i = -1; i <= 1; i++) {
      const cxp = lx + i * s * 0.075;
      ctx.beginPath();
      ctx.moveTo(cxp - s * 0.020, feet - s * 0.06);
      ctx.lineTo(cxp + s * 0.020, feet - s * 0.06);
      ctx.lineTo(cxp + s * 0.040, feet + s * 0.02);
      ctx.closePath();
      ctx.fill();
    }
  }

  // ================================================================
  // 4. КАПЮШОН — откинут назад, лицо открыто.
  // ================================================================
  const hx = bodyX + s * 0.02;
  {
    const hoodPath = (c) => {
      // Задняя часть капюшона — за головой.
      c.moveTo(hx - s * 0.34, chestY - s * 0.16);
      c.quadraticCurveTo(hx - s * 0.74, headY + s * 0.10, hx - s * 0.62, headY - s * 0.40);
      c.quadraticCurveTo(hx - s * 0.50, headY - s * 0.76, hx - s * 0.06, headY - s * 0.66);
      // Передний край капюшона — по бокам головы.
      c.quadraticCurveTo(hx + s * 0.28, headY - s * 0.52, hx + s * 0.34, headY - s * 0.16);
      c.quadraticCurveTo(hx + s * 0.30, chestY + s * 0.10, hx + s * 0.14, chestY - s * 0.06);
      c.closePath();
    };
    const hg = ctx.createLinearGradient(hx - s * 0.6, headY - s * 0.6, hx + s * 0.3, chestY);
    hg.addColorStop(0, robeLight);
    hg.addColorStop(0.45, robe);
    hg.addColorStop(1, robeDark);
    ctx.fillStyle = hg;
    ctx.beginPath();
    hoodPath(ctx);
    ctx.fill();
    ctx.strokeStyle = hexA(robeDeep, 0.60);
    ctx.lineWidth = s * 0.022;
    ctx.beginPath();
    hoodPath(ctx);
    ctx.stroke();

    // Внутренняя тень капюшона — глубина за головой.
    ctx.fillStyle = 'rgba(6,8,12,0.55)';
    ctx.beginPath();
    ctx.ellipse(hx + s * 0.02, headY - s * 0.02, s * 0.34, s * 0.40, 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  // ================================================================
  // 5. МОРДА — вытянутая, с ушами и рожками.
  // ================================================================
  {
    const muzzle = hx + s * 0.10;

    // Уши: крупные, в стороны — признак кобольда.
    for (const q of [-1, 1]) {
      const earPath = (c) => {
        c.moveTo(hx + q * s * 0.22, headY - s * 0.34);
        c.quadraticCurveTo(
          hx + q * s * 0.62, headY - s * 0.74,
          hx + q * s * 0.80, headY - s * 0.44);
        c.quadraticCurveTo(
          hx + q * s * 0.58, headY - s * 0.30,
          hx + q * s * 0.24, headY - s * 0.14);
        c.closePath();
      };
      const eg = ctx.createLinearGradient(
        hx, headY - s * 0.7, hx + q * s * 0.8, headY - s * 0.2);
      eg.addColorStop(0, scale);
      eg.addColorStop(1, scaleDark);
      ctx.fillStyle = eg;
      ctx.beginPath();
      earPath(ctx);
      ctx.fill();
      // Внутренняя часть уха — теплее.
      ctx.fillStyle = hexA(trim, 0.40);
      ctx.beginPath();
      ctx.moveTo(hx + q * s * 0.30, headY - s * 0.32);
      ctx.quadraticCurveTo(
        hx + q * s * 0.56, headY - s * 0.60,
        hx + q * s * 0.68, headY - s * 0.44);
      ctx.quadraticCurveTo(
        hx + q * s * 0.52, headY - s * 0.34,
        hx + q * s * 0.30, headY - s * 0.22);
      ctx.closePath();
      ctx.fill();
    }

    // Череп.
    const skullPath = (c) => {
      c.moveTo(hx - s * 0.28, headY + s * 0.14);
      c.quadraticCurveTo(hx - s * 0.30, headY - s * 0.38, hx + s * 0.02, headY - s * 0.40);
      // Морда вперёд.
      c.quadraticCurveTo(hx + s * 0.42, headY - s * 0.36, hx + s * 0.60, headY - s * 0.10);
      c.quadraticCurveTo(hx + s * 0.62, headY + s * 0.10, hx + s * 0.44, headY + s * 0.16);
      // Нижняя челюсть.
      c.quadraticCurveTo(hx + s * 0.16, headY + s * 0.34, hx - s * 0.10, headY + s * 0.30);
      c.quadraticCurveTo(hx - s * 0.30, headY + s * 0.26, hx - s * 0.28, headY + s * 0.14);
      c.closePath();
    };
    const kg = ctx.createLinearGradient(
      hx - s * 0.3, headY - s * 0.4, hx + s * 0.6, headY + s * 0.3);
    kg.addColorStop(0, shade(scale, 0.22));
    kg.addColorStop(0.5, scale);
    kg.addColorStop(1, scaleDark);
    ctx.fillStyle = kg;
    ctx.beginPath();
    skullPath(ctx);
    ctx.fill();

    // Тень под надбровьем.
    ctx.fillStyle = hexA(scaleDark, 0.55);
    ctx.beginPath();
    ctx.moveTo(hx - s * 0.16, headY - s * 0.20);
    ctx.quadraticCurveTo(hx + s * 0.24, headY - s * 0.34, hx + s * 0.48, headY - s * 0.12);
    ctx.quadraticCurveTo(hx + s * 0.22, headY - s * 0.20, hx - s * 0.14, headY - s * 0.10);
    ctx.closePath();
    ctx.fill();

    // Рожки — короткие, вверх-назад.
    for (const q of [-1, 1]) {
      const bx = hx + q * s * 0.10 - s * 0.04;
      const by = headY - s * 0.34;
      ctx.fillStyle = horn;
      ctx.beginPath();
      ctx.moveTo(bx - s * 0.045, by);
      ctx.quadraticCurveTo(bx + q * s * 0.06, by - s * 0.22, bx + q * s * 0.02, by - s * 0.28);
      ctx.quadraticCurveTo(bx + q * s * 0.02, by - s * 0.16, bx + s * 0.045, by);
      ctx.closePath();
      ctx.fill();
    }

    // Пасть с зубами.
    ctx.strokeStyle = hexA(robeDeep, 0.75);
    ctx.lineWidth = s * 0.020;
    ctx.beginPath();
    ctx.moveTo(hx + s * 0.58, headY + s * 0.04);
    ctx.quadraticCurveTo(hx + s * 0.36, headY + s * 0.14, hx + s * 0.12, headY + s * 0.16);
    ctx.stroke();
    ctx.fillStyle = '#f2ecd8';
    for (let i = 0; i < 4; i++) {
      const k = i / 4;
      const zx = hx + s * (0.50 - k * 0.32);
      const zy = headY + s * (0.06 + k * 0.04);
      const zh = s * (0.070 - k * 0.014);
      ctx.beginPath();
      ctx.moveTo(zx - s * 0.018, zy);
      ctx.lineTo(zx + s * 0.018, zy);
      ctx.lineTo(zx, zy + zh);
      ctx.closePath();
      ctx.fill();
    }

    // Нос.
    ctx.fillStyle = hexA(robeDeep, 0.85);
    ctx.beginPath();
    ctx.ellipse(hx + s * 0.54, headY - s * 0.04, s * 0.022, s * 0.016, 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Глаза — светятся жреческим огнём.
    bossEyes(ctx, hx + s * 0.16, headY - s * 0.14, s * 0.72, pal, t, phase2,
      { spread: 0.16, size: 0.085 });
  }

  // ================================================================
  // 6. ПОСОХ-КАДИЛО — символ сана.
  // ================================================================
  {
    const staffX = bodyX + s * 0.92;
    const orbY = feet - s * 2.36 + Math.sin(t * 1.8) * s * 0.045;

    // Древко.
    const shaftPath = (c) => {
      c.moveTo(staffX - s * 0.030, feet);
      c.quadraticCurveTo(staffX - s * 0.010, feet - s * 1.2, staffX - s * 0.022, feet - s * 2.16);
      c.lineTo(staffX + s * 0.022, feet - s * 2.16);
      c.quadraticCurveTo(staffX + s * 0.020, feet - s * 1.2, staffX + s * 0.030, feet);
      c.closePath();
    };
    const sg = ctx.createLinearGradient(staffX - s * 0.04, 0, staffX + s * 0.04, 0);
    sg.addColorStop(0, '#5a4220');
    sg.addColorStop(0.4, '#9a7838');
    sg.addColorStop(1, '#4c3818');
    ctx.fillStyle = sg;
    ctx.beginPath();
    shaftPath(ctx);
    ctx.fill();

    // Обмотка.
    ctx.strokeStyle = hexA(trim, 0.65);
    ctx.lineWidth = s * 0.016;
    for (let i = 0; i < 3; i++) {
      const y = feet - s * (1.2 + i * 0.22);
      ctx.beginPath();
      ctx.moveTo(staffX - s * 0.032, y);
      ctx.lineTo(staffX + s * 0.032, y + s * 0.03);
      ctx.stroke();
    }

    // Три когтя-держателя.
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i - 1) * 0.72;
      const tipX = staffX + Math.cos(a) * s * 0.20;
      const tipY = orbY + Math.sin(a) * s * 0.20 - s * 0.02;
      ctx.strokeStyle = hornDark;
      ctx.lineWidth = s * 0.028;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(staffX, feet - s * 2.14);
      ctx.quadraticCurveTo(
        staffX + Math.cos(a) * s * 0.26, orbY + s * 0.26,
        tipX, tipY);
      ctx.stroke();
    }

    // Камень — пульсирующий ореол.
    const pulse = 0.7 + Math.sin(t * 3) * 0.22;
    const og = ctx.createRadialGradient(staffX, orbY, 0, staffX, orbY, s * 0.60);
    og.addColorStop(0, hexA(pal.glow, 0.55 * pulse));
    og.addColorStop(0.4, hexA(pal.glow, 0.22 * pulse));
    og.addColorStop(1, hexA(pal.glow, 0));
    ctx.fillStyle = og;
    ctx.beginPath();
    ctx.arc(staffX, orbY, s * 0.60, 0, Math.PI * 2);
    ctx.fill();

    const core = ctx.createRadialGradient(
      staffX - s * 0.03, orbY - s * 0.03, 0, staffX, orbY, s * 0.13);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.45, pal.glow);
    core.addColorStop(1, shade(pal.glow, -0.35));
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(staffX, orbY, s * 0.115, 0, Math.PI * 2);
    ctx.fill();
  }

  // ================================================================
  // 7. ВТОРАЯ ФОРМА — крылья и корона.
  // ================================================================
  if (phase2) {
    for (const q of [-1, 1]) {
      const wingPath = (c) => {
        c.moveTo(bodyX + q * s * 0.10, chestY - s * 0.16);
        c.quadraticCurveTo(
          bodyX + q * s * 1.06, chestY - s * 0.52,
          bodyX + q * s * 1.24, feet - s * 0.66);
        c.quadraticCurveTo(
          bodyX + q * s * 0.86, feet - s * 0.80,
          bodyX + q * s * 0.92, feet - s * 1.16);
        c.quadraticCurveTo(
          bodyX + q * s * 0.52, feet - s * 1.10,
          bodyX + q * s * 0.10, chestY - s * 0.16);
        c.closePath();
      };
      const wg = ctx.createLinearGradient(
        bodyX, chestY - s * 0.5, bodyX + q * s * 1.2, feet - s * 0.7);
      wg.addColorStop(0, hexA(trim, 0.62));
      wg.addColorStop(1, hexA(shade(trim, -0.40), 0.50));
      ctx.fillStyle = wg;
      ctx.beginPath();
      wingPath(ctx);
      ctx.fill();
      ctx.strokeStyle = hexA(pal.glow, 0.62);
      ctx.lineWidth = s * 0.020;
      ctx.beginPath();
      wingPath(ctx);
      ctx.stroke();
    }

    // Корона: пять шипов с камнями.
    const crownY = headY - s * 0.62;
    ctx.fillStyle = pal.glow;
    for (let i = -2; i <= 2; i++) {
      const hh = s * (0.26 - Math.abs(i) * 0.045);
      const bx = hx + i * s * 0.17;
      ctx.beginPath();
      ctx.moveTo(bx - s * 0.055, crownY);
      ctx.lineTo(bx, crownY - hh);
      ctx.lineTo(bx + s * 0.055, crownY);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = hexA(trim, 0.85);
    ctx.beginPath();
    ctx.ellipse(hx, crownY + s * 0.03, s * 0.24, s * 0.055, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ================================================================
  // 8. СВЕТ ПО КРАЮ
  // ================================================================
  ctx.strokeStyle = hexA(robeLight, 0.20);
  ctx.lineWidth = s * 0.018;
  ctx.beginPath();
  ctx.moveTo(bodyX - s * 0.48, chestY - s * 0.10);
  ctx.quadraticCurveTo(bodyX - s * 0.86, feet - s * 0.70, bodyX - s * 0.98, feet - s * 0.06);
  ctx.stroke();
}

// ------------------------------------------------------------------
// 2. ГИНОСФИНКС (уровень 20)
// ------------------------------------------------------------------
function drawSphinx(ctx, cx, baseY, s, pal, t, b, phase2) {
  // ================================================================
  // ГИНОСФИНКС (уровень 20) — стиль «хорошая игровая графика».
  //
  // КТО ЭТО. Сфинкс — лев с женским лицом и крыльями. Силуэт должен
  // читаться как КОШКА: длинное лежащее тело, вытянутые передние
  // лапы, крылья за спиной, человеческий торс и голова сверху.
  //
  // ПРО ЦВЕТ. Палитра gold даёт robe #3a2a10 — почти чёрный. На тёмном
  // фоне торс в этом цвете полностью пропадал. Поэтому: шкура —
  // приглушённое золото, ткань — тёплый песочный (светлее фона),
  // убор — насыщенное золото. Три разных тона вместо двух.
  //
  // ПРО ВЫСОТУ. Плечи 1.76s, голова 2.34s над землёй; торс 0.70s
  // высотой — полноценный человеческий, а не «ведёрко».
  //
  // ПОРЯДОК: дальнее крыло → хвост → тело → лапы → торс →
  // ближнее крыло → голова → убор.
  // ================================================================

  const feet = baseY;
  const breathe = Math.sin(t * 1.0) * s * 0.030;

  // --- Материалы ---------------------------------------------------
  const fur = shade(pal.accent, -0.20);
  const furMid = shade(fur, -0.20);
  const furDark = shade(fur, -0.44);
  const furDeep = shade(fur, -0.66);
  const furLight = shade(fur, 0.24);
  // Ткань светлее фона и теплее шкуры — иначе торс исчезает.
  const cloth = '#c8a25c';
  const clothLight = '#e8cd96';
  const clothDark = '#8a6a32';
  const clothDeep = '#5c4620';
  const skin = pal.skin || '#ffe9c9';
  const skinDark = shade(skin, -0.34);
  const feather = '#f0e2c0';
  const featherDark = '#a89062';

  // --- Каркас ------------------------------------------------------
  const bodyBackX = cx - s * 1.24;            // круп
  const backY = feet - s * 0.80 + breathe;    // линия спины
  const bellyY = feet - s * 0.10;             // брюхо почти на земле
  const chestX = cx + s * 0.34;               // передняя точка груди
  const pawX = cx + s * 0.94;                 // кончики лап
  const torsoY = feet - s * 1.00 + breathe;   // низ торса
  const shoulderY = feet - s * 1.72 + breathe; // плечи
  const headX = cx + s * 0.20;
  const headY = feet - s * 2.30 + breathe;

  // ================================================================
  // 1. ДАЛЬНЕЕ КРЫЛО — в тени, за спиной.
  // ================================================================
  {
    // Крыло крепится у ЛОПАТКИ и уходит вверх-назад. Прежние версии
    // начинались на уровне спины и лежали поверх тела, отчего
    // читались как парус, а не как крыло.
    ctx.save();
    ctx.translate(-s * 0.12, -s * 0.02);
    const wingPath = (c) => {
      c.moveTo(cx - s * 0.28, backY - s * 0.30);
      // Передняя (верхняя) кромка к «локтю».
      c.quadraticCurveTo(
        cx - s * 0.86, backY - s * 1.66,
        cx - s * 1.66, backY - s * 1.62);
      // Внешний край с двумя перьями-пальцами.
      c.quadraticCurveTo(
        cx - s * 2.18, backY - s * 1.30,
        cx - s * 2.20, backY - s * 0.96);
      c.quadraticCurveTo(
        cx - s * 2.00, backY - s * 1.06,
        cx - s * 1.84, backY - s * 0.92);
      c.quadraticCurveTo(
        cx - s * 1.66, backY - s * 0.86,
        cx - s * 1.50, backY - s * 0.70);
      c.quadraticCurveTo(
        cx - s * 0.86, backY - s * 0.54,
        cx - s * 0.28, backY - s * 0.30);
      c.closePath();
    };
    const g = ctx.createLinearGradient(
      cx - s * 0.3, backY - s * 1.6, cx - s * 2.2, backY - s * 0.7);
    g.addColorStop(0, '#6f5a36');
    g.addColorStop(1, '#2e2413');
    ctx.fillStyle = g;
    ctx.beginPath();
    wingPath(ctx);
    ctx.fill();
    ctx.restore();
  }

  // ================================================================
  // 2. ХВОСТ — обвивает круп, с кисточкой.
  // ================================================================
  {
    const swayTail = Math.sin(t * 0.9) * s * 0.05;
    const tailPath = (c) => {
      c.moveTo(bodyBackX + s * 0.26, feet - s * 0.46);
      c.quadraticCurveTo(
        bodyBackX - s * 0.02, feet - s * 0.12,
        bodyBackX - s * 0.52, feet - s * 0.10 + swayTail);
      c.quadraticCurveTo(
        bodyBackX - s * 0.86, feet - s * 0.10 + swayTail * 1.4,
        bodyBackX - s * 0.96, feet - s * 0.26 + swayTail * 1.5);
      c.quadraticCurveTo(
        bodyBackX - s * 0.82, feet - s * 0.01 + swayTail * 1.4,
        bodyBackX - s * 0.52, feet - s * 0.01 + swayTail);
      c.quadraticCurveTo(
        bodyBackX - s * 0.02, feet - s * 0.01,
        bodyBackX + s * 0.30, feet - s * 0.34);
      c.closePath();
    };
    const tg = ctx.createLinearGradient(0, feet - s * 0.46, 0, feet);
    tg.addColorStop(0, furMid);
    tg.addColorStop(1, furDeep);
    ctx.fillStyle = tg;
    ctx.beginPath();
    tailPath(ctx);
    ctx.fill();
    // Кисточка.
    ctx.fillStyle = furDeep;
    ctx.beginPath();
    ctx.ellipse(bodyBackX - s * 0.98, feet - s * 0.20 + swayTail * 1.5,
      s * 0.14, s * 0.11, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // ================================================================
  // 3. ТЕЛО ЛЬВА — лежит, вытянуто по горизонтали.
  // ================================================================
  {
    const bodyPath = (c) => {
      c.moveTo(bodyBackX + s * 0.14, backY);
      // Спина к груди.
      c.quadraticCurveTo(
        cx - s * 0.44, backY - s * 0.14,
        chestX - s * 0.18, backY + s * 0.10);
      // Грудь вниз.
      c.quadraticCurveTo(
        chestX + s * 0.16, bellyY - s * 0.24,
        chestX - s * 0.02, bellyY);
      // Брюхо назад.
      c.quadraticCurveTo(
        cx - s * 0.42, bellyY + s * 0.06,
        bodyBackX + s * 0.16, bellyY - s * 0.04);
      // Круп вверх.
      c.quadraticCurveTo(
        bodyBackX - s * 0.10, feet - s * 0.46,
        bodyBackX + s * 0.14, backY);
      c.closePath();
    };
    const bg = ctx.createLinearGradient(
      cx - s * 1.2, backY - s * 0.1, cx + s * 0.5, bellyY);
    bg.addColorStop(0, furDark);
    bg.addColorStop(0.30, furMid);
    bg.addColorStop(0.62, fur);
    bg.addColorStop(1, furLight);
    ctx.fillStyle = bg;
    ctx.beginPath();
    bodyPath(ctx);
    ctx.fill();

    // Шерсть.
    ctx.save();
    ctx.beginPath();
    bodyPath(ctx);
    ctx.clip();
    ctx.strokeStyle = hexA(furDeep, 0.20);
    ctx.lineWidth = s * 0.012;
    ctx.lineCap = 'round';
    for (let i = 0; i < 20; i++) {
      const k = i / 19;
      const px = bodyBackX + s * (0.18 + k * 1.70);
      const py = feet - s * (0.18 + Math.sin(k * 2.6) * 0.34);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - s * 0.05, py + s * 0.11);
      ctx.stroke();
    }
    ctx.restore();

    ctx.strokeStyle = hexA(furDeep, 0.55);
    ctx.lineWidth = s * 0.018;
    ctx.beginPath();
    bodyPath(ctx);
    ctx.stroke();

    // Лопатка и бедро.
    ctx.fillStyle = hexA(furLight, 0.24);
    ctx.beginPath();
    ctx.ellipse(cx - s * 0.04, backY + s * 0.22, s * 0.28, s * 0.16, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hexA(furDark, 0.28);
    ctx.beginPath();
    ctx.ellipse(bodyBackX + s * 0.28, feet - s * 0.34, s * 0.24, s * 0.18, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // ================================================================
  // 4. ПЕРЕДНИЕ ЛАПЫ — вытянуты вперёд.
  // ================================================================
  for (const [dyk, col] of [[0.14, furDark], [0, fur]]) {
    const dy = s * dyk;
    const legPath = (c) => {
      c.moveTo(chestX - s * 0.14, feet - s * 0.56 + dy);
      c.quadraticCurveTo(
        chestX + s * 0.24, feet - s * 0.34 + dy,
        pawX - s * 0.10, feet - s * 0.18 + dy);
      c.quadraticCurveTo(
        pawX + s * 0.10, feet - s * 0.14 + dy,
        pawX + s * 0.08, feet - s * 0.02 + dy);
      c.lineTo(pawX - s * 0.12, feet - s * 0.02 + dy);
      c.quadraticCurveTo(
        chestX + s * 0.20, feet - s * 0.12 + dy,
        chestX - s * 0.18, feet - s * 0.32 + dy);
      c.closePath();
    };
    const lg = ctx.createLinearGradient(chestX, feet - s * 0.6, pawX, feet);
    lg.addColorStop(0, shade(col, -0.20));
    lg.addColorStop(0.5, col);
    lg.addColorStop(1, shade(col, 0.10));
    ctx.fillStyle = lg;
    ctx.beginPath();
    legPath(ctx);
    ctx.fill();
    // Пальцы.
    ctx.strokeStyle = hexA(furDeep, 0.55);
    ctx.lineWidth = s * 0.012;
    for (let i = 0; i < 3; i++) {
      const px = pawX - s * (0.08 - i * 0.055);
      ctx.beginPath();
      ctx.moveTo(px, feet - s * 0.03 + dy);
      ctx.lineTo(px, feet - s * 0.12 + dy);
      ctx.stroke();
    }
  }

  // ================================================================
  // 5. ЗАДНЯЯ ЛАПА — подобрана.
  // ================================================================
  {
    const legPath = (c) => {
      c.moveTo(bodyBackX + s * 0.42, feet - s * 0.56);
      c.quadraticCurveTo(
        bodyBackX + s * 0.20, feet - s * 0.24,
        bodyBackX + s * 0.30, feet - s * 0.06);
      c.lineTo(bodyBackX + s * 0.66, feet - s * 0.04);
      c.quadraticCurveTo(
        bodyBackX + s * 0.66, feet - s * 0.30,
        bodyBackX + s * 0.72, feet - s * 0.54);
      c.closePath();
    };
    const lg = ctx.createLinearGradient(
      bodyBackX, feet - s * 0.6, bodyBackX + s * 0.7, feet);
    lg.addColorStop(0, furMid);
    lg.addColorStop(0.55, fur);
    lg.addColorStop(1, furDark);
    ctx.fillStyle = lg;
    ctx.beginPath();
    legPath(ctx);
    ctx.fill();
    ctx.strokeStyle = hexA(furDeep, 0.45);
    ctx.lineWidth = s * 0.015;
    ctx.beginPath();
    legPath(ctx);
    ctx.stroke();
  }

  // ================================================================
  // 6. ЧЕЛОВЕЧЕСКИЙ ТОРС — высокий, светлый, читаемый.
  // ================================================================
  {
    const torsoPath = (c) => {
      // Левое плечо → правое → талия.
      c.moveTo(cx - s * 0.40, shoulderY - s * 0.06);
      c.quadraticCurveTo(cx - s * 0.30, shoulderY - s * 0.30, cx + s * 0.02, shoulderY - s * 0.32);
      c.quadraticCurveTo(cx + s * 0.34, shoulderY - s * 0.24, cx + s * 0.40, shoulderY - s * 0.02);
      // Бок вниз к талии.
      c.quadraticCurveTo(cx + s * 0.46, torsoY + s * 0.22, cx + s * 0.36, torsoY + s * 0.02);
      // Низ торса смыкается с телом.
      c.quadraticCurveTo(cx - s * 0.02, torsoY + s * 0.14, cx - s * 0.40, torsoY + s * 0.02);
      c.quadraticCurveTo(cx - s * 0.48, torsoY + s * 0.24, cx - s * 0.40, shoulderY - s * 0.06);
      c.closePath();
    };
    const tg = ctx.createLinearGradient(
      cx - s * 0.42, shoulderY - s * 0.2, cx + s * 0.44, torsoY);
    tg.addColorStop(0, clothLight);
    tg.addColorStop(0.46, cloth);
    tg.addColorStop(1, clothDark);
    ctx.fillStyle = tg;
    ctx.beginPath();
    torsoPath(ctx);
    ctx.fill();

    // Складки — объём.
    ctx.save();
    ctx.beginPath();
    torsoPath(ctx);
    ctx.clip();
    for (let i = 0; i < 4; i++) {
      const px = cx - s * 0.24 + i * s * 0.15;
      ctx.strokeStyle = hexA(clothDeep, 0.22);
      ctx.lineWidth = s * 0.016;
      ctx.beginPath();
      ctx.moveTo(px, shoulderY - s * 0.14);
      ctx.quadraticCurveTo(px + s * 0.03, torsoY + s * 0.06, px + s * 0.05, torsoY + s * 0.10);
      ctx.stroke();
    }
    ctx.restore();

    ctx.strokeStyle = hexA(clothDeep, 0.65);
    ctx.lineWidth = s * 0.016;
    ctx.beginPath();
    torsoPath(ctx);
    ctx.stroke();

    // Ожерелье.
    ctx.fillStyle = hexA('#ffe9a8', 0.95);
    ctx.beginPath();
    ctx.ellipse(cx + s * 0.00, shoulderY - s * 0.04, s * 0.24, s * 0.048, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(pal.glow, -0.10);
    ctx.beginPath();
    ctx.ellipse(cx + s * 0.00, shoulderY - s * 0.02, s * 0.05, s * 0.042, 0, 0, Math.PI * 2);
    ctx.fill();

    // Шея.
    const ng = ctx.createLinearGradient(headX - s * 0.1, headY, headX + s * 0.14, shoulderY);
    ng.addColorStop(0, shade(skin, 0.06));
    ng.addColorStop(1, skinDark);
    ctx.fillStyle = ng;
    ctx.beginPath();
    ctx.moveTo(headX - s * 0.11, headY + s * 0.14);
    ctx.quadraticCurveTo(headX - s * 0.15, shoulderY + s * 0.02,
                         cx - s * 0.10, shoulderY - s * 0.14);
    ctx.lineTo(cx + s * 0.16, shoulderY - s * 0.16);
    ctx.quadraticCurveTo(headX + s * 0.13, shoulderY + s * 0.02,
                         headX + s * 0.12, headY + s * 0.14);
    ctx.closePath();
    ctx.fill();
  }
  {
    // Ближнее крыло — то же, но светлее, крупнее и выше.
    const wingPath = (c) => {
      // Крыло растёт из лопатки и уходит ВВЕРХ-ВЛЕВО. Нижняя кромка
      // не заходит правее x = cx - 0.45s, иначе крыло наползает на
      // торс и закрывает его.
      c.moveTo(cx - s * 0.45, backY - s * 0.52);
      // Верхняя кромка к «локтю» высоко над спиной.
      c.quadraticCurveTo(
        cx - s * 0.86, backY - s * 1.92,
        cx - s * 1.56, backY - s * 1.88);
      // Внешний край — перья-пальцы.
      c.quadraticCurveTo(
        cx - s * 2.14, backY - s * 1.50,
        cx - s * 2.10, backY - s * 1.10);
      c.quadraticCurveTo(
        cx - s * 1.90, backY - s * 1.22,
        cx - s * 1.74, backY - s * 1.04);
      c.quadraticCurveTo(
        cx - s * 1.52, backY - s * 0.96,
        cx - s * 1.36, backY - s * 0.78);
      // Нижняя кромка обратно к лопатке.
      c.quadraticCurveTo(
        cx - s * 0.82, backY - s * 0.66,
        cx - s * 0.45, backY - s * 0.52);
      c.closePath();
    };
    const g = ctx.createLinearGradient(
      cx - s * 0.1, backY - s * 1.8, cx - s * 2.0, backY - s * 0.7);
    g.addColorStop(0, feather);
    g.addColorStop(0.46, '#d8bd90');
    g.addColorStop(1, featherDark);
    ctx.fillStyle = g;
    ctx.beginPath();
    wingPath(ctx);
    ctx.fill();

    // Маховые перья веером от лопатки.
    ctx.save();
    ctx.beginPath();
    wingPath(ctx);
    ctx.clip();
    for (let i = 0; i < 5; i++) {
      const k = i / 4;
      ctx.strokeStyle = hexA('#75603c', 0.44);
      ctx.lineWidth = s * 0.014;
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.20, backY - s * 0.46);
      ctx.quadraticCurveTo(
        cx - s * (0.80 + k * 0.34), backY - s * (1.30 + k * 0.06),
        cx - s * (1.68 + k * 0.34), backY - s * (1.20 - k * 0.12));
      ctx.stroke();
    }
    ctx.restore();

    ctx.strokeStyle = hexA('#5a4626', 0.50);
    ctx.lineWidth = s * 0.015;
    ctx.beginPath();
    wingPath(ctx);
    ctx.stroke();
  }

  // ================================================================
  // 8. ГОЛОВА — женское лицо, немес, урей.
  // ================================================================
  const hx = headX;
  const hy = headY;
  {
    // Платок сзади и по бокам.
    ctx.fillStyle = clothDark;
    ctx.beginPath();
    ctx.ellipse(hx - s * 0.04, hy - s * 0.01, s * 0.28, s * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();

    // Лицо.
    const facePath = (c) => {
      c.moveTo(hx - s * 0.19, hy - s * 0.13);
      c.quadraticCurveTo(hx - s * 0.19, hy + s * 0.15, hx - s * 0.04, hy + s * 0.25);
      c.quadraticCurveTo(hx + s * 0.09, hy + s * 0.29, hx + s * 0.16, hy + s * 0.17);
      c.quadraticCurveTo(hx + s * 0.23, hy + s * 0.00, hx + s * 0.19, hy - s * 0.13);
      c.quadraticCurveTo(hx + s * 0.08, hy - s * 0.30, hx - s * 0.05, hy - s * 0.28);
      c.quadraticCurveTo(hx - s * 0.17, hy - s * 0.25, hx - s * 0.19, hy - s * 0.13);
      c.closePath();
    };
    const fg = ctx.createLinearGradient(
      hx - s * 0.17, hy - s * 0.27, hx + s * 0.19, hy + s * 0.27);
    fg.addColorStop(0, shade(skin, 0.14));
    fg.addColorStop(0.5, skin);
    fg.addColorStop(1, skinDark);
    ctx.fillStyle = fg;
    ctx.beginPath();
    facePath(ctx);
    ctx.fill();

    // Боковая тень.
    ctx.fillStyle = hexA(skinDark, 0.24);
    ctx.beginPath();
    ctx.moveTo(hx - s * 0.18, hy - s * 0.01);
    ctx.quadraticCurveTo(hx - s * 0.08, hy - s * 0.07, hx + s * 0.01, hy - s * 0.01);
    ctx.quadraticCurveTo(hx - s * 0.07, hy + s * 0.08, hx - s * 0.18, hy - s * 0.01);
    ctx.closePath();
    ctx.fill();

    // Нос и губы.
    ctx.strokeStyle = hexA(skinDark, 0.72);
    ctx.lineWidth = s * 0.013;
    ctx.beginPath();
    ctx.moveTo(hx - s * 0.01, hy - s * 0.09);
    ctx.quadraticCurveTo(hx + s * 0.04, hy + s * 0.01, hx - s * 0.01, hy + s * 0.04);
    ctx.stroke();
    ctx.strokeStyle = hexA(shade(skin, -0.40), 0.78);
    ctx.lineWidth = s * 0.015;
    ctx.beginPath();
    ctx.moveTo(hx - s * 0.06, hy + s * 0.11);
    ctx.quadraticCurveTo(hx + s * 0.02, hy + s * 0.14, hx + s * 0.08, hy + s * 0.09);
    ctx.stroke();

    // Глаза с бровями.
    for (const q of [-1, 1]) {
      const ex = hx + q * s * 0.090;
      const ey = hy - s * 0.04;
      ctx.fillStyle = '#f8f1e4';
      ctx.beginPath();
      ctx.ellipse(ex, ey, s * 0.050, s * 0.036, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shade(pal.glow, -0.22);
      ctx.beginPath();
      ctx.arc(ex, ey, s * 0.026, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#14110c';
      ctx.beginPath();
      ctx.arc(ex, ey, s * 0.012, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = hexA(shade(skin, -0.60), 0.80);
      ctx.lineWidth = s * 0.018;
      ctx.beginPath();
      ctx.moveTo(ex - s * 0.052, ey - s * 0.058);
      ctx.quadraticCurveTo(ex, ey - s * 0.084, ex + s * 0.050, ey - s * 0.054);
      ctx.stroke();
    }

    // Немес — боковые полотнища.
    for (const q of [-1, 1]) {
      const lappetPath = (c) => {
        c.moveTo(hx + q * s * 0.17, hy - s * 0.19);
        c.quadraticCurveTo(
          hx + q * s * 0.38, hy - s * 0.02,
          hx + q * s * 0.36, hy + s * 0.28);
        c.quadraticCurveTo(
          hx + q * s * 0.27, hy + s * 0.36,
          hx + q * s * 0.17, hy + s * 0.32);
        c.quadraticCurveTo(
          hx + q * s * 0.21, hy + s * 0.06,
          hx + q * s * 0.15, hy - s * 0.17);
        c.closePath();
      };
      const lg = ctx.createLinearGradient(
        hx + q * s * 0.17, hy - s * 0.19, hx + q * s * 0.36, hy + s * 0.32);
      lg.addColorStop(0, shade(cloth, 0.16));
      lg.addColorStop(1, clothDark);
      ctx.fillStyle = lg;
      ctx.beginPath();
      lappetPath(ctx);
      ctx.fill();
      ctx.strokeStyle = hexA(pal.glow, 0.72);
      ctx.lineWidth = s * 0.015;
      for (let i = 0; i < 3; i++) {
        const yy = hy + s * (0.02 + i * 0.10);
        ctx.beginPath();
        ctx.moveTo(hx + q * s * 0.175, yy);
        ctx.lineTo(hx + q * s * 0.335, yy - s * 0.024);
        ctx.stroke();
      }
    }

    // Урей — кобра на лбу.
    {
      const ux = hx;
      const uy = hy - s * 0.30;
      ctx.fillStyle = shade(pal.glow, -0.06);
      ctx.beginPath();
      ctx.moveTo(ux - s * 0.042, uy + s * 0.085);
      ctx.quadraticCurveTo(ux - s * 0.080, uy - s * 0.048, ux, uy - s * 0.085);
      ctx.quadraticCurveTo(ux + s * 0.080, uy - s * 0.048, ux + s * 0.042, uy + s * 0.085);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = shade(pal.glow, -0.40);
      ctx.beginPath();
      ctx.ellipse(ux, uy + s * 0.095, s * 0.030, s * 0.024, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ================================================================
  // 9. ВТОРАЯ ФОРМА.
  // ================================================================
  if (phase2) {
    const hg = ctx.createRadialGradient(hx, hy - s * 0.08, s * 0.2, hx, hy - s * 0.08, s * 1.35);
    hg.addColorStop(0, hexA(pal.glow, 0.26));
    hg.addColorStop(0.5, hexA(pal.glow, 0.10));
    hg.addColorStop(1, hexA(pal.glow, 0));
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.arc(hx, hy - s * 0.08, s * 1.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = hexA(pal.glow, 0.50);
    ctx.lineWidth = s * 0.018;
    ctx.lineCap = 'round';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + t * 0.3;
      ctx.beginPath();
      ctx.moveTo(hx + Math.cos(a) * s * 0.54, hy - s * 0.08 + Math.sin(a) * s * 0.54);
      ctx.lineTo(hx + Math.cos(a) * s * 0.80, hy - s * 0.08 + Math.sin(a) * s * 0.80);
      ctx.stroke();
    }

    ctx.strokeStyle = hexA(pal.glow, 0.34);
    ctx.lineWidth = s * 0.018;
    for (let i = 0; i < 3; i++) {
      const yy = feet - s * (0.26 + i * 0.12);
      ctx.beginPath();
      ctx.moveTo(bodyBackX + s * 0.20, yy);
      ctx.quadraticCurveTo(cx - s * 0.30, yy - s * 0.04, chestX, yy);
      ctx.stroke();
    }
  }
}

// ------------------------------------------------------------------
// 3. СКАЛЬНЫЙ ВЕЛИКАН (уровень 30)
// ------------------------------------------------------------------
function drawStoneGiant(ctx, cx, baseY, s, pal, t, b, phase2) {
  // ================================================================
  // СКАЛЬНЫЙ ВЕЛИКАН (уровень 30) — стиль «хорошая игровая графика».
  //
  // КТО ЭТО. Каменный гигант: глыба-торс, огромные руки ниже колен,
  // голова вросла в плечи, вместо глаз — огонь в трещинах.
  //
  // ЧТО БЫЛО НЕ ТАК. Раньше это были плоские многоугольники без
  // объёма и один серый цвет — «серый шкаф». Исправлено:
  //   • каждая глыба — контур с ГРАДИЕНТОМ (свет сверху, тень снизу);
  //   • у камня есть сколы: тёмные грани и светлые кромки;
  //   • силуэт асимметричен — скол на плече, разные руки;
  //   • трещины светятся изнутри, а не просто нарисованы линией.
  //
  // ПОРЯДОК: ноги → торс → руки → голова → трещины → свечение.
  // ================================================================

  const feet = baseY;
  const breathe = Math.sin(t * 0.9) * s * 0.035;

  // --- Материалы ---------------------------------------------------
  // Камень холодный: синевато-серый, не чистый серый.
  const rock = '#5a6068';
  const rockLight = '#8d949c';
  const rockMid = '#6a717a';
  const rockDark = '#3e444b';
  const rockDeep = '#272b31';
  const rockWarm = '#7d7a6e';      // тёплые сколы
  const glow = pal.glow;

  // --- Каркас ------------------------------------------------------
  const hipY = feet - s * 1.30;
  const chestY = feet - s * 2.30 + breathe;
  const shoulderY = feet - s * 2.75 + breathe;
  const headY = feet - s * 3.10 + breathe;

  // Помощник: каменная глыба с объёмом.
  // Тёмная грань снизу-слева, светлая кромка сверху, плюс контур.
  const block = (path, c0, c1, c2) => {
    const g = ctx.createLinearGradient(
      cx - s * 0.2, feet - s * 3.2, cx + s * 0.2, feet);
    g.addColorStop(0, c0);
    g.addColorStop(0.5, c1);
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.beginPath();
    path(ctx);
    ctx.fill();
    ctx.strokeStyle = hexA(rockDeep, 0.70);
    ctx.lineWidth = s * 0.022;
    ctx.beginPath();
    path(ctx);
    ctx.stroke();
  };

  // ================================================================
  // 1. НОГИ — две каменные колонны с обломанными ступнями.
  // ================================================================
  for (const [q, colA, colB, colC] of [
    [-1, rockDark, rock, rockDeep],
    [1, rock, rockMid, rockDark],
  ]) {
    const legPath = (c) => {
      const lx = cx + q * s * 0.42;
      c.moveTo(lx - s * 0.30, hipY + s * 0.10);
      // Внешняя кромка вниз.
      c.quadraticCurveTo(lx - s * 0.34, feet - s * 0.70, lx - s * 0.30, feet - s * 0.12);
      // Ступня.
      c.lineTo(lx - s * 0.36, feet);
      c.lineTo(lx + s * 0.34, feet);
      c.lineTo(lx + s * 0.30, feet - s * 0.12);
      // Внутренняя кромка вверх.
      c.quadraticCurveTo(lx + s * 0.28, feet - s * 0.72, lx + s * 0.26, hipY + s * 0.10);
      c.closePath();
    };
    block(legPath, colA, colB, colC);

    // Скол на колене — плоская светлая грань.
    const lx = cx + q * s * 0.42;
    ctx.fillStyle = hexA(rockLight, 0.28);
    ctx.beginPath();
    ctx.moveTo(lx - s * 0.20, feet - s * 0.86);
    ctx.lineTo(lx + s * 0.06, feet - s * 0.92);
    ctx.lineTo(lx - s * 0.04, feet - s * 0.62);
    ctx.closePath();
    ctx.fill();
  }

  // ================================================================
  // 2. ТОРС — глыба, сужается к поясу, скол на левом плече.
  // ================================================================
  {
    const torsoPath = (c) => {
      c.moveTo(cx - s * 0.92, hipY + s * 0.06);
      // Левый бок вверх.
      c.quadraticCurveTo(cx - s * 1.02, feet - s * 1.90, cx - s * 0.94, shoulderY + s * 0.16);
      // Левое плечо со сколом.
      c.lineTo(cx - s * 0.72, shoulderY - s * 0.16);
      c.lineTo(cx - s * 0.40, shoulderY - s * 0.24);
      // Шея-выемка.
      c.lineTo(cx - s * 0.26, shoulderY - s * 0.10);
      c.lineTo(cx + s * 0.26, shoulderY - s * 0.10);
      // Правое плечо.
      c.lineTo(cx + s * 0.52, shoulderY - s * 0.30);
      c.quadraticCurveTo(cx + s * 1.02, feet - s * 2.20, cx + s * 0.94, hipY + s * 0.06);
      // Пояс.
      c.quadraticCurveTo(cx, hipY + s * 0.22, cx - s * 0.92, hipY + s * 0.06);
      c.closePath();
    };
    block(torsoPath, rockLight, rockMid, rockDeep);

    // Объём: светлая грань на груди слева, тень справа.
    ctx.save();
    ctx.beginPath();
    torsoPath(ctx);
    ctx.clip();
    const lg = ctx.createLinearGradient(
      cx - s * 0.9, feet - s * 2.6, cx + s * 0.4, feet - s * 1.5);
    lg.addColorStop(0, hexA('#c8ced6', 0.30));
    lg.addColorStop(1, hexA('#c8ced6', 0));
    ctx.fillStyle = lg;
    ctx.fillRect(cx - s * 1.1, feet - s * 3.0, s * 2.2, s * 2.0);

    const rg = ctx.createLinearGradient(
      cx + s * 0.3, feet - s * 2.2, cx + s * 1.0, feet - s * 1.2);
    rg.addColorStop(0, hexA(rockDeep, 0));
    rg.addColorStop(1, hexA(rockDeep, 0.55));
    ctx.fillStyle = rg;
    ctx.fillRect(cx - s * 1.1, feet - s * 3.0, s * 2.2, s * 2.0);
    ctx.restore();

    // Каменные пластины на груди — как броня из сколов.
    for (let i = 0; i < 4; i++) {
      const k = i / 3;
      const py = feet - s * (1.60 + k * 0.90);
      const pw = s * (0.62 - Math.abs(k - 0.5) * 0.30);
      ctx.strokeStyle = hexA(rockDeep, 0.50);
      ctx.lineWidth = s * 0.018;
      ctx.beginPath();
      ctx.moveTo(cx - pw, py);
      ctx.quadraticCurveTo(cx, py - s * 0.10, cx + pw, py);
      ctx.stroke();
      ctx.strokeStyle = hexA(rockLight, 0.22);
      ctx.lineWidth = s * 0.012;
      ctx.beginPath();
      ctx.moveTo(cx - pw, py + s * 0.035);
      ctx.quadraticCurveTo(cx, py - s * 0.065, cx + pw, py + s * 0.035);
      ctx.stroke();
    }
  }

  // ================================================================
  // 3. РУКИ — огромные, до колен, с каменными кулаками.
  // ================================================================
  for (const q of [-1, 1]) {
    const swing = Math.sin(t * 0.8 + (q > 0 ? 0 : 1.6)) * s * 0.045;
    const shoulderX = cx + q * s * 0.92;
    const elbowX = cx + q * s * 1.34;
    const fistX = cx + q * s * 1.28;
    const fistY = feet - s * 0.94 + swing;

    const armPath = (c) => {
      c.moveTo(shoulderX - q * s * 0.10, shoulderY + s * 0.06);
      // Внешняя кромка через локоть.
      c.quadraticCurveTo(
        elbowX + q * s * 0.14, feet - s * 2.10 + swing,
        elbowX + q * s * 0.06, fistY - s * 0.30);
      c.quadraticCurveTo(
        elbowX - q * s * 0.04, fistY - s * 0.06,
        fistX - q * s * 0.02, fistY + s * 0.06);
      // Внутренняя кромка обратно вверх.
      c.quadraticCurveTo(
        elbowX - q * s * 0.36, feet - s * 1.60 + swing,
        shoulderX - q * s * 0.34, shoulderY + s * 0.20);
      c.closePath();
    };
    block(armPath, shade(rock, 0.18), rock, rockDeep);

    // Кулак — отдельная глыба с пальцами.
    const fistPath = (c) => {
      c.moveTo(fistX - s * 0.24, fistY - s * 0.24);
      c.quadraticCurveTo(fistX + s * 0.26, fistY - s * 0.30, fistX + s * 0.28, fistY + s * 0.04);
      c.quadraticCurveTo(fistX + s * 0.26, fistY + s * 0.28, fistX - s * 0.06, fistY + s * 0.30);
      c.quadraticCurveTo(fistX - s * 0.28, fistY + s * 0.26, fistX - s * 0.24, fistY - s * 0.24);
      c.closePath();
    };
    block(fistPath, rockLight, rock, rockDark);
    // Пальцы-фаланги.
    ctx.strokeStyle = hexA(rockDeep, 0.60);
    ctx.lineWidth = s * 0.016;
    for (let i = 0; i < 3; i++) {
      const px = fistX - s * 0.10 + i * s * 0.11;
      ctx.beginPath();
      ctx.moveTo(px, fistY - s * 0.22);
      ctx.lineTo(px + s * 0.01, fistY + s * 0.06);
      ctx.stroke();
    }
  }

  // ================================================================
  // 4. ГОЛОВА — массивная, вросла в плечи, с надбровной плитой.
  // ================================================================
  {
    const headPath = (c) => {
      c.moveTo(cx - s * 0.44, headY + s * 0.28);
      c.quadraticCurveTo(cx - s * 0.56, headY - s * 0.10, cx - s * 0.44, headY - s * 0.34);
      // Верх — плоский, как обломок.
      c.lineTo(cx - s * 0.18, headY - s * 0.46);
      c.lineTo(cx + s * 0.20, headY - s * 0.46);
      c.lineTo(cx + s * 0.46, headY - s * 0.32);
      c.quadraticCurveTo(cx + s * 0.56, headY - s * 0.06, cx + s * 0.42, headY + s * 0.28);
      c.closePath();
    };
    block(headPath, rockLight, rockMid, rockDark);

    // Надбровная плита.
    const browPath = (c) => {
      c.moveTo(cx - s * 0.56, headY - s * 0.06);
      c.lineTo(cx + s * 0.56, headY - s * 0.06);
      c.lineTo(cx + s * 0.42, headY - s * 0.26);
      c.lineTo(cx - s * 0.42, headY - s * 0.26);
      c.closePath();
    };
    block(browPath, rock, rockMid, rockDeep);

    // Челюсть — тяжёлая нижняя плита.
    ctx.fillStyle = hexA(rockDark, 0.85);
    ctx.beginPath();
    ctx.ellipse(cx, headY + s * 0.24, s * 0.30, s * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    // Зубы-обломки.
    ctx.fillStyle = hexA(rockLight, 0.55);
    for (let i = 0; i < 4; i++) {
      const px = cx - s * 0.18 + i * s * 0.12;
      ctx.beginPath();
      ctx.moveTo(px - s * 0.035, headY + s * 0.20);
      ctx.lineTo(px + s * 0.035, headY + s * 0.20);
      ctx.lineTo(px, headY + s * 0.31);
      ctx.closePath();
      ctx.fill();
    }

    // Глаза — огонь в глубине.
    bossEyes(ctx, cx, headY + s * 0.02, s * 0.92, pal, t, phase2,
      { spread: 0.20, size: 0.080 });
  }

  // ================================================================
  // 5. ТРЕЩИНЫ С ОГНЁМ — светятся изнутри.
  // ================================================================
  const crackSpecs = [
    [cx - s * 0.52, feet - s * 1.44, s * 1.05, 0.5],
    [cx + s * 0.58, feet - s * 1.54, s * 0.88, 2.2],
    [cx + s * 0.08, feet - s * 2.46, s * 0.70, 3.7],
    [cx - s * 0.70, feet - s * 2.10, s * 0.62, 1.3],
  ];
  const drawCrack = (x0, y0, len, seed, width, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    let x = x0, y = y0;
    for (let i = 0; i < 5; i++) {
      x += Math.sin(seed + i * 2.1) * s * 0.15;
      y -= len / 5;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  // Тёмная основа трещины.
  for (const [x, y, l, sd] of crackSpecs) {
    drawCrack(x, y, l, sd, s * 0.030, hexA(rockDeep, 0.85));
  }
  // Светящаяся сердцевина.
  const flick = 0.55 + Math.sin(t * (phase2 ? 4.5 : 2.2)) * 0.22 + (phase2 ? 0.22 : 0);
  for (const [x, y, l, sd] of crackSpecs) {
    drawCrack(x, y, l, sd, s * 0.012, hexA(glow, Math.min(1, flick)));
  }

  // ================================================================
  // 6. ВТОРАЯ ФОРМА — камень трескается, из щелей идёт пар.
  // ================================================================
  if (phase2) {
    // Ореол вокруг головы.
    const hg = ctx.createRadialGradient(cx, headY, s * 0.2, cx, headY, s * 1.4);
    hg.addColorStop(0, hexA(glow, 0.22));
    hg.addColorStop(1, hexA(glow, 0));
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.arc(cx, headY, s * 1.4, 0, Math.PI * 2);
    ctx.fill();

    // Обломки, парящие вокруг.
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + t * 0.4;
      const r = s * (1.5 + Math.sin(t + i) * 0.16);
      const bx = cx + Math.cos(a) * r;
      const by = feet - s * 1.75 + Math.sin(a) * r * 0.55;
      const sz = s * (0.07 + (i % 3) * 0.025);
      ctx.fillStyle = hexA(rock, 0.85);
      ctx.beginPath();
      ctx.moveTo(bx - sz, by + sz * 0.6);
      ctx.lineTo(bx + sz * 0.4, by - sz);
      ctx.lineTo(bx + sz, by + sz * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = hexA(glow, 0.45);
      ctx.lineWidth = s * 0.010;
      ctx.stroke();
    }
  }
}

// ------------------------------------------------------------------
// 4. ДРЕВНИЙ КРАСНЫЙ ДРАКОН (уровень 40)
// ------------------------------------------------------------------
function drawRedDragon(ctx, cx, baseY, s, pal, t, b, phase2) {
  // ================================================================
  // ДРЕВНИЙ КРАСНЫЙ ДРАКОН (уровень 40)
  //
  // Стиль — хорошая игровая графика: сильный читаемый силуэт,
  // правильные пропорции, ясная поза. Никакой погони за живописью
  // и никакой мелкой чешуи: фигура собирается из КРУПНЫХ форм,
  // потому что силуэт читается на любом размере окна, а чешуя — нет.
  //
  // ПОЗА — В ПРОФИЛЬ. Дракон стоит на четырёх лапах, тело
  // горизонтально, шея поднимается дугой, голова развёрнута к
  // зрителю-игроку (вправо). Так силуэт сразу читается как
  // «дракон», а не как «пятно»: видны спина, живот, лапы и хвост
  // отдельными объёмами.
  //
  // ПОРЯДОК ОТРИСОВКИ (от дальнего к ближнему):
  //   дальнее крыло → хвост → дальние лапы → корпус → живот →
  //   ближние лапы → шея → голова → ближнее крыло → гребень
  //
  // Все координаты в единицах s, стопы на baseY.
  // ================================================================

  const feet = baseY;
  const breathe = Math.sin(t * 1.05) * s * 0.035;
  const sway = Math.sin(t * 0.7) * s * 0.02;

  // --- Материалы ---------------------------------------------------
  const hide = pal.accent || '#a33d12';
  const hideMid = shade(hide, -0.18);
  const hideDark = shade(hide, -0.48);
  const hideDeep = shade(hide, -0.66);
  const hideLight = shade(hide, 0.26);
  const belly = '#b8712f';
  const bellyLight = '#e0a05c';
  const horn = '#d9ccb0';
  const hornDark = '#7f7053';
  const membrane = '#8d3418';
  const membraneLit = '#d0622c';

  // --- Каркас в профиль --------------------------------------------
  // Тело горизонтальное. Точка опоры передних лап — правее центра,
  // задних — левее. Голова уходит вправо и вверх.
  const shoulderX = cx + s * 0.32;
  const shoulderY = feet - s * 1.62 + breathe;
  const hipX = cx - s * 0.72;
  const hipY = feet - s * 1.52 + breathe;

  // ================================================================
  // 1. ДАЛЬНЕЕ КРЫЛО — уходит за спину, темнее ближнего.
  // ================================================================
  const flap = Math.sin(t * 1.2) * 0.06;

  const wingPath = (c, q, scale) => {
    // q: -1 дальнее, +1 ближнее. Крыло раскрыто вверх-назад.
    //
    // Контур описан как ОДИН обход по кругу: от плеча по передней
    // кромке вверх, по вершинам «пальцев» вниз и обратно по задней
    // кромке. Никаких промежуточных возвратов — иначе контур
    // пересекает сам себя и заливка даёт узкий клин.
    const A = [q * s * 0.05 - s * 0.55, -s * 1.32 * scale];   // вершина 1 (вверх-назад)
    const B = [q * s * 0.20 - s * 1.02, -s * 1.16 * scale];   // вершина 2
    const C = [q * s * 0.30 - s * 1.30, -s * 0.62 * scale];   // вершина 3
    const D = [q * s * 0.24 - s * 1.00, -s * 0.14 * scale];   // низ задней кромки

    c.moveTo(0, 0);
    // Передняя кромка к вершине 1 (вогнутая).
    c.quadraticCurveTo(q * s * 0.02 - s * 0.20, -s * 0.80 * scale, A[0], A[1]);
    // Между вершинами 1 и 2 — провис перепонки внутрь.
    c.quadraticCurveTo(q * s * 0.10 - s * 0.90, -s * 0.98 * scale, B[0], B[1]);
    // Между вершинами 2 и 3.
    c.quadraticCurveTo(q * s * 0.26 - s * 1.24, -s * 0.78 * scale, C[0], C[1]);
    // Между вершиной 3 и низом — замыкающая перепонка.
    c.quadraticCurveTo(q * s * 0.28 - s * 1.16, -s * 0.36 * scale, D[0], D[1]);
    // Задняя кромка обратно к плечу.
    c.quadraticCurveTo(q * s * 0.16 - s * 0.50, -s * 0.06 * scale, 0, 0);
    c.closePath();
  };

  const fingersPath = (c, q, scale) => {
    // Три кости-пальца: от плеча к каждой вершине.
    const bones = [
      [q * s * 0.05 - s * 0.55, -s * 1.32 * scale],
      [q * s * 0.20 - s * 1.02, -s * 1.16 * scale],
      [q * s * 0.30 - s * 1.30, -s * 0.62 * scale],
    ];
    for (const [tx, ty] of bones) {
      c.moveTo(0, 0);
      // Слегка выгнутая кость — прямая читалась бы как спица.
      c.quadraticCurveTo(tx * 0.52, ty * 0.52 + s * 0.06 * scale, tx, ty);
    }
  };

  // Дальнее крыло рисуется первым — оно позади тела.
  {
    const q = -1;
    const scale = 0.92;
    ctx.save();
    ctx.translate(shoulderX - s * 0.10, shoulderY - s * 0.06);
    ctx.rotate(flap * 0.7);

    const g = ctx.createLinearGradient(0, -s * 2.2, q * s * 1.4, 0);
    g.addColorStop(0, shade(membrane, -0.48));
    g.addColorStop(0.5, shade(membrane, -0.24));
    g.addColorStop(1, shade(membrane, 0.06));
    ctx.fillStyle = g;
    ctx.beginPath();
    wingPath(ctx, q, scale);
    ctx.fill();

    ctx.strokeStyle = hexA(hideDeep, 0.8);
    ctx.lineWidth = s * 0.05;
    ctx.lineCap = 'round';
    ctx.beginPath();
    fingersPath(ctx, q, scale);
    ctx.stroke();
    ctx.restore();
  }

  // ================================================================
  // 2. ХВОСТ — сужается от бедра к кончику, лежит на земле.
  // ================================================================
  {
    const tailSway = Math.sin(t * 0.9) * s * 0.06;

    // Хвост строится как СУЖАЮЩИЙСЯ КОНТУР, а не линией:
    // линия одинаковой толщины читалась как верёвка.
    // Опорная кривая хвоста.
    // Одна плавная кривая от бедра к кончику.
    // Раньше хвост склеивался из двух разных формул (до середины и
    // после), и на стыке получался излом — хвост выглядел молнией.
    const spine = (k) => {
      // Точка на дуге: у бедра круто вниз, дальше почти вдоль земли.
      const drop = Math.pow(1 - k, 1.6);
      return {
        x: hipX - s * (0.10 + k * 2.42),
        y: feet - s * 0.26 - s * 1.06 * drop + tailSway * k,
        w: s * (0.22 * (1 - k) + 0.012),
      };
    };

    const N = 14;
    const pts = [];
    for (let i = 0; i <= N; i++) pts.push(spine(i / N));

    const tailPath = (c) => {
      c.moveTo(pts[0].x, pts[0].y - pts[0].w);
      // Верхняя кромка.
      for (let i = 1; i < pts.length; i++) {
        const p0 = pts[i - 1], p1 = pts[i];
        c.quadraticCurveTo((p0.x + p1.x) / 2, (p0.y + p1.y) / 2 - (p0.w + p1.w) / 2,
                           p1.x, p1.y - p1.w);
      }
      // Нижняя кромка обратно.
      for (let i = pts.length - 1; i >= 0; i--) {
        c.lineTo(pts[i].x, pts[i].y + pts[i].w);
      }
      c.closePath();
    };

    // Заливка с объёмом: верх светлее, низ темнее.
    const tg = ctx.createLinearGradient(0, feet - s * 1.10, 0, feet);
    tg.addColorStop(0, hide);
    tg.addColorStop(0.55, hideMid);
    tg.addColorStop(1, hideDark);
    ctx.fillStyle = tg;
    ctx.beginPath();
    tailPath(ctx);
    ctx.fill();

    // Шипы вдоль верхней кромки, мельчают к концу.
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i];
      const hh = s * (0.30 - (i / pts.length) * 0.26);
      if (hh < s * 0.03) continue;
      ctx.fillStyle = shade(horn, -(0.20 + (i / pts.length) * 0.45));
      ctx.beginPath();
      ctx.moveTo(p.x + s * 0.05, p.y - p.w + s * 0.01);
      ctx.lineTo(p.x - s * 0.05, p.y - p.w + s * 0.01);
      ctx.lineTo(p.x - s * 0.09, p.y - p.w - hh);
      ctx.closePath();
      ctx.fill();
    }

    // Наконечник — роговое острие.
    const last = pts[pts.length - 1];
    ctx.fillStyle = horn;
    ctx.beginPath();
    ctx.moveTo(last.x + s * 0.04, last.y - s * 0.05);
    ctx.lineTo(last.x + s * 0.04, last.y + s * 0.05);
    ctx.lineTo(last.x - s * 0.26, last.y);
    ctx.closePath();
    ctx.fill();
  }

  // ================================================================
  // 3. ДАЛЬНИЕ ЛАПЫ — за корпусом, темнее.
  // ================================================================
  const legAt = (lx, ly, w, col, clawCol) => {
    // Лапа одним контуром: бедро → голень → стопа. Раньше это были
    // три отдельных эллипса, и лапа читалась как набор шаров,
    // не связанных с телом.
    const footY = feet - w * 0.42;
    const kneeX = lx + w * 0.34;
    const kneeY = ly + w * 1.52;

    ctx.fillStyle = col;
    ctx.beginPath();
    // Внешняя (задняя) кромка: от бедра вниз к пятке.
    ctx.moveTo(lx - w * 0.92, ly - w * 0.10);
    ctx.quadraticCurveTo(lx - w * 0.86, ly + w * 1.10, kneeX - w * 0.62, kneeY);
    ctx.quadraticCurveTo(kneeX - w * 0.40, footY - w * 0.30, kneeX - w * 0.30, footY);
    // Подошва.
    ctx.lineTo(kneeX + w * 0.86, footY + w * 0.04);
    // Передняя кромка вверх к бедру.
    ctx.quadraticCurveTo(kneeX + w * 0.78, footY - w * 0.36, kneeX + w * 0.52, kneeY);
    ctx.quadraticCurveTo(lx + w * 0.94, ly + w * 0.94, lx + w * 0.86, ly - w * 0.22);
    // Верх бедра — закругляется под корпус.
    ctx.quadraticCurveTo(lx, ly - w * 0.78, lx - w * 0.92, ly - w * 0.10);
    ctx.closePath();
    ctx.fill();

    // Когти на подошве.
    ctx.fillStyle = clawCol;
    for (let i = 0; i < 3; i++) {
      const cxp = kneeX + w * (0.16 + i * 0.34);
      ctx.beginPath();
      ctx.moveTo(cxp, footY + w * 0.02);
      ctx.lineTo(cxp + w * 0.26, footY + w * 0.04);
      ctx.lineTo(cxp + w * 0.06, footY + w * 0.30);
      ctx.closePath();
      ctx.fill();
    }
  };

  legAt(hipX - s * 0.18, hipY + s * 0.10, s * 0.30, hideDeep, hornDark);
  legAt(shoulderX - s * 0.22, shoulderY + s * 0.52, s * 0.24, hideDeep, hornDark);

  // ================================================================
  // 4. КОРПУС — единая масса от задней лапы до груди.
  // ================================================================
  {
    const bodyPath = (c) => {
      c.moveTo(hipX - s * 0.28, feet - s * 0.34);
      // Живот.
      c.quadraticCurveTo(
        hipX + s * 0.10, feet - s * 0.24,
        shoulderX - s * 0.10, feet - s * 0.46);
      // Грудь.
      c.quadraticCurveTo(
        shoulderX + s * 0.34, feet - s * 0.86,
        shoulderX + s * 0.42, shoulderY + s * 0.34);
      // Перед шеи.
      c.quadraticCurveTo(
        shoulderX + s * 0.30, shoulderY - s * 0.30,
        shoulderX - s * 0.02, shoulderY - s * 0.34);
      // Спина с горбом.
      c.quadraticCurveTo(
        cx - s * 0.24, shoulderY - s * 0.56,
        hipX - s * 0.06, hipY - s * 0.22);
      // Зад.
      c.quadraticCurveTo(
        hipX - s * 0.54, hipY + s * 0.06,
        hipX - s * 0.28, feet - s * 0.34);
      c.closePath();
    };

    const bg = ctx.createLinearGradient(0, shoulderY - s * 0.6, 0, feet);
    bg.addColorStop(0, hideLight);
    bg.addColorStop(0.34, hide);
    bg.addColorStop(0.72, hideMid);
    bg.addColorStop(1, hideDark);
    ctx.fillStyle = bg;
    ctx.beginPath();
    bodyPath(ctx);
    ctx.fill();

    // --- Живот: светлые поперечные пластины, читаемые как «брюхо».
    ctx.save();
    ctx.beginPath();
    bodyPath(ctx);
    ctx.clip();

    ctx.fillStyle = belly;
    ctx.beginPath();
    ctx.moveTo(hipX - s * 0.16, feet - s * 0.30);
    ctx.quadraticCurveTo(
      hipX + s * 0.18, feet - s * 0.20,
      shoulderX - s * 0.04, feet - s * 0.42);
    ctx.quadraticCurveTo(
      shoulderX + s * 0.16, feet - s * 0.78,
      shoulderX + s * 0.20, shoulderY + s * 0.30);
    ctx.lineTo(shoulderX - s * 0.16, shoulderY + s * 0.26);
    ctx.quadraticCurveTo(
      shoulderX - s * 0.10, feet - s * 0.80,
      hipX + s * 0.02, feet - s * 0.38);
    ctx.quadraticCurveTo(
      hipX - s * 0.06, feet - s * 0.36,
      hipX - s * 0.16, feet - s * 0.30);
    ctx.closePath();
    ctx.fill();

    // Пластины.
    ctx.strokeStyle = hexA(bellyLight, 0.55);
    ctx.lineWidth = s * 0.028;
    for (let i = 0; i < 7; i++) {
      const k = i / 7;
      const y0 = feet - s * (0.40 + k * 1.30);
      const x0 = hipX + s * (0.02 + k * 0.46);
      const wpl = s * (0.30 + k * 0.10);
      ctx.beginPath();
      ctx.moveTo(x0 - wpl, y0 + s * 0.05);
      ctx.quadraticCurveTo(x0, y0 - s * 0.06, x0 + wpl * 0.5, y0 + s * 0.03);
      ctx.stroke();
    }

    // --- Крупная чешуя: редкие пластины, не «сетка».
    ctx.strokeStyle = hexA(hideDeep, 0.30);
    ctx.lineWidth = s * 0.022;
    for (let i = 0; i < 5; i++) {
      const k = i / 5;
      const y0 = shoulderY - s * (0.10 + k * 0.26);
      for (let j = 0; j < 4; j++) {
        const x0 = hipX + s * (0.10 + j * 0.44);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(x0 + s * 0.16, y0 + s * 0.05, x0 + s * 0.32, y0);
        ctx.stroke();
      }
    }
    ctx.restore();

    // Контур корпуса — отделяет от фона.
    ctx.strokeStyle = hexA(hideDeep, 0.72);
    ctx.lineWidth = s * 0.030;
    ctx.beginPath();
    bodyPath(ctx);
    ctx.stroke();
  }

  // ================================================================
  // 5. БЛИЖНИЕ ЛАПЫ — передние и задняя, светлее дальних.
  // ================================================================
  legAt(hipX + s * 0.14, hipY + s * 0.20, s * 0.34, hideMid, hornDark);
  legAt(shoulderX + s * 0.06, shoulderY + s * 0.66, s * 0.28, hideMid, horn);

  // ================================================================
  // 8. БЛИЖНЕЕ КРЫЛО — поверх корпуса, светлее дальнего.
  // ================================================================
  {
    const q = 1;
    const scale = 1.06;
    ctx.save();
    ctx.translate(shoulderX - s * 0.06, shoulderY - s * 0.12);
    ctx.rotate(flap);

    const g = ctx.createLinearGradient(0, -s * 2.4, q * s * 1.6, 0);
    g.addColorStop(0, shade(membraneLit, 0.12));
    g.addColorStop(0.44, membraneLit);
    g.addColorStop(1, membrane);
    ctx.fillStyle = g;
    ctx.beginPath();
    wingPath(ctx, q, scale);
    ctx.fill();

    // Просвет сквозь перепонку.
    ctx.save();
    ctx.beginPath();
    wingPath(ctx, q, scale);
    ctx.clip();
    const glow = ctx.createRadialGradient(
      q * s * 0.5, -s * 1.3, 0, q * s * 0.5, -s * 1.3, s * 1.8);
    glow.addColorStop(0, 'rgba(255, 150, 78, 0.34)');
    glow.addColorStop(0.55, 'rgba(200, 78, 30, 0.13)');
    glow.addColorStop(1, 'rgba(110, 34, 12, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-s * 0.2, -s * 2.8, s * 2.4, s * 3.4);
    ctx.restore();

    // Кости пальцев — ТЁМНАЯ кожа, тонко.
    ctx.strokeStyle = hexA(hideDeep, 0.88);
    ctx.lineWidth = s * 0.052;
    ctx.lineCap = 'round';
    ctx.beginPath();
    fingersPath(ctx, q, scale);
    ctx.stroke();

    // Тонкий блик сверху костей.
    ctx.strokeStyle = hexA(hideLight, 0.34);
    ctx.lineWidth = s * 0.013;
    ctx.beginPath();
    fingersPath(ctx, q, scale);
    ctx.stroke();

    // Когти на концах пальцев.
    ctx.fillStyle = horn;
    for (const [tx, ty] of [
      [q * s * 0.05 - s * 0.55, -s * 1.32 * scale],
      [q * s * 0.20 - s * 1.02, -s * 1.16 * scale],
      [q * s * 0.30 - s * 1.30, -s * 0.62 * scale],
    ]) {
      const ang = Math.atan2(ty, tx);
      ctx.beginPath();
      ctx.moveTo(tx + Math.cos(ang) * s * 0.075, ty + Math.sin(ang) * s * 0.075);
      ctx.lineTo(tx + Math.cos(ang + 2.0) * s * 0.042, ty + Math.sin(ang + 2.0) * s * 0.042);
      ctx.lineTo(tx + Math.cos(ang - 2.0) * s * 0.042, ty + Math.sin(ang - 2.0) * s * 0.042);
      ctx.closePath();
      ctx.fill();
    }

    // Контур крыла.
    ctx.strokeStyle = hexA(hideDeep, 0.62);
    ctx.lineWidth = s * 0.026;
    ctx.beginPath();
    wingPath(ctx, q, scale);
    ctx.stroke();
    ctx.restore();
  }
  // ================================================================
  // 6. ШЕЯ — поднимается дугой вправо, с гребнем по задней кромке.
  // ================================================================
  const headX = shoulderX + s * 0.78;
  const headY = shoulderY - s * 1.10;

  {
    const neckPath = (c) => {
      // Задняя кромка (со стороны спины).
      // Контур строится строго по кругу, без самопересечения:
      //   задняя кромка (вверх) → торец у головы → горло (вниз) → низ.
      // Прежний вариант шёл зигзагом (точка вверх, потом резко вниз),
      // из-за чего контур пересекал сам себя и заливка давала узкий клин.
      // Шея — плавная S-образная колонна от груди к затылку.
      // Строится по кругу: задняя кромка вверх, торец, горло вниз.
      c.moveTo(shoulderX - s * 0.18, shoulderY - s * 0.06);
      // Задняя кромка: вверх и вправо, к затылку.
      c.quadraticCurveTo(
        shoulderX - s * 0.10, shoulderY - s * 0.86,
        headX - s * 0.42, headY - s * 0.02);
      // Торец у головы (широкий — шея не «спица»).
      c.quadraticCurveTo(
        headX - s * 0.34, headY - s * 0.26,
        headX - s * 0.06, headY - s * 0.22);
      // Горло: вниз и влево, к груди.
      c.quadraticCurveTo(
        shoulderX + s * 0.62, headY + s * 0.42,
        shoulderX + s * 0.40, shoulderY + s * 0.26);
      // Низ шеи смыкается с грудиной.
      c.quadraticCurveTo(
        shoulderX + s * 0.08, shoulderY + s * 0.30,
        shoulderX - s * 0.18, shoulderY - s * 0.06);
      c.closePath();
    };

    const ng = ctx.createLinearGradient(
      shoulderX - s * 0.2, shoulderY - s * 0.6, headX + s * 0.4, headY);
    ng.addColorStop(0, hideMid);
    ng.addColorStop(0.6, hide);
    ng.addColorStop(1, hideLight);
    ctx.fillStyle = ng;
    ctx.beginPath();
    neckPath(ctx);
    ctx.fill();

    // Горловая тень — шея получает объём.
    ctx.strokeStyle = hexA(hideDeep, 0.34);
    ctx.lineWidth = s * 0.055;
    ctx.beginPath();
    ctx.moveTo(shoulderX + s * 0.30, shoulderY + s * 0.12);
    ctx.quadraticCurveTo(
      shoulderX + s * 0.46, headY + s * 0.50,
      headX - s * 0.08, headY - s * 0.26);
    ctx.stroke();

    ctx.strokeStyle = hexA(hideDeep, 0.66);
    ctx.lineWidth = s * 0.026;
    ctx.beginPath();
    neckPath(ctx);
    ctx.stroke();
  }

  // ================================================================
  // 7. ГОЛОВА — вытянутая морда вправо, пасть приоткрыта.
  // ================================================================
  {
    const hx = headX;
    const hy = headY + sway;

    // Череп + морда единым контуром.
    const headPath = (c) => {
      c.moveTo(hx - s * 0.24, hy - s * 0.10);
      // Лоб.
      c.quadraticCurveTo(hx - s * 0.06, hy - s * 0.40, hx + s * 0.22, hy - s * 0.26);
      // Спинка носа.
      c.quadraticCurveTo(hx + s * 0.58, hy - s * 0.16, hx + s * 0.78, hy + s * 0.02);
      // Кончик носа.
      c.quadraticCurveTo(hx + s * 0.86, hy + s * 0.14, hx + s * 0.74, hy + s * 0.20);
      // Верхняя губа.
      c.quadraticCurveTo(hx + s * 0.50, hy + s * 0.24, hx + s * 0.30, hy + s * 0.22);
      // Нижняя челюсть.
      c.quadraticCurveTo(hx + s * 0.04, hy + s * 0.34, hx - s * 0.16, hy + s * 0.24);
      // Затылок.
      c.quadraticCurveTo(hx - s * 0.36, hy + s * 0.10, hx - s * 0.24, hy - s * 0.10);
      c.closePath();
    };

    const hg = ctx.createLinearGradient(hx - s * 0.3, hy - s * 0.4, hx + s * 0.8, hy + s * 0.3);
    hg.addColorStop(0, hideMid);
    hg.addColorStop(0.5, hide);
    hg.addColorStop(1, hideLight);
    ctx.fillStyle = hg;
    ctx.beginPath();
    headPath(ctx);
    ctx.fill();

    // Линия пасти.
    ctx.strokeStyle = hexA(hideDeep, 0.85);
    ctx.lineWidth = s * 0.030;
    ctx.beginPath();
    ctx.moveTo(hx + s * 0.78, hy + s * 0.10);
    ctx.quadraticCurveTo(hx + s * 0.48, hy + s * 0.16, hx + s * 0.16, hy + s * 0.16);
    ctx.stroke();

    // Зубы верхнего ряда.
    ctx.fillStyle = '#f4eedd';
    for (let i = 0; i < 5; i++) {
      const k = i / 5;
      const px = hx + s * (0.68 - k * 0.44);
      const py = hy + s * (0.10 + k * 0.05);
      const hh = s * (0.13 - k * 0.02);
      ctx.beginPath();
      ctx.moveTo(px - s * 0.035, py);
      ctx.lineTo(px + s * 0.035, py);
      ctx.lineTo(px, py + hh);
      ctx.closePath();
      ctx.fill();
    }

    // Язык / пламя в пасти.
    ctx.fillStyle = hexA('#ff8a3c', 0.75);
    ctx.beginPath();
    ctx.moveTo(hx + s * 0.62, hy + s * 0.18);
    ctx.quadraticCurveTo(hx + s * 0.42, hy + s * 0.30, hx + s * 0.22, hy + s * 0.22);
    ctx.quadraticCurveTo(hx + s * 0.44, hy + s * 0.24, hx + s * 0.62, hy + s * 0.18);
    ctx.closePath();
    ctx.fill();

    // Рога: два конуса назад-вверх, толстые у основания.
    // Рисуются залитым контуром, а не линией: линия одинаковой
    // толщины читалась как палка, торчащая из головы.
    for (const [bx, len, thick] of [
      [-0.16, 1.00, 0.090],
      [-0.06, 0.78, 0.070],
    ]) {
      const baseX = hx + s * bx;
      const baseYY = hy - s * 0.26;
      const tipX = baseX - s * (0.30 + len * 0.34);
      const tipY = baseYY - s * (0.22 + len * 0.40);
      ctx.fillStyle = horn;
      ctx.beginPath();
      ctx.moveTo(baseX - s * thick, baseYY + s * 0.04);
      // Внешняя кромка — выгнутая.
      ctx.quadraticCurveTo(
        baseX - s * 0.34, baseYY - s * 0.16,
        tipX, tipY);
      // Внутренняя кромка обратно к основанию.
      ctx.quadraticCurveTo(
        baseX - s * 0.18, baseYY - s * 0.10,
        baseX + s * thick, baseYY + s * 0.02);
      ctx.closePath();
      ctx.fill();
      // Тёмное основание — рог «сидит» в голове.
      ctx.fillStyle = hexA(hornDark, 0.55);
      ctx.beginPath();
      ctx.ellipse(baseX, baseYY + s * 0.02, s * thick * 1.1, s * 0.030, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Щёчная пластина.
    ctx.fillStyle = hexA(horn, 0.72);
    ctx.beginPath();
    ctx.moveTo(hx - s * 0.06, hy + s * 0.04);
    ctx.quadraticCurveTo(hx + s * 0.10, hy + s * 0.14, hx + s * 0.02, hy + s * 0.26);
    ctx.quadraticCurveTo(hx - s * 0.14, hy + s * 0.18, hx - s * 0.06, hy + s * 0.04);
    ctx.closePath();
    ctx.fill();

    bossEyes(ctx, hx + s * 0.16, hy - s * 0.02, s * 1.05, pal, t, phase2,
      { spread: 0.14, size: 0.085 });
  }


  // ================================================================
  // 9. ГРЕБЕНЬ ПО СПИНЕ — от затылка до хвоста.
  // ================================================================
  // Гребень: роговые пластины по хребту, наклонённые назад.
  // Цвет — приглушённый роговой, а не белый: белые треугольники
  // читались как декоративный забор поверх спины.
  for (let i = 0; i < 8; i++) {
    const k = i / 8;
    const px = shoulderX - s * (0.24 + k * 1.00);
    const py = shoulderY - s * (0.06 + Math.sin(k * 1.3) * 0.09) + breathe;
    const hh = s * (0.30 - k * 0.15);
    const lean = s * 0.14;
    // Затемнение к концу гребня — пластины «уходят» в хвост.
    ctx.fillStyle = shade(horn, -(0.34 + k * 0.30));
    ctx.beginPath();
    ctx.moveTo(px - s * 0.07, py + s * 0.07);
    ctx.lineTo(px + s * 0.07, py + s * 0.07);
    ctx.lineTo(px - lean, py - hh);
    ctx.closePath();
    ctx.fill();
    // Свет по передней кромке пластины.
    ctx.fillStyle = hexA(horn, 0.42);
    ctx.beginPath();
    ctx.moveTo(px - s * 0.07, py + s * 0.06);
    ctx.lineTo(px - s * 0.005, py + s * 0.06);
    ctx.lineTo(px - lean, py - hh);
    ctx.closePath();
    ctx.fill();
  }
  // 10. ОГНЕННОЕ ДЫХАНИЕ — только во второй форме.
  // ================================================================
  if (phase2) {
    const len = s * (1.5 + Math.sin(t * 5) * 0.22);
    const by = headY + s * 0.16;
    const bx = headX + s * 0.82;
    const fg = ctx.createLinearGradient(bx, by, bx + len, by + s * 0.3);
    fg.addColorStop(0, hexA('#fff2a8', 0.9));
    fg.addColorStop(0.34, hexA('#ffa03c', 0.72));
    fg.addColorStop(1, hexA('#ff3b18', 0));
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(bx, by - s * 0.10);
    ctx.quadraticCurveTo(bx + len * 0.55, by - s * 0.46, bx + len, by + s * 0.22);
    ctx.quadraticCurveTo(bx + len * 0.52, by + s * 0.62, bx, by + s * 0.20);
    ctx.closePath();
    ctx.fill();
  }
}


// ==================================================================
// Восстановленные стражи (были потеряны при правке файла)
// ==================================================================

function drawFrostGiant(ctx, cx, baseY, s, pal, t, b, phase2) {
  // ================================================================
  // ТРИМВАЛЬД, ЛЕДЯНОЙ ВЕЛИКАН (уровень 50) — «хорошая игровая графика».
  //
  // КТО ЭТО. Ледяной великан: тело изо льда, корона из шипов, иней.
  // Раньше это были плоские многоугольники одним цветом — «белая
  // фигура». Теперь ледяная глыба строится так же, как камень у
  // Скального великана: объёмные грани, свет изнутри, острые сколы.
  //
  // ПРИЁМ. Лёд отличается от камня не цветом, а ОПТИКОЙ:
  //   • тело полупрозрачное — сверху светится, снизу темнеет;
  //   • у каждой грани резкая светлая кромка (лед ломается плоскостями);
  //   • внутри — застывшие пузыри и светящееся ядро;
  //   • сосульки вместо волос и на руках.
  //
  // ПОРЯДОК: ноги → торс → руки → сосульки → голова → корона →
  // ядро свечения → иней.
  // ================================================================

  const feet = baseY;
  const breathe = Math.sin(t * 0.85) * s * 0.035;

  // --- Материалы ---------------------------------------------------
  const ice = '#8fd4f0';
  const iceLight = '#d8f2ff';
  const iceMid = '#6fb8dc';
  const iceDark = '#3d7ea6';
  const iceDeep = '#1f4a68';
  const glow = pal.glow;

  // --- Каркас ------------------------------------------------------
  const hipY = feet - s * 1.34;
  const chestY = feet - s * 2.32 + breathe;
  const shoulderY = feet - s * 2.74 + breathe;
  const headY = feet - s * 3.08 + breathe;

  // Грань льда: контур с вертикальным градиентом и резкой кромкой.
  const facet = (path, c0, c1, c2, edge) => {
    const g = ctx.createLinearGradient(0, feet - s * 3.3, 0, feet);
    g.addColorStop(0, c0);
    g.addColorStop(0.48, c1);
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.beginPath();
    path(ctx);
    ctx.fill();
    ctx.strokeStyle = hexA(edge || iceLight, 0.55);
    ctx.lineWidth = s * 0.018;
    ctx.beginPath();
    path(ctx);
    ctx.stroke();
  };

  // ================================================================
  // 1. НОГИ — ледяные колонны с острыми сколами.
  // ================================================================
  for (const [q, c0, c1, c2] of [
    [-1, iceMid, ice, iceDeep],
    [1, iceLight, iceMid, iceDark],
  ]) {
    const lx = cx + q * s * 0.40;
    const legPath = (c) => {
      c.moveTo(lx - s * 0.28, hipY + s * 0.08);
      c.lineTo(lx - s * 0.32, feet - s * 0.70);
      // Скол на ступне.
      c.lineTo(lx - s * 0.38, feet);
      c.lineTo(lx + s * 0.36, feet);
      c.lineTo(lx + s * 0.28, feet - s * 0.66);
      c.lineTo(lx + s * 0.24, hipY + s * 0.08);
      c.closePath();
    };
    facet(legPath, c0, c1, c2);

    // Светлая грань — ледокол.
    ctx.fillStyle = hexA(iceLight, 0.30);
    ctx.beginPath();
    ctx.moveTo(lx - s * 0.06, hipY + s * 0.14);
    ctx.lineTo(lx + s * 0.02, hipY + s * 0.14);
    ctx.lineTo(lx - s * 0.02, feet - s * 0.10);
    ctx.lineTo(lx - s * 0.14, feet - s * 0.10);
    ctx.closePath();
    ctx.fill();
  }

  // ================================================================
  // 2. ТОРС — ледяной кристалл с гранями.
  // ================================================================
  {
    const torsoPath = (c) => {
      c.moveTo(cx - s * 0.86, hipY + s * 0.04);
      c.lineTo(cx - s * 1.00, feet - s * 1.92);
      c.lineTo(cx - s * 0.72, shoulderY + s * 0.02);
      c.lineTo(cx - s * 0.24, shoulderY - s * 0.20);
      c.lineTo(cx + s * 0.24, shoulderY - s * 0.20);
      c.lineTo(cx + s * 0.72, shoulderY + s * 0.02);
      c.lineTo(cx + s * 1.00, feet - s * 1.92);
      c.lineTo(cx + s * 0.86, hipY + s * 0.04);
      c.closePath();
    };
    facet(torsoPath, iceLight, ice, iceDeep);

    // Правая грань — тёмная сторона (свет слева).
    ctx.save();
    ctx.beginPath();
    torsoPath(ctx);
    ctx.clip();
    const dg = ctx.createLinearGradient(cx, feet - s * 2.8, cx + s * 1.0, feet - s * 1.3);
    dg.addColorStop(0, hexA(iceDark, 0));
    dg.addColorStop(1, hexA(iceDark, 0.62));
    ctx.fillStyle = dg;
    ctx.fillRect(cx - s * 1.1, feet - s * 3.0, s * 2.2, s * 1.9);

    // Внутренние грани-молнии: лёд ломается плоскостями.
    ctx.strokeStyle = hexA(iceLight, 0.42);
    ctx.lineWidth = s * 0.014;
    for (let i = 0; i < 3; i++) {
      const k = i / 2;
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.10, feet - s * (2.66 - k * 0.10));
      ctx.lineTo(cx + s * (0.06 + k * 0.16), feet - s * (2.20 - k * 0.14));
      ctx.lineTo(cx - s * (0.04 + k * 0.12), feet - s * (1.80 - k * 0.10));
      ctx.stroke();
    }
    ctx.restore();

    // Рёбра-пластины на груди.
    for (let i = 0; i < 4; i++) {
      const py = feet - s * (1.56 + i * 0.26);
      ctx.strokeStyle = hexA(iceDeep, 0.42);
      ctx.lineWidth = s * 0.016;
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.60, py);
      ctx.quadraticCurveTo(cx, py - s * 0.09, cx + s * 0.60, py);
      ctx.stroke();
      ctx.strokeStyle = hexA(iceLight, 0.30);
      ctx.lineWidth = s * 0.010;
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.58, py + s * 0.030);
      ctx.quadraticCurveTo(cx, py - s * 0.060, cx + s * 0.58, py + s * 0.030);
      ctx.stroke();
    }
  }

  // ================================================================
  // 3. РУКИ — длинные, с ледяными наростами.
  // ================================================================
  for (const q of [-1, 1]) {
    const swing = Math.sin(t * 0.75 + (q > 0 ? 0 : 1.5)) * s * 0.055;
    const shX = cx + q * s * 0.86;
    const elbowX = cx + q * s * 1.30;
    const fistX = cx + q * s * 1.24;
    const fistY = feet - s * 1.02 + swing;

    const armPath = (c) => {
      c.moveTo(shX - q * s * 0.14, shoulderY + s * 0.04);
      c.quadraticCurveTo(
        elbowX + q * s * 0.16, feet - s * 2.10 + swing,
        elbowX + q * s * 0.06, fistY - s * 0.28);
      c.lineTo(fistX + s * 0.14 * q, fistY + s * 0.06);
      c.lineTo(fistX - s * 0.20 * q, fistY + s * 0.10);
      c.quadraticCurveTo(
        elbowX - q * s * 0.36, feet - s * 1.66 + swing,
        shX - q * s * 0.32, shoulderY + s * 0.20);
      c.closePath();
    };
    facet(armPath, iceLight, iceMid, iceDeep);

    // Кулак-кристалл.
    const fistPath = (c) => {
      c.moveTo(fistX - s * 0.22, fistY - s * 0.22);
      c.lineTo(fistX + s * 0.24, fistY - s * 0.26);
      c.lineTo(fistX + s * 0.26, fistY + s * 0.06);
      c.lineTo(fistX - s * 0.04, fistY + s * 0.28);
      c.lineTo(fistX - s * 0.24, fistY + s * 0.20);
      c.closePath();
    };
    facet(fistPath, iceLight, ice, iceDark);

    // Шипы на предплечье — наружу.
    ctx.fillStyle = hexA(glow, 0.85);
    for (let i = 0; i < 3; i++) {
      const py = feet - s * (2.28 - i * 0.34) + swing;
      const bx = elbowX - q * s * 0.04;
      ctx.beginPath();
      ctx.moveTo(bx, py);
      ctx.lineTo(bx + q * s * 0.36, py - s * 0.12);
      ctx.lineTo(bx + q * s * 0.04, py + s * 0.11);
      ctx.closePath();
      ctx.fill();
      // Светлая кромка шипа.
      ctx.strokeStyle = hexA(iceLight, 0.55);
      ctx.lineWidth = s * 0.010;
      ctx.stroke();
    }
  }

  // ================================================================
  // 4. ГОЛОВА — ледяной череп с короной.
  // ================================================================
  {
    const headPath = (c) => {
      c.moveTo(cx - s * 0.40, headY + s * 0.32);
      c.lineTo(cx - s * 0.46, headY - s * 0.12);
      c.lineTo(cx - s * 0.20, headY - s * 0.44);
      c.lineTo(cx + s * 0.20, headY - s * 0.44);
      c.lineTo(cx + s * 0.46, headY - s * 0.12);
      c.lineTo(cx + s * 0.38, headY + s * 0.32);
      c.closePath();
    };
    facet(headPath, iceLight, ice, iceDark);

    // Скулы-грани.
    ctx.strokeStyle = hexA(iceDeep, 0.40);
    ctx.lineWidth = s * 0.014;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.34, headY + s * 0.12);
    ctx.lineTo(cx - s * 0.10, headY + s * 0.20);
    ctx.moveTo(cx + s * 0.34, headY + s * 0.12);
    ctx.lineTo(cx + s * 0.10, headY + s * 0.20);
    ctx.stroke();

    // Сосульки-«борода».
    for (let i = 0; i < 5; i++) {
      const k = (i - 2) / 2;
      const bx = cx + k * s * 0.24;
      const hh = s * (0.30 - Math.abs(k) * 0.11);
      ctx.fillStyle = hexA(iceLight, 0.75);
      ctx.beginPath();
      ctx.moveTo(bx - s * 0.055, headY + s * 0.28);
      ctx.lineTo(bx + s * 0.055, headY + s * 0.28);
      ctx.lineTo(bx, headY + s * 0.28 + hh);
      ctx.closePath();
      ctx.fill();
    }

    // Корона: пять шипов, средний выше.
    for (let i = -2; i <= 2; i++) {
      const hh = s * (0.52 - Math.abs(i) * 0.11);
      const bx = cx + i * s * 0.19;
      const tipX = bx + i * s * 0.05;
      const tipY = headY - s * 0.40 - hh;
      ctx.fillStyle = hexA(glow, 0.92);
      ctx.beginPath();
      ctx.moveTo(bx - s * 0.075, headY - s * 0.34);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(bx + s * 0.075, headY - s * 0.34);
      ctx.closePath();
      ctx.fill();
      // Светлая кромка — лед.
      ctx.strokeStyle = hexA(iceLight, 0.70);
      ctx.lineWidth = s * 0.010;
      ctx.stroke();
      // Тёмная внутренняя грань.
      ctx.fillStyle = hexA(iceDeep, 0.30);
      ctx.beginPath();
      ctx.moveTo(bx, headY - s * 0.34);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(bx + s * 0.075, headY - s * 0.34);
      ctx.closePath();
      ctx.fill();
    }

    bossEyes(ctx, cx, headY + s * 0.02, s * 0.94, pal, t, phase2,
      { spread: 0.17, size: 0.078 });
  }

  // ================================================================
  // 5. СВЕТЯЩЕЕСЯ ЯДРО внутри груди — лёд просвечивает.
  // ================================================================
  {
    const coreY = feet - s * 1.92 + breathe;
    const pulse = 0.62 + Math.sin(t * 2.4) * 0.20 + (phase2 ? 0.16 : 0);
    const cg = ctx.createRadialGradient(cx, coreY, 0, cx, coreY, s * 0.62);
    cg.addColorStop(0, hexA(glow, 0.45 * pulse));
    cg.addColorStop(0.45, hexA(glow, 0.16 * pulse));
    cg.addColorStop(1, hexA(glow, 0));
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(cx, coreY, s * 0.62, 0, Math.PI * 2);
    ctx.fill();
  }

  // ================================================================
  // 6. ИНЕЙ — постоянно, во второй форме сильнее.
  // ================================================================
  const frostCount = phase2 ? 30 : 16;
  for (let i = 0; i < frostCount; i++) {
    const ph = i * 2.4;
    const fx = cx + Math.sin(t * 0.6 + ph) * s * 1.9;
    const fy = feet - s * (0.4 + ((t * 0.32 + i * 0.13) % 1) * 3.4);
    const sz = s * (0.018 + (i % 3) * 0.011);
    ctx.fillStyle = hexA('#ffffff', 0.42 + Math.sin(t * 2 + ph) * 0.18);
    ctx.beginPath();
    ctx.moveTo(fx, fy - sz * 1.6);
    ctx.lineTo(fx + sz, fy);
    ctx.lineTo(fx, fy + sz * 1.6);
    ctx.lineTo(fx - sz, fy);
    ctx.closePath();
    ctx.fill();
  }

  // ================================================================
  // 7. ВТОРАЯ ФОРМА — буря.
  // ================================================================
  if (phase2) {
    const hg = ctx.createRadialGradient(cx, feet - s * 1.9, s * 0.3, cx, feet - s * 1.9, s * 2.2);
    hg.addColorStop(0, hexA(glow, 0.20));
    hg.addColorStop(1, hexA(glow, 0));
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.arc(cx, feet - s * 1.9, s * 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Обломки льда вокруг.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + t * 0.5;
      const r = s * (1.55 + Math.sin(t + i) * 0.14);
      const bx = cx + Math.cos(a) * r;
      const by = feet - s * 1.85 + Math.sin(a) * r * 0.5;
      const sz = s * (0.06 + (i % 3) * 0.022);
      ctx.fillStyle = hexA(iceMid, 0.80);
      ctx.beginPath();
      ctx.moveTo(bx, by - sz * 1.5);
      ctx.lineTo(bx + sz, by + sz * 0.4);
      ctx.lineTo(bx - sz * 0.7, by + sz);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = hexA(iceLight, 0.55);
      ctx.lineWidth = s * 0.008;
      ctx.stroke();
    }
  }
}

function drawArchLich(ctx, cx, baseY, s, pal, t, b, phase2) {
  const feet = baseY;
  const float = Math.sin(t * 1.4) * s * 0.12;
  const fy = feet - s * 0.35 + float;

  // --- Тень под парящим личом.
  const sh = ctx.createRadialGradient(cx, feet + s * 0.05, 0, cx, feet + s * 0.05, s * 0.9);
  sh.addColorStop(0, hexA('#000000', 0.5));
  sh.addColorStop(1, hexA('#000000', 0));
  ctx.fillStyle = sh;
  ctx.beginPath();
  ctx.ellipse(cx, feet + s * 0.05, s * 0.9, s * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  // --- Рваная мантия, не касающаяся земли.
  ctx.fillStyle = pal.robe;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.75, fy - s * 1.7);
  ctx.quadraticCurveTo(cx - s * 1.15, fy - s * 0.5, cx - s * 0.85, fy + s * 0.1);
  // Рваный подол — волнами.
  for (let i = 0; i < 5; i++) {
    const x = cx - s * 0.85 + i * s * 0.42;
    ctx.quadraticCurveTo(x + s * 0.21, fy + s * 0.3 + Math.sin(t * 2 + i) * s * 0.08, x + s * 0.42, fy + s * 0.1);
  }
  ctx.quadraticCurveTo(cx + s * 1.15, fy - s * 0.5, cx + s * 0.75, fy - s * 1.7);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = hexA(pal.accent, 0.5);
  ctx.lineWidth = s * 0.035;
  ctx.stroke();

  // --- Посох в правой руке, с черепом наверху.
  ctx.strokeStyle = '#3a3020';
  ctx.lineWidth = s * 0.08;
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.95, fy + s * 0.05);
  ctx.lineTo(cx + s * 0.85, fy - s * 2.5);
  ctx.stroke();

  // Череп на посохе.
  const skullY = fy - s * 2.62 + Math.sin(t * 2.2) * s * 0.04;
  ctx.fillStyle = '#e8e2d2';
  ctx.beginPath();
  ctx.ellipse(cx + s * 0.85, skullY, s * 0.17, s * 0.19, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1018';
  for (const q of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(cx + s * 0.85 + q * s * 0.07, skullY - s * 0.02, s * 0.045, 0, Math.PI * 2);
    ctx.fill();
  }
  // Свечение в глазницах черепа.
  const skullGlow = 0.6 + Math.sin(t * 3.5) * 0.3;
  ctx.fillStyle = hexA(pal.glow, skullGlow);
  for (const q of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(cx + s * 0.85 + q * s * 0.07, skullY - s * 0.02, s * 0.025, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Капюшон и череп.
  const headY = fy - s * 2.15;
  ctx.fillStyle = shade(pal.robe, -0.3);
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.6, fy - s * 1.7);
  ctx.quadraticCurveTo(cx - s * 0.72, fy - s * 2.95, cx, fy - s * 3.05);
  ctx.quadraticCurveTo(cx + s * 0.72, fy - s * 2.95, cx + s * 0.6, fy - s * 1.7);
  ctx.closePath();
  ctx.fill();

  // Череп внутри капюшона.
  ctx.fillStyle = '#e8e2d2';
  ctx.beginPath();
  ctx.ellipse(cx, headY, s * 0.34, s * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
  // Челюсть.
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.2, headY + s * 0.28);
  ctx.lineTo(cx + s * 0.2, headY + s * 0.28);
  ctx.lineTo(cx + s * 0.14, headY + s * 0.55);
  ctx.lineTo(cx - s * 0.14, headY + s * 0.55);
  ctx.closePath();
  ctx.fill();

  bossEyes(ctx, cx, headY - s * 0.02, s, pal, t, phase2, { spread: 0.14, size: 0.075 });

  // Вторая форма: рой душ и костяные шипы.
  if (phase2) {
    for (let i = 0; i < 8; i++) {
      const ph = i * 1.7;
      const ax = cx + Math.sin(t * 0.9 + ph) * s * 1.9;
      const ay = fy - s * (1.0 + ((t * 0.3 + i * 0.12) % 1) * 3.0);
      const g = ctx.createRadialGradient(ax, ay, 0, ax, ay, s * 0.22);
      g.addColorStop(0, hexA(pal.glow, 0.55));
      g.addColorStop(1, hexA(pal.glow, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(ax, ay, s * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawNecromancer(ctx, cx, baseY, s, pal, t, b, phase2) {
  const feet = baseY;
  const breathe = Math.sin(t * 1.1) * s * 0.02;

  // Постоянные цвета. Палитра стража тёмная, но для мантии и лицa
  // нужны свои оттенки — иначе фигура сливается с фоном склепа.
  const ROBE_DARK = '#2e1f3a';
  const ROBE_MID = '#43305a';
  const ROBE_TRIM = '#8f6fd0';
  const BONE = '#ded5be';
  const FLESH = '#cfc0b4';

  // --- Круг призыва на полу. Рисуется ПЕРВЫМ: он под ногами.
  //
  // Это главный признак некроманта: он уже что-то вызвал. Круг
  // медленно вращается, из него поднимаются языки зелёного света.
  const summonGlow = 0.5 + Math.sin(t * 1.8) * 0.2;
  ctx.save();
  ctx.translate(cx, feet - s * 0.05);
  ctx.scale(1, 0.32);                  // сплющиваем круг в перспективе
  ctx.rotate(t * 0.18);
  ctx.strokeStyle = hexA(ROBE_TRIM, 0.55 * summonGlow);
  ctx.lineWidth = s * 0.05;
  ctx.beginPath();
  ctx.arc(0, 0, s * 2.1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = s * 0.025;
  ctx.beginPath();
  ctx.arc(0, 0, s * 1.75, 0, Math.PI * 2);
  ctx.stroke();
  // Пентаграмма внутри круга.
  ctx.beginPath();
  for (let i = 0; i <= 5; i++) {
    const a = (i * 2 / 5) * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(a) * s * 1.75;
    const py = Math.sin(a) * s * 1.75;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
  // Руны по ободу — короткие чёрточки.
  ctx.strokeStyle = hexA('#9fe87a', 0.4 * summonGlow);
  ctx.lineWidth = s * 0.03;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * s * 1.85, Math.sin(a) * s * 1.85);
    ctx.lineTo(Math.cos(a) * s * 2.03, Math.sin(a) * s * 2.03);
    ctx.stroke();
  }
  ctx.restore();

  // Языки света из круга — вертикально, поэтому вне сплющенной матрицы.
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + t * 0.18;
    const lx = cx + Math.cos(a) * s * 1.9;
    const h = s * (0.35 + Math.sin(t * 2.3 + i * 1.1) * 0.18 + 0.35);
    const g = ctx.createLinearGradient(lx, feet, lx, feet - h);
    g.addColorStop(0, hexA('#8ee85a', 0.42 * summonGlow));
    g.addColorStop(1, hexA('#8ee85a', 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(lx - s * 0.1, feet);
    ctx.quadraticCurveTo(lx - s * 0.05, feet - h * 0.6, lx, feet - h);
    ctx.quadraticCurveTo(lx + s * 0.05, feet - h * 0.6, lx + s * 0.1, feet);
    ctx.closePath();
    ctx.fill();
  }

  // --- Мантия до пола. Подол тяжёлый, стоит на земле.
  ctx.fillStyle = ROBE_DARK;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.34, feet - s * 2.30 + breathe);
  // Левый край вниз к подолу.
  ctx.quadraticCurveTo(cx - s * 0.60, feet - s * 1.30, cx - s * 1.02, feet - s * 0.02);
  // Подол — слегка волнистый, но стоит на земле.
  for (let i = 0; i < 6; i++) {
    const x0 = cx - s * 1.02 + i * s * 0.34;
    ctx.quadraticCurveTo(x0 + s * 0.17, feet + s * 0.10, x0 + s * 0.34, feet - s * 0.02);
  }
  ctx.quadraticCurveTo(cx + s * 0.60, feet - s * 1.30, cx + s * 0.34, feet - s * 2.30 + breathe);
  ctx.closePath();
  ctx.fill();

  // Блик по мантии — вертикальная полоса, чтобы объём читался.
  const rg = ctx.createLinearGradient(cx - s * 0.9, 0, cx + s * 0.9, 0);
  rg.addColorStop(0, hexA('#000000', 0.32));
  rg.addColorStop(0.42, hexA(ROBE_MID, 0.55));
  rg.addColorStop(1, hexA('#000000', 0.35));
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.34, feet - s * 2.30 + breathe);
  ctx.quadraticCurveTo(cx - s * 0.60, feet - s * 1.30, cx - s * 1.02, feet - s * 0.02);
  for (let i = 0; i < 6; i++) {
    const x0 = cx - s * 1.02 + i * s * 0.34;
    ctx.quadraticCurveTo(x0 + s * 0.17, feet + s * 0.10, x0 + s * 0.34, feet - s * 0.02);
  }
  ctx.quadraticCurveTo(cx + s * 0.60, feet - s * 1.30, cx + s * 0.34, feet - s * 2.30 + breathe);
  ctx.closePath();
  ctx.fill();

  // Кайма по подолу — тонкая светлая полоса с рунами.
  ctx.strokeStyle = hexA(ROBE_TRIM, 0.75);
  ctx.lineWidth = s * 0.045;
  ctx.beginPath();
  ctx.moveTo(cx - s * 1.00, feet - s * 0.12);
  for (let i = 0; i < 6; i++) {
    const x0 = cx - s * 1.00 + i * s * 0.34;
    ctx.quadraticCurveTo(x0 + s * 0.17, feet + s * 0.02, x0 + s * 0.34, feet - s * 0.12);
  }
  ctx.stroke();

  // --- Застёжка у горла: череп на цепочке.
  ctx.fillStyle = BONE;
  ctx.beginPath();
  ctx.ellipse(cx, feet - s * 2.18, s * 0.10, s * 0.11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1018';
  for (const q of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(cx + q * s * 0.04, feet - s * 2.20, s * 0.025, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- ЛЕВАЯ РУКА (от игрока — слева) держит свиток с призывом.
  const scrollY = feet - s * 1.45;
  ctx.strokeStyle = ROBE_MID;
  ctx.lineWidth = s * 0.20;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.36, feet - s * 1.95);
  ctx.quadraticCurveTo(cx - s * 0.78, feet - s * 1.70, cx - s * 0.86, scrollY);
  ctx.stroke();

  // Свиток: развёрнутый пергамент с рунами.
  ctx.save();
  ctx.translate(cx - s * 0.90, scrollY);
  ctx.rotate(-0.18);
  ctx.fillStyle = '#d9cfae';
  ctx.beginPath();
  ctx.moveTo(-s * 0.24, -s * 0.42);
  ctx.lineTo(s * 0.24, -s * 0.42);
  ctx.quadraticCurveTo(s * 0.30, 0, s * 0.24, s * 0.42);
  ctx.lineTo(-s * 0.24, s * 0.42);
  ctx.quadraticCurveTo(-s * 0.30, 0, -s * 0.24, -s * 0.42);
  ctx.closePath();
  ctx.fill();
  // Строки рун на свитке.
  ctx.strokeStyle = hexA('#5a3a2a', 0.75);
  ctx.lineWidth = s * 0.022;
  for (let i = 0; i < 5; i++) {
    const ly = -s * 0.28 + i * s * 0.14;
    ctx.beginPath();
    ctx.moveTo(-s * 0.17, ly);
    ctx.lineTo(s * 0.17, ly);
    ctx.stroke();
  }
  // Светящаяся руна посередине.
  const runeGlow = 0.6 + Math.sin(t * 3.0) * 0.3;
  ctx.strokeStyle = hexA('#9fe87a', runeGlow);
  ctx.lineWidth = s * 0.03;
  ctx.beginPath();
  ctx.moveTo(-s * 0.06, -s * 0.05);
  ctx.lineTo(0, -s * 0.18);
  ctx.lineTo(s * 0.06, -s * 0.05);
  ctx.moveTo(0, -s * 0.18);
  ctx.lineTo(0, s * 0.08);
  ctx.stroke();
  ctx.restore();

  // --- ПОСОХ в правой руке, упирается в землю, увенчан черепом.
  const staffX = cx + s * 0.95;
  ctx.strokeStyle = '#3a3020';
  ctx.lineWidth = s * 0.09;
  ctx.beginPath();
  ctx.moveTo(staffX, feet - s * 0.02);
  ctx.lineTo(staffX + s * 0.06, feet - s * 2.72);
  ctx.stroke();
  // Рука, сжимающая посох.
  ctx.strokeStyle = ROBE_MID;
  ctx.lineWidth = s * 0.20;
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.36, feet - s * 1.95);
  ctx.quadraticCurveTo(cx + s * 0.78, feet - s * 1.80, staffX, feet - s * 1.62);
  ctx.stroke();
  // Кисть.
  ctx.fillStyle = FLESH;
  ctx.beginPath();
  ctx.ellipse(staffX, feet - s * 1.62, s * 0.11, s * 0.10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Череп на посохе.
  const skullY = feet - s * 2.88;
  const skullGlow = 0.55 + Math.sin(t * 3.5) * 0.3;
  // Зелёный ореол вокруг черепа — свет некромантии.
  const sg = ctx.createRadialGradient(staffX, skullY, 0, staffX, skullY, s * 0.85);
  sg.addColorStop(0, hexA('#8ee85a', 0.32 * skullGlow));
  sg.addColorStop(1, hexA('#8ee85a', 0));
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.arc(staffX, skullY, s * 0.85, 0, Math.PI * 2);
  ctx.fill();
  // Кость.
  ctx.fillStyle = BONE;
  ctx.beginPath();
  ctx.ellipse(staffX + s * 0.06, skullY, s * 0.19, s * 0.21, 0, 0, Math.PI * 2);
  ctx.fill();
  // Челюсть.
  ctx.beginPath();
  ctx.moveTo(staffX + s * 0.06 - s * 0.12, skullY + s * 0.12);
  ctx.lineTo(staffX + s * 0.06 + s * 0.12, skullY + s * 0.12);
  ctx.lineTo(staffX + s * 0.06 + s * 0.08, skullY + s * 0.30);
  ctx.lineTo(staffX + s * 0.06 - s * 0.08, skullY + s * 0.30);
  ctx.closePath();
  ctx.fill();
  // Глазницы с зелёным огнём.
  ctx.fillStyle = '#12080f';
  for (const q of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(staffX + s * 0.06 + q * s * 0.075, skullY - s * 0.02, s * 0.055, s * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = hexA('#9fe87a', skullGlow + 0.25);
  for (const q of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(staffX + s * 0.06 + q * s * 0.075, skullY - s * 0.02, s * 0.032, 0, Math.PI * 2);
    ctx.fill();
  }
  // Зубы.
  ctx.fillStyle = '#b8ad96';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(staffX + s * 0.06 - s * 0.09 + i * s * 0.06, skullY + s * 0.16, s * 0.035, s * 0.07);
  }

  // --- КАПЮШОН и ЖИВОЕ ЛИЦО.
  //
  // Главное отличие от лича: под капюшоном не череп, а лицо человека.
  // Бледное, с крючковатым носом и запавшими глазами — так Векна
  // читается как некромант, а не как ещё одна нежить.
  const headY = feet - s * 2.55 + breathe;

  // Плечи и капюшон.
  ctx.fillStyle = ROBE_DARK;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.50, feet - s * 2.26);
  ctx.quadraticCurveTo(cx - s * 0.66, feet - s * 3.00, cx, feet - s * 3.12 + breathe);
  ctx.quadraticCurveTo(cx + s * 0.66, feet - s * 3.00, cx + s * 0.50, feet - s * 2.26);
  ctx.closePath();
  ctx.fill();

  // Тёмный провал капюшона — под ним будет лицо.
  ctx.fillStyle = '#0d0710';
  ctx.beginPath();
  ctx.ellipse(cx, headY, s * 0.36, s * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  // Лицо: бледное, вытянутое.
  const faceGrad = ctx.createLinearGradient(cx, headY - s * 0.3, cx, headY + s * 0.4);
  faceGrad.addColorStop(0, '#ded2c8');
  faceGrad.addColorStop(1, '#a9998e');
  ctx.fillStyle = faceGrad;
  ctx.beginPath();
  ctx.ellipse(cx, headY + s * 0.02, s * 0.27, s * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();

  // Скулы и впадины щёк — две тёмные дуги.
  ctx.fillStyle = hexA('#6b5a52', 0.42);
  for (const q of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + q * s * 0.15, headY + s * 0.14, s * 0.09, s * 0.15, q * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  // Глазницы запавшие, с ярким светом некромантии.
  const eyeY = headY - s * 0.06;
  const eyeGlow = 0.7 + Math.sin(t * 2.6) * 0.3;
  for (const q of [-1, 1]) {
    const ex = cx + q * s * 0.125;
    // Тёмная впадина.
    ctx.fillStyle = hexA('#20141c', 0.8);
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, s * 0.085, s * 0.062, 0, 0, Math.PI * 2);
    ctx.fill();
    // Светящийся зрачок.
    ctx.fillStyle = hexA('#9fe87a', eyeGlow);
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, s * 0.042, s * 0.042, 0, 0, Math.PI * 2);
    ctx.fill();
    // Ореол глаза.
    const eg = ctx.createRadialGradient(ex, eyeY, 0, ex, eyeY, s * 0.16);
    eg.addColorStop(0, hexA('#9fe87a', 0.4 * eyeGlow));
    eg.addColorStop(1, hexA('#9fe87a', 0));
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.arc(ex, eyeY, s * 0.16, 0, Math.PI * 2);
    ctx.fill();
    // Хмурая бровь над глазом.
    ctx.strokeStyle = hexA('#4a3a38', 0.8);
    ctx.lineWidth = s * 0.028;
    ctx.beginPath();
    ctx.moveTo(ex - q * s * 0.075, eyeY - s * 0.10);
    ctx.lineTo(ex + q * s * 0.070, eyeY - s * 0.14);
    ctx.stroke();
  }

  // Крючковатый нос — характерная черта.
  ctx.fillStyle = '#c6b6ac';
  ctx.beginPath();
  ctx.moveTo(cx, eyeY + s * 0.02);
  ctx.quadraticCurveTo(cx + s * 0.06, eyeY + s * 0.16, cx + s * 0.09, eyeY + s * 0.20);
  ctx.quadraticCurveTo(cx + s * 0.02, eyeY + s * 0.22, cx - s * 0.01, eyeY + s * 0.20);
  ctx.closePath();
  ctx.fill();
  // Тень под носом.
  ctx.fillStyle = hexA('#5a4a44', 0.5);
  ctx.beginPath();
  ctx.ellipse(cx + s * 0.02, eyeY + s * 0.23, s * 0.05, s * 0.022, 0, 0, Math.PI * 2);
  ctx.fill();

  // Тонкие поджатые губы.
  ctx.strokeStyle = hexA('#7a5a52', 0.85);
  ctx.lineWidth = s * 0.022;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.085, headY + s * 0.235);
  ctx.quadraticCurveTo(cx, headY + s * 0.255, cx + s * 0.085, headY + s * 0.235);
  ctx.stroke();

  // Длинные седые пряди, выбившиеся из-под капюшона.
  ctx.strokeStyle = hexA('#d8d2c4', 0.55);
  ctx.lineWidth = s * 0.022;
  for (const q of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      const sx0 = cx + q * s * (0.30 + i * 0.045);
      ctx.moveTo(sx0, headY - s * 0.10 + i * s * 0.05);
      ctx.quadraticCurveTo(
        sx0 + q * s * 0.06, headY + s * 0.30,
        sx0 + q * s * 0.02, headY + s * (0.55 + i * 0.07)
      );
      ctx.stroke();
    }
  }

  // Остроконечная шляпа/верх капюшона над лицом.
  ctx.fillStyle = shade(ROBE_DARK, 0.08);
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.46, headY - s * 0.22);
  ctx.quadraticCurveTo(cx - s * 0.30, headY - s * 0.72, cx - s * 0.02, headY - s * 0.80);
  ctx.quadraticCurveTo(cx + s * 0.34, headY - s * 0.70, cx + s * 0.46, headY - s * 0.22);
  ctx.quadraticCurveTo(cx, headY - s * 0.40, cx - s * 0.46, headY - s * 0.22);
  ctx.closePath();
  ctx.fill();

  // --- ДУШИ-СЛУГИ. Два призрака поднимаются из круга и висят у плеч.
  //
  // Это то, что отличает некроманта от просто тёмного мага: вокруг
  // него уже стоят те, кого он поднял.
  for (let i = 0; i < 2; i++) {
    const q = i === 0 ? -1 : 1;
    const bob = Math.sin(t * 1.3 + i * 2.1) * s * 0.10;
    const gx = cx + q * s * 1.62;
    const gy = feet - s * 1.15 + bob;
    const soulA = 0.5 + Math.sin(t * 2.0 + i * 1.5) * 0.18;

    // Тело призрака — вытянутое пламя.
    const pg = ctx.createLinearGradient(gx, gy - s * 0.7, gx, gy + s * 0.5);
    pg.addColorStop(0, hexA('#bfe8a0', 0.55 * soulA));
    pg.addColorStop(1, hexA('#8ee85a', 0));
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.moveTo(gx, gy - s * 0.78);
    ctx.quadraticCurveTo(gx + q * s * 0.30, gy - s * 0.20, gx + q * s * 0.18, gy + s * 0.42);
    ctx.quadraticCurveTo(gx, gy + s * 0.26, gx - q * s * 0.18, gy + s * 0.42);
    ctx.quadraticCurveTo(gx - q * s * 0.30, gy - s * 0.20, gx, gy - s * 0.78);
    ctx.closePath();
    ctx.fill();

    // Два глаза-огонька.
    ctx.fillStyle = hexA('#e8ffd0', 0.85 * soulA);
    for (const e of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(gx + e * s * 0.075, gy - s * 0.30, s * 0.030, s * 0.045, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // --- ВТОРАЯ ФОРМА: свиток рассыпается, души сгущаются в хоровод.
  if (phase2) {
    // Кольцо из душ вокруг фигуры.
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + t * 0.5;
      const r = s * (1.95 + Math.sin(t * 1.7 + i) * 0.22);
      const px = cx + Math.cos(a) * r;
      const py = feet - s * 1.75 + Math.sin(a) * r * 0.34 + Math.sin(t * 2.2 + i * 1.3) * s * 0.14;
      const sg2 = ctx.createRadialGradient(px, py, 0, px, py, s * 0.26);
      sg2.addColorStop(0, hexA('#9fe87a', 0.6));
      sg2.addColorStop(1, hexA('#9fe87a', 0));
      ctx.fillStyle = sg2;
      ctx.beginPath();
      ctx.arc(px, py, s * 0.26, 0, Math.PI * 2);
      ctx.fill();
      // Огонёк-глаз в каждой душе.
      ctx.fillStyle = hexA('#eaffd8', 0.8);
      ctx.beginPath();
      ctx.arc(px, py, s * 0.035, 0, Math.PI * 2);
      ctx.fill();
    }

    // Костяные руки, тянущиеся из круга — земля отдаёт мёртвых.
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI * 0.5 + (i - 2) * 0.45;
      const hx = cx + Math.cos(a) * s * 1.55;
      const lift = s * (0.30 + Math.sin(t * 1.9 + i * 1.4) * 0.20 + 0.20);
      ctx.strokeStyle = hexA(BONE, 0.85);
      ctx.lineWidth = s * 0.055;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(hx, feet - s * 0.02);
      ctx.lineTo(hx + Math.cos(a) * s * 0.14, feet - lift);
      ctx.stroke();
      // Пальцы.
      ctx.lineWidth = s * 0.032;
      for (let f = -1; f <= 1; f++) {
        ctx.beginPath();
        ctx.moveTo(hx + Math.cos(a) * s * 0.14, feet - lift);
        ctx.lineTo(
          hx + Math.cos(a) * s * 0.14 + f * s * 0.06,
          feet - lift - s * 0.10
        );
        ctx.stroke();
      }
    }
  }
}

function drawTiamat(ctx, cx, baseY, s, pal, t, b, phase2) {
  const feet = baseY;
  const breathe = Math.sin(t * 1.0) * s * 0.08;

  // Пропорции. Раньше корпус был широким, а головы мелкими: силуэт
  // читался как "дракон с шипами", и пять голов терялись на его фоне.
  // Теперь наоборот - корпус сжат, а головы крупные и с деталями.
  //
  //   BODY - общий множитель корпуса (было 1.0)
  //   HEAD - множитель голов (было 1.0)
  const BODY = 0.74;
  const HEAD = 1.52;

  const HEAD_COLORS = ['#f2f4ff', '#2a2030', '#3fa35a', '#4a8fd8', '#d8402a'];

  // --- Крылья - огромные, за спиной.
  const flap = Math.sin(t * 1.2) * 0.14;
  for (const q of [-1, 1]) {
    ctx.save();
    ctx.translate(cx + q * s * 0.85 * BODY, feet - s * 2.9 * BODY + breathe);
    ctx.scale(q, 1);
    ctx.rotate(flap);
    ctx.fillStyle = hexA('#6d4a8c', 0.9);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(s * 2.0, -s * 2.0, s * 3.4, -s * 1.0);
    ctx.lineTo(s * 3.0, s * 0.35);
    ctx.lineTo(s * 2.5, -s * 0.3);
    ctx.lineTo(s * 2.1, s * 0.75);
    ctx.lineTo(s * 1.6, s * 0.05);
    ctx.lineTo(s * 1.2, s * 0.9);
    ctx.quadraticCurveTo(s * 0.5, s * 0.55, 0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = hexA(pal.glow, 0.4);
    ctx.lineWidth = s * 0.05;
    ctx.stroke();
    ctx.restore();
  }

  // --- Хвост.
  const sway = Math.sin(t * 0.9) * s * 0.35;
  ctx.strokeStyle = '#5a3f78';
  ctx.lineWidth = s * 0.42 * BODY;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.5 * BODY, feet - s * 1.4 * BODY);
  ctx.quadraticCurveTo(cx + s * 2.2 * BODY, feet - s * 1.0 * BODY, cx + s * 3.0 * BODY + sway, feet - s * 0.2);
  ctx.stroke();

  // --- Тело.
  ctx.fillStyle = '#6d4a8c';
  ctx.beginPath();
  ctx.moveTo(cx - s * 1.15 * BODY, feet - s * 0.25);
  ctx.quadraticCurveTo(cx - s * 1.35 * BODY, feet - s * 2.3 * BODY, cx - s * 0.65 * BODY, feet - s * 3.0 * BODY + breathe);
  ctx.lineTo(cx + s * 0.65 * BODY, feet - s * 3.0 * BODY + breathe);
  ctx.quadraticCurveTo(cx + s * 1.35 * BODY, feet - s * 2.3 * BODY, cx + s * 1.15 * BODY, feet - s * 0.25);
  ctx.closePath();
  ctx.fill();

  // Чешуя на груди - ряд тёмных пластин по корпусу.
  ctx.fillStyle = hexA('#4a2f66', 0.55);
  for (let r = 0; r < 4; r++) {
    const ry = feet - s * (0.9 + r * 0.5) * BODY;
    for (let c2 = -2; c2 <= 2; c2++) {
      ctx.beginPath();
      ctx.ellipse(cx + c2 * s * 0.26 * BODY, ry, s * 0.12 * BODY, s * 0.08 * BODY, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Лапы с когтями.
  ctx.fillStyle = '#553a72';
  for (const q of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + q * s * 0.72 * BODY, feet - s * 0.18, s * 0.36 * BODY, s * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#efe6cf';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + q * s * 0.72 * BODY + i * s * 0.12, feet - s * 0.1);
      ctx.lineTo(cx + q * s * 0.72 * BODY + i * s * 0.12 + q * s * 0.06, feet);
      ctx.lineTo(cx + q * s * 0.72 * BODY + i * s * 0.12 + q * s * 0.12, feet - s * 0.1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#553a72';
  }

  // --- ПЯТЬ ГОЛОВ на длинных шеях, каждая в своей стихии.
  const necks = [
    { dx: -1.14, dy: -2.28, r: 0.30 * HEAD, col: 0, style: 'ice' },
    { dx: 1.14, dy: -2.28, r: 0.30 * HEAD, col: 1, style: 'acid' },
    { dx: -0.60, dy: -2.70, r: 0.32 * HEAD, col: 2, style: 'poison' },
    { dx: 0.60, dy: -2.70, r: 0.32 * HEAD, col: 3, style: 'storm' },
    { dx: 0, dy: -3.10, r: 0.35 * HEAD, col: 4, style: 'fire' },
  ];
  for (let i = 0; i < necks.length; i++) {
    const n = necks[i];
    // Явный типизированный доступ: старые движки не любят сложных выражений.
    const r = n.r;
    const col = HEAD_COLORS[n.col];
    const ncol = n.col;
    const style = n.style;
    const hx = cx + n.dx * s;
    const hy = feet + n.dy * s + breathe + Math.sin(t * 1.6 + i * 0.8) * s * 0.06;

    // Шея: толще у основания, тоньше у головы - рисуем двумя штрихами.
    ctx.strokeStyle = col;
    ctx.lineWidth = s * r * 1.15;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + n.dx * s * 0.32, feet - s * 2.55 * BODY + breathe);
    ctx.quadraticCurveTo(cx + n.dx * s * 0.85, (feet - s * 2.55 * BODY + hy) / 2, hx, hy + s * r * 1.0);
    ctx.stroke();
    // Блик по шее.
    ctx.strokeStyle = hexA('#ffffff', 0.16);
    ctx.lineWidth = s * r * 0.32;
    ctx.beginPath();
    ctx.moveTo(cx + n.dx * s * 0.38, feet - s * 2.55 * BODY + breathe);
    ctx.quadraticCurveTo(cx + n.dx * s * 0.88, (feet - s * 2.55 * BODY + hy) / 2, hx, hy + s * r * 0.95);
    ctx.stroke();

    // --- ЧЕРЕП: овал с надбровной дугой.
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(hx, hy, s * r * 1.25, s * r * 0.92, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hexA('#000000', 0.22);
    ctx.beginPath();
    ctx.ellipse(hx, hy - s * r * 0.42, s * r * 1.05, s * r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // --- Морда вперёд.
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(hx - s * r * 0.58, hy + s * r * 0.15);
    ctx.lineTo(hx + s * r * 0.58, hy + s * r * 0.15);
    ctx.lineTo(hx, hy + s * r * 1.25);
    ctx.closePath();
    ctx.fill();

    // --- ПАСТЬ: тёмный провал со змеиными зубами.
    ctx.fillStyle = hexA('#160d1c', 0.92);
    ctx.beginPath();
    ctx.ellipse(hx, hy + s * r * 0.72, s * r * 0.46, s * r * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f0e8d2';
    for (let k = -2; k <= 2; k++) {
      const tx = hx + k * s * r * 0.17;
      const th = s * r * (0.16 - Math.abs(k) * 0.02);
      ctx.beginPath();
      ctx.moveTo(tx - s * r * 0.05, hy + s * r * 0.54);
      ctx.lineTo(tx + s * r * 0.05, hy + s * r * 0.54);
      ctx.lineTo(tx, hy + s * r * 0.54 + th);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(tx - s * r * 0.045, hy + s * r * 0.92);
      ctx.lineTo(tx + s * r * 0.045, hy + s * r * 0.92);
      ctx.lineTo(tx, hy + s * r * 0.92 - th * 0.7);
      ctx.closePath();
      ctx.fill();
    }

    // --- РОГА загнутые назад.
    ctx.strokeStyle = '#e8dcc0';
    ctx.lineWidth = s * r * 0.2;
    ctx.lineCap = 'round';
    for (const q of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(hx + q * s * r * 0.62, hy - s * r * 0.5);
      ctx.quadraticCurveTo(hx + q * s * r * 1.25, hy - s * r * 1.15, hx + q * s * r * 0.95, hy - s * r * 1.62);
      ctx.stroke();
    }
    // Костяной гребень по макушке - три шипа.
    ctx.fillStyle = hexA('#e8dcc0', 0.85);
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(hx + k * s * r * 0.24 - s * r * 0.08, hy - s * r * 0.78);
      ctx.lineTo(hx + k * s * r * 0.24 + s * r * 0.08, hy - s * r * 0.78);
      ctx.lineTo(hx + k * s * r * 0.24, hy - s * r * (1.05 + (k === 0 ? 0.16 : 0)));
      ctx.closePath();
      ctx.fill();
    }

    // --- ГЛАЗА: глазница, светящийся зрачок, вертикальная щель.
    const eyeGlow = 0.7 + Math.sin(t * 3 + i) * 0.3;
    for (const q of [-1, 1]) {
      const ex = hx + q * s * r * 0.44;
      const ey = hy - s * r * 0.12;
      ctx.fillStyle = hexA('#0a0610', 0.72);
      ctx.beginPath();
      ctx.ellipse(ex, ey, s * r * 0.24, s * r * 0.16, q * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = hexA('#ffd75a', eyeGlow);
      ctx.beginPath();
      ctx.ellipse(ex, ey, s * r * 0.15, s * r * 0.08, q * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = hexA('#12060a', 0.9);
      ctx.beginPath();
      ctx.ellipse(ex, ey, s * r * 0.04, s * r * 0.075, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ноздри.
    ctx.fillStyle = hexA('#12060a', 0.8);
    for (const q of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(hx + q * s * r * 0.17, hy + s * r * 0.95, s * r * 0.055, s * r * 0.04, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- СТИХИЯ ГОЛОВЫ. Раньше пять голов отличались только цветом.
    // Теперь у каждой свой признак, по которому видно, какая голова
    // готовит вдох.
    const pulse = 0.6 + Math.sin(t * 2.4 + i * 1.7) * 0.4;
    if (style === 'fire') {
      for (let k = 0; k < 5; k++) {
        const ph = (t * 0.9 + k * 0.2) % 1;
        ctx.fillStyle = hexA('#ff8a30', (1 - ph) * 0.5);
        ctx.beginPath();
        ctx.ellipse(hx + (k - 2) * s * r * 0.2, hy + s * r * (1.25 + ph * 0.5),
          s * r * 0.09 * (1 - ph * 0.5), s * r * 0.16 * (1 - ph * 0.5), 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (style === 'ice') {
      ctx.fillStyle = hexA('#cfeeff', 0.85 * pulse);
      for (let k = 0; k < 3; k++) {
        const ix = hx + (k - 1) * s * r * 0.45;
        const iy = hy - s * r * (0.95 + (k === 1 ? 0.2 : 0));
        ctx.beginPath();
        ctx.moveTo(ix - s * r * 0.07, iy);
        ctx.lineTo(ix, iy - s * r * 0.32);
        ctx.lineTo(ix + s * r * 0.07, iy);
        ctx.closePath();
        ctx.fill();
      }
    } else if (style === 'acid') {
      ctx.fillStyle = hexA('#8ee85a', 0.7 * pulse);
      for (let k = 0; k < 3; k++) {
        const dy2 = (t * 1.4 + k * 0.4) % 1;
        ctx.beginPath();
        ctx.ellipse(hx + (k - 1) * s * r * 0.22, hy + s * r * (0.95 + dy2 * 0.55),
          s * r * 0.05, s * r * (0.09 - dy2 * 0.04), 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (style === 'storm') {
      ctx.strokeStyle = hexA('#bfe4ff', 0.8 * pulse);
      ctx.lineWidth = s * r * 0.05;
      ctx.beginPath();
      const sx0 = hx - s * r * 0.3;
      const sy0 = hy - s * r * 1.35;
      ctx.moveTo(sx0, sy0);
      ctx.lineTo(sx0 + s * r * 0.22, sy0 + s * r * 0.25);
      ctx.lineTo(sx0 + s * r * 0.05, sy0 + s * r * 0.32);
      ctx.lineTo(sx0 + s * r * 0.3, sy0 + s * r * 0.62);
      ctx.stroke();
    } else if (style === 'poison') {
      for (let k = 0; k < 3; k++) {
        const ph = (t * 0.6 + k * 0.33) % 1;
        ctx.fillStyle = hexA('#7fe0a0', (1 - ph) * 0.35);
        ctx.beginPath();
        ctx.arc(hx + (k - 1) * s * r * 0.3, hy + s * r * (1.3 + ph * 0.7), s * r * (0.14 + ph * 0.16), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Ореол вокруг головы.
    const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, s * r * 2.6);
    hg.addColorStop(0, hexA(col, 0.3));
    hg.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.arc(hx, hy, s * r * 2.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Вторая форма: каждая голова дышит своей стихией.
  if (phase2) {
    for (let i = 0; i < necks.length; i++) {
      const n = necks[i];
      const hx = cx + n.dx * s;
      const hy = feet + n.dy * s + breathe;
      const len = s * (0.7 + Math.sin(t * 4 + i * 1.3) * 0.2);
      const by = hy + s * n.r * 0.9;
      const g = ctx.createLinearGradient(hx, by, hx, by + len);
      g.addColorStop(0, hexA(HEAD_COLORS[n.col], 0.85));
      g.addColorStop(1, hexA(HEAD_COLORS[n.col], 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(hx - s * n.r * 0.3, by);
      ctx.quadraticCurveTo(hx - s * n.r * 0.5, by + len * 0.6, hx, by + len);
      ctx.quadraticCurveTo(hx + s * n.r * 0.5, by + len * 0.6, hx + s * n.r * 0.3, by);
      ctx.closePath();
      ctx.fill();
    }
  }
}

export function drawBossCreature(ctx, cx, baseY, scale, enemy, t, state = {}) {
  const pal = enemy.palette;
  const phase2 = state.phase === 2;
  const breathe = Math.sin(t * 1.2) * scale * 0.06;

  // Во второй форме страж подрастает прямо на глазах.
  const s = scale * (phase2 ? 1.12 : 1);

  ctx.save();

  // Ореол ярости — до тела, чтобы свет шёл из-за спины.
  if (phase2) rageAura(ctx, cx, baseY, s, pal, t);

  switch (enemy.creature) {
    case 'koboldpriest': drawKoboldPriest(ctx, cx, baseY, s, pal, t, breathe, phase2); break;
    case 'sphinx':       drawSphinx(ctx, cx, baseY, s, pal, t, breathe, phase2); break;
    case 'stonegiant':   drawStoneGiant(ctx, cx, baseY, s, pal, t, breathe, phase2); break;
    case 'reddragon':    drawRedDragon(ctx, cx, baseY, s, pal, t, breathe, phase2); break;
    case 'frostgiant':   drawFrostGiant(ctx, cx, baseY, s, pal, t, breathe, phase2); break;
    case 'necromancer':  drawNecromancer(ctx, cx, baseY, s, pal, t, breathe, phase2); break;
    case 'archlich':     drawArchLich(ctx, cx, baseY, s, pal, t, breathe, phase2); break;
    case 'tiamat':       drawTiamat(ctx, cx, baseY, s, pal, t, breathe, phase2); break;
    default: break;
  }

  // Трещины во второй форме — кроме лича (он бесплотный) и Тиамат
  // (у неё своё свечение голов).
  if (phase2 && enemy.creature !== 'archlich' && enemy.creature !== 'tiamat') {
    phaseCracks(ctx, cx, baseY, s, pal, t);
  }

  ctx.restore();
}
