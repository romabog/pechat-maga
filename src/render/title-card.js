/**
 * ЗАСТАВКИ: вступительная и предсмертная.
 *
 * Оба экрана — полноэкранные анимированные титры на canvas, нарисованные
 * кодом (никаких картинок и видео). Общая идея одна: вращающаяся печать
 * мага — круг, гексаграмма и руны, которые прочерчиваются на глазах.
 *
 *   Вступление — печать собирается из ничего, проявляется название,
 *                затем подсказка «нажмите». Ждёт клика (но не бесконечно:
 *                есть страховочный таймаут, иначе игрок застрянет).
 *   Смерть     — печать трескается и распадается, экран заливает тьма,
 *                и только после этого показывается экран поражения.
 *                Раньше панель поражения выскакивала в тот же кадр, что
 *                и последний удар, — заставки не было видно вообще.
 */

/** Длительность предсмертной заставки, секунды. */
export const DEATH_CARD_LEN = 3.4;

/** Страховочный предел вступления: дальше ждать клика нельзя. */
export const INTRO_MAX = 14;

/** Момент, с которого вступление пускает по клику. */
export const INTRO_READY = 5.4;

/** Виды заставок. */
export const CARD_INTRO = 'intro';
export const CARD_DEATH = 'death';

export function createIntro() { return { kind: CARD_INTRO, t: 0 }; }
export function createDeath() { return { kind: CARD_DEATH, t: 0 }; }

export function updateCard(card, dt) { card.t += dt; }

/**
 * Пора ли заканчивать заставку самой.
 * Вступление ждёт клика, но не дольше INTRO_MAX; смерть — строго по сроку.
 */
export function cardExpired(card) {
  if (card.kind === CARD_DEATH) return card.t >= DEATH_CARD_LEN;
  return card.t >= INTRO_MAX;
}

/** Пускает ли заставка себя пропустить (для вступления — после прочтения). */
export function cardSkippable(card) {
  if (card.kind === CARD_DEATH) return card.t >= 0.6;
  return card.t >= INTRO_READY;
}

/** Плавная рампа 0..1 на отрезке [a, b]. */
function ramp(t, a, b) {
  if (b <= a) return t >= b ? 1 : 0;
  const k = (t - a) / (b - a);
  return k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k); // сглаживание
}

