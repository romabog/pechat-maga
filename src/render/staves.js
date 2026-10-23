/**
 * ПОСОХИ МАГОВ
 * ============
 * У каждого противника в руках посох, и этим посохом он чертит знак.
 *
 * Зачем отдельный модуль. Посох — не декорация: от него зависит,
 * куда рисуется заклинание и как выглядит каст. Держать эту геометрию
 * рядом с телом (character.js) неудобно, потому что она нужна ещё и
 * бою (main.js), который рисует заклинание и связывает его с посохом.
 *
 * ШЕСТЬ ФОРМ, по одной на стиль. Форма выбирается от элемента
 * противника, а не случайно: игрок должен узнавать стихию врага по
 * навершию, ещё до того как тот начнёт кастовать.
 *
 *   sakura/light → «ветвь»   изогнутая ветка с лепестками
 *   night/shadow → «серп»    короткий жезл с серпом тьмы
 *   storm        → «кольцо»  шест с парящим кольцом молний
 *   ember/fire   → «чаша»    жаровня на конце, открытый огонь
 *   frost/ice    → «шип»     ледяной кристалл в оправе
 *   void         → «глаз»    глаз бездны в когтях
 *   heaven       → «трость»  императорская трость с диском
 *
 * ВСЕ формы анимируются, но по-разному — одинаковое мерцание выдало бы
 * процедурную природу графики:
 *   · ветвь  — лепестки кружатся и опадают
 *   · серп   — тёмное лезвие пульсирует, тень течёт по лезвию
 *   · кольцо — кольцо вращается, между зубцами проскакивают дуги
 *   · чаша   — пламя горит, языки дёргаются независимо
 *   · шип    — кристалл растёт и сжимается, внутри бежит блик
 *   · глаз   — зрачок смотрит на игрока, веко моргает
 *   · трость — диск вращается, по ободу бегут письмена
 */

/** Форма посоха по стихии противника. */
const FORM_BY_ELEMENT = {
  sakura: 'branch',
  light: 'branch',
  shadow: 'scythe',
  night: 'scythe',
  storm: 'ring',
  fire: 'bowl',
  ember: 'bowl',
  ice: 'spike',
  frost: 'spike',
  void: 'eye',
  heaven: 'scepter',
  celestial: 'scepter',
};

/**
 * Форма по палитре — запасной путь для обычных врагов.
 *
 * У боссов есть явное поле element, а у обычных зверей его нет:
 * процедурный противник собирается из палитры, и стихию можно понять
 * только по ней. Соответствие палитр стихиям (см. P в data/enemies.js):
 *
 *   sakura → цветение · night → тьма · jade → природа · ember → огонь
 *   frost  → лёд      · gold  → свет · blood → кровь · void → бездна
 *   storm  → гроза    · spirit → дух · oni → демон · celestial → небо
 */
const FORM_BY_PALETTE = {
  sakura: 'branch',
  night: 'scythe',
  jade: 'branch',
  ember: 'bowl',
  frost: 'spike',
  gold: 'scepter',
  blood: 'scythe',
  void: 'eye',
  storm: 'ring',
  spirit: 'eye',
  oni: 'bowl',
  celestial: 'scepter',
};

/** Форма по умолчанию, если стихия и палитра неизвестны. */
const DEFAULT_FORM = 'ring';

/**
 * Форма посоха противника.
 *
 * Приоритет: явная стихия (боссы) → палитра (обычные звери) → кольцо.
 * Порядок важен: у босса element точнее, чем палитра, потому что
 * палитра задаёт лишь цвет.
 *
 * @param {object} enemy данные врага
 * @returns {string} ключ формы
 */
export function staffForm(enemy) {
  if (!enemy) return DEFAULT_FORM;
  const byEl = FORM_BY_ELEMENT[enemy.element];
  if (byEl) return byEl;

  // palette может быть строкой-ключом или готовым объектом —
  // поддерживаем оба варианта, потому что генератор создаёт объект,
  // а данные боссов хранят ключ.
  const key = typeof enemy.palette === 'string' ? enemy.palette : enemy.paletteKey;
  const byPal = FORM_BY_PALETTE[key];
  if (byPal) return byPal;

  // Последний шанс: угадать по оттенку. Сравниваем не точное значение,
  // а «какой канал перевешивает» — этого хватает, чтобы тёплые тона
  // получили чашу с огнём, а холодные — кристалл.
  return formByHue(enemy.palette) || DEFAULT_FORM;
}

