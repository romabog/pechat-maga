/**
 * ГОЛОВЫ СУЩЕСТВ ПОДЗЕМЕЛЬЯ
 * ========================
 * Отрисовка голов для врагов из вселенной Dungeons & Dragons.
 *
 * Зачем отдельный модуль. Прежний drawBeastHead рисовал звериную морду:
 * круглую голову, овальную морду, нос-треугольник. Для лиса это верно,
 * для дварфа, иллитида или драконорождённого — нет: подпись говорила
 * «Тифлинг», а на экране стоял зверь в мантии.
 *
 * Здесь у каждого вида своя анатомия:
 *   - люди (дварф, эльф, орк, тифлинг) — лицо с носом и губами;
 *   - драконы — вытянутая челюсть с зубами и гребнем;
 *   - иллитид — осьминог: купол и щупальца вместо рта;
 *   - лич — череп;
 *   - бехолдер — глаз с рожками-стебельками;
 *   - мимик — сундук с зубами.
 *
 * Стиль общий с остальной игрой: плоские заливки, контур в тон, мягкое
 * дыхание и подёргивание по времени t. Никаких загружаемых картинок —
 * всё процедурное, как и весь остальной рисунок игры.
 */

/** Полупрозрачный цвет из hex — та же функция, что в character.js. */
function hexA(hex, a) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/** Затемнить или осветлить цвет: k > 0 светлее, k < 0 темнее. */
function shade(hex, k) {
  const h = hex.replace('#', '');
  const num = parseInt(h.substring(0, 6), 16);
  let r = (num >> 16) & 255;
  let g = (num >> 8) & 255;
  let b = num & 255;
  if (k >= 0) {
    r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k;
  } else {
    r *= 1 + k; g *= 1 + k; b *= 1 + k;
  }
  const to = (v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/**
 * ГЛАЗА СУЩЕСТВА.
 *
 * Общие для всех видов: форма века и цвет задаются, но взгляд и
 * моргание — одна логика, чтобы существа не выглядели «ожившими
 * по-разному».
 *
 * @param glow настоящий ли глаз светится (у нежити и чудовищ)
 */
function creatureEyes(ctx, cx, eyeY, headR, style, pal, t, opts = {}) {
  const { glow = false, slit = false, off = 0.38, big = 1 } = opts;
  const eyeW = headR * 0.30 * big;
  const eyeH = headR * 0.36 * big;
  const dx = headR * off;

  // Моргание — раз в ~4 секунды, короткое, как в основной игре.
  const cyc = t % 4.2;
  let blink = 1;
  if (cyc < 0.12) blink = 1 - Math.sin((cyc / 0.12) * Math.PI) * 0.94;

  // Лёгкое блуждание взгляда: существо осматривается, а не смотрит в упор.
  const gx = Math.sin(t * 0.55) * headR * 0.035;
  const gy = Math.cos(t * 0.85) * headR * 0.02;

  for (const s of [-1, 1]) {
    const ex = cx + s * dx + gx;
    const ey = eyeY + gy;

    if (style === 'closed') {
      ctx.strokeStyle = hexA(pal.robe, 0.9);
      ctx.lineWidth = headR * 0.06;
      ctx.beginPath();
      ctx.arc(ex, ey, eyeW * 0.75, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      continue;
    }

    // Белок (у светящихся глаз его нет — сразу свечение).
    if (!glow) {
      ctx.fillStyle = '#f8f5ff';
      ctx.beginPath();
      ctx.ellipse(ex, ey, eyeW, eyeH * blink, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Радужка.
    const irisColor = glow ? pal.glow : pal.accent;
    ctx.fillStyle = irisColor;
    ctx.beginPath();
    const irisH = glow ? eyeH * blink : eyeH * 0.82 * blink;
    ctx.ellipse(ex, ey + headR * 0.01, eyeW * (glow ? 0.82 : 0.62), irisH, 0, 0, Math.PI * 2);
    ctx.fill();

    // Зрачок: у зверя и дракона — вертикальная щель, у людей — круглый.
    ctx.fillStyle = hexA('#0a0a14', glow ? 0.5 : 0.9);
    ctx.beginPath();
    if (slit) {
      ctx.ellipse(ex, ey + headR * 0.01, eyeW * 0.16, irisH * 0.85, 0, 0, Math.PI * 2);
    } else {
      ctx.ellipse(ex, ey + headR * 0.01, eyeW * 0.34, irisH * 0.62, 0, 0, Math.PI * 2);
    }
    ctx.fill();

    // Блик — точка жизни. У светящихся глаз его нет: там ровный огонь.
    if (!glow && blink > 0.4) {
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.beginPath();
      ctx.arc(ex - eyeW * 0.3, ey - eyeH * 0.34, eyeW * 0.19, 0, Math.PI * 2);
      ctx.fill();
    }

    // Свечение вокруг светящегося глаза.
    if (glow) {
      const halo = ctx.createRadialGradient(ex, ey, 0, ex, ey, eyeW * 2.1);
      halo.addColorStop(0, hexA(pal.glow, 0.45));
      halo.addColorStop(1, hexA(pal.glow, 0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(ex, ey, eyeW * 2.1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Бровь — сердитая складка у всех, кроме «спокойных».
    if (style === 'sharp' || style === 'glowing' || style === 'hollow') {
      ctx.strokeStyle = hexA(pal.hair, 0.95);
      ctx.lineWidth = headR * 0.055;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ex + s * eyeW * 1.1, ey - eyeH * 1.15);
      ctx.lineTo(ex - s * eyeW * 0.75, ey - eyeH * 0.62);
      ctx.stroke();
    }
  }
}

/**
 * РОГА.
 *
 * Виды рогов разные, и это главный маркер: у тифлинга загнутые назад,
 * у драконорождённого — вперёд и толстые, у минотавра — как у быка,
 * у кобольда маленькие.
 */
function creatureHorns(ctx, cx, headY, headR, kind, pal, t) {
  const hornColor = shade(pal.accent, -0.25);
  const light = shade(pal.accent, 0.35);
  ctx.save();
  ctx.lineCap = 'round';

  if (kind === 'tiefling') {
    // Загнутые назад рога — у тифлинга они растут изо лба и уходят за
    // затылок. Толщина падает к концу: рог сужается.
    for (const s of [-1, 1]) {
      ctx.strokeStyle = hornColor;
      ctx.lineWidth = headR * 0.16;
      ctx.beginPath();
      ctx.moveTo(cx + s * headR * 0.42, headY - headR * 0.78);
      ctx.quadraticCurveTo(
        cx + s * headR * 1.05, headY - headR * 1.35,
        cx + s * headR * 0.72, headY - headR * 1.95
      );
      ctx.stroke();
      ctx.strokeStyle = light;
      ctx.lineWidth = headR * 0.06;
      ctx.stroke();
    }
  } else if (kind === 'dragon') {
    // Драконьи рога: толстые у основания, смотрят вверх и в стороны,
    // с кольцами-насечками у старых драконов.
    for (const s of [-1, 1]) {
      ctx.fillStyle = hornColor;
      ctx.beginPath();
      ctx.moveTo(cx + s * headR * 0.34, headY - headR * 0.86);
      ctx.quadraticCurveTo(
        cx + s * headR * 0.95, headY - headR * 1.6,
        cx + s * headR * 1.25, headY - headR * 1.5
      );
      ctx.quadraticCurveTo(
        cx + s * headR * 0.82, headY - headR * 2.05,
        cx + s * headR * 0.5, headY - headR * 1.05
      );
      ctx.closePath();
      ctx.fill();
      // Кольца на роге.
      ctx.strokeStyle = hexA('#000000', 0.22);
      ctx.lineWidth = headR * 0.035;
      for (let i = 1; i <= 2; i++) {
        const p = i / 3;
        ctx.beginPath();
        ctx.moveTo(cx + s * headR * (0.45 + p * 0.5), headY - headR * (0.95 + p * 0.5));
        ctx.lineTo(cx + s * headR * (0.62 + p * 0.5), headY - headR * (1.05 + p * 0.45));
        ctx.stroke();
      }
    }
  } else if (kind === 'bull') {
    // Бычьи рога минотавра: в стороны и вверх, светлые к концу.
    for (const s of [-1, 1]) {
      ctx.strokeStyle = hornColor;
      ctx.lineWidth = headR * 0.2;
      ctx.beginPath();
      ctx.moveTo(cx + s * headR * 0.55, headY - headR * 0.55);
      ctx.quadraticCurveTo(
        cx + s * headR * 1.35, headY - headR * 0.75,
        cx + s * headR * 1.5, headY - headR * 1.35
      );
      ctx.stroke();
      ctx.strokeStyle = light;
      ctx.lineWidth = headR * 0.09;
      ctx.beginPath();
      ctx.moveTo(cx + s * headR * 1.2, headY - headR * 1.0);
      ctx.lineTo(cx + s * headR * 1.5, headY - headR * 1.35);
      ctx.stroke();
    }
  } else if (kind === 'small') {
    // Маленькие рожки кобольда и гоблина.
    for (const s of [-1, 1]) {
      ctx.fillStyle = hornColor;
      ctx.beginPath();
      ctx.moveTo(cx + s * headR * 0.3, headY - headR * 0.82);
      ctx.lineTo(cx + s * headR * 0.52, headY - headR * 1.18);
      ctx.lineTo(cx + s * headR * 0.1, headY - headR * 0.88);
      ctx.closePath();
      ctx.fill();
    }
  } else if (kind === 'antlers') {
    // Ветвистые рога древня.
    ctx.strokeStyle = '#6b4a2a';
    ctx.lineWidth = headR * 0.1;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * headR * 0.35, headY - headR * 0.85);
      ctx.quadraticCurveTo(cx + s * headR * 0.9, headY - headR * 1.6, cx + s * headR * 0.6, headY - headR * 2.2);
      ctx.stroke();
      for (const [px, py, qx, qy] of [
        [0.7, 1.35, 1.15, 1.5], [0.68, 1.7, 0.25, 1.95],
      ]) {
        ctx.beginPath();
        ctx.moveTo(cx + s * headR * px, headY - headR * py);
        ctx.lineTo(cx + s * headR * qx, headY - headR * qy);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

/**
 * ЩУПАЛЬЦА ИЛЛИТИДА — вместо рта.
 *
 * Четыре отростка из-под «лица», шевелятся волной. Это главный признак
 * пожирателя разума: без них голова читается как обычный лысый
 * гуманоид.
 */
function mindflayerTentacles(ctx, cx, headY, headR, pal, t) {
  const tentacle = shade(pal.hair, 0.12);
  const tip = hexA(pal.accent, 0.85);
  for (let i = 0; i < 4; i++) {
    const ox = (i - 1.5) * headR * 0.26;
    const ph = i * 0.7;
    const sway = Math.sin(t * 1.4 + ph) * headR * 0.16;
    const len = headR * (0.95 + Math.sin(ph) * 0.16);
    ctx.strokeStyle = tentacle;
    ctx.lineWidth = headR * 0.14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + ox, headY + headR * 0.2);
    ctx.quadraticCurveTo(
      cx + ox + sway * 0.5, headY + headR * 0.62,
      cx + ox + sway, headY + headR * 0.2 + len
    );
    ctx.stroke();
    // Присоска-кончик.
    ctx.fillStyle = tip;
    ctx.beginPath();
    ctx.arc(cx + ox + sway, headY + headR * 0.2 + len, headR * 0.075, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * ГОЛОВА СУЩЕСТВА — точка входа.
 *
 * Вид берётся из species.anatomy:
 *   'human'     — люди и полулюди (дварф, эльф, орк, тифлинг, фей)
 *   'dragon'    — драконорождённые и драконы
 *   'illithid'  — иллитид
 *   'skull'     — лич
 *   'beholder'  — бехолдер
 *   'blob'      — мимик, слизь
 *   'ghost'     — призрак
 *   'beast'     — звериная голова (тролль, гнолл, совомедведь)
 */
export function drawCreatureHead(ctx, cx, headY, headR, species, pal, eyeStyle, t) {
  const anat = species.anatomy || 'beast';
  const flesh = pal.skin;
  const dark = shade(flesh, -0.35);
  const line = hexA(dark, 0.9);

  // Рога рисуем ДО головы: они должны торчать из-за неё.
  if (species.horns) {
    creatureHorns(ctx, cx, headY, headR, species.hornKind || 'small', pal, t);
  }

  if (anat === 'human') {
    // --- ЧЕЛОВЕЧЕСКОЕ ЛИЦО ---------------------------------------
    //
    // ЧТО БЫЛО НЕ ТАК. Голова рисовалась одним овалом заливки, нос был
    // линией, губы — дугой. Не было черепа, скул, подбородка и тени
    // от волос, поэтому лицо выглядело наклейкой, а не объёмом.
    //
    // КАК ПОСТРОЕНО ТЕПЕРЬ:
    //   1. овал лица с сужением к подбородку
    //   2. тень по левой стороне (свет справа) — даёт объём
    //   3. скулы и надбровные дуги — светлые блики
    //   4. нос объёмный: спинка, крылья, тень
    //   5. губы с верхней и нижней губой разного тона
    //   6. тень под волосами и от подбородка на шею
    // ------------------------------------------------------------
    const fleshLight = shade(flesh, 0.14);
    const fleshMid = shade(flesh, -0.08);
    const fleshShadow = shade(flesh, -0.30);
    const fleshDeep = shade(flesh, -0.52);

    // 1. Овал лица.
    const facePath = (c) => {
      c.moveTo(cx - headR * 0.86, headY - headR * 0.30);
      // Левая скула вниз к подбородку.
      c.quadraticCurveTo(cx - headR * 0.92, headY + headR * 0.34,
                         cx - headR * 0.56, headY + headR * 0.80);
      c.quadraticCurveTo(cx - headR * 0.28, headY + headR * 1.10,
                         cx, headY + headR * 1.08);
      // Правая половина.
      c.quadraticCurveTo(cx + headR * 0.28, headY + headR * 1.10,
                         cx + headR * 0.56, headY + headR * 0.80);
      c.quadraticCurveTo(cx + headR * 0.92, headY + headR * 0.34,
                         cx + headR * 0.86, headY - headR * 0.30);
      // Лоб.
      c.quadraticCurveTo(cx + headR * 0.80, headY - headR * 1.06,
                         cx, headY - headR * 1.04);
      c.quadraticCurveTo(cx - headR * 0.80, headY - headR * 1.06,
                         cx - headR * 0.86, headY - headR * 0.30);
      c.closePath();
    };
    const faceG = ctx.createLinearGradient(
      cx + headR * 0.5, headY - headR * 0.8,
      cx - headR * 0.5, headY + headR * 0.9);
    faceG.addColorStop(0, fleshLight);
    faceG.addColorStop(0.45, flesh);
    faceG.addColorStop(1, fleshMid);
    ctx.fillStyle = faceG;
    ctx.beginPath();
    facePath(ctx);
    ctx.fill();

    // 2. Тень по левой стороне лица.
    ctx.save();
    ctx.beginPath();
    facePath(ctx);
    ctx.clip();
    const sideG = ctx.createLinearGradient(
      cx - headR * 0.9, 0, cx - headR * 0.1, 0);
    sideG.addColorStop(0, hexA(fleshShadow, 0.50));
    sideG.addColorStop(1, hexA(fleshShadow, 0));
    ctx.fillStyle = sideG;
    ctx.fillRect(cx - headR * 1.2, headY - headR * 1.2, headR * 2.4, headR * 2.6);

    // 3. Скулы — светлый блик.
    for (const q of [-1, 1]) {
      const cg = ctx.createRadialGradient(
        cx + q * headR * 0.56, headY + headR * 0.22, 0,
        cx + q * headR * 0.56, headY + headR * 0.22, headR * 0.42);
      cg.addColorStop(0, hexA(fleshLight, 0.42));
      cg.addColorStop(1, hexA(fleshLight, 0));
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(cx + q * headR * 0.56, headY + headR * 0.22, headR * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }

    // Тень под волосами — лоб не сливается с чёлкой.
    const browG = ctx.createLinearGradient(0, headY - headR * 1.02, 0, headY - headR * 0.34);
    browG.addColorStop(0, hexA(fleshShadow, 0.44));
    browG.addColorStop(1, hexA(fleshShadow, 0));
    ctx.fillStyle = browG;
    ctx.fillRect(cx - headR * 1.1, headY - headR * 1.05, headR * 2.2, headR * 0.72);
    ctx.restore();

    // Контур лица.
    ctx.strokeStyle = hexA(fleshDeep, 0.55);
    ctx.lineWidth = headR * 0.028;
    ctx.beginPath();
    facePath(ctx);
    ctx.stroke();

    // Уши: у эльфа острые и длинные, у остальных маленькие круглые.
    if (species.earKind === 'elf') {
      for (const q of [-1, 1]) {
        const eg = ctx.createLinearGradient(
          cx + q * headR * 0.8, headY - headR * 0.3,
          cx + q * headR * 1.45, headY - headR * 0.9);
        eg.addColorStop(0, fleshMid);
        eg.addColorStop(1, fleshLight);
        ctx.fillStyle = eg;
        ctx.beginPath();
        // Ухо НИЖЕ линии волос и отведено наружу: раньше оно
        // протыкало причёску и читалось как обломок.
        ctx.moveTo(cx + q * headR * 0.78, headY - headR * 0.10);
        ctx.quadraticCurveTo(cx + q * headR * 1.54, headY - headR * 0.72,
                             cx + q * headR * 1.46, headY + headR * 0.06);
        ctx.quadraticCurveTo(cx + q * headR * 1.08, headY + headR * 0.16,
                             cx + q * headR * 0.78, headY + headR * 0.24);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = hexA(fleshDeep, 0.55);
        ctx.lineWidth = headR * 0.024;
        ctx.stroke();
        // Внутренняя складка уха.
        ctx.strokeStyle = hexA(fleshDeep, 0.35);
        ctx.lineWidth = headR * 0.018;
        ctx.beginPath();
        ctx.moveTo(cx + q * headR * 0.90, headY - headR * 0.04);
        ctx.quadraticCurveTo(cx + q * headR * 1.26, headY - headR * 0.46,
                             cx + q * headR * 1.26, headY);
        ctx.stroke();
      }
    } else {
      for (const q of [-1, 1]) {
        const ex = cx + q * headR * 0.88;
        const ey = headY + headR * 0.12;
        const eg = ctx.createLinearGradient(ex, ey - headR * 0.28, ex, ey + headR * 0.28);
        eg.addColorStop(0, fleshMid);
        eg.addColorStop(1, fleshLight);
        ctx.fillStyle = eg;
        ctx.beginPath();
        ctx.ellipse(ex, ey, headR * 0.17, headR * 0.28, q * 0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = hexA(fleshDeep, 0.50);
        ctx.lineWidth = headR * 0.022;
        ctx.stroke();
        ctx.strokeStyle = hexA(fleshDeep, 0.30);
        ctx.lineWidth = headR * 0.015;
        ctx.beginPath();
        ctx.arc(ex, ey, headR * 0.10, -1.1, 1.1);
        ctx.stroke();
      }
    }

    // 4. НОС — объёмный.
    {
      const nx = cx;
      const nyTop = headY - headR * 0.06;
      const nyTip = headY + headR * 0.34;
      // Спинка носа.
      const noseG = ctx.createLinearGradient(nx - headR * 0.10, nyTop, nx + headR * 0.10, nyTip);
      noseG.addColorStop(0, hexA(fleshLight, 0.30));
      noseG.addColorStop(1, hexA(fleshShadow, 0.22));
      ctx.fillStyle = noseG;
      ctx.beginPath();
      ctx.moveTo(nx - headR * 0.075, nyTop);
      ctx.quadraticCurveTo(nx - headR * 0.115, nyTip - headR * 0.10,
                           nx - headR * 0.135, nyTip);
      // Кончик и крылья.
      ctx.quadraticCurveTo(nx, nyTip + headR * 0.075,
                           nx + headR * 0.135, nyTip);
      ctx.quadraticCurveTo(nx + headR * 0.115, nyTip - headR * 0.10,
                           nx + headR * 0.075, nyTop);
      ctx.closePath();
      ctx.fill();
      // Тень под носом.
      ctx.fillStyle = hexA(fleshShadow, 0.38);
      ctx.beginPath();
      ctx.ellipse(nx, nyTip + headR * 0.055, headR * 0.115, headR * 0.045, 0, 0, Math.PI * 2);
      ctx.fill();
      // Ноздри.
      ctx.fillStyle = hexA(fleshDeep, 0.55);
      for (const q of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(nx + q * headR * 0.075, nyTip - headR * 0.005,
                    headR * 0.026, headR * 0.020, q * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 5. ГУБЫ — две разные, с тенью между.
    {
      const ly = headY + headR * 0.56;
      const lw = headR * 0.25;
      // Верхняя губа.
      ctx.fillStyle = shade(flesh, -0.30);
      ctx.beginPath();
      ctx.moveTo(cx - lw, ly);
      ctx.quadraticCurveTo(cx - lw * 0.45, ly - headR * 0.075,
                           cx, ly - headR * 0.035);
      ctx.quadraticCurveTo(cx + lw * 0.45, ly - headR * 0.075,
                           cx + lw, ly);
      ctx.quadraticCurveTo(cx, ly + headR * 0.035, cx - lw, ly);
      ctx.closePath();
      ctx.fill();
      // Нижняя губа — светлее.
      ctx.fillStyle = shade(flesh, -0.18);
      ctx.beginPath();
      ctx.moveTo(cx - lw, ly);
      ctx.quadraticCurveTo(cx, ly + headR * 0.115, cx + lw, ly);
      ctx.quadraticCurveTo(cx, ly + headR * 0.030, cx - lw, ly);
      ctx.closePath();
      ctx.fill();
      // Щель рта.
      ctx.strokeStyle = hexA(fleshDeep, 0.72);
      ctx.lineWidth = headR * 0.020;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - lw * 0.92, ly);
      ctx.quadraticCurveTo(cx, ly + headR * 0.030, cx + lw * 0.92, ly);
      ctx.stroke();
      // Блики на нижней губе.
      ctx.fillStyle = hexA(fleshLight, 0.35);
      ctx.beginPath();
      ctx.ellipse(cx, ly + headR * 0.062, lw * 0.42, headR * 0.022, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Тень от подбородка — отделяет голову от шеи.
    ctx.fillStyle = hexA(fleshShadow, 0.34);
    ctx.beginPath();
    ctx.ellipse(cx, headY + headR * 1.10, headR * 0.30, headR * 0.10, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (anat === 'dragon') {
    // --- ДРАКОНЬЯ ГОЛОВА: череп, вытянутая морда, гребень.
    //
    // Форма строится из двух частей: череп (сверху, шире) и морда
    // (внизу, уже и длиннее). Так силуэт читается ящером, а не котом.
    ctx.fillStyle = flesh;
    ctx.beginPath();
    ctx.moveTo(cx - headR * 0.95, headY - headR * 0.35);
    ctx.quadraticCurveTo(cx - headR * 0.9, headY - headR * 1.18, cx, headY - headR * 1.12);
    ctx.quadraticCurveTo(cx + headR * 0.9, headY - headR * 1.18, cx + headR * 0.95, headY - headR * 0.35);
    ctx.lineTo(cx + headR * 0.62, headY + headR * 0.28);
    // Челюсть.
    ctx.quadraticCurveTo(cx + headR * 0.55, headY + headR * 1.05, cx, headY + headR * 1.12);
    ctx.quadraticCurveTo(cx - headR * 0.55, headY + headR * 1.05, cx - headR * 0.62, headY + headR * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = line;
    ctx.lineWidth = headR * 0.035;
    ctx.stroke();

    // Чешуя: ряды мелких полукругов по щекам.
    ctx.strokeStyle = hexA(shade(flesh, -0.25), 0.45);
    ctx.lineWidth = headR * 0.022;
    for (let row = 0; row < 3; row++) {
      for (const s of [-1, 1]) {
        for (let i = 0; i < 2; i++) {
          const x = cx + s * headR * (0.55 + i * 0.16);
          const y = headY + headR * (0.1 + row * 0.22);
          ctx.beginPath();
          ctx.arc(x, y, headR * 0.085, Math.PI * 0.15, Math.PI * 0.85);
          ctx.stroke();
        }
      }
    }

    // Гребень по хребту черепа.
    ctx.fillStyle = hexA(pal.accent, 0.9);
    for (let i = -2; i <= 2; i++) {
      const x = cx + i * headR * 0.2;
      const h = headR * (0.3 - Math.abs(i) * 0.05);
      ctx.beginPath();
      ctx.moveTo(x - headR * 0.08, headY - headR * 1.02);
      ctx.lineTo(x, headY - headR * 1.02 - h);
      ctx.lineTo(x + headR * 0.08, headY - headR * 1.02);
      ctx.closePath();
      ctx.fill();
    }

    // Зубы: два ряда треугольников по линии пасти.
    const mouthY = headY + headR * 0.62;
    ctx.fillStyle = '#f7f4ea';
    for (let i = 0; i < 4; i++) {
      const x = cx - headR * 0.42 + i * headR * 0.28;
      ctx.beginPath();
      ctx.moveTo(x, mouthY - headR * 0.06);
      ctx.lineTo(x + headR * 0.07, mouthY - headR * 0.06);
      ctx.lineTo(x + headR * 0.035, mouthY + headR * 0.16);
      ctx.closePath();
      ctx.fill();
    }
    // Линия пасти.
    ctx.strokeStyle = hexA(dark, 0.7);
    ctx.lineWidth = headR * 0.04;
    ctx.beginPath();
    ctx.moveTo(cx - headR * 0.55, mouthY);
    ctx.quadraticCurveTo(cx, mouthY + headR * 0.1, cx + headR * 0.55, mouthY);
    ctx.stroke();

    // Ноздри на кончике морды.
    ctx.fillStyle = hexA(dark, 0.75);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + s * headR * 0.13, headY + headR * 0.32, headR * 0.045, headR * 0.03, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (anat === 'illithid') {
    // --- ИЛЛИТИД: купол, огромные светящиеся глаза, щупальца, мантия.
    ctx.fillStyle = flesh;
    ctx.beginPath();
    ctx.ellipse(cx, headY - headR * 0.15, headR * 0.92, headR * 1.02, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = line;
    ctx.lineWidth = headR * 0.03;
    ctx.stroke();

    // Вздутия на куполе — признак пожирателя разума.
    ctx.strokeStyle = hexA(dark, 0.35);
    ctx.lineWidth = headR * 0.03;
    for (let i = 0; i < 4; i++) {
      const a = -0.9 + i * 0.6;
      ctx.beginPath();
      ctx.arc(cx + Math.sin(a) * headR * 0.5, headY - headR * 0.75, headR * 0.16, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }

    mindflayerTentacles(ctx, cx, headY, headR, pal, t);
    // Глаза иллитида — светящиеся и очень крупные.
    creatureEyes(ctx, cx, headY - headR * 0.22, headR, eyeStyle, pal, t, { glow: true, big: 1.35, off: 0.42 });
    return;
  } else if (anat === 'skull') {
    // --- ЧЕРЕП: лич и скелеты.
    ctx.fillStyle = '#efeade';
    ctx.beginPath();
    ctx.ellipse(cx, headY - headR * 0.15, headR * 0.85, headR * 0.95, 0, 0, Math.PI * 2);
    ctx.fill();
    // Скулы.
    ctx.beginPath();
    ctx.moveTo(cx - headR * 0.45, headY + headR * 0.5);
    ctx.lineTo(cx + headR * 0.45, headY + headR * 0.5);
    ctx.lineTo(cx + headR * 0.3, headY + headR * 0.95);
    ctx.lineTo(cx - headR * 0.3, headY + headR * 0.95);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,50,40,0.5)';
    ctx.lineWidth = headR * 0.025;
    ctx.stroke();

    // Глазницы — пустые, но с огоньком внутри: лич «смотрит».
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#1a1418';
      ctx.beginPath();
      ctx.ellipse(cx + s * headR * 0.36, headY - headR * 0.1, headR * 0.22, headR * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
      const pulse = 0.55 + Math.sin(t * 2.2) * 0.2;
      ctx.fillStyle = hexA(pal.glow, pulse);
      ctx.beginPath();
      ctx.arc(cx + s * headR * 0.36, headY - headR * 0.1, headR * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Нос — перевёрнутое сердечко из двух дуг.
    ctx.fillStyle = '#1a1418';
    ctx.beginPath();
    ctx.moveTo(cx, headY + headR * 0.12);
    ctx.lineTo(cx - headR * 0.12, headY + headR * 0.34);
    ctx.lineTo(cx + headR * 0.12, headY + headR * 0.34);
    ctx.closePath();
    ctx.fill();

    // Зубы — вертикальные полоски у нижней челюсти.
    ctx.strokeStyle = 'rgba(60,50,40,0.55)';
    ctx.lineWidth = headR * 0.028;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * headR * 0.14, headY + headR * 0.52);
      ctx.lineTo(cx + i * headR * 0.14, headY + headR * 0.82);
      ctx.stroke();
    }
    return;
  } else if (anat === 'beholder') {
    // --- БЕХОЛДЕР: шар, один огромный глаз, стебельки с глазами.
    ctx.fillStyle = flesh;
    ctx.beginPath();
    ctx.arc(cx, headY, headR * 1.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = line;
    ctx.lineWidth = headR * 0.04;
    ctx.stroke();

    // Стебельки с глазами — рисуем позади шара по краям.
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI * 0.85 + (i / 5) * Math.PI * 1.7;
      const sx = cx + Math.cos(a) * headR * 1.0;
      const sy = headY + Math.sin(a) * headR * 1.0;
      const sway = Math.sin(t * 1.3 + i * 1.1) * headR * 0.1;
      const ex = sx + Math.cos(a) * headR * 0.42 + sway;
      const ey = sy + Math.sin(a) * headR * 0.42;
      ctx.strokeStyle = flesh;
      ctx.lineWidth = headR * 0.1;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.fillStyle = '#efe6d8';
      ctx.beginPath();
      ctx.arc(ex, ey, headR * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = hexA(pal.accent, 0.9);
      ctx.beginPath();
      ctx.arc(ex, ey, headR * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }

    // Центральный глаз: белок, радужка, зрачок, блик.
    ctx.fillStyle = '#f4efe4';
    ctx.beginPath();
    ctx.arc(cx, headY, headR * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = hexA(dark, 0.5);
    ctx.lineWidth = headR * 0.03;
    ctx.stroke();
    const px = Math.sin(t * 0.7) * headR * 0.1;
    const py = Math.cos(t * 0.9) * headR * 0.07;
    ctx.fillStyle = pal.accent;
    ctx.beginPath();
    ctx.arc(cx + px, headY + py, headR * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0a0a12';
    ctx.beginPath();
    ctx.arc(cx + px, headY + py, headR * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(cx + px - headR * 0.1, headY + py - headR * 0.12, headR * 0.07, 0, Math.PI * 2);
    ctx.fill();

    // Зубастая пасть снизу шара.
    ctx.fillStyle = '#1a1016';
    ctx.beginPath();
    ctx.ellipse(cx, headY + headR * 0.78, headR * 0.34, headR * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2ecdc';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * headR * 0.12 - headR * 0.04, headY + headR * 0.66);
      ctx.lineTo(cx + i * headR * 0.12 + headR * 0.04, headY + headR * 0.66);
      ctx.lineTo(cx + i * headR * 0.12, headY + headR * 0.8);
      ctx.closePath();
      ctx.fill();
    }
    return;
  } else if (anat === 'blob') {
    // --- МИМИК: сундук с крышкой, зубами и языком.
    const w = headR * 1.05;
    const h = headR * 0.95;
    ctx.fillStyle = shade(pal.robe, 0.25);
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(cx - w, headY - h * 0.1, w * 2, h * 1.1, headR * 0.1)
      : ctx.rect(cx - w, headY - h * 0.1, w * 2, h * 1.1);
    ctx.fill();
    ctx.strokeStyle = '#3a2a14';
    ctx.lineWidth = headR * 0.05;
    ctx.stroke();

    // Крышка — полукруг сверху, приоткрыта (это и есть пасть).
    ctx.fillStyle = shade(pal.robe, 0.45);
    ctx.beginPath();
    ctx.moveTo(cx - w, headY - h * 0.05);
    ctx.quadraticCurveTo(cx, headY - h * 0.95, cx + w, headY - h * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#3a2a14';
    ctx.stroke();

    // Пасть: тёмная щель с зубами.
    ctx.fillStyle = '#150c10';
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.92, headY + h * 0.12);
    ctx.quadraticCurveTo(cx, headY + h * 0.5, cx + w * 0.92, headY + h * 0.12);
    ctx.lineTo(cx + w * 0.92, headY + h * 0.3);
    ctx.quadraticCurveTo(cx, headY + h * 0.66, cx - w * 0.92, headY + h * 0.3);
    ctx.closePath();
    ctx.fill();

    // Зубы обоих рядов.
    ctx.fillStyle = '#f5efdf';
    for (let i = 0; i < 6; i++) {
      const x = cx - w * 0.75 + i * w * 0.3;
      ctx.beginPath();
      ctx.moveTo(x, headY + h * 0.18);
      ctx.lineTo(x + w * 0.12, headY + h * 0.18);
      ctx.lineTo(x + w * 0.06, headY + h * 0.36);
      ctx.closePath();
      ctx.fill();
    }

    // Замок-«нос» и глаза на крышке.
    ctx.fillStyle = pal.accent;
    ctx.beginPath();
    ctx.arc(cx, headY + h * 0.42, headR * 0.13, 0, Math.PI * 2);
    ctx.fill();
    creatureEyes(ctx, cx, headY - h * 0.42, headR * 0.62, eyeStyle, pal, t, { off: 0.34 });
    return;
  } else if (anat === 'ghost') {
    // --- ПРИЗРАК: полупрозрачный силуэт с рваным низом.
    ctx.fillStyle = hexA(pal.skin, 0.5);
    ctx.beginPath();
    ctx.moveTo(cx - headR * 0.85, headY + headR * 0.2);
    ctx.quadraticCurveTo(cx - headR * 0.8, headY - headR * 1.15, cx, headY - headR * 1.1);
    ctx.quadraticCurveTo(cx + headR * 0.8, headY - headR * 1.15, cx + headR * 0.85, headY + headR * 0.2);
    // Рваный низ: три волны.
    for (let i = 0; i <= 3; i++) {
      const x = cx + headR * (0.85 - i * 0.57);
      const y = headY + headR * (1.15 + Math.sin(t * 2 + i) * 0.14);
      ctx.quadraticCurveTo(x + headR * 0.28, y - headR * 0.4, x - headR * 0.28, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = hexA(pal.glow, 0.5);
    ctx.lineWidth = headR * 0.035;
    ctx.stroke();
    creatureEyes(ctx, cx, headY - headR * 0.05, headR, eyeStyle, pal, t, { glow: true });
    return;
  }

  // --- ЗВЕРИНАЯ ГОЛОВА (тролль, гнолл, совомедведь, гарпия).
  ctx.fillStyle = flesh;
  ctx.beginPath();
  ctx.ellipse(cx, headY, headR * 0.95, headR, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = line;
  ctx.lineWidth = headR * 0.03;
  ctx.stroke();

  // Морда.
  ctx.fillStyle = shade(flesh, 0.18);
  ctx.beginPath();
  ctx.ellipse(cx, headY + headR * 0.42, headR * 0.52, headR * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Нос.
  ctx.fillStyle = hexA(dark, 0.85);
  ctx.beginPath();
  ctx.moveTo(cx - headR * 0.12, headY + headR * 0.36);
  ctx.lineTo(cx + headR * 0.12, headY + headR * 0.36);
  ctx.lineTo(cx, headY + headR * 0.5);
  ctx.closePath();
  ctx.fill();

  // Клыки — у тролля и гнолла они торчат снизу вверх.
  if (species.tusks) {
    ctx.fillStyle = '#f7f2e2';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * headR * 0.3, headY + headR * 0.72);
      ctx.lineTo(cx + s * headR * 0.2, headY + headR * 0.72);
      ctx.lineTo(cx + s * headR * 0.25, headY + headR * 0.42);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Уши/перья по виду.
  if (species.earKind === 'feather') {
    for (const s of [-1, 1]) {
      ctx.fillStyle = pal.accent;
      ctx.beginPath();
      ctx.ellipse(cx + s * headR * 0.78, headY - headR * 0.62, headR * 0.24, headR * 0.42, s * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (species.earKind === 'pointed') {
    for (const s of [-1, 1]) {
      ctx.fillStyle = flesh;
      ctx.beginPath();
      ctx.moveTo(cx + s * headR * 0.55, headY - headR * 0.7);
      ctx.lineTo(cx + s * headR * 1.05, headY - headR * 1.5);
      ctx.lineTo(cx + s * headR * 0.95, headY - headR * 0.5);
      ctx.closePath();
      ctx.fill();
    }
  }

  creatureEyes(ctx, cx, headY - headR * 0.02, headR, eyeStyle, pal, t, {
    slit: !!species.slitEyes,
    glow: !!species.glowEyes,
  });
}

/**
 * КРЫЛЬЯ — за спиной существа.
 *
 * Нужны драконам, гарпиям, горгульям и феям. Рисуются ДО тела, чтобы
 * оказаться позади него, и по-разному: кожистые перепонки, птичьи
 * перья, каменные пластины, стрекозиные.
 */
export function drawCreatureWings(ctx, cx, bodyTopY, scale, kind, pal, t) {
  if (!kind) return;
  const flap = Math.sin(t * 1.6) * 0.09;
  const span = scale * 2.15;

  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(cx + s * scale * 0.3, bodyTopY + scale * 0.34);
    ctx.scale(s, 1);
    ctx.rotate(flap);

    if (kind === 'dragon') {
      // Кожистая перепонка: кости-лучи и полотно между ними.
      ctx.fillStyle = hexA(pal.accent, 0.62);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(span * 0.55, -scale * 0.85, span, -scale * 0.5);
      ctx.quadraticCurveTo(span * 0.82, -scale * 0.02, span * 0.9, scale * 0.42);
      ctx.quadraticCurveTo(span * 0.5, scale * 0.24, span * 0.45, scale * 0.56);
      ctx.quadraticCurveTo(span * 0.24, scale * 0.2, 0, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = hexA(shade(pal.accent, -0.4), 0.8);
      ctx.lineWidth = scale * 0.03;
      ctx.stroke();
      // Лучи.
      ctx.strokeStyle = hexA(shade(pal.accent, -0.3), 0.6);
      ctx.lineWidth = scale * 0.035;
      for (const [ex, ey] of [[span, -scale * 0.5], [span * 0.9, scale * 0.42], [span * 0.45, scale * 0.56]]) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
    } else if (kind === 'feather') {
      // Птичьи перья веером.
      ctx.fillStyle = hexA(pal.robe, 0.9);
      for (let i = 0; i < 5; i++) {
        const a = -0.95 + i * 0.34;
        ctx.save();
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(span * 0.5, 0, span * 0.46, scale * 0.13, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.strokeStyle = hexA(pal.accent, 0.5);
      ctx.lineWidth = scale * 0.02;
      for (let i = 0; i < 5; i++) {
        const a = -0.95 + i * 0.34;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * span * 0.9, Math.sin(a) * span * 0.9);
        ctx.stroke();
      }
    } else if (kind === 'stone') {
      // Каменные пластины горгульи.
      ctx.fillStyle = hexA(shade(pal.robe, 0.3), 0.92);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(span * (0.45 + i * 0.2), -scale * (0.62 - i * 0.1));
        ctx.lineTo(span * (0.55 + i * 0.2), scale * (0.16 + i * 0.1));
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = hexA('#000000', 0.25);
        ctx.lineWidth = scale * 0.025;
        ctx.stroke();
      }
    } else if (kind === 'gossamer') {
      // Стрекозиные крылья феи — прозрачные, с жилками.
      ctx.fillStyle = hexA(pal.glow, 0.3);
      ctx.strokeStyle = hexA(pal.glow, 0.75);
      ctx.lineWidth = scale * 0.018;
      for (const [w, h, rot] of [[span * 0.62, scale * 0.28, -0.5], [span * 0.5, scale * 0.22, 0.24]]) {
        ctx.save();
        ctx.rotate(rot);
        ctx.beginPath();
        ctx.ellipse(span * 0.44, 0, w, h, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();
  }
}

/**
 * ХВОСТ ДРАКОНА / ЯЩЕРА.
 *
 * Змеиный хвост с чешуёй и шипами по гребню. У людей хвоста нет,
 * поэтому вызывать нужно только по признаку вида.
 */
export function drawCreatureTail(ctx, cx, baseY, scale, pal, t) {
  const sway = Math.sin(t * 1.2) * scale * 0.22;
  ctx.strokeStyle = pal.hair;
  ctx.lineWidth = scale * 0.24;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + scale * 0.32, baseY - scale * 0.5);
  ctx.quadraticCurveTo(
    cx + scale * 1.5, baseY - scale * 0.72,
    cx + scale * 1.9 + sway, baseY + scale * 0.16
  );
  ctx.stroke();

  // Шипы по гребню хвоста.
  ctx.fillStyle = hexA(pal.accent, 0.9);
  for (let i = 0; i < 4; i++) {
    const p = 0.2 + i * 0.2;
    const x = cx + scale * (0.32 + p * 1.55) + sway * p;
    const y = baseY - scale * (0.5 - p * 0.1) - scale * 0.12;
    ctx.beginPath();
    ctx.moveTo(x - scale * 0.06, y);
    ctx.lineTo(x, y - scale * 0.2);
    ctx.lineTo(x + scale * 0.06, y);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * ОСОБЫЕ ДЕТАЛИ ВИДА
 * ===================
 * Каждый из семидесяти видов получил свою метку `extra`, и она рисует
 * то, что делает вид непохожим на соседей: у одного гребень, у другого
 * иней, у третьего корона.
 *
 * ЗАЧЕМ ЭТО ОТДЕЛЬНО ОТ ГОЛОВЫ. Анатомий восемь (человек, дракон,
 * иллитид, череп, бехолдер, масса, призрак, зверь), а видов семьдесят.
 * Восемь форм на семьдесят существ не различают их — дракон с рогами и
 * дракон с рогами выглядят одинаково, меняется только цвет. Деталь
 * поверх головы добавляет то, чего в анатомии нет: конкретный признак
 * конкретного вида.
 *
 * Положение всех деталей считается от головы (headY, headR), поэтому
 * они садятся правильно на любое тело.
 */
export function drawSpeciesExtra(ctx, cx, headY, headR, extra, pal, t) {
  if (!extra) return;
  const R = headR;
  const gl = 0.6 + Math.sin(t * 2.2) * 0.25;

  switch (extra) {
    // --- Крысиные усы и зубы.
    case 'whiskers': {
      ctx.strokeStyle = hexA(shade(pal.robe, 0.5), 0.75);
      ctx.lineWidth = R * 0.03;
      for (const q of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const a = (i - 1) * 0.28;
          ctx.beginPath();
          ctx.moveTo(cx + q * R * 0.32, headY + R * 0.34);
          ctx.quadraticCurveTo(
            cx + q * R * 1.0, headY + R * (0.3 + a),
            cx + q * R * 1.45, headY + R * (0.2 + a * 1.6)
          );
          ctx.stroke();
        }
      }
      // Резцы.
      ctx.fillStyle = '#f4ecd8';
      for (const q of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + q * R * 0.12, headY + R * 0.62);
        ctx.lineTo(cx + q * R * 0.26, headY + R * 0.62);
        ctx.lineTo(cx + q * R * 0.19, headY + R * 0.95);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }

    // --- Гребень по шее и спине: дракон, ящер.
    case 'crest': {
      ctx.fillStyle = hexA(pal.accent, 0.9);
      for (let i = 0; i < 6; i++) {
        const y = headY - R * 0.1 + i * R * 0.34;
        const w = R * (0.3 - i * 0.03);
        ctx.beginPath();
        ctx.moveTo(cx - R * 0.4, y);
        ctx.lineTo(cx - R * 0.4 - w, y - R * 0.12);
        ctx.lineTo(cx - R * 0.4, y + R * 0.2);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }

    // --- Один большой рог или гребень юнца.
    case 'horns1': {
      ctx.strokeStyle = '#e8dcc0';
      ctx.lineWidth = R * 0.13;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx, headY - R * 0.72);
      ctx.quadraticCurveTo(cx - R * 0.15, headY - R * 1.4, cx + R * 0.1, headY - R * 1.7);
      ctx.stroke();
      break;
    }

    // --- Шипы по всему телу.
    case 'spikes': {
      ctx.fillStyle = hexA(pal.glow, 0.85);
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI * 0.5 + (i - 2) * 0.45;
        const r0 = R * 1.05;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a - 0.14) * r0, headY + Math.sin(a - 0.14) * r0);
        ctx.lineTo(cx + Math.cos(a) * r0 * 1.5, headY + Math.sin(a) * r0 * 1.5);
        ctx.lineTo(cx + Math.cos(a + 0.14) * r0, headY + Math.sin(a + 0.14) * r0);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }

    // --- Воротник-жабо вокруг шеи.
    case 'frill': {
      ctx.fillStyle = hexA(pal.accent, 0.55);
      ctx.strokeStyle = hexA(pal.glow, 0.7);
      ctx.lineWidth = R * 0.04;
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * 0.12 + (i / 8) * Math.PI * 0.76;
        const px = cx + Math.cos(a) * R * 1.15;
        const py = headY + Math.sin(a) * R * 1.15;
        ctx.beginPath();
        ctx.ellipse(px, py, R * 0.22, R * 0.1, a, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }

    // --- Сосульки: белый дракон, ледяной великан.
    case 'icicles': {
      ctx.fillStyle = hexA('#cfeeff', 0.9);
      for (let i = 0; i < 5; i++) {
        const px = cx + (i - 2) * R * 0.36;
        const len = R * (0.5 + (i % 2) * 0.25);
        ctx.beginPath();
        ctx.moveTo(px - R * 0.08, headY - R * 0.55);
        ctx.lineTo(px + R * 0.08, headY - R * 0.55);
        ctx.lineTo(px, headY - R * 0.55 - len);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }

    // --- Капли кислоты с пасти.
    case 'acid': {
      ctx.fillStyle = hexA(pal.glow, gl);
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.8 + i * 0.33) % 1;
        const px = cx + (i - 1) * R * 0.3;
        const py = headY + R * 0.8 + ph * R * 0.8;
        ctx.beginPath();
        ctx.ellipse(px, py, R * 0.06, R * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    // --- Пламя вокруг головы.
    case 'flame': {
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI * 0.85 + (i / 6) * Math.PI * 1.7;
        const len = R * (0.5 + Math.sin(t * 5 + i * 1.3) * 0.2);
        const px = cx + Math.cos(a) * R * 1.0;
        const py = headY + Math.sin(a) * R * 1.0;
        const g = ctx.createRadialGradient(px, py, 0, px, py, len);
        g.addColorStop(0, hexA('#ffe08a', 0.9));
        g.addColorStop(0.5, hexA(pal.glow, 0.6));
        g.addColorStop(1, hexA(pal.glow, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, len, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    // --- Кольца воды вокруг.
    case 'waves': {
      ctx.strokeStyle = hexA(pal.glow, 0.6);
      ctx.lineWidth = R * 0.06;
      for (let i = 0; i < 3; i++) {
        const rr = R * (1.1 + i * 0.3) + Math.sin(t * 2 + i) * R * 0.06;
        ctx.beginPath();
        ctx.ellipse(cx, headY + R * 0.6, rr, rr * 0.34, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }

    // --- Вихрь воздуха.
    case 'whirl': {
      ctx.strokeStyle = hexA(pal.glow, 0.55);
      ctx.lineWidth = R * 0.05;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        for (let k = 0; k <= 20; k++) {
          const a = (k / 20) * Math.PI * 2 + t * 2 + i;
          const rr = R * (0.8 + k / 20 * 0.8);
          const px = cx + Math.cos(a) * rr;
          const py = headY + Math.sin(a) * rr * 0.5 + R * 0.3;
          if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      break;
    }

    // --- Корона из каменных зубцов.
    case 'rocky': {
      ctx.fillStyle = hexA(shade(pal.robe, 0.3), 0.9);
      for (let i = 0; i < 4; i++) {
        const px = cx + (i - 1.5) * R * 0.4;
        ctx.beginPath();
        ctx.moveTo(px - R * 0.16, headY - R * 0.6);
        ctx.lineTo(px, headY - R * (1.0 + (i % 2) * 0.2));
        ctx.lineTo(px + R * 0.16, headY - R * 0.6);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }

    // --- Грозовая корона.
    case 'stormcrown': {
      ctx.strokeStyle = hexA(pal.glow, gl);
      ctx.lineWidth = R * 0.06;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(cx, headY - R * 1.15, R * (0.5 + i * 0.2), Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      }
      break;
    }

    // --- Рёбра скелета.
    case 'ribs': {
      ctx.strokeStyle = hexA('#e8e2d2', 0.65);
      ctx.lineWidth = R * 0.07;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(cx, headY + R * (1.0 + i * 0.3), R * 0.6, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
      break;
    }

    // --- Плащ-крыло вампира и дьявола.
    case 'batcape': {
      ctx.fillStyle = hexA(shade(pal.robe, -0.45), 0.8);
      for (const q of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + q * R * 0.5, headY + R * 0.5);
        ctx.quadraticCurveTo(cx + q * R * 2.2, headY + R * 0.2, cx + q * R * 2.0, headY + R * 2.4);
        ctx.lineTo(cx + q * R * 0.6, headY + R * 1.9);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }

    // --- Хвост с остриём.
    case 'tailspade': {
      const sway = Math.sin(t * 1.4) * R * 0.3;
      ctx.strokeStyle = shade(pal.robe, -0.2);
      ctx.lineWidth = R * 0.13;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx + R * 0.6, headY + R * 2.0);
      ctx.quadraticCurveTo(cx + R * 2.2, headY + R * 2.2, cx + R * 2.6 + sway, headY + R * 1.4);
      ctx.stroke();
      ctx.fillStyle = hexA(pal.accent, 0.9);
      ctx.beginPath();
      ctx.moveTo(cx + R * 2.6 + sway, headY + R * 1.2);
      ctx.lineTo(cx + R * 2.95 + sway, headY + R * 1.5);
      ctx.lineTo(cx + R * 2.55 + sway, headY + R * 1.75);
      ctx.closePath();
      ctx.fill();
      break;
    }

    // --- Боевая раскраска.
    case 'warpaint': {
      ctx.strokeStyle = hexA(pal.accent, 0.85);
      ctx.lineWidth = R * 0.09;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(cx - R * 0.5 + i * R * 0.16, headY + R * 0.1);
        ctx.lineTo(cx - R * 0.42 + i * R * 0.16, headY + R * 0.5);
        ctx.stroke();
      }
      break;
    }

    // --- Плащ из листьев.
    case 'leafcloak': {
      ctx.fillStyle = hexA('#4f9a4a', 0.55);
      for (let i = 0; i < 8; i++) {
        const a = Math.PI * 0.15 + (i / 7) * Math.PI * 0.7;
        const px = cx + Math.cos(a) * R * 1.3;
        const py = headY + Math.sin(a) * R * 1.6;
        ctx.beginPath();
        ctx.ellipse(px, py, R * 0.18, R * 0.09, a + 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    // --- Клюв совомедведя.
    case 'beak': {
      ctx.fillStyle = '#e0b45c';
      ctx.beginPath();
      ctx.moveTo(cx - R * 0.18, headY + R * 0.28);
      ctx.lineTo(cx + R * 0.18, headY + R * 0.28);
      ctx.lineTo(cx, headY + R * 0.78);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = R * 0.03;
      ctx.stroke();
      // Перья-уши совы.
      ctx.fillStyle = hexA(pal.accent, 0.75);
      for (const q of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + q * R * 0.5, headY - R * 0.55);
        ctx.lineTo(cx + q * R * 0.92, headY - R * 1.15);
        ctx.lineTo(cx + q * R * 0.72, headY - R * 0.5);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }

    // --- Плюмаж на шляпе.
    case 'plume': {
      ctx.strokeStyle = hexA(pal.accent, 0.85);
      ctx.lineWidth = R * 0.06;
      for (let i = 0; i < 4; i++) {
        const a = -Math.PI * 0.75 + i * 0.16;
        ctx.beginPath();
        ctx.moveTo(cx + R * 0.2, headY - R * 0.75);
        ctx.quadraticCurveTo(
          cx + Math.cos(a) * R * 0.9, headY - R * 1.1,
          cx + Math.cos(a) * R * 1.35, headY - R * 0.85 - i * R * 0.08
        );
        ctx.stroke();
      }
      break;
    }

    // --- Горящий клинок ангела.
    case 'swordglow': {
      const g = ctx.createLinearGradient(cx + R * 1.1, headY, cx + R * 1.1, headY + R * 2.2);
      g.addColorStop(0, hexA(pal.glow, 0.9));
      g.addColorStop(1, hexA(pal.glow, 0));
      ctx.fillStyle = g;
      ctx.fillRect(cx + R * 1.02, headY - R * 0.2, R * 0.16, R * 2.4);
      ctx.fillStyle = hexA('#ffffff', 0.75);
      ctx.fillRect(cx + R * 1.07, headY - R * 0.2, R * 0.06, R * 2.2);
      break;
    }

    // --- Двойной венец сосулек: серебряный дракон.
    case 'icicles2': {
      for (let ring = 0; ring < 2; ring++) {
        ctx.fillStyle = hexA(ring ? '#eaf7ff' : '#cfeeff', 0.92);
        for (let i = 0; i < 6; i++) {
          const px = cx + (i - 2.5) * R * (ring ? 0.3 : 0.42);
          const len = R * (ring ? 0.38 : 0.62) * (1 - Math.abs(i - 2.5) * 0.12);
          const baseY2 = headY - R * (ring ? 0.2 : 0.62);
          ctx.beginPath();
          ctx.moveTo(px - R * 0.07, baseY2);
          ctx.lineTo(px + R * 0.07, baseY2);
          ctx.lineTo(px, baseY2 - len);
          ctx.closePath();
          ctx.fill();
        }
      }
      break;
    }

    // --- Каменные плиты и звёздный свет скального великана.
    case 'rockyHalo': {
      ctx.fillStyle = hexA(shade(pal.robe, 0.35), 0.92);
      for (let i = 0; i < 5; i++) {
        const px = cx + (i - 2) * R * 0.42;
        const h = R * (0.7 + (i % 3) * 0.2);
        ctx.beginPath();
        ctx.moveTo(px - R * 0.2, headY - R * 0.55);
        ctx.lineTo(px - R * 0.05, headY - R * 0.55 - h);
        ctx.lineTo(px + R * 0.18, headY - R * 0.55 - h * 0.6);
        ctx.lineTo(px + R * 0.2, headY - R * 0.55);
        ctx.closePath();
        ctx.fill();
      }
      // Искры в камне.
      for (let i = 0; i < 5; i++) {
        const a = t * 0.7 + i * 1.26;
        ctx.fillStyle = hexA(pal.glow, 0.35 + Math.sin(t * 2 + i) * 0.2);
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * R * 1.5, headY + Math.sin(a) * R * 0.8, R * 0.05, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    // --- Капсулы разума вокруг иллитида.
    case 'brainsacs': {
      for (let i = 0; i < 4; i++) {
        const a = Math.PI * 0.2 + i * 0.7 + Math.sin(t * 0.8 + i) * 0.2;
        const px = cx + Math.cos(a) * R * (1.6 + (i % 2) * 0.35);
        const py = headY + Math.sin(a) * R * (1.1 + (i % 3) * 0.2);
        const rr = R * 0.18;
        ctx.fillStyle = hexA('#d98fb0', 0.55);
        ctx.beginPath();
        ctx.ellipse(px, py, rr, rr * 1.25, a, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = hexA('#8a4463', 0.5);
        ctx.lineWidth = R * 0.025;
        ctx.stroke();
      }
      break;
    }

    // --- Зубастая пасть мимика.
    case 'mouth': {
      ctx.fillStyle = '#2a0f18';
      ctx.beginPath();
      ctx.ellipse(cx, headY + R * 0.5, R * 0.55, R * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f6efdc';
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * R * 0.15, headY + R * 0.28);
        ctx.lineTo(cx + i * R * 0.15 + R * 0.07, headY + R * 0.28);
        ctx.lineTo(cx + i * R * 0.15 + R * 0.035, headY + R * 0.52);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }

    // --- ЖВАЛЫ ЧЕРВЯ: пара крючковатых челюстей вместо пасти.
    //
    // У пожирателя-под-горой и умбер-халка рот — не щель, а два
    // расходящихся крюка. Это сразу отделяет их от любого зверя.
    case 'mandibles': {
      ctx.strokeStyle = '#3a2a1a';
      ctx.lineWidth = R * 0.16;
      ctx.lineCap = 'round';
      for (const side of [-1, 1]) {
        const spread = 0.5 + Math.sin(t * 2.2) * 0.12;
        ctx.beginPath();
        ctx.moveTo(cx + side * R * 0.16, headY + R * 0.5);
        ctx.quadraticCurveTo(
          cx + side * R * spread, headY + R * 0.78,
          cx + side * R * (spread - 0.14), headY + R * 1.02
        );
        ctx.stroke();
      }
      // Внутренняя пасть между жвалами.
      ctx.fillStyle = '#2a0a12';
      ctx.beginPath();
      ctx.ellipse(cx, headY + R * 0.62, R * 0.2, R * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
      // Слюна/свечение в глотке.
      ctx.fillStyle = hexA(pal.glow, 0.5 + Math.sin(t * 3) * 0.2);
      ctx.beginPath();
      ctx.ellipse(cx, headY + R * 0.62, R * 0.09, R * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    // --- НОГИ ПАУКА: восемь коленчатых лап по бокам.
    case 'spiderlegs': {
      ctx.strokeStyle = shade(pal.robe, 0.4);
      ctx.lineWidth = R * 0.055;
      ctx.lineCap = 'round';
      for (let i = 0; i < 8; i++) {
        const side = i < 4 ? -1 : 1;
        const k = i % 4;
        const phase = Math.sin(t * 2 + i * 0.8) * R * 0.1;
        const bx = cx + side * R * 0.5;
        const by = headY + R * 0.3 + k * R * 0.28;
        // Колено вверх, лапа вниз — узнаваемый паучий излом.
        const kx = bx + side * R * (0.9 + k * 0.12);
        const ky = by - R * 0.55 + phase;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(kx, ky, kx + side * R * 0.35, by + R * 0.75);
        ctx.stroke();
      }
      // Дополнительные глаза в ряд — у паука их много.
      ctx.fillStyle = hexA(pal.accent, 0.9);
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(cx + (i - 1.5) * R * 0.22, headY - R * 0.28, R * 0.055, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    // --- ШИПЫ НА ХВОСТЕ: у мантикоры хвост заканчивается частоколом игл.
    case 'tailspikes': {
      ctx.fillStyle = shade(pal.accent, 0.75);
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI * 0.5 + (i - 3) * 0.24;
        const len = R * (0.55 + ((i * 7) % 3) * 0.08);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * R * 0.6, headY + R * 1.0);
        ctx.lineTo(cx + Math.cos(a) * (R * 0.6 + len), headY + R * 1.0 + Math.sin(a) * len);
        ctx.lineTo(cx + Math.cos(a + 0.13) * R * 0.6, headY + R * 1.0 + Math.sin(a + 0.13) * R * 0.3);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }

    // --- РАСКАЛЁННАЯ СПИНА: у реморхаза по хребту идёт жар.
    case 'heatshine': {
      const pulse = 0.45 + Math.sin(t * 2.4) * 0.25;
      const g = ctx.createRadialGradient(cx, headY, R * 0.4, cx, headY, R * 2.2);
      g.addColorStop(0, hexA('#ff8830', 0.34 * pulse));
      g.addColorStop(1, hexA('#ff8830', 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, headY, R * 2.2, 0, Math.PI * 2);
      ctx.fill();
      // Пластины по хребту, светящиеся изнутри.
      for (let i = 0; i < 5; i++) {
        const y = headY - R * 0.5 + i * R * 0.34;
        ctx.fillStyle = hexA('#ffa050', 0.55 + ((i * 3) % 2) * 0.25);
        ctx.beginPath();
        ctx.moveTo(cx - R * 0.42, y);
        ctx.lineTo(cx - R * 0.28, y - R * 0.16);
        ctx.lineTo(cx - R * 0.14, y);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx + R * 0.14, y);
        ctx.lineTo(cx + R * 0.28, y - R * 0.16);
        ctx.lineTo(cx + R * 0.42, y);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }

    // --- ВОСЕМЬ ЩУПАЛЕЦ: кракен, а не дракон с крыльями.
    case 'tentacles8': {
      ctx.strokeStyle = shade(pal.robe, 0.55);
      ctx.lineCap = 'round';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.sin(t * 0.6 + i) * 0.13;
        const len = R * (1.5 + ((i * 11) % 4) * 0.22);
        ctx.lineWidth = R * (0.16 - i * 0.008);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * R * 0.5, headY + Math.sin(a) * R * 0.5);
        // Изгиб: щупальце закручивается спиралью.
        const mx = cx + Math.cos(a + 0.55) * len * 0.65;
        const my = headY + Math.sin(a + 0.55) * len * 0.65;
        const ex = cx + Math.cos(a + 1.0) * len;
        const ey = headY + Math.sin(a + 1.0) * len;
        ctx.quadraticCurveTo(mx, my, ex, ey);
        ctx.stroke();
        // Присоски на конце.
        ctx.fillStyle = hexA(pal.accent, 0.65);
        ctx.beginPath();
        ctx.arc(ex, ey, R * 0.07, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    // --- Светящееся кольцо над головой.
    case 'halo': {
      const pulse = 0.5 + Math.sin(t * 1.8) * 0.18;
      ctx.strokeStyle = hexA(pal.glow, pulse);
      ctx.lineWidth = R * 0.09;
      ctx.beginPath();
      ctx.ellipse(cx, headY - R * 1.45, R * 0.66, R * 0.2, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Мягкое свечение вокруг кольца.
      const hg = ctx.createRadialGradient(cx, headY - R * 1.45, 0, cx, headY - R * 1.45, R * 1.1);
      hg.addColorStop(0, hexA(pal.glow, 0.35 * pulse));
      hg.addColorStop(1, hexA(pal.glow, 0));
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(cx, headY - R * 1.45, R * 1.1, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    // --- Замок на макушке мимика: выдаёт, что это не сундук.
    case 'lock': {
      ctx.strokeStyle = '#c9b47a';
      ctx.lineWidth = R * 0.07;
      ctx.beginPath();
      ctx.arc(cx, headY - R * 0.95, R * 0.22, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#c9b47a';
      ctx.beginPath();
      ctx.roundRect
        ? ctx.roundRect(cx - R * 0.3, headY - R * 0.95, R * 0.6, R * 0.5, R * 0.08)
        : ctx.rect(cx - R * 0.3, headY - R * 0.95, R * 0.6, R * 0.5);
      ctx.fill();
      ctx.fillStyle = '#2a2018';
      ctx.beginPath();
      ctx.arc(cx, headY - R * 0.74, R * 0.08, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    // --- Четыре щупальца пожирателя разума.
    case 'tentacles4': {
      ctx.strokeStyle = hexA('#c9a0d0', 0.85);
      ctx.lineWidth = R * 0.09;
      ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const px = cx + (i - 1.5) * R * 0.32;
        const sw = Math.sin(t * 2 + i) * R * 0.15;
        ctx.beginPath();
        ctx.moveTo(px, headY + R * 0.55);
        ctx.quadraticCurveTo(px + sw, headY + R * 1.0, px + sw * 1.6, headY + R * 1.45);
        ctx.stroke();
      }
      break;
    }

    // --- Глазные стебли бехолдера: 6 у обычного, 10 у тирана.
    //
    // Была ошибка: стебли выходили из шара радиусом 1.05R и тянулись на
    // 1.5R, то есть торчали наружу на 0.6R, а глаз на конце был размером
    // R*0.15 — крупный. Десять таких глаз вокруг шара читались не как
    // «один бехолдер с глазными стеблями», а как «россыпь отдельных
    // маленьких бехолдеров вокруг большого». Отсюда и жалоба «как будто
    // два бехолдера сразу».
    //
    // Теперь стебли растут ближе к макушке, короче и тоньше, а глаза на
    // концах вдвое мельче. У тирана десять стеблей идут в ДВА яруса:
    // пять спереди по дуге, пять позади и выше, — так их всё ещё десять,
    // но силуэт остаётся одним шаром, а не гроздью.
    case 'stalkers6':
    case 'stalkers10': {
      const tyrant = extra === 'stalkers10';
      // Дуга стеблей держится ВЕРХНЕЙ ПОЛОВИНЫ шара.
      //
      // Замер показал: при размахе от -0.95π до -0.05π последние стебли
      // уходили ниже центра шара (два глаза у тирана висели под ним).
      // Сбоку это и давало вторую голову. Теперь размах ограничен
      // -0.95π..-0.55π: все стебли торчат вверх и в стороны, нижняя
      // половина шара (где пасть) остаётся чистой.
      const eyes = tyrant
        ? [
            // Передний ярус — пять стеблей веером над шаром, симметрично.
            ...Array.from({ length: 5 }, (_, i) => ({
              a: -Math.PI * 0.50 - (i - 2) * 0.38,
              len: 1.22,
              r: 0.105,
              back: false,
            })),
            // Задний ярус — шире и выше, рисуется первым.
            ...Array.from({ length: 5 }, (_, i) => ({
              a: -Math.PI * 0.50 - (i - 2) * 0.62,
              len: 1.40,
              r: 0.088,
              back: true,
            })),
          ]
        : Array.from({ length: 6 }, (_, i) => ({
            a: -Math.PI * 0.50 - (i - 2.5) * 0.42,
            len: 1.28,
            r: 0.11,
            back: false,
          }));

      // Задние стебли первыми — перекрытие даёт глубину.
      eyes.sort((p, q) => (q.back ? 1 : 0) - (p.back ? 1 : 0));

      for (const st of eyes) {
        // Покачивание — это ДРОЖАНИЕ, а не перенос.
        //
        // Была тонкая ошибка: `sway` умножался на 0.35 и прибавлялся к
        // углу в радианах. Для стебля у самого левого края (a ≈ -0.94π)
        // синус давал большой сдвиг, и угол уезжал до -1.15π — стебель
        // ЗАГИБАЛСЯ ВНИЗ, под шар. Именно эти два нижних глаза и читались
        // как второй бехолдер. Теперь качание идёт по удлинению стебля и
        // по кончику, а угол стоит на месте.
        const wob = Math.sin(t * 1.5 + st.a * 3);
        const a = st.a + wob * 0.05;
        const len = R * (st.len + Math.sin(t * 1.6 + st.a * 4) * 0.05);
        const ex = cx + Math.cos(a) * len;
        const ey = headY + Math.sin(a) * len;

        // Стебель: выходит из-под верхней кромки шара, а не из центра.
        ctx.strokeStyle = st.back ? shade(pal.robe, -0.28) : shade(pal.robe, -0.12);
        ctx.lineWidth = R * (st.back ? 0.06 : 0.075);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * R * 0.88, headY + Math.sin(a) * R * 0.88);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        // Глаз на конце: мелкий белок и точка зрачка.
        ctx.fillStyle = st.back ? '#cfc8b6' : '#f6f2e4';
        ctx.beginPath();
        ctx.arc(ex, ey, R * st.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = st.back ? hexA(pal.glow, 0.7) : pal.glow;
        ctx.beginPath();
        ctx.arc(ex, ey, R * st.r * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    // --- Три головы аватара Тиамат.
    case 'heads3': {
      for (const q of [-1, 1]) {
        const hx = cx + q * R * 1.05;
        const hy = headY - R * 0.35;
        ctx.strokeStyle = shade(pal.robe, -0.3);
        ctx.lineWidth = R * 0.26;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx + q * R * 0.4, headY + R * 0.5);
        ctx.quadraticCurveTo(hx, headY + R * 0.9, hx, hy + R * 0.7);
        ctx.stroke();
        ctx.fillStyle = shade(pal.robe, q * 0.12);
        ctx.beginPath();
        ctx.ellipse(hx, hy, R * 0.5, R * 0.42, q * 0.2, 0, Math.PI * 2);
        ctx.fill();
        // Рога и глаз каждой головы.
        ctx.strokeStyle = '#e8dcc0';
        ctx.lineWidth = R * 0.07;
        ctx.beginPath();
        ctx.moveTo(hx + q * R * 0.2, hy - R * 0.35);
        ctx.lineTo(hx + q * R * 0.5, hy - R * 0.85);
        ctx.stroke();
        ctx.fillStyle = pal.glow;
        ctx.beginPath();
        ctx.arc(hx + q * R * 0.16, hy - R * 0.05, R * 0.09, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    // --- Пять голов Тиамат: полный венец по кругу.
    case 'heads5': {
      for (let i = 1; i <= 4; i++) {
        const q = i <= 2 ? -1 : 1;
        const k = i <= 2 ? i : i - 2;
        const hx = cx + q * R * (0.85 + k * 0.55);
        const hy = headY - R * (0.25 + k * 0.22);
        ctx.strokeStyle = shade(pal.robe, -0.25 - k * 0.08);
        ctx.lineWidth = R * (0.26 - k * 0.04);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx + q * R * 0.35, headY + R * 0.45);
        ctx.quadraticCurveTo(hx, headY + R * (0.9 - k * 0.1), hx, hy + R * 0.65);
        ctx.stroke();
        // Каждая голова — своего цвета, как пять цветов Тиамат.
        const tints = ['#e05a4a', '#4a8ee0', '#4ac06a', '#e8e8f0', '#3a3a4a'];
        ctx.fillStyle = i % 2 ? tints[i - 1] : tints[i];
        ctx.beginPath();
        ctx.ellipse(hx, hy, R * 0.46, R * 0.38, q * 0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#e8dcc0';
        ctx.lineWidth = R * 0.06;
        ctx.beginPath();
        ctx.moveTo(hx + q * R * 0.18, hy - R * 0.3);
        ctx.lineTo(hx + q * R * 0.46, hy - R * 0.78);
        ctx.stroke();
        ctx.fillStyle = pal.glow;
        ctx.beginPath();
        ctx.arc(hx + q * R * 0.14, hy - R * 0.04, R * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    // --- Очки изобретателя.
    case 'goggles': {
      ctx.fillStyle = hexA('#2a2a33', 0.9);
      for (const q of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(cx + q * R * 0.34, headY, R * 0.2, R * 0.17, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = hexA(pal.glow, 0.5);
      ctx.lineWidth = R * 0.04;
      ctx.beginPath();
      ctx.moveTo(cx - R * 0.16, headY);
      ctx.lineTo(cx + R * 0.16, headY);
      ctx.stroke();
      break;
    }

    // --- Перья гарпии.
    case 'feathers': {
      ctx.fillStyle = hexA(pal.accent, 0.7);
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI * 0.75 + (i / 6) * Math.PI * 1.5;
        const px = cx + Math.cos(a) * R * 1.1;
        const py = headY + Math.sin(a) * R * 1.1;
        ctx.beginPath();
        ctx.ellipse(px, py, R * 0.09, R * 0.24, a, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    // --- Бородавки тролля.
    case 'warts': {
      ctx.fillStyle = hexA(shade(pal.robe, -0.3), 0.8);
      for (let i = 0; i < 6; i++) {
        const px = cx + Math.sin(i * 2.3) * R * 0.7;
        const py = headY + Math.cos(i * 1.7) * R * 0.5 + R * 0.3;
        ctx.beginPath();
        ctx.arc(px, py, R * 0.06, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    // --- Пыльца феи.
    case 'glowdust': {
      for (let i = 0; i < 8; i++) {
        const a = t * 1.2 + i * 0.8;
        const rr = R * (1.0 + (i % 3) * 0.4);
        const px = cx + Math.cos(a) * rr;
        const py = headY + Math.sin(a * 1.3) * rr * 0.7;
        ctx.fillStyle = hexA(pal.glow, 0.35 + Math.sin(t * 3 + i) * 0.2);
        ctx.beginPath();
        ctx.arc(px, py, R * 0.045, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    // --- Двойное гало аасимара-карателя.
    case 'halo2': {
      ctx.strokeStyle = hexA(pal.glow, 0.7);
      ctx.lineWidth = R * 0.05;
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.ellipse(cx, headY - R * (1.5 + i * 0.32), R * (0.62 - i * 0.14), R * 0.2, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }

    // --- Рога-корона древнего дракона.
    case 'crownhorns': {
      ctx.strokeStyle = '#e8dcc0';
      ctx.lineWidth = R * 0.09;
      ctx.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const px = cx + (i - 2) * R * 0.3;
        const h = R * (0.6 - Math.abs(i - 2) * 0.1);
        ctx.beginPath();
        ctx.moveTo(px, headY - R * 0.7);
        ctx.quadraticCurveTo(px * 0.9 + cx * 0.1, headY - R * 0.7 - h, px + (i - 2) * R * 0.1, headY - R * 0.8 - h * 1.3);
        ctx.stroke();
      }
      break;
    }

    default: break;
  }
}

/**
 * ЗНАКИ ВЕЛИЧИЯ
 * ==============
 * Чем дальше по кампании, тем внушительнее враг. Помимо роста у
 * поздних видов есть знаки: корона, аура, шипы.
 *
 * Это и есть ответ на «чем дальше по уровню, тем внушительнее».
 * Рост виден бок о бок, а значок читается с первого взгляда: корона
 * на голове говорит «это не рядовая крыса» быстрее, чем разница в
 * полтора сантиметра.
 */
export function drawSpeciesRegalia(ctx, cx, headY, headR, regalia, pal, t, anatomy) {
  if (!regalia) return;
  const R = headR;

  // У бехолдера сверху шара растут стебельки с глазами, и обычная
  // корона садилась прямо на них: пять зубцов торчали из середины
  // глазного шара, сбоку читались как «маленький человечек в короне,
  // прилипший к бехолдеру». Поэтому обод короны у него идёт ниже —
  // по «лбу» шара, между центральным глазом и верхними стебельками, —
  // а сами стебельки остаются снаружи, над короной.
  const isBeholder = anatomy === 'beholder';
  const bandY = headY - R * (isBeholder ? 0.42 : 0.78);
  const bandHalf = R * (isBeholder ? 0.72 : 0.6);
  const spikeH = R * (isBeholder ? 0.34 : (regalia === 'crowns' ? 0.62 : 0.44));

  switch (regalia) {
    case 'crown':
    case 'crowns': {
      // Зубцы короны над головой. У `crowns` их больше и они выше.
      const n = regalia === 'crowns' ? 7 : 5;
      ctx.fillStyle = hexA('#f0d27a', 0.95);
      for (let i = 0; i < n; i++) {
        const px = cx + (i - (n - 1) / 2) * (bandHalf * 2 / (n - 1)) * 0.92;
        const h = spikeH - Math.abs(i - (n - 1) / 2) * R * 0.05;
        ctx.beginPath();
        ctx.moveTo(px - R * 0.11, bandY);
        ctx.lineTo(px, bandY - h);
        ctx.lineTo(px + R * 0.11, bandY);
        ctx.closePath();
        ctx.fill();
      }
      // Обод.
      ctx.strokeStyle = hexA('#f0d27a', 0.9);
      ctx.lineWidth = R * 0.08;
      ctx.beginPath();
      ctx.moveTo(cx - bandHalf, bandY);
      ctx.lineTo(cx + bandHalf, bandY);
      ctx.stroke();
      break;
    }

    case 'aura': {
      const pulse = 0.5 + Math.sin(t * 1.8) * 0.2;
      const g = ctx.createRadialGradient(cx, headY, R * 0.5, cx, headY, R * 2.6);
      g.addColorStop(0, hexA(pal.glow, 0.22 * pulse));
      g.addColorStop(1, hexA(pal.glow, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, headY, R * 2.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'gold': {
      ctx.fillStyle = 'rgba(240,210,120,0.85)';
      for (let i = 0; i < 5; i++) {
        const a = t * 0.8 + i * 1.26;
        const px = cx + Math.cos(a) * R * 1.7;
        const py = headY - R * 0.4 + Math.sin(a) * R * 0.9;
        ctx.beginPath();
        ctx.arc(px, py, R * 0.07, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'robe':
    case 'armor':
    case 'spikes':
    default:
      // Эти знаки уже нарисованы телом или деталью вида.
      break;
  }
}