function hexA(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Звёздная пыль: медленно всплывающие искры. */
function drawEmbers(c, W, H, t, count, color, alpha) {
  c.save();
  for (let i = 0; i < count; i++) {
    const seed = i * 12.9898;
    const x = ((Math.sin(seed) * 43758.5453) % 1 + 1) % 1;
    const sp = 0.02 + (((Math.sin(seed * 1.7) * 12345.6789) % 1 + 1) % 1) * 0.05;
    const y = 1 - (((t * sp + x) % 1));
    const r = 0.8 + (((Math.sin(seed * 2.3) * 9876.543) % 1 + 1) % 1) * 1.6;
    c.globalAlpha = alpha * (0.25 + 0.75 * Math.sin(y * Math.PI));
    c.fillStyle = color;
    c.beginPath();
    c.arc(x * W, y * H, r, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

/**
 * Печать мага. Каждый элемент появляется со своим временем, поэтому
 * круг «собирается» постепенно, а не вспыхивает целиком.
 *
 * @param {number} p  прогресс сборки 0..1
 * @param {number} br развал 0..1 (для предсмертной: 0 — целая, 1 — прах)
 */
function drawSeal(c, cx, cy, R, t, p, br, color, glow) {
  const broken = br > 0;
  c.save();
  c.translate(cx, cy);

  // Развал: печать слегка раскалывается и оседает.
  if (broken) {
    c.rotate(br * 0.12);
    c.scale(1 + br * 0.22, 1 + br * 0.22);
  }

  const spin = t * 0.12 + br * 0.9;
  c.rotate(spin);

  // --- Внешнее кольцо: прочерчивается по дуге.
  const a0 = -Math.PI / 2;
  const a1 = a0 + Math.PI * 2 * ramp(p, 0, 0.45);
  c.strokeStyle = hexA(color, broken ? 0.9 * (1 - br) : 0.85);
  c.lineWidth = Math.max(1.4, R * 0.012);
  c.shadowColor = glow;
  c.shadowBlur = R * 0.22;
  c.beginPath();
  c.arc(0, 0, R, a0, a1);
  c.stroke();

  // --- Внутреннее кольцо.
  if (p > 0.3) {
    c.strokeStyle = hexA(color, 0.5 * ramp(p, 0.3, 0.6));
    c.lineWidth = Math.max(1, R * 0.007);
    c.beginPath();
    c.arc(0, 0, R * 0.86, 0, Math.PI * 2 * ramp(p, 0.3, 0.75));
    c.stroke();
  }

  // --- Гексаграмма: два треугольника.
  if (p > 0.45) {
    const tri = (off) => {
      c.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = off + (i * Math.PI * 2) / 3;
        const x = Math.cos(a) * R * 0.86;
        const y = Math.sin(a) * R * 0.86;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.closePath();
      c.stroke();
    };
    c.strokeStyle = hexA(color, 0.62 * ramp(p, 0.45, 0.8));
    c.lineWidth = Math.max(1, R * 0.008);
    // Каждый треугольник растёт отдельно, чтобы линии «писались».
    c.save();
    c.globalAlpha = ramp(p, 0.45, 0.65);
    tri(-Math.PI / 2);
    c.restore();
    c.save();
    c.globalAlpha = ramp(p, 0.6, 0.8);
    tri(Math.PI / 2);
    c.restore();
  }

  // --- Руны по кругу: короткие штрихи.
  if (p > 0.55) {
    const n = 24;
    for (let i = 0; i < n; i++) {
      const local = ramp(p, 0.55 + (i / n) * 0.4, 0.62 + (i / n) * 0.4);
      if (local <= 0) continue;
      const a = (i / n) * Math.PI * 2;
      const x1 = Math.cos(a) * R * 0.9;
      const y1 = Math.sin(a) * R * 0.9;
      const x2 = Math.cos(a) * R * (0.9 + 0.06 * local);
      const y2 = Math.sin(a) * R * (0.9 + 0.06 * local);
      c.strokeStyle = hexA(color, 0.75 * local * (broken ? 1 - br : 1));
      c.lineWidth = Math.max(1, R * 0.009);
      c.beginPath();
      c.moveTo(x1, y1);
      c.lineTo(x2, y2);
      c.stroke();
    }
  }

  // --- Центр: тлеющая точка.
  if (p > 0.5) {
    const cr = R * 0.09 * ramp(p, 0.5, 0.9) * (1 - br * 0.6);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, cr * 3);
    g.addColorStop(0, hexA('#ffffff', 0.9 * (1 - br)));
    g.addColorStop(0.4, hexA(color, 0.55 * (1 - br)));
    g.addColorStop(1, hexA(color, 0));
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, cr * 3, 0, Math.PI * 2);
    c.fill();
  }

  // --- Трещины при развале.
  if (broken) {
    c.strokeStyle = hexA('#ff6b6b', 0.75 * (1 - br));
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.4;
      c.lineWidth = Math.max(1, R * 0.006 * (1 - br));
      c.beginPath();
      c.moveTo(Math.cos(a) * R * 0.2, Math.sin(a) * R * 0.2);
      let x = Math.cos(a) * R * 0.2;
      let y = Math.sin(a) * R * 0.2;
      for (let k = 1; k <= 5; k++) {
        const wob = Math.sin(i * 3.1 + k * 2.7) * 0.11;
        x = Math.cos(a + wob) * R * (0.2 + 0.16 * k * br);
        y = Math.sin(a + wob) * R * (0.2 + 0.16 * k * br);
        c.lineTo(x, y);
      }
      c.stroke();
    }
  }

  c.restore();
}

/** Общая подложка: затемнение, виньетка, пыль. */
function drawBackdrop(c, W, H, t, tint, dust) {
  c.fillStyle = 'rgba(4,6,14,0.82)';
  c.fillRect(0, 0, W, H);

  // Цветное свечение из центра.
  const g = c.createRadialGradient(W / 2, H * 0.44, 0, W / 2, H * 0.44, Math.max(W, H) * 0.6);
  g.addColorStop(0, tint);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);

  drawEmbers(c, W, H, t, 42, dust, 0.5);

  // Виньетка по краям.
  const v = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3,
    W / 2, H / 2, Math.max(W, H) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.85)');
  c.fillStyle = v;
  c.fillRect(0, 0, W, H);
}