/** Грубая оценка формы по цвету акцента. */
function formByHue(pal) {
  if (!pal || typeof pal.accent !== 'string') return null;
  const hex = pal.accent.replace('#', '');
  if (hex.length < 6) return null;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if (![r, g, b].every(Number.isFinite)) return null;

  // Фиолетовый — бездна, оранжевый/жёлтый — огонь, голубой — лёд.
  if (b > r && b > g && r > g) return 'eye';
  if (r > g && g > b) return 'bowl';
  if (b > r && g > r) return 'spike';
  return null;
}

/**
 * ГЕОМЕТРИЯ ПОСОХА.
 *
 * Возвращает точки, по которым рисуется посох и к которым
 * привязывается кисть, рисующая знак.
 *
 * Посох держится в правой руке (со стороны зрителя справа) и наклонён
 * так, что навершие оказывается ВЫШЕ головы: знак рисуется в воздухе
 * перед магом, и посох должен дотягиваться до области каста.
 *
 * @param {number} cx центр фигуры
 * @param {number} robeTop верх мантии (плечи)
 * @param {number} bodyH высота тела
 * @param {number} bodyW ширина тела
 * @param {number} scale масштаб фигуры
 * @param {number} t время
 * @param {boolean} casting идёт ли каст (посох поднимается выше)
 */
export function staffGeometry(cx, robeTop, bodyH, bodyW, scale, t, casting, grip) {
  // Кисть берётся у ТЕЛА, а не считается здесь заново.
  //
  // Раньше точка хвата задавалась тут своей формулой (bodyW * 0.62,
  // bodyH * 0.52). Когда тело перерисовали, рука уехала, а формула
  // осталась — древко проходило сквозь рукав. Теперь тело возвращает
  // настоящую позицию кисти в geo.grip, и посох держится за неё.
  const handX = grip ? grip.x : cx + bodyW * 0.62;
  const handY = grip ? grip.y : robeTop + bodyH * 0.52;

  // Наклон верхнего конца. Во время каста посох поднимается и
  // выпрямляется — видно, что маг «взялся за работу».
  const castLift = casting ? 1 : 0;
  const idleSway = Math.sin(t * 1.3) * 0.04;
  const tilt = 0.30 - castLift * 0.16 + idleSway;

  // Длина посоха чуть больше роста: так он читается как магический.
  const len = bodyH * 1.18;

  const topX = handX + Math.sin(tilt) * len;
  const topY = handY - Math.cos(tilt) * len;

  // Древко слегка изогнуто — прямой шест выглядит как черенок лопаты.
  const bendX = (handX + topX) / 2 + Math.cos(tilt) * scale * 0.12;
  const bendY = (handY + topY) / 2 + Math.sin(tilt) * scale * 0.12;

  return {
    handX, handY,
    topX, topY,
    bendX, bendY,
    tilt,
    scale,
    len,
    // Точка, у которой навершие: сюда крепятся кристалл/чаша/кольцо.
    headX: topX,
    headY: topY,
  };
}

/**
 * РИСОВАНИЕ ПОСОХА.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} g геометрия из staffGeometry()
 * @param {object} enemy данные врага
 * @param {number} t время
 * @param {boolean} casting идёт ли каст
 */
