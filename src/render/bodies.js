/**
 * СТРОЕНИЕ ТЕЛА ОБЫЧНЫХ ВРАГОВ
 * ============================
 * Раньше у всех семидесяти противников было одно тело: мантия-конус
 * с поясом и рукавами. Менялись только головы. Из-за этого слизь,
 * призрак и дракон стояли в одинаковых халатах — силуэт не отвечал
 * на вопрос «кто это», и приходилось читать подпись.
 *
 * Теперь строится сначала ТЕЛО подходящей формы, а голова садится на
 * него сверху. Формы:
 *
 *   robe     — человеческая фигура в одежде
 *   armor    — то же, но с наплечниками и металлом
 *   quadruped— зверь на четырёх лапах
 *   serpent  — змеиное тело без ног
 *   floating — бесплотный силуэт, висящий над землёй
 *   blob     — бесформенная масса
 *   eye      — шар с большим глазом
 *   giant    — огромная фигура с широкими плечами
 *   winged   — фигура с крыльями
 *   tree     — ствол вместо тела
 *
 * Все координаты — в единицах масштаба `s`, отсчёт от `baseY` (земля).
 * Вернуть нужно высоту, на которой должна оказаться голова, и её
 * радиус: остальной код подстраивается под них и не думает о форме.
 */