/** Текст с межбуквенным разлётом — «кинематографичный» титр. */
function drawTitle(c, text, x, y, size, alpha, spread, color) {
  if (alpha <= 0) return;
  c.save();
  c.globalAlpha = alpha;
  c.font = `700 ${size}px system-ui, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = color;
  c.shadowColor = color;
  c.shadowBlur = size * 0.5;
  // Разрядка рисуется по буквам: canvas letterSpacing поддерживают не все.
  const chars = [...text];
  const widths = chars.map((ch) => c.measureText(ch).width);
  const total = widths.reduce((s, w) => s + w, 0) + spread * (chars.length - 1);
  let cx = x - total / 2;
  for (let i = 0; i < chars.length; i++) {
    c.fillText(chars[i], cx + widths[i] / 2, y);
    cx += widths[i] + spread;
  }
  c.restore();
}

/**
 * Вступительная заставка.
 *
 * @param {CanvasRenderingContext2D} c
 * @param {{W:number,H:number,t:number,card:object}} o
 */
export function drawIntro(c, o) {
  const { W, H, t, card } = o;
  const T = card.t;

  drawBackdrop(c, W, H, t,
    `rgba(60,110,190,${0.16 * ramp(T, 0.6, 2.4)})`, '#8cc8ff');

  // --- Печать собирается.
  const R = Math.min(W, H) * 0.19;
  const sealAlpha = ramp(T, 0.3, 1.0);
  c.save();
  c.globalAlpha = sealAlpha;
  drawSeal(c, W / 2, H * 0.44, R, t, ramp(T, 0.3, 3.4), 0, '#9fd8ff', '#4aa8ff');
  c.restore();

  // --- Название.
  const titleA = ramp(T, 2.4, 3.6);
  drawTitle(c, 'ПЕЧАТЬ МАГА', W / 2, H * 0.44,
    Math.min(W * 0.075, 62), titleA, 10, '#ffffff');

  // --- Подзаголовок.
  const subA = ramp(T, 3.6, 4.6);
  drawTitle(c, 'Рисуй символы в воздухе · Читай противника',
    W / 2, H * 0.44 + Math.min(W * 0.075, 62) * 1.05,
    Math.min(W * 0.024, 19), subA * 0.85, 2, '#bcd6f0');

  // --- Условия пути.
  const pathA = ramp(T, 4.6, 5.6);
  drawTitle(c, 'СЕМЬ СТРАЖЕЙ · 70 УРОВНЕЙ · ОДНА СЛОЖНОСТЬ',
    W / 2, H * 0.9, Math.min(W * 0.018, 14), pathA * 0.7, 3, '#8fb6d8');

  // --- Подсказка: пульсирует, пока ждём клика.
  if (cardSkippable(card)) {
    const pulse = 0.55 + 0.45 * Math.sin(t * 3);
    drawTitle(c, 'НАЖМИТЕ, ЧТОБЫ НАЧАТЬ', W / 2, H * 0.79,
      Math.min(W * 0.022, 17), pulse * 0.95, 4, '#ffe9a8');
  }
}

/**
 * Предсмертная заставка: мир гаснет, печать трескается и рассыпается.
 *
 * @param {CanvasRenderingContext2D} c
 * @param {{W:number,H:number,t:number,card:object,enemy:string}} o
 */
export function drawDeath(c, o) {
  const { W, H, t, card, enemy } = o;
  const T = card.t;
  const k = Math.min(1, T / DEATH_CARD_LEN);

  // Мир темнеет и уходит в красное.
  c.fillStyle = `rgba(8,4,10,${0.35 + 0.5 * k})`;
  c.fillRect(0, 0, W, H);

  const red = c.createRadialGradient(W / 2, H * 0.5, 0, W / 2, H * 0.5, Math.max(W, H) * 0.6);
  red.addColorStop(0, `rgba(150,20,40,${0.35 * ramp(T, 0.2, 1.4)})`);
  red.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = red;
  c.fillRect(0, 0, W, H);

  // Печать ломается.
  const R = Math.min(W, H) * 0.2;
  const br = ramp(T, 0.5, DEATH_CARD_LEN - 0.4);
  c.save();
  c.globalAlpha = 1 - br * 0.55;
  drawSeal(c, W / 2, H * 0.46, R, t, 1, br, '#ff8a8a', '#ff3b52');
  c.restore();

  // Искры разлома разлетаются.
  c.save();
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2 + 0.3;
    const d = R * (0.3 + br * 1.9);
    const x = W / 2 + Math.cos(a) * d;
    const y = H * 0.46 + Math.sin(a) * d;
    c.globalAlpha = Math.max(0, (1 - br) * 0.9);
    c.fillStyle = '#ff6b6b';
    c.beginPath();
    c.arc(x, y, 1.6 * (1 - br) + 0.4, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();

  // Титр.
  const a = ramp(T, 0.9, 2.0);
  drawTitle(c, 'ПЕЧАТЬ РАЗРУШЕНА', W / 2, H * 0.46,
    Math.min(W * 0.055, 48), a, 8, '#ffd9d9');

  if (enemy) {
    const a2 = ramp(T, 1.5, 2.6);
    drawTitle(c, `${enemy} оказался сильнее`, W / 2, H * 0.46 + Math.min(W * 0.055, 48) * 1.15,
      Math.min(W * 0.022, 17), a2 * 0.8, 2, '#e0b8b8');
  }

  // Затемнение в конце — переход к панели поражения.
  const out = ramp(T, DEATH_CARD_LEN - 0.7, DEATH_CARD_LEN);
  if (out > 0) {
    c.fillStyle = `rgba(0,0,0,${out})`;
    c.fillRect(0, 0, W, H);
  }
}