export function drawStaff(ctx, g, enemy, t, casting) {
  const pal = enemy.palette;
  const form = staffForm(enemy);
  const s = g.scale;

  // --- Древко ---
  //
  // Цвет от стихии: у огня обугленное, у льда белёсое, у тьмы почти
  // чёрное. Так посох вписывается в образ, а не выглядит деревяшкой
  // из общего набора.
  const shaftCol = shaftColor(enemy.element);

  ctx.save();
  ctx.lineCap = 'round';

  // Тень под древком — объём.
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = s * 0.11;
  ctx.beginPath();
  ctx.moveTo(g.handX + s * 0.02, g.handY);
  ctx.quadraticCurveTo(g.bendX + s * 0.02, g.bendY, g.topX + s * 0.02, g.topY);
  ctx.stroke();

  // Само древко.
  ctx.strokeStyle = shaftCol;
  ctx.lineWidth = s * 0.085;
  ctx.beginPath();
  ctx.moveTo(g.handX, g.handY);
  ctx.quadraticCurveTo(g.bendX, g.bendY, g.topX, g.topY);
  ctx.stroke();

  // Обмотка у руки — три витка шнура. Мелкая деталь, но она сразу
  // делает предмет «сделанным», а не нарисованным линией.
  ctx.strokeStyle = hexA(pal.accent, 0.75);
  ctx.lineWidth = s * 0.03;
  for (let i = 0; i < 3; i++) {
    const k = 0.02 + i * 0.05;
    const wx = g.handX + (g.bendX - g.handX) * k;
    const wy = g.handY + (g.bendY - g.handY) * k;
    ctx.beginPath();
    ctx.arc(wx, wy, s * 0.055, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Свечение по всей длине: посох заряжен.
  const glowPulse = 0.45 + Math.sin(t * 2.4) * 0.15 + (casting ? 0.3 : 0);
  ctx.strokeStyle = hexA(pal.glow, glowPulse);
  ctx.lineWidth = s * 0.05;
  ctx.shadowColor = pal.glow;
  ctx.shadowBlur = s * (casting ? 0.5 : 0.22);
  ctx.beginPath();
  ctx.moveTo(g.handX, g.handY);
  ctx.quadraticCurveTo(g.bendX, g.bendY, g.topX, g.topY);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // --- Навершие: своя форма у каждого стиля ---
  const head = { x: g.headX, y: g.headY, s, t, pal, casting };
  switch (form) {
    case 'branch': drawBranch(ctx, head); break;
    case 'scythe': drawScythe(ctx, head); break;
    case 'ring': drawRing(ctx, head); break;
    case 'bowl': drawBowl(ctx, head); break;
    case 'spike': drawSpike(ctx, head); break;
    case 'eye': drawEye(ctx, head); break;
    case 'scepter': drawScepter(ctx, head); break;
    default: drawRing(ctx, head);
  }
  ctx.restore();
}

/** Цвет древка по стихии. */
function shaftColor(element) {
  switch (element) {
    case 'fire': case 'ember': return '#4a2a1c';
    case 'ice': case 'frost': return '#cfe4f2';
    case 'void': case 'shadow': case 'night': return '#1e1a2c';
    case 'heaven': case 'celestial': case 'light': return '#e8d9a8';
    default: return '#5a4230';
  }
}

// =============================================================== НАВЕРШИЯ

/** Ветвь: изогнутый отросток с лепестками, кружащимися вокруг. */
function drawBranch(ctx, h) {
  const { x, y, s, t, pal } = h;

  // Развилка — две веточки.
  ctx.strokeStyle = hexA(pal.accent, 0.9);
  ctx.lineWidth = s * 0.05;
  ctx.lineCap = 'round';
  for (const d of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.15);
    ctx.quadraticCurveTo(x + d * s * 0.35, y - s * 0.1, x + d * s * 0.22, y - s * 0.45);
    ctx.stroke();
  }

  // Лепестки: 6 штук, каждый на своей орбите и со своей фазой.
  //
  // Движение составное: лепесток облетает навершие по эллипсу И
  // медленно опускается, будто его сдувает. Чистое вращение по кругу
  // выглядело бы как карусель.
  for (let i = 0; i < 6; i++) {
    const phase = t * 0.9 + i * 1.05;
    const orbitR = s * (0.42 + (i % 3) * 0.12);
    const px = x + Math.cos(phase) * orbitR;
    const py = y - s * 0.2 + Math.sin(phase) * orbitR * 0.55;

    // Опадание: лепесток тонет вниз и возвращается.
    const fall = ((t * 0.35 + i * 0.17) % 1);
    const fade = 1 - fall;

    ctx.save();
    ctx.globalAlpha = 0.35 + fade * 0.55;
    ctx.fillStyle = i % 2 ? pal.glow : pal.accent;
    ctx.beginPath();
    ctx.ellipse(
      px, py - fall * s * 0.5,
      s * 0.09, s * 0.055,
      phase,
      0, Math.PI * 2
    );
    ctx.fill();
    ctx.restore();
  }

  // Ядро ветви — светящаяся точка.
  glowDot(ctx, x, y - s * 0.1, s * 0.14, pal.glow, t * 3);
}

/** Серп: короткое тёмное лезвие, по которому течёт тень. */
function drawScythe(ctx, h) {
  const { x, y, s, t, pal } = h;

  // Лезвие — дуга, растущая из навершия вбок.
  const pulse = 0.8 + Math.sin(t * 2.6) * 0.2;
  ctx.fillStyle = hexA('#2a1f3a', 0.95);
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.1);
  ctx.quadraticCurveTo(x + s * 0.7, y - s * 0.15, x + s * 0.55, y - s * 0.62);
  ctx.quadraticCurveTo(x + s * 0.35, y - s * 0.25, x, y - s * 0.1);
  ctx.closePath();
  ctx.fill();

  // Кромка лезвия светится — и пульсирует.
  ctx.strokeStyle = hexA(pal.glow, 0.75 * pulse);
  ctx.lineWidth = s * 0.035;
  ctx.shadowColor = pal.glow;
  ctx.shadowBlur = s * 0.4 * pulse;
  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.1);
  ctx.quadraticCurveTo(x + s * 0.35, y - s * 0.25, x + s * 0.55, y - s * 0.62);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Тень стекает по лезвию: три капли, бегущие вниз по кривой.
  for (let i = 0; i < 3; i++) {
    const k = ((t * 0.5 + i * 0.33) % 1);
    const px = x + s * (0.55 * k);
    const py = y - s * (0.1 + 0.5 * k * k);
    ctx.fillStyle = hexA(pal.glow, 0.5 * (1 - k));
    ctx.beginPath();
    ctx.arc(px, py, s * 0.045, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Кольцо: парящее кольцо молний между двумя зубцами. */
function drawRing(ctx, h) {
  const { x, y, s, t, pal } = h;

  // Зубцы, между которыми висит кольцо.
  ctx.strokeStyle = hexA(pal.accent, 0.85);
  ctx.lineWidth = s * 0.045;
  for (const d of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.1);
    ctx.quadraticCurveTo(x + d * s * 0.28, y - s * 0.1, x + d * s * 0.2, y - s * 0.32);
    ctx.stroke();
  }

  // Само кольцо — вращается и слегка наклонено, поэтому эллипс.
  const spin = t * 1.4;
  const rx = s * 0.26;
  const ry = s * 0.26 * Math.abs(Math.cos(spin * 0.5)) * 0.45 + s * 0.08;
  ctx.strokeStyle = hexA(pal.glow, 0.9);
  ctx.lineWidth = s * 0.038;
  ctx.shadowColor = pal.glow;
  ctx.shadowBlur = s * 0.35;
  ctx.beginPath();
  ctx.ellipse(x, y - s * 0.42, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Молнии между зубцами — короткие зигзаги, вспыхивающие нерегулярно.
  //
  // Нерегулярность дают разные частоты синусов: сумма двух волн с
  // несоизмеримыми периодами не повторяется на глаз.
  const zap = Math.sin(t * 7.1) * Math.sin(t * 3.3);
  if (zap > 0.6) {
    ctx.strokeStyle = hexA('#ffffff', 0.85);
    ctx.lineWidth = s * 0.02;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.2, y - s * 0.32);
    for (let i = 1; i <= 4; i++) {
      const k = i / 4;
      const jx = x - s * 0.2 + s * 0.4 * k;
      const jy = y - s * 0.32 + (i % 2 ? -s * 0.06 : s * 0.06);
      ctx.lineTo(jx, jy);
    }
    ctx.stroke();
  }
}

/** Чаша: жаровня с открытым огнём. */
function drawBowl(ctx, h) {
  const { x, y, s, t, pal } = h;

  // Чаша.
  ctx.fillStyle = hexA('#3a2418', 0.95);
  ctx.beginPath();
  ctx.moveTo(x - s * 0.22, y - s * 0.2);
  ctx.lineTo(x + s * 0.22, y - s * 0.2);
  ctx.quadraticCurveTo(x + s * 0.16, y + s * 0.1, x, y + s * 0.12);
  ctx.quadraticCurveTo(x - s * 0.16, y + s * 0.1, x - s * 0.22, y - s * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = hexA(pal.accent, 0.8);
  ctx.lineWidth = s * 0.03;
  ctx.stroke();

  // Пламя: три языка с разными частотами — они не повторяют друг
  // друга, и огонь выглядит живым, а не «анимацией по синусу».
  for (let i = 0; i < 3; i++) {
    const f1 = Math.sin(t * (5 + i * 1.7) + i * 2.1);
    const f2 = Math.sin(t * (3.1 + i * 0.9) + i);
    const hgt = s * (0.32 + i * 0.1) * (0.75 + f1 * 0.22 + f2 * 0.12);
    const off = (i - 1) * s * 0.1 + f2 * s * 0.05;

    const g = ctx.createLinearGradient(x + off, y - s * 0.2, x + off, y - s * 0.2 - hgt);
    g.addColorStop(0, hexA('#ffb347', 0.95));
    g.addColorStop(0.6, hexA('#ff6b2b', 0.8));
    g.addColorStop(1, hexA('#ffe9a8', 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x + off - s * 0.07, y - s * 0.18);
    ctx.quadraticCurveTo(x + off - s * 0.09, y - s * 0.2 - hgt * 0.5, x + off, y - s * 0.2 - hgt);
    ctx.quadraticCurveTo(x + off + s * 0.09, y - s * 0.2 - hgt * 0.5, x + off + s * 0.07, y - s * 0.18);
    ctx.closePath();
    ctx.fill();
  }

  // Угли в чаше — тлеют с разной яркостью.
  for (let i = 0; i < 4; i++) {
    const em = 0.5 + Math.sin(t * (4 + i) + i * 1.6) * 0.35;
    ctx.fillStyle = hexA('#ff9a3c', em * 0.9);
    ctx.beginPath();
    ctx.arc(x + (i - 1.5) * s * 0.08, y - s * 0.16, s * 0.028, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Шип: ледяной кристалл в оправе. */
function drawSpike(ctx, h) {
  const { x, y, s, t, pal } = h;

  // Кристалл «дышит»: медленно растёт и сжимается.
  const breathe = 1 + Math.sin(t * 1.7) * 0.07;

  // Оправа — три когтя, держащие кристалл.
  ctx.strokeStyle = hexA(pal.accent, 0.9);
  ctx.lineWidth = s * 0.045;
  ctx.lineCap = 'round';
  for (const d of [-1, 0, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + d * s * 0.18, y + s * 0.06);
    ctx.quadraticCurveTo(x + d * s * 0.24, y - s * 0.2, x + d * s * 0.1, y - s * 0.34);
    ctx.stroke();
  }

  // Кристалл — вытянутый ромб.
  const ch = s * 0.52 * breathe;
  const cw = s * 0.19 * breathe;
  ctx.fillStyle = hexA('#dff2ff', 0.88);
  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.1 - ch);
  ctx.lineTo(x + cw, y - s * 0.1 - ch * 0.45);
  ctx.lineTo(x, y - s * 0.1);
  ctx.lineTo(x - cw, y - s * 0.1 - ch * 0.45);
  ctx.closePath();
  ctx.fill();

  // Грань — вторая половина, темнее: кристалл читается объёмным.
  ctx.fillStyle = hexA(pal.glow, 0.5);
  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.1 - ch);
  ctx.lineTo(x + cw, y - s * 0.1 - ch * 0.45);
  ctx.lineTo(x, y - s * 0.1);
  ctx.closePath();
  ctx.fill();

  // Блик бежит по грани сверху вниз и обратно.
  const gl = (Math.sin(t * 2.2) * 0.5 + 0.5);
  ctx.strokeStyle = hexA('#ffffff', 0.65);
  ctx.lineWidth = s * 0.022;
  ctx.beginPath();
  ctx.moveTo(x - cw * 0.4, y - s * 0.1 - ch * (0.85 - gl * 0.5));
  ctx.lineTo(x - cw * 0.15, y - s * 0.1 - ch * (0.7 - gl * 0.5));
  ctx.stroke();
}

/** Глаз бездны: смотрит на игрока и моргает. */
function drawEye(ctx, h) {
  const { x, y, s, t, pal, casting } = h;

  // Когти, удерживающие глаз.
  ctx.strokeStyle = hexA(pal.accent, 0.85);
  ctx.lineWidth = s * 0.04;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const a = -Math.PI * 0.75 + i * (Math.PI * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * s * 0.3, y - s * 0.22 + Math.sin(a) * s * 0.3);
    ctx.lineTo(x + Math.cos(a) * s * 0.5, y - s * 0.22 + Math.sin(a) * s * 0.5);
    ctx.stroke();
  }

  // Веко: моргание — короткое, раз в ~3.7 с.
  //
  // Глаз на посохе моргает НЕ в такт с глазами зверя (там цикл 4.2 с):
  // если бы совпадало, это выглядело бы как общий таймер анимации.
  const blinkPh = t % 3.7;
  const lid = blinkPh < 0.14 ? Math.sin(blinkPh / 0.14 * Math.PI) : 0;

  const er = s * 0.26;
  const ey = y - s * 0.24;
  const rx = er;
  const ry = er * 0.62 * (1 - lid * 0.95);

  // Белок — тёмный, бездонный.
  ctx.fillStyle = hexA('#0d0a16', 0.95);
  ctx.beginPath();
  ctx.ellipse(x, ey, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  if (lid < 0.7) {
    // Радужка — светящаяся.
    ctx.fillStyle = hexA(pal.glow, 0.85);
    ctx.beginPath();
    ctx.ellipse(x, ey, rx * 0.62, ry * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();

    // Зрачок смотрит в сторону игрока: влево-вниз, к руке с заклинанием.
    const lookX = -rx * 0.16 + Math.sin(t * 0.8) * rx * 0.06;
    const lookY = ry * 0.1 + Math.cos(t * 1.1) * ry * 0.06;
    ctx.fillStyle = '#05030a';
    ctx.beginPath();
    ctx.ellipse(x + lookX, ey + lookY, rx * 0.22, ry * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Блик.
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(x - rx * 0.3 + lookX, ey - ry * 0.3 + lookY, rx * 0.09, 0, Math.PI * 2);
    ctx.fill();
  }

  // Контур века.
  ctx.strokeStyle = hexA(pal.accent, 0.9);
  ctx.lineWidth = s * 0.03;
  ctx.beginPath();
  ctx.ellipse(x, ey, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();

  // При касте глаз светится ярче — видно, что посох «заряжается».
  if (casting) {
    const g = ctx.createRadialGradient(x, ey, 0, x, ey, er * 2.2);
    g.addColorStop(0, hexA(pal.glow, 0.5));
    g.addColorStop(1, hexA(pal.glow, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, ey, er * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Трость: диск с бегущими по ободу письменами. */
function drawScepter(ctx, h) {
  const { x, y, s, t, pal, casting } = h;

  // Перекладина.
  ctx.strokeStyle = hexA(pal.accent, 0.9);
  ctx.lineWidth = s * 0.045;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.26, y - s * 0.18);
  ctx.lineTo(x + s * 0.26, y - s * 0.18);
  ctx.stroke();

  // Диск — вращается.
  const spin = t * 0.9;
  ctx.strokeStyle = hexA(pal.glow, 0.85);
  ctx.lineWidth = s * 0.04;
  ctx.shadowColor = pal.glow;
  ctx.shadowBlur = s * (casting ? 0.55 : 0.3);
  ctx.beginPath();
  ctx.arc(x, y - s * 0.48, s * 0.2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Письмена по ободу: короткие штрихи, бегущие по кругу.
  ctx.strokeStyle = hexA('#ffffff', 0.7);
  ctx.lineWidth = s * 0.018;
  for (let i = 0; i < 8; i++) {
    const a = spin + i * (Math.PI / 4);
    const r0 = s * 0.14;
    const r1 = s * 0.185;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r0, y - s * 0.48 + Math.sin(a) * r0);
    ctx.lineTo(x + Math.cos(a) * r1, y - s * 0.48 + Math.sin(a) * r1);
    ctx.stroke();
  }

  // Внутреннее ядро диска — пульсирует.
  const core = 0.6 + Math.sin(t * 2.8) * 0.25;
  glowDot(ctx, x, y - s * 0.48, s * 0.09, pal.glow, core);
}

/** Светящаяся точка с ореолом. */
function glowDot(ctx, x, y, r, color, pulse) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
  g.addColorStop(0, hexA('#ffffff', 0.9));
  g.addColorStop(0.35, hexA(color, 0.7));
  g.addColorStop(1, hexA(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Альфа-версия цвета из hex.
 *
 * Дублируется здесь, чтобы модуль посохов не зависел от character.js:
 * он импортируется и из боя, и из галереи, и лишняя связь между ними
 * создаёт цикл импортов.
 */
function hexA(hex, a) {
  if (!hex || hex[0] !== '#') return `rgba(255,255,255,${a})`;
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
}

export { FORM_BY_ELEMENT };
