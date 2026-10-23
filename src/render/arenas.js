/**
 * ФОНЫ БОЯ
 * =========
 * У каждого противника своя арена, а у боссов она ещё и живёт.
 *
 * Идея: фон — не декорация, а подсказка. Игрок должен узнавать врага
 * по обстановке раньше, чем прочитает имя. Поэтому стихия обычного
 * врага задаёт подземелье (склеп, темница, огненная кузня), а стихия
 * босса — полноценную сцену: вулкан, океан, грозовое небо.
 *
 * Все фоны рисуются кодом. Частицы (пепел, снег, искры) считаются от
 * времени t, без хранения состояния, поэтому переключение сцены не
 * оставляет мусора на экране.
 */

/**
 * Подземелья обычных врагов.
 *
 * Раньше здесь были звериные локации (лисья тропа, бамбуковая роща):
 * они остались от версии с животными и не подходили существам
 * Подземелья. Теперь каждая арена — помещение: склеп, темница, пещера,
 * кузня, ледяные залы, библиотека, грибные гроты, шахты, провал,
 * святилище, костяная галерея.
 */
export const BIOMES = {
  crypt:    { sky: ['#0d0b14', '#151020', '#1d1526'], mist: '#6a5a8a', ground: '#120e1a', accent: '#a894d8', name: 'Склеп' },
  dungeon:  { sky: ['#120f10', '#1b1616', '#241c1c'], mist: '#8a6a52', ground: '#171112', accent: '#c9a06a', name: 'Темница' },
  cavern:   { sky: ['#0a1014', '#101a20', '#16242c'], mist: '#4a8aa0', ground: '#0c1418', accent: '#6fc4d8', name: 'Пещера' },
  lava:     { sky: ['#1a0a08', '#2a100a', '#3d1a0e'], mist: '#c85a28', ground: '#1f0c09', accent: '#ff8a3a', name: 'Огненная кузня' },
  ice:      { sky: ['#0c1418', '#14222a', '#1c3038'], mist: '#7fc0d8', ground: '#0e181d', accent: '#a8e4f8', name: 'Ледяные залы' },
  library:  { sky: ['#10100c', '#1a1810', '#241f14'], mist: '#a89050', ground: '#14120d', accent: '#e0c070', name: 'Забытая библиотека' },
  fungal:   { sky: ['#0c1410', '#122018', '#182c20'], mist: '#50a878', ground: '#0e1914', accent: '#7fe0a0', name: 'Грибные гроты' },
  mine:     { sky: ['#0e0c0a', '#171412', '#201c18'], mist: '#7a6a4a', ground: '#13100d', accent: '#b09a6a', name: 'Заброшенные шахты' },
  abyss:    { sky: ['#08060e', '#0e0a18', '#150e22'], mist: '#5a3a8a', ground: '#0a0812', accent: '#8a5ae0', name: 'Бездонный провал' },
  shrine:   { sky: ['#0a1016', '#101a26', '#162434'], mist: '#5a8ac0', ground: '#0c141c', accent: '#8ab8f0', name: 'Затопленное святилище' },
  ossuary:  { sky: ['#100e0c', '#1a1612', '#241e18'], mist: '#b0a088', ground: '#14110e', accent: '#e0d0b0', name: 'Костяная галерея' },
  forge:    { sky: ['#140c0a', '#1e1210', '#281a14'], mist: '#b05a38', ground: '#18100c', accent: '#e88a50', name: 'Подземная кузня' },
};

/**
 * Возможные подземелья для каждого вида.
 *
 * Двух-трёх вариантов достаточно: враг одного вида всё равно узнаваем,
 * а разнообразие по уровням сохраняется.
 */
const BIOME_VARIANTS = {
  crypt:    ['crypt', 'ossuary', 'abyss', 'dungeon'],
  dungeon:  ['dungeon', 'mine', 'forge'],
  cavern:   ['cavern', 'fungal', 'shrine'],
  lava:     ['lava', 'forge', 'abyss', 'dungeon'],
  ice:      ['ice', 'shrine', 'crypt'],
  library:  ['library', 'ossuary', 'shrine', 'dungeon'],
  fungal:   ['fungal', 'cavern', 'mine'],
  mine:     ['mine', 'dungeon', 'cavern'],
  abyss:    ['abyss', 'crypt', 'lava'],
  shrine:   ['shrine', 'library', 'ice', 'dungeon'],
  ossuary:  ['ossuary', 'crypt', 'library'],
  forge:    ['forge', 'lava', 'mine', 'dungeon'],
};

/**
 * Выбирает подземелье для врага.
 *
 * Раньше ключом служил вид зверя (лиса, барсук), и у существ
 * Подземелья почти все они проваливались в вариант по умолчанию:
 * выходила одна и та же арена на всех. Теперь ключ — стихия уровня:
 * огненные враги в кузне, ледяные в залах льда, нежить в склепах.
 */
const ELEMENT_BIOME = {
  fire: 'lava', ice: 'ice', void: 'abyss', nature: 'fungal',
  holy: 'shrine', heaven: 'shrine', arcane: 'library', stone: 'mine',
  water: 'cavern', air: 'cavern', light: 'shrine', shadow: 'crypt',
};

function biomeFor(enemy) {
  // Палитра уровня — самый надёжный признак стихии.
  //
  // ВАЖНО: поле называется `paletteKey` и в нём СТРОКА ('ember', 'frost').
  // Само поле `palette` — объект с цветами, ключом для таблицы он быть
  // не может: обращение к нему даёт «[object Object]», все стихии
  // проваливаются в ветку по умолчанию, и на всех уровнях одна арена.
  // Именно так и вышло в первый раз: 70 уровней поделили между собой
  // три подземелья вместо двенадцати.
  const byPalette = {
    ember: 'lava', frost: 'ice', void: 'abyss', jade: 'fungal',
    celestial: 'shrine', spirit: 'cavern', storm: 'forge',
    blood: 'crypt', gold: 'library', night: 'crypt', sakura: 'fungal',
  };
  const key = enemy.paletteKey || '';
  const base = byPalette[key] || ELEMENT_BIOME[enemy.element] || 'dungeon';
  const variants = BIOME_VARIANTS[base] || [base];
  const pick = variants[enemy.level % variants.length];
  return BIOMES[pick] || BIOMES.dungeon;
}