function shade(hex, k) {
  const h = hex.replace('#', '');
  const num = parseInt(h.substring(0, 6), 16);
  let r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
  if (k >= 0) { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
  else { r *= 1 + k; g *= 1 + k; b *= 1 + k; }
  const to = (v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

function hexA(hex, a) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// ------------------------------------------------------------------
// Прямоходящее тело: мантия, доспех, крылатый
// ------------------------------------------------------------------
//
// ЧТО БЫЛО НЕ ТАК.
//
// Прежняя версия рисовала один плоский многоугольник-конус, шею через
// fillRect и рукава двумя треугольниками, приклеенными сбоку. В итоге
// у 45 существ из 70 не было ни рук, ни ног, ни плеч — только конус и
// голова. Менялся лишь цвет, и все они выглядели одинаково.
//
// КАК ПОСТРОЕНО ТЕПЕРЬ.
//
// От скелета, как у боссов: сначала считаются точки (плечи, локти,
// кисти, бёдра, колени, стопы), потом по ним строятся контуры.
//   1. дальняя рука — в тени, за телом
//   2. ноги и стопы
//   3. полы одежды
//   4. ближняя рука — поверх
//   5. ворот, пояс, складки, объём
//   6. шея — трапеция, а не прямоугольник
//
function bodyRobe(ctx, cx, baseY, s, pal, arch, t, armored) {
  const buildScale = { slim: 0.9, toned: 0.98, broad: 1.15, lean: 0.88, feral: 0.95, ethereal: 0.88, tall: 1.08, small: 0.78, serpent: 1.1 }[arch.build] || 1;
  const bodyW = s * 0.62 * buildScale;
  const bodyH = s * 2.3 * (arch.robeLen > 0.5 ? 1 : 0.85);
  const robeTop = baseY - bodyH;
  const breathe = Math.sin(t * 1.2) * s * 0.018;

  // --- Материалы ---------------------------------------------------
  // Одежда: у доспеха холоднее и темнее, у мантии — как задано.
  const cloth = armored ? shade(pal.robe, -0.18) : pal.robe;
  const clothMid = shade(cloth, -0.14);
  const clothDark = shade(cloth, -0.38);
  const clothDeep = shade(cloth, -0.58);
  const clothLight = shade(cloth, 0.22);
  const trim = pal.accent;                    // кайма, пояс, наплечники
  const trimDark = shade(trim, -0.42);
  // Кожа чуть темнее «лица», иначе кисти сливаются с фоном.
  const skin = shade(pal.skin, -0.06);
  const skinDark = shade(pal.skin, -0.34);

  // --- Скелет ------------------------------------------------------
  const hipY = baseY - bodyH * 0.46;                 // пояс
  const chestY = robeTop + bodyH * 0.20 + breathe;   // грудь
  const shoulderY = robeTop + bodyH * 0.10 + breathe;
  const shoulderX = bodyW * 0.92;                    // полуширина плеч
  const waistX = bodyW * 0.62;
  const hemX = bodyW * (0.72 + arch.robeLen * 0.62);

  // Руки. Кисти на уровне бёдер — у мага вниз, у воина ближе к телу.
  const armLen = bodyH * 0.54;
  const sleeveOut = arch.sleeve === 'wide' ? bodyW * 0.46
    : arch.sleeve === 'armor' ? bodyW * 0.34
    : arch.sleeve === 'none' ? bodyW * 0.12
    : bodyW * 0.32;
  const armPose = (q) => {
    const swing = Math.sin(t * 1.6 + (q > 0 ? 0 : 1.4)) * s * 0.03;
    const shX = cx + q * shoulderX * 0.80;
    const shY = shoulderY + s * 0.06;
    const elbowX = cx + q * (shoulderX + sleeveOut * 0.6) + swing;
    const elbowY = shY + armLen * 0.48;
    const handX = cx + q * (shoulderX + sleeveOut * 0.34) + swing * 1.4;
    const handY = shY + armLen * 0.96;
    return { shX, shY, elbowX, elbowY, handX, handY };
  };

  // Ноги — только если одежда не до земли: под длинным подолом их нет.
  const legsVisible = arch.robeLen < 0.62;
  const footY = baseY - s * 0.04;

  // ================================================================
  // 1. ДАЛЬНЯЯ РУКА — за телом, в тени.
  // ================================================================
  {
    const a = armPose(-1);
    const handR = s * 0.090;
    ctx.fillStyle = clothDark;
    ctx.beginPath();
    ctx.moveTo(a.shX - s * 0.02, a.shY - s * 0.06);
    ctx.quadraticCurveTo(
      a.elbowX, a.elbowY - s * 0.10,
      a.handX - handR * 0.9, a.handY - s * 0.10);
    ctx.lineTo(a.handX + handR * 0.8, a.handY - s * 0.02);
    ctx.quadraticCurveTo(
      a.elbowX + s * 0.10, a.elbowY + s * 0.02,
      a.shX + s * 0.16, a.shY + s * 0.10);
    ctx.closePath();
    ctx.fill();
    // Кисть.
    ctx.fillStyle = skinDark;
    ctx.beginPath();
    ctx.ellipse(a.handX, a.handY + s * 0.02, handR * 0.86, handR, 0.15, 0, Math.PI * 2);
    ctx.fill();
  }

  // ================================================================
  // 2. НОГИ И СТОПЫ.
  // ================================================================
  if (legsVisible) {
    for (const [q, col] of [[-1, clothDeep], [1, clothDark]]) {
      const hipX = cx + q * bodyW * 0.30;
      const kneeX = cx + q * bodyW * 0.32;
      const shinX = cx + q * bodyW * 0.30;
      const legPath = (c) => {
        c.moveTo(hipX - bodyW * 0.14, hipY);
        c.lineTo(kneeX - bodyW * 0.13, hipY + (footY - hipY) * 0.52);
        c.lineTo(shinX - bodyW * 0.12, footY - s * 0.10);
        // Стопа.
        c.lineTo(shinX - bodyW * 0.20, footY);
        c.lineTo(shinX + bodyW * 0.22, footY);
        c.lineTo(shinX + bodyW * 0.14, footY - s * 0.10);
        c.lineTo(kneeX + bodyW * 0.13, hipY + (footY - hipY) * 0.52);
        c.lineTo(hipX + bodyW * 0.14, hipY);
        c.closePath();
      };
      const lg = ctx.createLinearGradient(0, hipY, 0, footY);
      lg.addColorStop(0, col);
      lg.addColorStop(1, shade(col, -0.30));
      ctx.fillStyle = lg;
      ctx.beginPath();
      legPath(ctx);
      ctx.fill();
      // Кромка голени — свет.
      ctx.strokeStyle = hexA(clothLight, 0.22);
      ctx.lineWidth = s * 0.012;
      ctx.beginPath();
      ctx.moveTo(kneeX + bodyW * 0.06, hipY + (footY - hipY) * 0.16);
      ctx.lineTo(shinX + bodyW * 0.05, footY - s * 0.14);
      ctx.stroke();
      // Сапог / обмотка.
      ctx.fillStyle = hexA(clothDeep, 0.85);
      ctx.beginPath();
      ctx.moveTo(shinX - bodyW * 0.15, footY - s * 0.30);
      ctx.lineTo(shinX + bodyW * 0.16, footY - s * 0.30);
      ctx.lineTo(shinX + bodyW * 0.14, footY - s * 0.10);
      ctx.lineTo(shinX - bodyW * 0.13, footY - s * 0.10);
      ctx.closePath();
      ctx.fill();
    }
  }

  // ================================================================
  // 3. ПОЛЫ ОДЕЖДЫ — от плеч к подолу, с объёмом.
  // ================================================================
  {
    const robePath = (c) => {
      c.moveTo(cx - shoulderX * 0.86, shoulderY);
      // Левый бок: талия втянута, подол расширяется.
      c.quadraticCurveTo(cx - waistX, hipY - bodyH * 0.10,
                         cx - waistX * 0.94, hipY);
      c.quadraticCurveTo(cx - hemX * 0.92, baseY - bodyH * 0.14,
                         cx - hemX, baseY);
      // Подол с лёгкой волной.
      c.quadraticCurveTo(cx - hemX * 0.30, baseY + s * 0.06,
                         cx, baseY + s * 0.02);
      c.quadraticCurveTo(cx + hemX * 0.30, baseY + s * 0.06,
                         cx + hemX, baseY);
      c.quadraticCurveTo(cx + hemX * 0.92, baseY - bodyH * 0.14,
                         cx + waistX * 0.94, hipY);
      c.quadraticCurveTo(cx + waistX, hipY - bodyH * 0.10,
                         cx + shoulderX * 0.86, shoulderY);
      // Плечи: линия с выемкой под шею.
      c.quadraticCurveTo(cx + shoulderX * 0.44, shoulderY - s * 0.14,
                         cx + s * 0.12, shoulderY - s * 0.10);
      c.lineTo(cx - s * 0.12, shoulderY - s * 0.10);
      c.quadraticCurveTo(cx - shoulderX * 0.44, shoulderY - s * 0.14,
                         cx - shoulderX * 0.86, shoulderY);
      c.closePath();
    };
    const rg = ctx.createLinearGradient(
      cx - shoulderX, shoulderY, cx + hemX * 0.8, baseY);
    rg.addColorStop(0, clothLight);
    rg.addColorStop(0.28, cloth);
    rg.addColorStop(0.72, clothMid);
    rg.addColorStop(1, clothDeep);
    ctx.fillStyle = rg;
    ctx.beginPath();
    robePath(ctx);
    ctx.fill();

    // Тень слева — объём.
    ctx.save();
    ctx.beginPath();
    robePath(ctx);
    ctx.clip();
    const sg = ctx.createLinearGradient(cx - hemX, 0, cx - waistX * 0.2, 0);
    sg.addColorStop(0, hexA(clothDeep, 0.55));
    sg.addColorStop(1, hexA(clothDeep, 0));
    ctx.fillStyle = sg;
    ctx.fillRect(cx - hemX * 1.2, shoulderY - s * 0.3, hemX * 2.4, bodyH + s);

    // Светлое пятно справа — от источника света.
    const lg2 = ctx.createLinearGradient(cx + waistX * 0.1, 0, cx + hemX, 0);
    lg2.addColorStop(0, hexA(clothLight, 0));
    lg2.addColorStop(1, hexA(clothLight, 0.26));
    ctx.fillStyle = lg2;
    ctx.fillRect(cx - hemX * 1.2, shoulderY - s * 0.3, hemX * 2.4, bodyH + s);

    // Складки ткани — вертикальные, сходятся к поясу.
    for (let i = 0; i < 5; i++) {
      const k = (i - 2) / 2;
      const topX = cx + k * waistX * 0.52;
      const botX = cx + k * hemX * 0.72;
      ctx.strokeStyle = hexA(clothDeep, 0.30);
      ctx.lineWidth = s * 0.014;
      ctx.beginPath();
      ctx.moveTo(topX, hipY + s * 0.04);
      ctx.quadraticCurveTo(topX + (botX - topX) * 0.5, baseY - bodyH * 0.14,
                           botX, baseY - s * 0.02);
      ctx.stroke();
      // Светлая кромка складки.
      ctx.strokeStyle = hexA(clothLight, 0.16);
      ctx.lineWidth = s * 0.009;
      ctx.beginPath();
      ctx.moveTo(topX + s * 0.018, hipY + s * 0.04);
      ctx.quadraticCurveTo(topX + (botX - topX) * 0.5 + s * 0.018, baseY - bodyH * 0.14,
                           botX + s * 0.018, baseY - s * 0.02);
      ctx.stroke();
    }
    ctx.restore();

    // Кайма по подолу.
    ctx.strokeStyle = hexA(trim, 0.88);
    ctx.lineWidth = s * 0.030;
    ctx.beginPath();
    ctx.moveTo(cx - hemX * 0.99, baseY - s * 0.02);
    ctx.quadraticCurveTo(cx - hemX * 0.30, baseY + s * 0.04, cx, baseY);
    ctx.quadraticCurveTo(cx + hemX * 0.30, baseY + s * 0.04, cx + hemX * 0.99, baseY - s * 0.02);
    ctx.stroke();
  }

  // ================================================================
  // 4. БЛИЖНЯЯ РУКА — поверх одежды.
  // ================================================================
  {
    const a = armPose(1);
    const handR = s * 0.098;
    const armPath = (c) => {
      // Рука толщиной ~0.13s у плеча и ~0.10s у кисти. Тонкая полоска
      // не читалась как рука — выглядела краем одежды.
      c.moveTo(a.shX - s * 0.17, a.shY - s * 0.13);
      c.quadraticCurveTo(
        a.elbowX + sleeveOut * 0.44, a.elbowY - s * 0.21,
        a.handX + handR * 1.35, a.handY - s * 0.19);
      // Кисть.
      c.lineTo(a.handX + handR * 0.85, a.handY + s * 0.10);
      c.lineTo(a.handX - handR * 0.95, a.handY + s * 0.08);
      // Внутренняя кромка вверх.
      c.quadraticCurveTo(
        a.elbowX - sleeveOut * 0.32, a.elbowY + s * 0.08,
        a.shX - s * 0.26, a.shY + s * 0.14);
      c.closePath();
    };
    const ag = ctx.createLinearGradient(
      a.shX, a.shY, a.handX, a.handY);
    ag.addColorStop(0, clothLight);
    ag.addColorStop(0.5, cloth);
    ag.addColorStop(1, clothDark);
    ctx.fillStyle = ag;
    ctx.beginPath();
    armPath(ctx);
    ctx.fill();
    ctx.strokeStyle = hexA(clothDeep, 0.45);
    ctx.lineWidth = s * 0.014;
    ctx.beginPath();
    armPath(ctx);
    ctx.stroke();

    // Складка на сгибе.
    ctx.strokeStyle = hexA(clothDeep, 0.34);
    ctx.lineWidth = s * 0.012;
    ctx.beginPath();
    ctx.moveTo(a.elbowX - s * 0.06, a.elbowY - s * 0.02);
    ctx.quadraticCurveTo(a.elbowX + s * 0.02, a.elbowY + s * 0.03,
                         a.elbowX + s * 0.09, a.elbowY - s * 0.01);
    ctx.stroke();

    // Кисть.
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(a.handX, a.handY + s * 0.03, handR * 0.92, handR * 1.05, 0.12, 0, Math.PI * 2);
    ctx.fill();
    // Большой палец.
    ctx.fillStyle = skinDark;
    ctx.beginPath();
    ctx.ellipse(a.handX - handR * 0.55, a.handY + s * 0.01, handR * 0.34, handR * 0.5, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // Манжета.
    ctx.strokeStyle = hexA(trim, 0.85);
    ctx.lineWidth = s * 0.022;
    ctx.beginPath();
    ctx.moveTo(a.handX - handR * 1.0, a.handY - s * 0.05);
    ctx.quadraticCurveTo(a.handX, a.handY - s * 0.10,
                         a.handX + handR * 1.0, a.handY - s * 0.05);
    ctx.stroke();
  }

  // ================================================================
  // 5. ВОРОТ, НАПЛЕЧНИКИ, ПОЯС.
  // ================================================================
  {
    // Ворот — V-вырез.
    ctx.fillStyle = hexA(clothDeep, 0.55);
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.22, shoulderY - s * 0.08);
    ctx.lineTo(cx, shoulderY + bodyH * 0.20);
    ctx.lineTo(cx + s * 0.22, shoulderY - s * 0.08);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = hexA(trim, 0.80);
    ctx.lineWidth = s * 0.020;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.24, shoulderY - s * 0.08);
    ctx.lineTo(cx, shoulderY + bodyH * 0.21);
    ctx.lineTo(cx + s * 0.24, shoulderY - s * 0.08);
    ctx.stroke();

    // Наплечники — только у доспеха.
    if (armored) {
      for (const q of [-1, 1]) {
        const px = cx + q * shoulderX * 0.80;
        const py = shoulderY + s * 0.04;
        const pg = ctx.createLinearGradient(px - s * 0.2, py - s * 0.2, px + s * 0.2, py + s * 0.2);
        pg.addColorStop(0, shade(trim, 0.14));
        pg.addColorStop(1, trimDark);
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.moveTo(px - q * s * 0.26, py - s * 0.10);
        ctx.quadraticCurveTo(px + q * s * 0.26, py - s * 0.20,
                             px + q * s * 0.20, py + s * 0.14);
        ctx.quadraticCurveTo(px - q * s * 0.02, py + s * 0.22,
                             px - q * s * 0.26, py - s * 0.10);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = hexA(trimDark, 0.80);
        ctx.lineWidth = s * 0.014;
        ctx.stroke();
        // Заклёпки.
        ctx.fillStyle = hexA(shade(trim, 0.40), 0.85);
        for (let i = 0; i < 2; i++) {
          ctx.beginPath();
          ctx.arc(px + q * s * (0.02 + i * 0.09), py + s * (0.02 + i * 0.04), s * 0.018, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // Нагрудная пластина.
      ctx.fillStyle = hexA(shade(trim, -0.28), 0.55);
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.26, chestY);
      ctx.quadraticCurveTo(cx, chestY + s * 0.18, cx + s * 0.26, chestY);
      ctx.lineTo(cx + s * 0.20, chestY + s * 0.30);
      ctx.quadraticCurveTo(cx, chestY + s * 0.44, cx - s * 0.20, chestY + s * 0.30);
      ctx.closePath();
      ctx.fill();
    }

    // Пояс.
    const beltG = ctx.createLinearGradient(0, hipY - s * 0.09, 0, hipY + s * 0.09);
    beltG.addColorStop(0, shade(trim, 0.06));
    beltG.addColorStop(0.55, trim);
    beltG.addColorStop(1, trimDark);
    ctx.fillStyle = beltG;
    ctx.beginPath();
    ctx.moveTo(cx - waistX * 1.02, hipY - s * 0.075);
    ctx.quadraticCurveTo(cx, hipY - s * 0.03, cx + waistX * 1.02, hipY - s * 0.075);
    ctx.lineTo(cx + waistX * 1.02, hipY + s * 0.075);
    ctx.quadraticCurveTo(cx, hipY + s * 0.115, cx - waistX * 1.02, hipY + s * 0.075);
    ctx.closePath();
    ctx.fill();
    // Пряжка.
    ctx.fillStyle = hexA(shade(trim, 0.45), 0.95);
    ctx.beginPath();
    ctx.ellipse(cx, hipY + s * 0.01, s * 0.065, s * 0.055, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hexA(trimDark, 0.80);
    ctx.beginPath();
    ctx.ellipse(cx, hipY + s * 0.01, s * 0.030, s * 0.026, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ================================================================
  // 6. ШЕЯ — трапеция с тенью под подбородком.
  // ================================================================
  const neckTop = robeTop - s * 0.30;
  {
    const neckG = ctx.createLinearGradient(cx, neckTop, cx, shoulderY + s * 0.10);
    neckG.addColorStop(0, skinDark);
    neckG.addColorStop(0.55, skin);
    neckG.addColorStop(1, shade(skin, -0.22));
    ctx.fillStyle = neckG;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.115, neckTop);
    ctx.quadraticCurveTo(cx - s * 0.135, shoulderY - s * 0.06,
                         cx - s * 0.185, shoulderY + s * 0.06);
    ctx.lineTo(cx + s * 0.185, shoulderY + s * 0.06);
    ctx.quadraticCurveTo(cx + s * 0.135, shoulderY - s * 0.06,
                         cx + s * 0.115, neckTop);
    ctx.closePath();
    ctx.fill();
    // Тень от подбородка.
    ctx.fillStyle = hexA(skinDark, 0.45);
    ctx.beginPath();
    ctx.ellipse(cx, neckTop + s * 0.045, s * 0.10, s * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Кисть ближней руки — за неё держится посох. Тело возвращает
  // реальную точку, а не формулу: иначе древко проходит сквозь рукав.
  const gripArm = armPose(1);

  return {
    headY: robeTop - s * 0.35, headR: s * 0.46, robeTop, bodyH, bodyW,
    grip: { x: gripArm.handX, y: gripArm.handY + s * 0.03 },
  };
}

// ------------------------------------------------------------------
// Зверь на четырёх лапах
// ------------------------------------------------------------------
//
// ЧТО БЫЛО НЕ ТАК.
//
// Тело — горизонтальный овал, лапы — четыре бруска, приставленных
// сбоку. Когти рисовались от baseY и висели В ВОЗДУХЕ под фигурой:
// в кадре они оказывались отдельным рядом галочек у нижней кромки.
// Шерсть — редкие палочки поверх овала.
//
// КАК ПОСТРОЕНО ТЕПЕРЬ.
//
// От скелета в профиль: круп → спина → лопатка → грудь. Четыре ноги
// строятся по точкам (бедро, колено, пятка, ступня) с изгибом, как у
// настоящей кошки; когти крепятся к СТУПНЕ, а не к baseY. Хвост
// сужается. Шерсть — короткие штрихи по контуру, а не по центру.
//
function bodyQuadruped(ctx, cx, baseY, s, pal, arch, t) {
  const breathe = Math.sin(t * 1.4) * s * 0.025;

  // --- КОНТРАСТ С ФОНОМ -------------------------------------------
  //
  // Палитра void даёт robe #150a20 — это темнее ночного фона арены.
  // Тело сливалось с ним, и от крысы оставались голова и когти.
  // Если основной цвет слишком тёмный, поднимаем его до читаемого:
  // зверь должен отделяться от фона, иначе силуэта просто нет.
  let col = pal.robe;
  {
    const m = /^#([0-9a-f]{6})$/i.exec(col);
    if (m) {
      const n = parseInt(m[1], 16);
      const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      const lum = (ch[0] * 0.299 + ch[1] * 0.587 + ch[2] * 0.114) / 255;
      if (lum < 0.30) {
        // Смешиваем с акцентом палитры — так зверь остаётся «в цвете»
        // вида, но перестаёт быть чёрным пятном.
        const a = /^#([0-9a-f]{6})$/i.exec(pal.accent || '#888888');
        const an = a ? parseInt(a[1], 16) : 0x888888;
        const acc = [(an >> 16) & 255, (an >> 8) & 255, an & 255];
        const k = Math.min(0.55, (0.34 - lum) * 1.8);
        const mix = ch.map((v, i) => Math.round(v + (acc[i] - v) * k));
        col = '#' + mix.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
      }
    }
  }
  const colMid = shade(col, -0.18);
  const colDark = shade(col, -0.40);
  const colDeep = shade(col, -0.62);
  const colLight = shade(col, 0.24);
  const claw = '#e8dcc0';
  const big = arch.build === 'broad' || arch.feral ? 1.08 : 1;

  // --- Скелет в профиль (голова справа) ---------------------------
  const rumpX = cx - s * 0.86;              // круп
  const shoulderX = cx + s * 0.62;          // лопатка
  const backY = baseY - s * 1.64 + breathe; // линия спины
  const bellyY = baseY - s * 1.00 + breathe;// брюхо
  const pawY = baseY - s * 0.22;            // подошвы
  const headY = baseY - s * 2.06 + breathe;

  // ================================================================
  // 1. ДАЛЬНИЕ НОГИ — позади корпуса, в тени.
  // ================================================================
  const drawLeg = (hipX, kneeX, footX, w, c0, c1, c2, far) => {
    const kneeY = (hipX === rumpX + s * 0.30)
      ? bellyY + s * 0.10    // задняя: колено вперёд
      : bellyY + s * 0.16;
    const legPath = (c) => {
      c.moveTo(hipX - w * 0.55, hipX < cx ? bellyY - s * 0.30 : bellyY - s * 0.42);
      // Передняя кромка.
      c.quadraticCurveTo(kneeX + w * 0.55, kneeY - s * 0.20,
                         footX + w * 0.30, pawY - s * 0.30);
      // Ступня.
      c.lineTo(footX + w * 0.42, pawY - s * 0.02);
      c.lineTo(footX - w * 0.34, pawY - s * 0.02);
      // Задняя кромка вверх.
      c.quadraticCurveTo(kneeX - w * 0.50, kneeY + s * 0.10,
                         hipX - w * 0.62, bellyY - s * 0.44);
      c.closePath();
    };
    const g = ctx.createLinearGradient(0, bellyY - s * 0.4, 0, pawY);
    g.addColorStop(0, c0);
    g.addColorStop(0.6, c1);
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.beginPath();
    legPath(ctx);
    ctx.fill();

    // КОГТИ — от ступни, а не от земли.
    ctx.fillStyle = claw;
    const toeY = pawY - s * 0.035;
    for (let i = -1; i <= 1; i++) {
      const tx = footX + i * w * 0.26;
      ctx.beginPath();
      ctx.moveTo(tx - s * 0.030, toeY);
      ctx.quadraticCurveTo(tx, toeY + s * 0.045, tx + s * 0.014, pawY + s * 0.030);
      ctx.quadraticCurveTo(tx + s * 0.020, toeY + s * 0.010, tx + s * 0.030, toeY);
      ctx.closePath();
      ctx.fill();
    }
    // Пальцы — тени между ними.
    ctx.strokeStyle = hexA(colDeep, far ? 0.35 : 0.55);
    ctx.lineWidth = s * 0.012;
    for (let i = 0; i < 2; i++) {
      const tx = footX + (i - 0.5) * w * 0.52;
      ctx.beginPath();
      ctx.moveTo(tx, pawY - s * 0.16);
      ctx.lineTo(tx, toeY);
      ctx.stroke();
    }
  };

  // Дальняя пара.
  drawLeg(rumpX + s * 0.16, rumpX + s * 0.34, rumpX + s * 0.22, s * 0.20,
    colDeep, colDeep, colDeep, true);
  drawLeg(shoulderX - s * 0.14, shoulderX - s * 0.06, shoulderX - s * 0.18, s * 0.19,
    colDeep, colDeep, colDeep, true);

  // ================================================================
  // 2. ХВОСТ — сужается от крупа к кончику.
  // ================================================================
  {
    const sway = Math.sin(t * 1.6) * s * 0.16;
    const segs = [
      [rumpX + s * 0.10, bellyY - s * 0.52, s * 0.17],
      [rumpX - s * 0.40, bellyY - s * 0.40, s * 0.145],
      [rumpX - s * 0.84, bellyY - s * 0.18 + sway * 0.5, s * 0.115],
      [rumpX - s * 1.20, bellyY + s * 0.04 + sway, s * 0.080],
      [rumpX - s * 1.46, bellyY - s * 0.06 + sway * 1.3, s * 0.045],
    ];
    const tailPath = (c) => {
      c.moveTo(segs[0][0], segs[0][1] - segs[0][2]);
      for (let i = 0; i < segs.length - 1; i++) {
        const [x0, y0, w0] = segs[i];
        const [x1, y1, w1] = segs[i + 1];
        c.quadraticCurveTo((x0 + x1) / 2, y0 - w0 * 1.3, x1, y1 - w1);
      }
      // Кончик и обратно по нижней кромке.
      for (let i = segs.length - 1; i > 0; i--) {
        const [x0, y0, w0] = segs[i];
        const [x1, y1, w1] = segs[i - 1];
        c.quadraticCurveTo((x0 + x1) / 2, y0 + w0 * 1.3, x1, y1 + w1);
      }
      c.closePath();
    };
    // Хвост светлее корпуса: тёмный сбегал в фон и крыса казалась
    // бесхвостой.
    const tg = ctx.createLinearGradient(rumpX, bellyY - s * 0.5, rumpX - s * 1.4, bellyY + s * 0.3);
    tg.addColorStop(0, col);
    tg.addColorStop(0.5, colMid);
    tg.addColorStop(1, colDark);
    ctx.fillStyle = tg;
    ctx.beginPath();
    tailPath(ctx);
    ctx.fill();
  }

  // ================================================================
  // 3. КОРПУС — от крупа к лопатке, с брюхом и объёмом.
  // ================================================================
  {
    const bodyPath = (c) => {
      c.moveTo(rumpX - s * 0.12, bellyY - s * 0.30);
      // Спина: круп → лопатка.
      c.quadraticCurveTo(cx - s * 0.30, backY - s * 0.14,
                         shoulderX - s * 0.20, backY + s * 0.10);
      // Холка вниз к груди.
      c.quadraticCurveTo(shoulderX + s * 0.30, backY + s * 0.42,
                         shoulderX + s * 0.24, bellyY + s * 0.06);
      // Грудь и брюхо.
      c.quadraticCurveTo(cx + s * 0.30, bellyY + s * 0.26,
                         cx - s * 0.20, bellyY + s * 0.20);
      c.quadraticCurveTo(cx - s * 0.60, bellyY + s * 0.14,
                         rumpX + s * 0.06, bellyY - s * 0.02);
      // Круп вверх.
      c.quadraticCurveTo(rumpX - s * 0.26, bellyY - s * 0.46,
                         rumpX - s * 0.12, bellyY - s * 0.30);
      c.closePath();
    };
    const bg = ctx.createLinearGradient(
      cx, backY - s * 0.2, cx, bellyY + s * 0.3);
    bg.addColorStop(0, colLight);
    bg.addColorStop(0.30, col);
    bg.addColorStop(0.72, colMid);
    bg.addColorStop(1, colDeep);
    ctx.fillStyle = bg;
    ctx.beginPath();
    bodyPath(ctx);
    ctx.fill();

    // Шкура: штрихи ПО КОНТУРУ спины, а не по центру.
    ctx.save();
    ctx.beginPath();
    bodyPath(ctx);
    ctx.clip();
    ctx.strokeStyle = hexA(colDeep, 0.30);
    ctx.lineWidth = s * 0.014;
    ctx.lineCap = 'round';
    for (let i = 0; i < 16; i++) {
      const k = i / 15;
      const px = rumpX + s * (0.06 + k * 1.72);
      const py = backY + s * (0.02 + Math.abs(Math.sin(k * 3.0)) * 0.26);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - s * 0.045, py + s * 0.10);
      ctx.stroke();
    }
    // Светлое брюхо.
    const bellyG = ctx.createLinearGradient(0, bellyY - s * 0.30, 0, bellyY + s * 0.26);
    bellyG.addColorStop(0, hexA(colLight, 0));
    bellyG.addColorStop(1, hexA(colLight, 0.30));
    ctx.fillStyle = bellyG;
    ctx.fillRect(rumpX - s * 0.4, bellyY - s * 0.40, s * 2.2, s * 0.72);
    ctx.restore();

    // Контур корпуса.
    ctx.strokeStyle = hexA(colDeep, 0.50);
    ctx.lineWidth = s * 0.016;
    ctx.beginPath();
    bodyPath(ctx);
    ctx.stroke();

    // Объём лопатки и бедра.
    ctx.fillStyle = hexA(colLight, 0.20);
    ctx.beginPath();
    ctx.ellipse(shoulderX - s * 0.06, backY + s * 0.34, s * 0.26, s * 0.20, -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hexA(colDeep, 0.26);
    ctx.beginPath();
    ctx.ellipse(rumpX + s * 0.22, backY + s * 0.46, s * 0.24, s * 0.22, 0.22, 0, Math.PI * 2);
    ctx.fill();
  }

  // ================================================================
  // 4. БЛИЖНИЕ НОГИ — поверх корпуса.
  // ================================================================
  drawLeg(rumpX + s * 0.30, rumpX + s * 0.50, rumpX + s * 0.38, s * 0.24,
    colMid, col, colDark, false);
  drawLeg(shoulderX + s * 0.02, shoulderX + s * 0.14, shoulderX - s * 0.02, s * 0.22,
    colMid, col, colDark, false);

  // ================================================================
  // 5. ШЕЯ — от лопатки к голове.
  // ================================================================
  {
    const neckPath = (c) => {
      // У зверя шея почти не видна: голова сидит на холке. Отдельный
      // «столб» шеи торчал справа острым углом и читался как деталь
      // от другого существа.
      c.moveTo(shoulderX - s * 0.34, backY + s * 0.04);
      c.quadraticCurveTo(shoulderX - s * 0.02, headY + s * 0.40,
                         shoulderX + s * 0.06, headY + s * 0.20);
      c.quadraticCurveTo(shoulderX + s * 0.06, headY + s * 0.56,
                         shoulderX - s * 0.06, bellyY - s * 0.52);
      c.quadraticCurveTo(shoulderX - s * 0.20, bellyY - s * 0.36,
                         shoulderX - s * 0.32, bellyY - s * 0.24);
      c.closePath();
    };
    const ng = ctx.createLinearGradient(
      shoulderX, backY, shoulderX + s * 0.5, headY);
    ng.addColorStop(0, colLight);
    ng.addColorStop(0.5, col);
    ng.addColorStop(1, colMid);
    ctx.fillStyle = ng;
    ctx.beginPath();
    neckPath(ctx);
    ctx.fill();
    ctx.strokeStyle = hexA(colDeep, 0.44);
    ctx.lineWidth = s * 0.014;
    ctx.beginPath();
    neckPath(ctx);
    ctx.stroke();
  }

  return {
    headY,
    headR: s * 0.44 * big,
    robeTop: backY + s * 0.10,
    bodyH: s * 1.55,
    bodyW: s * 1.20,
  };
}

// ------------------------------------------------------------------
// Змеиное тело без ног
// ------------------------------------------------------------------
function bodySerpent(ctx, cx, baseY, s, pal, arch, t) {
  const col = pal.robe;
  const wave = Math.sin(t * 1.2) * s * 0.12;

  // --- Свёрнутый хвост на земле.
  ctx.strokeStyle = shade(col, -0.2);
  ctx.lineWidth = s * 0.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - s * 1.5, baseY - s * 0.25);
  ctx.quadraticCurveTo(cx - s * 0.4, baseY + s * 0.15, cx + s * 0.3, baseY - s * 0.35);
  ctx.quadraticCurveTo(cx + s * 1.0, baseY - s * 0.7, cx + s * 0.55, baseY - s * 1.1);
  ctx.stroke();

  // --- Поднимающееся тело.
  const headY = baseY - s * 2.55 + wave;
  ctx.strokeStyle = col;
  ctx.lineWidth = s * 0.62;
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.1, baseY - s * 0.75);
  ctx.quadraticCurveTo(cx - s * 0.35, baseY - s * 1.7, cx + s * 0.12, headY + s * 0.35);
  ctx.stroke();

  // --- Брюшные пластины поперёк.
  ctx.strokeStyle = hexA(shade(col, 0.35), 0.7);
  ctx.lineWidth = s * 0.05;
  for (let i = 1; i <= 5; i++) {
    const k = i / 6;
    const py = baseY - s * (0.75 + k * 1.5);
    const pxx = cx + s * 0.1 - Math.sin(k * 2.4) * s * 0.18;
    ctx.beginPath();
    ctx.arc(pxx, py + wave * k, s * 0.2, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  }

  // --- Шипы по спине.
  ctx.fillStyle = hexA(pal.glow, 0.75);
  for (let i = 0; i < 4; i++) {
    const py = baseY - s * (0.95 + i * 0.42) + wave * (i / 4);
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.12, py);
    ctx.lineTo(cx - s * 0.34, py - s * 0.1);
    ctx.lineTo(cx - s * 0.1, py - s * 0.05);
    ctx.closePath();
    ctx.fill();
  }

  return { headY, headR: s * 0.48, robeTop: baseY - s * 2.1, bodyH: s * 2.0, bodyW: s * 0.62 };
}

// ------------------------------------------------------------------
// Бесплотный силуэт
// ------------------------------------------------------------------
function bodyFloating(ctx, cx, baseY, s, pal, arch, t) {
  const float = Math.sin(t * 1.3) * s * 0.11;
  const fy = baseY - s * 0.45 + float;
  const col = pal.robe;

  // --- Тень под призраком.
  const sh = ctx.createRadialGradient(cx, baseY, 0, cx, baseY, s * 0.85);
  sh.addColorStop(0, 'rgba(0,0,0,0.45)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh;
  ctx.beginPath();
  ctx.ellipse(cx, baseY, s * 0.85, s * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();

  // --- Полупрозрачное тело с рваным низом.
  ctx.save();
  ctx.globalAlpha = 0.82;
  const grd = ctx.createLinearGradient(cx, fy - s * 2.4, cx, fy + s * 0.3);
  grd.addColorStop(0, hexA(col, 0.9));
  grd.addColorStop(0.6, hexA(col, 0.5));
  grd.addColorStop(1, hexA(col, 0));
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.5, fy - s * 1.9);
  ctx.quadraticCurveTo(cx - s * 0.95, fy - s * 0.8, cx - s * 0.7, fy + s * 0.2);
  // Рваный край волнами.
  for (let i = 0; i < 4; i++) {
    const x0 = cx - s * 0.7 + i * s * 0.35;
    ctx.quadraticCurveTo(x0 + s * 0.18, fy + s * 0.45 + Math.sin(t * 2.4 + i) * s * 0.1,
                         x0 + s * 0.35, fy + s * 0.18);
  }
  ctx.quadraticCurveTo(cx + s * 0.95, fy - s * 0.8, cx + s * 0.5, fy - s * 1.9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // --- Свечение вокруг.
  const glow = ctx.createRadialGradient(cx, fy - s * 1.4, s * 0.2, cx, fy - s * 1.4, s * 1.9);
  glow.addColorStop(0, hexA(pal.glow, 0.28));
  glow.addColorStop(1, hexA(pal.glow, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, fy - s * 1.4, s * 1.9, 0, Math.PI * 2);
  ctx.fill();

  // --- Руки-тени по бокам.
  ctx.strokeStyle = hexA(col, 0.6);
  ctx.lineWidth = s * 0.16;
  ctx.lineCap = 'round';
  for (const q of [-1, 1]) {
    const sw = Math.sin(t * 1.7 + q) * s * 0.1;
    ctx.beginPath();
    ctx.moveTo(cx + q * s * 0.5, fy - s * 1.6);
    ctx.quadraticCurveTo(cx + q * s * 0.95, fy - s * 1.1 + sw,
                         cx + q * s * 0.85, fy - s * 0.6 + sw);
    ctx.stroke();
  }

  return { headY: fy - s * 2.3, headR: s * 0.44, robeTop: fy - s * 1.9, bodyH: s * 1.9, bodyW: s * 0.7 };
}

// ------------------------------------------------------------------
// Бесформенная масса
// ------------------------------------------------------------------
function bodyBlob(ctx, cx, baseY, s, pal, arch, t) {
  const wob = Math.sin(t * 2.1) * s * 0.05;
  const col = pal.robe;

  // --- Лужа под массой.
  ctx.fillStyle = hexA(col, 0.35);
  ctx.beginPath();
  ctx.ellipse(cx, baseY, s * 1.15, s * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();

  // --- Сама масса: неровный «мешок».
  ctx.fillStyle = hexA(col, 0.92);
  ctx.beginPath();
  ctx.moveTo(cx - s * 1.0, baseY);
  ctx.quadraticCurveTo(cx - s * 1.25, baseY - s * 1.2 + wob, cx - s * 0.5, baseY - s * 1.75 + wob);
  ctx.quadraticCurveTo(cx, baseY - s * 2.05 - wob, cx + s * 0.5, baseY - s * 1.75 + wob);
  ctx.quadraticCurveTo(cx + s * 1.25, baseY - s * 1.2 - wob, cx + s * 1.0, baseY);
  ctx.closePath();
  ctx.fill();

  // --- Блики — масса кажется мокрой.
  ctx.fillStyle = hexA('#ffffff', 0.22);
  ctx.beginPath();
  ctx.ellipse(cx - s * 0.38, baseY - s * 1.42 + wob, s * 0.2, s * 0.32, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hexA('#ffffff', 0.12);
  ctx.beginPath();
  ctx.ellipse(cx + s * 0.45, baseY - s * 1.2, s * 0.11, s * 0.2, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // --- Пузыри внутри — масса живая.
  for (let i = 0; i < 4; i++) {
    const ph = (t * 0.5 + i * 0.31) % 1;
    const bxx = cx + Math.sin(i * 2.1 + t * 0.7) * s * 0.55;
    const byy = baseY - s * (0.3 + ph * 1.2);
    ctx.fillStyle = hexA(shade(col, 0.45), 0.5 * (1 - ph));
    ctx.beginPath();
    ctx.arc(bxx, byy, s * (0.06 + (i % 3) * 0.03), 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Глазные стебельки выходят из массы.
  const headY = baseY - s * 1.95 + wob;
  ctx.strokeStyle = col;
  ctx.lineWidth = s * 0.13;
  ctx.lineCap = 'round';
  for (const q of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + q * s * 0.2, baseY - s * 1.6);
    ctx.quadraticCurveTo(cx + q * s * 0.42, headY + s * 0.1, cx + q * s * 0.24, headY + s * 0.15);
    ctx.stroke();
  }

  return { headY: headY - s * 0.05, headR: s * 0.42, robeTop: baseY - s * 1.8, bodyH: s * 1.8, bodyW: s * 1.0 };
}

// ------------------------------------------------------------------
// Шар с глазом
// ------------------------------------------------------------------
function bodyEye(ctx, cx, baseY, s, pal, arch, t) {
  const float = Math.sin(t * 1.2) * s * 0.1;
  const cy = baseY - s * 1.75 + float;
  const R = s * 0.95;

  // --- Тень.
  const sh = ctx.createRadialGradient(cx, baseY, 0, cx, baseY, s * 0.9);
  sh.addColorStop(0, 'rgba(0,0,0,0.4)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh;
  ctx.beginPath();
  ctx.ellipse(cx, baseY, s * 0.9, s * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();

  // --- Шар.
  ctx.fillStyle = pal.robe;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();
  const sh2 = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.35, R * 0.1, cx, cy, R);
  sh2.addColorStop(0, hexA(shade(pal.robe, 0.35), 0.7));
  sh2.addColorStop(1, hexA(shade(pal.robe, -0.35), 0.5));
  ctx.fillStyle = sh2;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();

  // --- Пасть снизу.
  ctx.fillStyle = '#1a0f14';
  ctx.beginPath();
  ctx.ellipse(cx, cy + R * 0.55, R * 0.45, R * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2ead6';
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * R * 0.16, cy + R * 0.42);
    ctx.lineTo(cx + i * R * 0.16 + R * 0.05, cy + R * 0.42);
    ctx.lineTo(cx + i * R * 0.16 + R * 0.025, cy + R * 0.58);
    ctx.closePath();
    ctx.fill();
  }

  // --- Большой глаз в центре.
  const eyeR = R * 0.42;
  const look = Math.sin(t * 0.6) * R * 0.08;
  ctx.fillStyle = '#f6f2e4';
  ctx.beginPath();
  ctx.ellipse(cx + look, cy - R * 0.12, eyeR, eyeR * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = pal.glow;
  ctx.beginPath();
  ctx.arc(cx + look, cy - R * 0.12, eyeR * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#120a12';
  ctx.beginPath();
  ctx.arc(cx + look, cy - R * 0.12, eyeR * 0.24, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.arc(cx + look - eyeR * 0.18, cy - R * 0.24, eyeR * 0.1, 0, Math.PI * 2);
  ctx.fill();

  // --- Стебельки с глазами по кругу.
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI * 0.85 + (i / 5) * Math.PI * 0.7 + Math.sin(t * 1.4 + i) * 0.1;
    const len = R * (1.35 + Math.sin(t * 2 + i) * 0.08);
    const ex = cx + Math.cos(a) * len;
    const ey = cy + Math.sin(a) * len;
    ctx.strokeStyle = pal.robe;
    ctx.lineWidth = s * 0.11;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * R * 0.9, cy + Math.sin(a) * R * 0.9);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.fillStyle = '#f6f2e4';
    ctx.beginPath();
    ctx.arc(ex, ey, s * 0.11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.glow;
    ctx.beginPath();
    ctx.arc(ex, ey, s * 0.055, 0, Math.PI * 2);
    ctx.fill();
  }

  return { headY: cy - R * 0.95, headR: s * 0.4, robeTop: cy - R, bodyH: R * 2, bodyW: R * 2 };
}

// ------------------------------------------------------------------
// Огромная фигура
// ------------------------------------------------------------------
function bodyGiant(ctx, cx, baseY, s, pal, arch, t) {
  const breathe = Math.sin(t * 1.1) * s * 0.05;
  const col = pal.robe;
  const H = s * 2.9;

  // --- Ноги-столбы.
  ctx.fillStyle = shade(col, -0.2);
  for (const q of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + q * s * 0.2, baseY);
    ctx.lineTo(cx + q * s * 0.55, baseY);
    ctx.lineTo(cx + q * s * 0.48, baseY - s * 1.15);
    ctx.lineTo(cx + q * s * 0.24, baseY - s * 1.15);
    ctx.closePath();
    ctx.fill();
    // Ступня.
    ctx.beginPath();
    ctx.ellipse(cx + q * s * 0.36, baseY - s * 0.05, s * 0.24, s * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Торс-бочка: широкие плечи, узкий пояс.
  const shoulderTop = baseY - H + breathe;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.75, baseY - s * 1.2);
  ctx.quadraticCurveTo(cx - s * 1.15, baseY - s * 1.9, cx - s * 1.05, shoulderTop + s * 0.15);
  ctx.quadraticCurveTo(cx - s * 0.55, shoulderTop - s * 0.15, cx, shoulderTop - s * 0.18);
  ctx.quadraticCurveTo(cx + s * 0.55, shoulderTop - s * 0.15, cx + s * 1.05, shoulderTop + s * 0.15);
  ctx.quadraticCurveTo(cx + s * 1.15, baseY - s * 1.9, cx + s * 0.75, baseY - s * 1.2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = hexA(pal.accent, 0.55);
  ctx.lineWidth = s * 0.05;
  ctx.stroke();

  // --- Пояс-ремень.
  ctx.fillStyle = shade(pal.accent, -0.15);
  ctx.fillRect(cx - s * 0.82, baseY - s * 1.45, s * 1.64, s * 0.2);

  // --- Кулаки по бокам.
  ctx.fillStyle = shade(col, -0.15);
  for (const q of [-1, 1]) {
    const swing = Math.sin(t * 0.9 + q) * s * 0.05;
    ctx.beginPath();
    ctx.ellipse(cx + q * s * 1.18, baseY - s * (1.35 + swing / s), s * 0.24, s * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    // Рука к плечу.
    ctx.strokeStyle = col;
    ctx.lineWidth = s * 0.3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + q * s * 0.95, shoulderTop + s * 0.3);
    ctx.lineTo(cx + q * s * 1.16, baseY - s * 1.5 + swing);
    ctx.stroke();
  }

  // --- Шея короткая, почти нет.
  ctx.fillStyle = pal.skin;
  ctx.fillRect(cx - s * 0.16, shoulderTop - s * 0.3, s * 0.32, s * 0.3);

  return { headY: shoulderTop - s * 0.5, headR: s * 0.5, robeTop: shoulderTop, bodyH: H - s * 0.5, bodyW: s * 1.1 };
}

// ------------------------------------------------------------------
// Ствол-тело
// ------------------------------------------------------------------
function bodyTree(ctx, cx, baseY, s, pal, arch, t) {
  const col = pal.robe;
  const H = s * 2.6;

  // --- Корни.
  ctx.strokeStyle = shade(col, -0.3);
  ctx.lineWidth = s * 0.14;
  ctx.lineCap = 'round';
  for (const q of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + q * s * 0.35, baseY - s * 0.2);
      ctx.quadraticCurveTo(cx + q * s * (0.7 + i * 0.15), baseY - s * 0.1,
                           cx + q * s * (0.85 + i * 0.22), baseY);
      ctx.stroke();
    }
  }

  // --- Ствол, сужающийся вверх.
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.42, baseY);
  ctx.quadraticCurveTo(cx - s * 0.36, baseY - H * 0.5, cx - s * 0.26, baseY - H);
  ctx.lineTo(cx + s * 0.26, baseY - H);
  ctx.quadraticCurveTo(cx + s * 0.36, baseY - H * 0.5, cx + s * 0.42, baseY);
  ctx.closePath();
  ctx.fill();

  // --- Кора: вертикальные борозды.
  ctx.strokeStyle = hexA(shade(col, -0.45), 0.6);
  ctx.lineWidth = s * 0.03;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * s * 0.13, baseY - s * 0.15);
    ctx.quadraticCurveTo(cx + i * s * 0.11, baseY - H * 0.55, cx + i * s * 0.09, baseY - H * 0.92);
    ctx.stroke();
  }

  // --- Ветви-руки.
  ctx.strokeStyle = shade(col, -0.1);
  ctx.lineWidth = s * 0.11;
  for (const q of [-1, 1]) {
    const sw = Math.sin(t * 0.8 + q) * s * 0.06;
    ctx.beginPath();
    ctx.moveTo(cx + q * s * 0.22, baseY - H * 0.72);
    ctx.quadraticCurveTo(cx + q * s * 0.85, baseY - H * 0.78 + sw,
                         cx + q * s * 1.05, baseY - H * 0.5 + sw);
    ctx.stroke();
    // Пальцы-веточки.
    ctx.lineWidth = s * 0.05;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + q * s * 1.05, baseY - H * 0.5 + sw);
      ctx.lineTo(cx + q * s * (1.2 + i * 0.05), baseY - H * (0.42 - i * 0.07) + sw);
      ctx.stroke();
    }
    ctx.lineWidth = s * 0.11;
  }

  // --- Листва вокруг кроны.
  ctx.fillStyle = hexA(pal.accent, 0.45);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + t * 0.2;
    const r = s * (0.55 + (i % 3) * 0.13);
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * r, baseY - H - s * 0.1 + Math.sin(a) * r * 0.5,
                s * 0.3, s * 0.22, a, 0, Math.PI * 2);
    ctx.fill();
  }

  return { headY: baseY - H - s * 0.45, headR: s * 0.42, robeTop: baseY - H, bodyH: H, bodyW: s * 0.6 };
}

/**
 * ТОЧКА ВХОДА: нарисовать тело под голову.
 *
 * Возвращает { headY, headR, robeTop, bodyH, bodyW } — где окажется
 * голова и какие габариты у тела. Вызывающий код дальше рисует голову
 * по этим числам.
 */
export function drawBody(ctx, cx, baseY, s, pal, enemy, t) {  const arch = enemy.archetype || {};
  const kind = enemy.bodyKind || 'robe';

  switch (kind) {
    case 'armor':     return bodyRobe(ctx, cx, baseY, s, pal, arch, t, true);
    case 'quadruped': return bodyQuadruped(ctx, cx, baseY, s, pal, arch, t);
    case 'serpent':   return bodySerpent(ctx, cx, baseY, s, pal, arch, t);
    case 'floating':  return bodyFloating(ctx, cx, baseY, s, pal, arch, t);
    case 'blob':      return bodyBlob(ctx, cx, baseY, s, pal, arch, t);
    case 'eye':       return bodyEye(ctx, cx, baseY, s, pal, arch, t);
    case 'giant':     return bodyGiant(ctx, cx, baseY, s, pal, arch, t);
    case 'tree':      return bodyTree(ctx, cx, baseY, s, pal, arch, t);
    case 'winged':    return bodyRobe(ctx, cx, baseY, s, pal, arch, t, false);
    case 'robe':
    default:          return bodyRobe(ctx, cx, baseY, s, pal, arch, t, false);
  }
}