/** Линейный цвет фона по вертикали. */
function skyGradient(ctx, W, H, stops) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, stops[0]);
  g.addColorStop(0.5, stops[1]);
  g.addColorStop(1, stops[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/**
 * СВОД ПЕЩЕРЫ — вместо неба.
 *
 * Это подземелье, а не пейзаж: над головой не должно быть ничего, кроме
 * камня. Раньше здесь было небо с солнцем, луной и звёздами, а по
 * горизонту тянулись горы — сцена читалась как «бой на улице», и вся
 * работа над существами Подземелья рассыпалась на первом же кадре.
 *
 * Рисуем три плана:
 *   1. тёмная масса камня по краям и сверху (вход в грот);
 *   2. неровная кромка свода с зубцами;
 *   3. трещины и каменные жилы внутри.
 */
function cavernVault(ctx, W, H, seed, light) {
  const top = shiftLight('#06060b', light);
  const edge = shiftLight('#030307', light);

  // --- Верхняя масса камня: свод нависает над ареной.
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(W, 0);
  ctx.lineTo(W, H * 0.30);
  // Неровная нижняя кромка свода.
  for (let i = 10; i >= 0; i--) {
    const x = (W / 10) * i;
    const n = Math.sin(i * 2.3 + seed) * 0.5 + Math.sin(i * 4.7 + seed * 2) * 0.5;
    ctx.lineTo(x, H * (0.10 + Math.abs(n) * 0.16));
  }
  ctx.closePath();
  ctx.fill();

  // --- Боковые стены: уходят в темноту по краям кадра.
  for (const side of [0, 1]) {
    const dir = side === 0 ? 1 : -1;
    const bx = side === 0 ? 0 : W;
    ctx.fillStyle = edge;
    ctx.beginPath();
    ctx.moveTo(bx, 0);
    ctx.lineTo(bx + dir * W * (side === 0 ? 0.13 : -0.13), 0);
    ctx.lineTo(bx + dir * W * (side === 0 ? 0.09 : -0.09), H);
    ctx.lineTo(bx, H);
    ctx.closePath();
    ctx.fill();
  }

  // --- Сталактиты, свисающие со свода.
  ctx.fillStyle = edge;
  for (let i = 0; i < 9; i++) {
    const x = ((i * 173 + seed * 11) % 100) / 100 * W;
    const h = H * (0.03 + ((i * 41) % 30) / 400);
    const w = W * (0.008 + ((i * 19) % 10) / 800);
    ctx.beginPath();
    ctx.moveTo(x - w, 0);
    ctx.lineTo(x + w, 0);
    ctx.lineTo(x, h * 2.2);
    ctx.closePath();
    ctx.fill();
  }

  // --- Трещины по камню: тонкие светлые линии.
  ctx.strokeStyle = shiftLight('#1a1a26', light) + '99';
  ctx.lineWidth = Math.max(1, W * 0.0015);
  for (let i = 0; i < 6; i++) {
    const x0 = ((i * 239 + seed * 7) % 100) / 100 * W;
    const y0 = H * (((i * 13) % 10) / 60);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + W * 0.02 * Math.sin(i), y0 + H * 0.05);
    ctx.lineTo(x0 + W * 0.04 * Math.sin(i * 2), y0 + H * 0.09);
    ctx.stroke();
  }
}

/**
 * КАМЕННЫЙ СВОД В ГЛУБИНЕ — вместо гор на горизонте.
 *
 * Горы на горизонте говорили «мы на улице». В подземелье на их месте
 * должна быть стена тоннеля: тёмная масса с аркой прохода, сквозь
 * которую ничего не видно.
 */
function tunnelBack(ctx, W, H, seed, light) {
  const wall = shiftLight('#05050a', light);

  // Сплошная стена — закрывает «горизонт».
  ctx.fillStyle = wall;
  ctx.fillRect(0, H * 0.30, W, H * 0.54);

  // Лабиринт в стене: несколько проходов, уходящих в темноту.
  //
  // Одинокая арка читалась как «вход», а нам нужно ощущение, что мы
  // внутри лабиринта и ходов вокруг много. Поэтому в глубине видно
  // несколько проёмов и углы стен между ними — часть завалена, часть
  // ведёт в темноту.
  const depth = shiftLight('#020205', light);
  const passes = [
    { fx: 0.16, fw: 0.13, fh: 0.20 },
    { fx: 0.47, fw: 0.17, fh: 0.28 },
    { fx: 0.78, fw: 0.11, fh: 0.17 },
  ];
  for (const ps of passes) {
    const ax = W * (ps.fx + Math.sin(seed + ps.fx * 9) * 0.02);
    const aw = W * ps.fw;
    const ah = H * ps.fh;
    const ay = H * 0.66;
    ctx.fillStyle = depth;
    ctx.beginPath();
    ctx.moveTo(ax - aw / 2, ay);
    ctx.lineTo(ax - aw / 2, ay - ah * 0.6);
    ctx.quadraticCurveTo(ax, ay - ah * 1.25, ax + aw / 2, ay - ah * 0.6);
    ctx.lineTo(ax + aw / 2, ay);
    ctx.closePath();
    ctx.fill();
  }

  // Углы стен между проходами — «коридоры» лабиринта.
  ctx.fillStyle = shiftLight('#0a0a12', light);
  for (let i = 0; i < 3; i++) {
    const x = W * (0.30 + i * 0.24);
    const y = H * (0.40 + (i % 2) * 0.08);
    ctx.fillRect(x, y, W * 0.022, H * 0.26);
    ctx.fillRect(x - W * 0.05, y, W * 0.072, H * 0.022);
  }

  // Грубая кладка стены: редкие горизонтальные швы.
  ctx.strokeStyle = shiftLight('#131320', light) + '77';
  ctx.lineWidth = Math.max(1, W * 0.0012);
  for (let r = 0; r < 5; r++) {
    const y = H * (0.34 + r * 0.10);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  for (let c = 0; c < 8; c++) {
    const x = ((c * 197 + seed * 5) % 100) / 100 * W;
    const row = c % 5;
    const y = H * (0.34 + row * 0.10);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + H * 0.10);
    ctx.stroke();
  }
}

/** Круглый источник мягкого света. */
function softGlow(ctx, x, y, r, color, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Функции ridge() (горы) и dots() (звёзды) удалены: в подземелье нет ни
// гор на горизонте, ни неба со звёздами. Если понадобится вновь — они
// восстанавливаются из истории правок, но в текущих сценах их вызывать
// нечем: все фоны теперь замкнуты камнем.

// ================================================================ ВРЕМЯ СУТОК

/**
 * Времена суток, которые чередуются от уровня к уровню.
 *
 * В подземелье нет неба, поэтому «время суток» здесь работает не как
 * цвет неба, а как ОСВЕЩЕНИЕ: днём в грот падает больше света сверху,
 * ночью остаются только факелы и свечение лавы.
 *
 * tint   — цвет, который ложится поверх всей сцены (режим multiply);
 * skyWarm— тёплый или холодный сдвиг общего освещения;
 * stars  — признак «ночь»: сгущает свод и гасит свет (звёзд не рисует);
 * fog    — плотность дымки в глубине грота;
 * light  — общая яркость сцены.
 */
export const TIMES = {
  morning: {
    name: 'Утро',
    tint: 'rgba(255, 214, 186, 0.20)',   // тёплая розовая дымка
    tintMode: 'overlay',
    skyWarm: '#f6c8b0',
    stars: 0,
    fog: 0.10,
    light: 1.18,                          // общая яркость сцены
  },
  day: {
    name: 'День',
    tint: 'rgba(180, 220, 255, 0.16)',   // ясный голубой
    tintMode: 'overlay',
    skyWarm: '#bfe0ff',
    stars: 0,
    fog: 0.05,
    light: 1.35,
  },
  evening: {
    name: 'Вечер',
    tint: 'rgba(255, 150, 90, 0.26)',    // закатная медь
    tintMode: 'overlay',
    skyWarm: '#ffb070',
    stars: 0,
    fog: 0.14,
    light: 1.02,
  },
  night: {
    name: 'Ночь',
    tint: 'rgba(40, 62, 120, 0.34)',     // холодная синева
    tintMode: 'multiply',
    skyWarm: '#2a3a66',
    stars: 1,
    fog: 0.18,
    light: 0.86,
  },
};

/** Порядок чередования. */
export const TIME_ORDER = ['morning', 'day', 'evening', 'night'];

/**
 * Какое время суток на уровне.
 *
 * Чередование строго по кругу: уровни 1-4 идут утро→день→вечер→ночь,
 * 5-8 снова с утра. Так игрок за четыре боя видит все четыре
 * состояния и не привыкает к одному фону.
 *
 * @param {number} level номер уровня, 1..70
 */
export function timeOfDay(level) {
  return TIME_ORDER[(Math.max(1, level) - 1) % TIME_ORDER.length];
}

/** Описание времени суток для уровня. */
export function timeInfo(level) {
  return TIMES[timeOfDay(level)];
}

// ================================================================ ОБЫЧНЫЕ АРЕНЫ

/**
 * Рисует арену обычного врага.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} W ширина
 * @param {number} H высота
 * @param {object} enemy данные врага (нужны species и level)
 * @param {number} t время
 */
export function drawArena(ctx, W, H, enemy, t, timeKey) {
  const bio = biomeFor(enemy);
  const seed = enemy.level * 37;
  const tod = TIMES[timeKey || timeOfDay(enemy.level)] || TIMES.night;

  // --- ФОН: камень, а не небо.
  //
  // Раньше здесь рисовалось небо с солнцем, луной и звёздами, а по
  // горизонту шли горы. Это улица, а не подземелье. Теперь сверху
  // нависает свод, в глубине стоит стена тоннеля, по краям темнота.
  // Время суток осталось — оно теперь меняет ОСВЕЩЕНИЕ грота (факелы
  // теплее, ночь холоднее), но небо больше не участвует.
  skyGradient(ctx, W, H, tintSky(bio.sky, tod));

  cavernVault(ctx, W, H, seed, tod.light);
  tunnelBack(ctx, W, H, seed, tod.light);

  // Дымка в глубине — сырой воздух грота, а не утренний туман.
  const mg = ctx.createLinearGradient(0, H * 0.4, 0, H * 0.78);
  mg.addColorStop(0, 'rgba(0,0,0,0)');
  mg.addColorStop(0.6, hexAlpha(bio.mist, 0.10 + tod.fog * 0.4));
  mg.addColorStop(1, hexAlpha(bio.mist, 0.20 + tod.fog * 0.6));
  ctx.fillStyle = mg;
  ctx.fillRect(0, H * 0.4, W, H * 0.4);

  // Деталь арены: свой предмет для каждого подземелья.
  drawArenaDetail(ctx, W, H, bio, enemy, t, seed);

  // Пол.
  const eg = ctx.createLinearGradient(0, H * 0.82, 0, H);
  eg.addColorStop(0, shiftLight(bio.ground, tod.light));
  eg.addColorStop(1, shiftLight('#07070d', tod.light));
  ctx.fillStyle = eg;
  ctx.fillRect(0, H * 0.82, W, H * 0.18);

  // Плиты пола: подземелье вымощено камнем, а не травой.
  ctx.strokeStyle = shiftLight('#15151f', tod.light) + '88';
  ctx.lineWidth = Math.max(1, W * 0.0012);
  for (let r = 0; r < 3; r++) {
    const y = H * (0.84 + r * 0.055);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  for (let c = 0; c < 10; c++) {
    const x = ((c * 131 + seed) % 100) / 100 * W;
    ctx.beginPath();
    ctx.moveTo(x, H * 0.84);
    ctx.lineTo(x - W * 0.01, H);
    ctx.stroke();
  }

  // Магический круг под врагом.
  drawArenaCircle(ctx, W, H, bio, t);

  // Финальный слой: единый тон, который связывает все элементы в
  // одну сцену. Без него холодный камень под тёплой дымкой выглядит
  // склейкой из разных картинок.
  applyTimeTint(ctx, W, H, tod);
}

/**
 * Накладывает общий тон времени суток.
 *
 * multiply затемняет до синевы (ночь), overlay даёт тёплый или
 * холодный оттенок поверх (утро/день/вечер).
 */
function applyTimeTint(ctx, W, H, tod) {
  ctx.save();
  ctx.globalCompositeOperation = tod.tintMode;
  ctx.fillStyle = tod.tint;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/** Смешивает цвета неба к цвету времени суток. */
function tintSky(stops, tod) {
  return stops.map((c, i) => {
    // Верх неба сильнее зависит от времени суток, низ — слабее.
    const w = i === 0 ? 0.45 : i === 1 ? 0.28 : 0.16;
    return mix(c, tod.skyWarm, w);
  });
}

/** Смешивает два hex-цвета. */
function mix(a, b, w) {
  const pa = parseHex(a), pb = parseHex(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * w);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * w);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * w);
  return `rgb(${r},${g},${bl})`;
}

function parseHex(h) {
  const s = h.replace('#', '');
  const n = s.length === 3
    ? s.split('').map((c) => parseInt(c + c, 16))
    : [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  return n;
}

/** Осветляет или затемняет цвет в зависимости от времени суток. */
function shiftLight(hex, light) {
  const [r, g, b] = parseHex(hex);
  const f = light;
  const cl = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${cl(r)},${cl(g)},${cl(b)})`;
}

/** Hex + прозрачность → rgba(). */
function hexAlpha(hex, a) {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${Math.min(1, a)})`;
}

/** Характерная деталь подземелья на среднем плане. */
function drawArenaDetail(ctx, W, H, bio, enemy, t, seed) {
  const cx = W * 0.5;
  const cy = H * 0.72;
  // Сводчатaя арка — общий мотив всех подземелий.
  const arch = (ax, ay, aw, ah, col) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(ax - aw / 2, ay);
    ctx.lineTo(ax - aw / 2, ay - ah * 0.55);
    ctx.quadraticCurveTo(ax, ay - ah * 1.05, ax + aw / 2, ay - ah * 0.55);
    ctx.lineTo(ax + aw / 2, ay);
    ctx.closePath();
    ctx.fill();
  };

  switch (bio.name) {
    // --- Склеп: ряды ниш с саркофагами. ---
    case 'Склеп': {
      for (let i = 0; i < 4; i++) {
        const ax = W * (0.1 + i * 0.27);
        arch(ax, H * 0.84, W * 0.11, H * 0.3, '#0a0810');
        // Саркофаг в нише.
        ctx.fillStyle = bio.ground;
        ctx.fillRect(ax - W * 0.04, H * 0.78, W * 0.08, H * 0.06);
      }
      break;
    }

    // --- Темница: решётки и цепи. ---
    case 'Темница': {
      ctx.strokeStyle = bio.accent + '44';
      ctx.lineWidth = Math.max(2, W * 0.005);
      for (let i = 0; i < 7; i++) {
        const x = W * (0.05 + i * 0.15);
        ctx.beginPath();
        ctx.moveTo(x, H * 0.1);
        ctx.lineTo(x, H * 0.84);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(0, H * 0.1);
      ctx.lineTo(W, H * 0.1);
      ctx.stroke();
      // Свисающие цепи.
      for (let i = 0; i < 3; i++) {
        const x = W * (0.25 + i * 0.25);
        ctx.strokeStyle = '#5a4a3a';
        ctx.lineWidth = Math.max(1.5, W * 0.003);
        ctx.beginPath();
        ctx.moveTo(x, H * 0.1);
        ctx.lineTo(x + Math.sin(t * 0.6 + i) * W * 0.006, H * (0.35 + i * 0.08));
        ctx.stroke();
      }
      break;
    }

    // --- Пещера: сталактиты и сталагмиты. ---
    case 'Пещера': {
      ctx.fillStyle = '#070d10';
      for (let i = 0; i < 7; i++) {
        const x = ((i * 163 + seed) % 100) / 100 * W;
        const h = H * (0.08 + ((i * 37) % 30) / 200);
        ctx.beginPath();
        ctx.moveTo(x - W * 0.03, 0);
        ctx.lineTo(x + W * 0.03, 0);
        ctx.lineTo(x, h);
        ctx.closePath();
        ctx.fill();
      }
      for (let i = 0; i < 5; i++) {
        const x = ((i * 227 + seed * 3) % 100) / 100 * W;
        const h = H * 0.09;
        ctx.beginPath();
        ctx.moveTo(x - W * 0.025, H * 0.84);
        ctx.lineTo(x + W * 0.025, H * 0.84);
        ctx.lineTo(x, H * 0.84 - h);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }

    // --- Огненная кузня: горн, искры, наковальня. ---
    case 'Огненная кузня': {
      softGlow(ctx, cx, cy, W * 0.35, bio.accent, 0.3);
      // Искры, летящие вверх.
      for (let i = 0; i < 14; i++) {
        const ph = (t * 0.5 + i * 0.071) % 1;
        const x = cx + Math.sin(i * 2.7 + t) * W * 0.28;
        const y = H * 0.84 - ph * H * 0.6;
        ctx.fillStyle = bio.accent + Math.round((1 - ph) * 200).toString(16).padStart(2, '0');
        ctx.fillRect(x, y, W * 0.004, W * 0.004);
      }
      break;
    }

    // --- Ледяные залы: колонны и сосульки. ---
    case 'Ледяные залы': {
      for (let i = 0; i < 5; i++) {
        const x = W * (0.08 + i * 0.21);
        ctx.fillStyle = bio.mist + '22';
        ctx.fillRect(x - W * 0.012, H * 0.2, W * 0.024, H * 0.64);
        ctx.fillStyle = bio.accent + '33';
        ctx.fillRect(x - W * 0.004, H * 0.2, W * 0.008, H * 0.64);
      }
      ctx.fillStyle = bio.accent + '55';
      for (let i = 0; i < 8; i++) {
        const x = ((i * 179 + seed) % 100) / 100 * W;
        const h = H * (0.04 + ((i * 13) % 20) / 300);
        ctx.beginPath();
        ctx.moveTo(x - W * 0.012, 0);
        ctx.lineTo(x + W * 0.012, 0);
        ctx.lineTo(x, h);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }

    // --- Забытая библиотека: стеллажи с книгами. ---
    case 'Забытая библиотека': {
      for (let s = 0; s < 3; s++) {
        const sx = W * (0.05 + s * 0.33);
        const sh = H * 0.5;
        ctx.fillStyle = '#0d0b08';
        ctx.fillRect(sx, H * 0.84 - sh, W * 0.22, sh);
        // Корешки книг.
        for (let b = 0; b < 4; b++) {
          for (let k = 0; k < 7; k++) {
            const bh = H * 0.035;
            const bw = W * 0.024;
            const bx = sx + W * 0.012 + k * (bw + W * 0.002);
            const by = H * 0.84 - sh + H * 0.03 + b * (sh / 4);
            ctx.fillStyle = ['#6a4a2a', '#4a5a3a', '#5a3a4a', '#3a4a5a'][(b + k) % 4];
            ctx.fillRect(bx, by, bw, bh);
          }
        }
      }
      break;
    }

    // --- Грибные гроты: светящиеся грибы. ---
    case 'Грибные гроты': {
      for (let i = 0; i < 9; i++) {
        const x = ((i * 197 + seed * 5) % 100) / 100 * W;
        const h = H * (0.03 + ((i * 29) % 40) / 400);
        const sw = W * (0.01 + ((i * 17) % 20) / 900);
        const pulse = 0.4 + Math.sin(t * 1.2 + i) * 0.25;
        softGlow(ctx, x, H * 0.84 - h, W * 0.06, bio.accent, 0.22 * pulse);
        ctx.fillStyle = bio.accent + '66';
        ctx.fillRect(x - sw * 0.2, H * 0.84 - h, sw * 0.4, h);
        ctx.beginPath();
        ctx.ellipse(x, H * 0.84 - h, sw, sw * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    // --- Заброшенные шахты: крепи и рельсы. ---
    case 'Заброшенные шахты': {
      ctx.strokeStyle = '#1a1410';
      ctx.lineWidth = Math.max(3, W * 0.007);
      for (let i = 0; i < 4; i++) {
        const x = W * (0.1 + i * 0.28);
        ctx.beginPath();
        ctx.moveTo(x, H * 0.84);
        ctx.lineTo(x, H * 0.15);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - W * 0.05, H * 0.18);
        ctx.lineTo(x + W * 0.05, H * 0.18);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(0, H * 0.18);
      ctx.lineTo(W, H * 0.18);
      ctx.stroke();
      // Рельсы на полу.
      ctx.strokeStyle = bio.accent + '33';
      ctx.lineWidth = Math.max(1.5, W * 0.003);
      for (const dy of [0.79, 0.83]) {
        ctx.beginPath();
        ctx.moveTo(0, H * dy);
        ctx.lineTo(W, H * dy);
        ctx.stroke();
      }
      break;
    }

    // --- Бездонный провал: обрыв и парящие камни. ---
    case 'Бездонный провал': {
      // Край обрыва.
      ctx.fillStyle = '#05040a';
      ctx.beginPath();
      ctx.moveTo(0, H * 0.84);
      ctx.lineTo(W * 0.28, H * 0.84);
      ctx.lineTo(W * 0.34, H * 0.92);
      ctx.lineTo(0, H * 0.95);
      ctx.closePath();
      ctx.fill();
      // Парящие обломки.
      for (let i = 0; i < 6; i++) {
        const x = ((i * 211 + seed) % 100) / 100 * W;
        const y = H * (0.3 + ((i * 47) % 40) / 100) + Math.sin(t * 0.7 + i) * H * 0.01;
        ctx.fillStyle = '#120c1c';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + W * 0.03, y + H * 0.01);
        ctx.lineTo(x + W * 0.02, y + H * 0.03);
        ctx.lineTo(x - W * 0.01, y + H * 0.02);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }

    // --- Затопленное святилище: колонны в воде. ---
    case 'Затопленное святилище': {
      for (let i = 0; i < 4; i++) {
        const x = W * (0.12 + i * 0.25);
        ctx.fillStyle = bio.mist + '2a';
        ctx.fillRect(x - W * 0.015, H * 0.25, W * 0.03, H * 0.59);
        // Капитель.
        ctx.fillRect(x - W * 0.028, H * 0.24, W * 0.056, H * 0.02);
      }
      // Вода с отражением и кругами.
      ctx.fillStyle = bio.mist + '22';
      ctx.fillRect(0, H * 0.8, W, H * 0.06);
      ctx.strokeStyle = bio.accent + '44';
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.35 + i * 0.33) % 1;
        ctx.beginPath();
        ctx.ellipse(W * (0.3 + i * 0.2), H * 0.83, ph * W * 0.06, ph * H * 0.012, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }

    // --- Костяная галерея: ниши со скелетами. ---
    case 'Костяная галерея': {
      for (let i = 0; i < 5; i++) {
        const ax = W * (0.06 + i * 0.22);
        arch(ax, H * 0.84, W * 0.1, H * 0.32, '#0c0a08');
        // Череп в нише.
        ctx.fillStyle = bio.accent + '55';
        ctx.beginPath();
        ctx.arc(ax, H * 0.76, W * 0.016, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0a0806';
        ctx.beginPath();
        ctx.arc(ax - W * 0.006, H * 0.758, W * 0.004, 0, Math.PI * 2);
        ctx.arc(ax + W * 0.006, H * 0.758, W * 0.004, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    // --- Подземная кузня: наковальни и молоты. ---
    case 'Подземная кузня': {
      softGlow(ctx, cx, cy + H * 0.06, W * 0.3, bio.accent, 0.22);
      for (let i = 0; i < 2; i++) {
        const x = W * (0.2 + i * 0.55);
        // Наковальня.
        ctx.fillStyle = '#1a1210';
        ctx.fillRect(x - W * 0.03, H * 0.78, W * 0.06, H * 0.02);
        ctx.fillRect(x - W * 0.015, H * 0.8, W * 0.03, H * 0.04);
      }
      // Угли в горне.
      ctx.fillStyle = bio.accent + '44';
      for (let i = 0; i < 8; i++) {
        const x = cx - W * 0.1 + (i * 37) % (W * 0.2);
        const y = H * 0.86 - ((i * 23) % 20);
        ctx.fillRect(x, y, W * 0.008, W * 0.008);
      }
      break;
    }

    default: {
      // Лёгкая деталь по умолчанию — тусклый огонь в глубине.
      softGlow(ctx, cx, cy, W * 0.25, bio.accent, 0.1);
      break;
    }
  }
}

function drawSilhouettePagoda(ctx, x, baseY, s) {
  ctx.fillStyle = '#080a12';
  for (let i = 0; i < 4; i++) {
    const w = s * (2.0 - i * 0.34);
    const y = baseY - i * s * 0.72;
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x, y - s * 0.5, x + w, y);
    ctx.lineTo(x + w * 0.72, y + s * 0.14);
    ctx.lineTo(x - w * 0.72, y + s * 0.14);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(x - w * 0.42, y + s * 0.14, w * 0.84, s * 0.58);
  }
}

/** Магический круг на полу арены. */
function drawArenaCircle(ctx, W, H, bio, t) {
  const ccx = W * 0.5, ccy = H * 0.9;
  const cr = Math.min(W, H) * 0.2;
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = bio.accent;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(ccx, ccy, cr * (1 - i * 0.22), cr * 0.3 * (1 - i * 0.22), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.55;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + t * 0.25;
    ctx.beginPath();
    ctx.moveTo(ccx, ccy);
    ctx.lineTo(ccx + Math.cos(a) * cr, ccy + Math.sin(a) * cr * 0.3);
    ctx.stroke();
  }
  ctx.restore();
}

// ================================================================ АРЕНЫ БОССОВ

/**
 * Анимированные арены боссов по стихии.
 *
 * Возвращает true, если сцена нарисована. Каждая — своя: огонь, вода,
 * молния, лёд, пустота, небо.
 */
export function drawBossArena(ctx, W, H, enemy, t, timeKey) {
  const el = enemy.element;
  const pal = enemy.palette;
  const tod = TIMES[timeKey || timeOfDay(enemy.level)] || TIMES.night;

  switch (el) {
    case 'fire':    bossVolcano(ctx, W, H, pal, t); break;
    case 'ice':     bossGlacier(ctx, W, H, pal, t); break;
    case 'storm':   bossStorm(ctx, W, H, pal, t); break;
    case 'void':    bossAbyss(ctx, W, H, pal, t); break;
    case 'heaven':  bossHeaven(ctx, W, H, pal, t); break;
    case 'shadow':  bossShadowWood(ctx, W, H, pal, t); break;
    case 'sakura':  bossSakuraGate(ctx, W, H, pal, t); break;
    default:        drawArena(ctx, W, H, enemy, t, timeKey); return false;
  }

  // Своя сцена босса уже задаёт настроение, поэтому тон времени суток
  // ложится мягче, чем на обычных аренах, — иначе вулкан «весной»
  // становится неузнаваемым. Но разница между днём и ночью видна.
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = tod.stars > 0 ? 0.42 : 0.26;
  ctx.fillStyle = tod.skyWarm;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // Звёзд над сценой босса больше нет: это подземные чертоги, а не
  // ночное небо. Вместо звёзд ночью сгущается каменный свод.
  if (tod.stars > 0) {
    cavernVault(ctx, W, H, enemy.level * 31, tod.light * 0.8);
  }
  return true;
}

/**
 * ЛАВОВЫЙ ГРОТ: пещера, затопленная лавой.
 *
 * Раньше здесь был конус вулкана с кратером и потоками лавы по склону
 * — вид снаружи, издалека. Но бой идёт в подземелье: игрок стоит в
 * гроте, а не смотрит на гору. Теперь лава внизу, свод сверху,
 * сталактиты и трещины в камне.
 */
function bossVolcano(ctx, W, H, pal, t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0d0300');
  g.addColorStop(0.45, '#2a0c00');
  g.addColorStop(0.8, '#4a1800');
  g.addColorStop(1, '#1a0500');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Каменный свод над головой.
  cavernVault(ctx, W, H, 13, 1.0);

  // Лавовое озеро в глубине — источник света всей сцены.
  softGlow(ctx, W * 0.5, H * 0.74, W * 0.7, '#ff6a00', 0.32);

  // Берег лавы: неровная кромка.
  ctx.fillStyle = '#170400';
  ctx.beginPath();
  ctx.moveTo(0, H * 0.82);
  for (let i = 0; i <= 8; i++) {
    const x = (W / 8) * i;
    const n = Math.sin(i * 1.9 + 3) * 0.5 + Math.sin(i * 3.7) * 0.5;
    ctx.lineTo(x, H * (0.76 + Math.abs(n) * 0.04));
  }
  ctx.lineTo(W, H * 0.82);
  ctx.closePath();
  ctx.fill();

  // Трещины в полу, раскалённые докрасна.
  ctx.strokeStyle = '#ffb04a';
  ctx.lineWidth = Math.max(2, W * 0.004);
  ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const off = (i - 2) * 0.09;
    ctx.beginPath();
    ctx.moveTo(W * (0.5 + off * 0.6), H * 0.82);
    ctx.quadraticCurveTo(
      W * (0.5 + off * 1.4), H * 0.9,
      W * (0.5 + off * 2.6), H * 0.99
    );
    ctx.stroke();
  }

  // Пепел — падает медленно.
  ctx.fillStyle = '#ffcf9a';
  for (let i = 0; i < 45; i++) {
    const sp = 0.02 + (i % 7) * 0.008;
    const x = ((i * 173) % 1000) / 1000 * W + Math.sin(t * 0.6 + i) * W * 0.02;
    const y = (((i * 271) % 1000) / 1000 + t * sp) % 1 * H;
    ctx.globalAlpha = 0.25 + ((i * 37) % 100) / 400;
    ctx.fillRect(x, y, 2.4, 2.4);
  }
  ctx.globalAlpha = 1;

  // Искры, летящие вверх от лавы.
  for (let i = 0; i < 18; i++) {
    const ph = (t * 0.35 + i * 0.13) % 1;
    const x = W * (0.3 + ((i * 97) % 40) / 100) + Math.sin(t + i) * 18;
    const y = H * 0.85 - ph * H * 0.5;
    softGlow(ctx, x, y, 8, '#ffd166', (1 - ph) * 0.8);
  }

  // Земля.
  const eg = ctx.createLinearGradient(0, H * 0.82, 0, H);
  eg.addColorStop(0, '#2a0b00');
  eg.addColorStop(1, '#100300');
  ctx.fillStyle = eg;
  ctx.fillRect(0, H * 0.82, W, H * 0.18);

  // Трещины с лавой на полу.
  ctx.strokeStyle = '#ff7a18';
  ctx.globalAlpha = 0.55 + Math.sin(t * 2) * 0.25;
  ctx.lineWidth = 1.8;
  for (let i = 0; i < 6; i++) {
    const y0 = H * (0.85 + i * 0.025);
    ctx.beginPath();
    ctx.moveTo(0, y0);
    for (let x = 0; x <= W; x += W / 8) {
      ctx.lineTo(x, y0 + Math.sin(x * 0.01 + i) * 6);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** ЛЕДНИК: синие скалы, снег, северное сияние. */
function bossGlacier(ctx, W, H, pal, t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#04121f');
  g.addColorStop(0.5, '#0c2a44');
  g.addColorStop(1, '#081623');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Северное сияние — медленные волны.
  for (let band = 0; band < 3; band++) {
    ctx.save();
    ctx.globalAlpha = 0.14 - band * 0.03;
    ctx.strokeStyle = band % 2 === 0 ? '#6fe8c0' : '#7fb8ff';
    ctx.lineWidth = H * (0.05 - band * 0.012);
    ctx.beginPath();
    for (let x = 0; x <= W; x += W / 20) {
      const y = H * (0.14 + band * 0.06) + Math.sin(x * 0.006 + t * 0.5 + band) * H * 0.05;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Свод ледяной пещеры — вместо ночного неба над ледником.
  cavernVault(ctx, W, H, 17, 1.0);

  // Холодное свечение из толщи льда в своде — вместо луны.
  softGlow(ctx, W * 0.75, H * 0.14, W * 0.26, '#bfe8ff', 0.22);

  // Айсберги.
  ctx.fillStyle = '#0a1e30';
  for (let i = 0; i < 4; i++) {
    const bx = W * (0.1 + i * 0.26);
    const bw = W * (0.09 + (i % 2) * 0.05);
    const bh = H * (0.2 + (i % 3) * 0.07);
    ctx.beginPath();
    ctx.moveTo(bx - bw, H * 0.82);
    ctx.lineTo(bx - bw * 0.3, H * 0.82 - bh);
    ctx.lineTo(bx + bw * 0.2, H * 0.82 - bh * 0.7);
    ctx.lineTo(bx + bw, H * 0.82);
    ctx.closePath();
    ctx.fill();
  }

  // Снег.
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 90; i++) {
    const sp = 0.03 + (i % 5) * 0.012;
    const x = ((i * 197) % 1000) / 1000 * W + Math.sin(t * 0.7 + i * 0.5) * W * 0.015;
    const y = (((i * 313) % 1000) / 1000 + t * sp) % 1 * H;
    ctx.globalAlpha = 0.35 + ((i * 53) % 100) / 180;
    ctx.beginPath();
    ctx.arc(x, y, 1.6 + (i % 3) * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Ледяной пол.
  const eg = ctx.createLinearGradient(0, H * 0.82, 0, H);
  eg.addColorStop(0, '#12314a');
  eg.addColorStop(1, '#061019');
  ctx.fillStyle = eg;
  ctx.fillRect(0, H * 0.82, W, H * 0.18);

  // Блики на льду.
  ctx.strokeStyle = '#bfe8ff';
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(W * (0.1 + i * 0.2), H * 0.87);
    ctx.lineTo(W * (0.16 + i * 0.2), H * 0.95);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** ГРОЗА: тяжёлые тучи, вспышки молний, ливень. */
function bossStorm(ctx, W, H, pal, t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#080c14');
  g.addColorStop(0.5, '#141c2c');
  g.addColorStop(1, '#0a0e18');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Клубящиеся тучи — тёмные эллипсы разного размера.
  for (let i = 0; i < 7; i++) {
    const x = W * (0.05 + i * 0.16) + Math.sin(t * 0.25 + i) * W * 0.02;
    const y = H * (0.1 + (i % 3) * 0.05);
    ctx.fillStyle = `rgba(28,36,54,${0.55 + (i % 3) * 0.1})`;
    ctx.beginPath();
    ctx.ellipse(x, y, W * 0.16, H * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Вспышки молний: цикл из трёх тактов.
  const cycle = t % 3.2;
  const flash = cycle < 0.12 ? 1 : cycle < 0.22 ? 0.4 : cycle < 0.3 ? 0.8 : 0;
  if (flash > 0) {
    ctx.save();
    ctx.globalAlpha = flash * 0.35;
    ctx.fillStyle = '#cfe8ff';
    ctx.fillRect(0, 0, W, H * 0.7);
    ctx.restore();

    // Сама молния — ломаная.
    if (cycle < 0.12) {
      ctx.strokeStyle = '#e8f4ff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      let lx = W * 0.62, ly = 0;
      ctx.moveTo(lx, ly);
      for (let i = 0; i < 7; i++) {
        lx += (((i * 71) % 40) - 20) * W * 0.004;
        ly += H * 0.07;
        ctx.lineTo(lx, ly);
      }
      ctx.stroke();
    }
  }

  // Дальние скалы убраны: это подземный грот, а не перевал под дождём.
  // На их месте — стена пещеры с аркой.
  tunnelBack(ctx, W, H, 5, 1.0);

  // Ливень — частые быстрые штрихи.
  ctx.strokeStyle = '#9dc4e8';
  ctx.lineWidth = 1.2;
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < 70; i++) {
    const sp = 0.55 + (i % 5) * 0.12;
    const x = ((i * 181) % 1000) / 1000 * W;
    const y = (((i * 257) % 1000) / 1000 + t * sp) % 1 * H;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - W * 0.004, y + H * 0.022);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const eg = ctx.createLinearGradient(0, H * 0.82, 0, H);
  eg.addColorStop(0, '#0e1420');
  eg.addColorStop(1, '#05070c');
  ctx.fillStyle = eg;
  ctx.fillRect(0, H * 0.82, W, H * 0.18);
}

/** БЕЗДНА: пустота, разрывы, дрейфующие осколки. */
function bossAbyss(ctx, W, H, pal, t) {
  ctx.fillStyle = '#040208';
  ctx.fillRect(0, 0, W, H);

  // Медленно дышащая тьма.
  softGlow(ctx, W * 0.5, H * 0.42, W * 0.55, '#5a1e8f', 0.25 + Math.sin(t * 0.6) * 0.08);

  // Разрывы пространства — тонкие фиолетовые дуги.
  ctx.strokeStyle = pal.glow;
  for (let i = 0; i < 4; i++) {
    ctx.globalAlpha = 0.16 + Math.sin(t * 0.8 + i) * 0.08;
    ctx.lineWidth = 1 + i * 0.6;
    ctx.beginPath();
    const r = W * (0.18 + i * 0.09);
    ctx.arc(W * 0.5, H * 0.45, r, t * 0.2 + i, t * 0.2 + i + 2.2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Осколки — плывут вверх, вращаются.
  for (let i = 0; i < 22; i++) {
    const ph = ((i * 137) % 1000) / 1000;
    const x = ((i * 271) % 1000) / 1000 * W + Math.sin(t * 0.4 + i) * W * 0.03;
    const y = (ph + t * 0.02) % 1 * H;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * 0.3 + i);
    ctx.fillStyle = i % 3 === 0 ? pal.glow : pal.accent;
    ctx.globalAlpha = 0.25 + ((i * 41) % 100) / 300;
    ctx.beginPath();
    ctx.moveTo(0, -5); ctx.lineTo(4, 0); ctx.lineTo(0, 5); ctx.lineTo(-4, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // Искажённая земля без горизонта.
  const eg = ctx.createRadialGradient(W * 0.5, H * 0.9, 10, W * 0.5, H * 0.9, W * 0.5);
  eg.addColorStop(0, '#180a28');
  eg.addColorStop(1, '#040208');
  ctx.fillStyle = eg;
  ctx.fillRect(0, H * 0.82, W, H * 0.18);
}

/**
 * ЧЕРТОГ СВЕТА: подземный храм, освещённый изнутри.
 *
 * Раньше здесь были облака, солнце и парящие острова — то есть небо.
 * Но последний страж стоит в подземной твердыне, а не в облаках.
 * Небесный свет остался, но источник другой: не солнце в небе, а
 * огромный кристалл в своде, от которого идут лучи.
 */
function bossHeaven(ctx, W, H, pal, t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1a1004');
  g.addColorStop(0.4, '#3a2408');
  g.addColorStop(0.75, '#5a3a10');
  g.addColorStop(1, '#241604');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Каменный свод — потолок чертога.
  cavernVault(ctx, W, H, 11, 1.0);

  // Кристалл света, вросший в свод: отсюда идёт всё освещение.
  softGlow(ctx, W * 0.5, H * 0.22, W * 0.5, '#ffe9a8', 0.55);
  ctx.fillStyle = '#fff4cc';
  ctx.beginPath();
  ctx.moveTo(W * 0.5, H * 0.12);
  ctx.lineTo(W * 0.55, H * 0.26);
  ctx.lineTo(W * 0.5, H * 0.34);
  ctx.lineTo(W * 0.45, H * 0.26);
  ctx.closePath();
  ctx.fill();

  // Лучи от кристалла — не от солнца, а от камня. Вращаются медленно.
  ctx.save();
  ctx.translate(W * 0.5, H * 0.26);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + t * 0.06;
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#fff2c8';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * W, Math.sin(a) * W - W * 0.12);
    ctx.lineTo(Math.cos(a + 0.12) * W, Math.sin(a + 0.12) * W);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Колонны чертога по бокам — вместо облаков.
  for (let i = 0; i < 4; i++) {
    const x = W * (0.08 + i * 0.28);
    ctx.fillStyle = 'rgba(255,240,210,0.10)';
    ctx.fillRect(x - W * 0.014, H * 0.28, W * 0.028, H * 0.56);
    ctx.fillRect(x - W * 0.026, H * 0.27, W * 0.052, H * 0.02);
  }

  // Пол.
  const eg = ctx.createLinearGradient(0, H * 0.82, 0, H);
  eg.addColorStop(0, '#3a2408');
  eg.addColorStop(1, '#160e03');
  ctx.fillStyle = eg;
  ctx.fillRect(0, H * 0.82, W, H * 0.18);
}

/** ТЕНИ: подземный склеп-роща, мёртвые стволы в гроте, туман. */
function bossShadowWood(ctx, W, H, pal, t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#04060e');
  g.addColorStop(0.6, '#0a1020');
  g.addColorStop(1, '#04060c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Свод грота — вместо ночного неба.
  cavernVault(ctx, W, H, 7, 0.9);

  // Холодное свечение из трещины в своде — вместо луны.
  softGlow(ctx, W * 0.7, H * 0.14, W * 0.24, '#8ea8d8', 0.22);

  // Мёртвые стволы.
  ctx.strokeStyle = '#05070e';
  ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const x = W * (0.06 + i * 0.15);
    const h = H * (0.42 + (i % 3) * 0.12);
    ctx.lineWidth = W * (0.008 + (i % 3) * 0.004);
    ctx.beginPath();
    ctx.moveTo(x, H * 0.84);
    ctx.quadraticCurveTo(x + 8, H * 0.84 - h * 0.6, x + (i % 2 ? 18 : -18), H * 0.84 - h);
    ctx.stroke();
    // Ветви.
    ctx.lineWidth = W * 0.003;
    for (let b = 1; b <= 2; b++) {
      const by = H * 0.84 - h * (0.4 + b * 0.22);
      ctx.beginPath();
      ctx.moveTo(x + b * 4, by);
      ctx.lineTo(x + (i % 2 ? 42 : -42), by - H * 0.05);
      ctx.stroke();
    }
  }

  // Туман — полосы, ползущие вбок.
  ctx.fillStyle = '#5a6f90';
  for (let i = 0; i < 5; i++) {
    const x = (((i * 311) % 800) / 800 * W + t * 12) % (W + 300) - 150;
    ctx.globalAlpha = 0.07;
    ctx.beginPath();
    ctx.ellipse(x, H * (0.78 + i * 0.02), W * 0.3, H * 0.035, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const eg = ctx.createLinearGradient(0, H * 0.82, 0, H);
  eg.addColorStop(0, '#0a0f1a');
  eg.addColorStop(1, '#03040a');
  ctx.fillStyle = eg;
  ctx.fillRect(0, H * 0.82, W, H * 0.18);
}

/** САКУРА: врата тории, осыпающиеся лепестки. */
function bossSakuraGate(ctx, W, H, pal, t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2a0f1e');
  g.addColorStop(0.5, '#4a1c30');
  g.addColorStop(1, '#1e0a14');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  softGlow(ctx, W * 0.28, H * 0.2, W * 0.3, '#ffd0e0', 0.28);

  // Врата тории.
  ctx.fillStyle = '#1a0810';
  const gx = W * 0.62, gy = H * 0.82, gw = W * 0.16;
  ctx.fillRect(gx - gw, gy - H * 0.42, gw * 0.12, H * 0.42);
  ctx.fillRect(gx + gw * 0.88, gy - H * 0.42, gw * 0.12, H * 0.42);
  ctx.fillRect(gx - gw * 1.25, gy - H * 0.44, gw * 2.5, H * 0.03);
  ctx.fillRect(gx - gw * 1.05, gy - H * 0.37, gw * 2.1, H * 0.02);

  // Лепестки — падают по спирали.
  for (let i = 0; i < 40; i++) {
    const sp = 0.04 + (i % 5) * 0.015;
    const x = ((i * 151) % 1000) / 1000 * W + Math.sin(t * 0.9 + i) * W * 0.03;
    const y = (((i * 293) % 1000) / 1000 + t * sp) % 1 * H;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * 0.8 + i);
    ctx.fillStyle = i % 3 === 0 ? '#ffd0e0' : '#ff9ec4';
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.ellipse(0, 0, 4, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  const eg = ctx.createLinearGradient(0, H * 0.82, 0, H);
  eg.addColorStop(0, '#2a1020');
  eg.addColorStop(1, '#12060c');
  ctx.fillStyle = eg;
  ctx.fillRect(0, H * 0.82, W, H * 0.18);
}

export { biomeFor };
