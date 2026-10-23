/**
 * СИСТЕМА СИМВОЛОВ (СИГИЛОВ)
 * ========================
 * Ключевая идея баланса: чем сильнее заклинание, тем сложнее и дольше его рисовать.
 * Сложность = ранг (rank). Ранг определяет:
 *   - стоимость маны (manaCost)
 *   - время каста после успешного распознавания (castTime)
 *   - время рисования (drawTime) — сколько нужно вести линию
 *   - размер урона / эффекта
 *   - насколько легко "сбить" этот каст (interruptWindow)
 *
 * Ранги (число штрихов проверено tools/check.mjs и справкой в игре):
 *   I    (Tier 1) — 2 штриха, мгновенные. Основа спама и «сбивания».
 *   II   (Tier 2) — 3 штриха, требуют стабильной руки.
 *   III  (Tier 3) — 4 штриха, заметный урон, легко прервать если начал не вовремя.
 *   IV   (Tier 4) — 5 штрихов, сложные многозвенные, требуют расчистки поля.
 *   V    (Tier 5) — 6 штрихов, долгий рисунок, огромный урон, почти гарантированный прерывание.
 *
 * Каждый символ описан как направленная последовательность сегментов.
 * Сегмент = направление движения: 0=вправо, 1=вправо-вниз, 2=вниз, 3=влево-вниз,
 * 4=влево, 5=влево-вверх, 6=вверх, 7=вправо-вверх (8 направлений, как на нумпаде).
 * Это даёт устойчивое распознавание: важно направление черты, а не точная форма.
 */

export const DIR = {
  E: 0, SE: 1, S: 2, SW: 3, W: 4, NW: 5, N: 6, NE: 7,
};

/** Человекочитаемые названия направлений для подсказок. */
export const DIR_NAME = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];

export const TIERS = {
  1: { name: 'Ранг I', color: '#8fd3ff', glow: '#4aa8ff', manaMult: 1.0, dmgMult: 1.0 },
  2: { name: 'Ранг II', color: '#9dff9d', glow: '#43d943', manaMult: 1.5, dmgMult: 1.9 },
  3: { name: 'Ранг III', color: '#ffe066', glow: '#ffb700', manaMult: 2.2, dmgMult: 3.4 },
  4: { name: 'Ранг IV', color: '#ff9d5c', glow: '#ff6a00', manaMult: 3.2, dmgMult: 5.8 },
  5: { name: 'Ранг V', color: '#ff6b9d', glow: '#ff1f6b', manaMult: 4.6, dmgMult: 9.5 },
};

/**
 * Таблица символов.
 * pattern — последовательность направлений, которую нужно нарисовать.
 *
 * БАЛАНС УРОНА. Ключевая идея: урон за единицу маны растёт с рангом.
 * Иначе нет смысла рисковать долгим рисунком — дешёвый спам был бы выгоднее.
 * Ранг I остаётся лучшим по скорости и по урону В СЕКУНДУ (это оружие
 * для сбивания), но проигрывает по урону за ману, поэтому в затяжном бою
 * выгоднее вкладываться в высокие ранги.
 */
export const SIGILS = {
  // ---------- РАНГ I: быстрые, дешёвые, для сбивания чужих кастов ----------
  spark: {
    id: 'spark',
    name: 'Искра',
    hanzi: '火',
    tier: 1,
    pattern: [DIR.E, DIR.S],
    manaCost: 6,
    castTime: 0.10,
    drawTime: 0.35,
    damage: 6,
    kind: 'projectile',
    // Перезарядка — ключ к тактике.
    //
    // Без неё искра становится универсальным ответом на любой чужой каст:
    // она мгновенная и дешёвая, поэтому игрок просто сбивает всё подряд
    // и щит никогда не нужен. Перезарядка заставляет считать:
    // если искра на откате, остаётся только закрыться щитом.
    cooldown: 1.6,
    desc: 'Мгновенный сгусток огня. Самое быстрое заклинание — идеально для сбивания, но урон мал.',
    interruptPower: 1.0, // насколько хорошо прерывает чужие касты
  },
  pebble: {
    id: 'pebble',
    name: 'Каменное жало',
    hanzi: '石',
    tier: 1,
    pattern: [DIR.E, DIR.N],
    manaCost: 6,
    castTime: 0.12,
    drawTime: 0.35,
    damage: 7,
    kind: 'projectile',
    cooldown: 1.2,
    desc: 'Короткий толчок камня. Чуть больнее искры, но медленнее. Свой откат.',
    interruptPower: 0.95,
  },
  veil: {
    id: 'veil',
    name: 'Дымка',
    hanzi: '雾',
    tier: 1,
    pattern: [DIR.S, DIR.E],
    manaCost: 7,
    castTime: 0.14,
    drawTime: 0.35,
    damage: 0,
    kind: 'debuff',
    effect: { accuracy: -0.25, duration: 4 },
    desc: 'Затуманивает взор врага: его следующие символы распознаются хуже.',
    interruptPower: 0.75,
  },

  // ---------- РАНГ II: основная боевая работа ----------
  bolt: {
    id: 'bolt',
    name: 'Громовая стрела',
    hanzi: '雷',
    tier: 2,
    pattern: [DIR.E, DIR.S, DIR.W],
    manaCost: 14,
    castTime: 0.32,
    drawTime: 0.75,
    damage: 19,
    kind: 'projectile',
    desc: 'Разряд по прямой. Рабочая лошадка боя.',
    interruptPower: 1.15,
  },
  ward_pulse: {
    id: 'ward_pulse',
    name: 'Импульс',
    hanzi: '震',
    tier: 2,
    pattern: [DIR.S, DIR.E, DIR.N],
    manaCost: 15,
    castTime: 0.30,
    drawTime: 0.75,
    damage: 14,
    kind: 'aoe',
    effect: { stagger: 0.6 }, // оглушает врага, замедляя его рисунок
    desc: 'Волна силы: меньше урона, но сбивает врага с ритма.',
    interruptPower: 1.35,
  },
  mend: {
    id: 'mend',
    name: 'Тихий ручей',
    hanzi: '泉',
    tier: 2,
    pattern: [DIR.N, DIR.E, DIR.S],
    // Лечение стоит дорого и даёт меньше, чем отнимает чужой удар.
    //
    // Замер: при 22 HP за 16 маны (1.375 HP/мана) бот вылечивал 5544 HP
    // за бой — больше, чем у босса здоровья. Бой превращался в вечный
    // цикл «лечусь — получаю удар», не заканчиваясь за 180 секунд.
    //
    // Теперь 18 HP за 24 маны (0.75 HP/мана): это заметно ХУЖЕ, чем
    // атаковать (у «Копья дракона» 1.77 урона/мана). Лечение — способ
    // пережить опасный момент, а не основной план на бой.
    manaCost: 24,
    castTime: 0.34,
    drawTime: 0.80,
    damage: 0,
    kind: 'heal',
    effect: { heal: 18 },
    desc: 'Восстанавливает здоровье. Дорого: лечиться дешевле, чем атаковать, нельзя.',
    interruptPower: 0.6,
  },

  // ---------- РАНГ III: серьёзные заклинания ----------
  lance: {
    id: 'lance',
    name: 'Копьё дракона',
    hanzi: '龍',
    tier: 3,
    pattern: [DIR.E, DIR.S, DIR.W, DIR.N],
    manaCost: 26,
    castTime: 0.55,
    drawTime: 1.25,
    damage: 46,
    kind: 'projectile',
    pierce: true, // проходит сквозь щит частично
    effect: { shieldPierce: 0.35 },
    desc: 'Пробивает щит на треть урона. Требует 4 уверенных штриха.',
    interruptPower: 1.2,
  },
  frost_bind: {
    id: 'frost_bind',
    name: 'Оковы льда',
    hanzi: '冰',
    tier: 3,
    pattern: [DIR.S, DIR.E, DIR.N, DIR.W],
    manaCost: 27,
    castTime: 0.58,
    drawTime: 1.25,
    damage: 18,
    kind: 'control',
    effect: { freeze: 1.8 },
    desc: 'Сковывает врага. Замороженный враг не может завершить символ.',
    interruptPower: 1.6,
  },
  flame_wall: {
    id: 'flame_wall',
    name: 'Стена пламени',
    hanzi: '焰',
    tier: 3,
    pattern: [DIR.E, DIR.N, DIR.W, DIR.S],
    manaCost: 29,
    castTime: 0.60,
    drawTime: 1.30,
    damage: 36,
    kind: 'aoe',
    effect: { burn: { dmg: 5, duration: 4 } },
    desc: 'Поджигает врага: урон продолжается после попадания.',
    interruptPower: 1.25,
  },

  // ---------- РАНГ IV: требуют окна безопасности ----------
  tempest: {
    id: 'tempest',
    name: 'Небесная кара',
    hanzi: '霆',
    tier: 4,
    pattern: [DIR.E, DIR.S, DIR.E, DIR.N, DIR.W],
    manaCost: 40,
    castTime: 0.85,
    drawTime: 1.85,
    damage: 84,
    kind: 'aoe',
    effect: { stagger: 1.0 },
    desc: 'Пять штрихов, тяжелый удар по площади. Легко прервать.',
    interruptPower: 1.1,
  },
  siphon: {
    id: 'siphon',
    name: 'Похищение ци',
    hanzi: '吸',
    tier: 4,
    pattern: [DIR.S, DIR.W, DIR.N, DIR.E, DIR.S],
    manaCost: 38,
    castTime: 0.90,
    drawTime: 1.90,
    damage: 52,
    kind: 'drain',
    effect: { manaDrain: 28, heal: 18 },
    desc: 'Вытягивает ману и жизнь врага. Решает затяжные бои.',
    interruptPower: 0.9,
  },
  mirror: {
    id: 'mirror',
    name: 'Зеркальный зал',
    hanzi: '鏡',
    tier: 4,
    pattern: [DIR.N, DIR.E, DIR.S, DIR.E, DIR.N],
    manaCost: 36,
    castTime: 0.80,
    drawTime: 1.80,
    damage: 0,
    kind: 'buff',
    effect: { reflect: { duration: 5, ratio: 0.6 } },
    desc: 'Отражает 60% входящего урона обратно во врага.',
    interruptPower: 0.5,
  },

  // ---------- РАНГ V: ультимативные ----------
  judgment: {
    id: 'judgment',
    name: 'Суд Небес',
    hanzi: '天',
    tier: 5,
    pattern: [DIR.E, DIR.S, DIR.W, DIR.S, DIR.E, DIR.N],
    manaCost: 62,
    castTime: 1.30,
    drawTime: 2.60,
    damage: 190,
    kind: 'aoe',
    effect: { stagger: 1.4, shieldPierce: 0.5 },
    desc: 'Шесть штрихов. Половина урона проходит сквозь щит. Огромный риск.',
    interruptPower: 0.85,
  },
  vortex: {
    id: 'vortex',
    name: 'Врата бездны',
    hanzi: '淵',
    tier: 5,
    pattern: [DIR.S, DIR.E, DIR.N, DIR.E, DIR.S, DIR.W],
    manaCost: 66,
    castTime: 1.40,
    drawTime: 2.70,
    damage: 160,
    kind: 'drain',
    effect: { manaDrain: 45, freeze: 1.2, heal: 40 },
    desc: 'Крадёт ману, жизнь и время. Самый сложный символ в игре.',
    interruptPower: 0.8,
  },
};

/** Символ щита — особый: не кастуется, а удерживается. */
export const SHIELD_SIGIL = {
  id: 'shield',
  name: 'Незыблемый круг',
  hanzi: '盾',
  tier: 2,
  pattern: [DIR.S, DIR.W, DIR.N, DIR.E], // замкнутый контур
  manaCost: 12,          // стоимость активации
  // Расход маны в секунду при удержании.
  //
  // Цена удержания.
  //
  // Расход растёт с уровнем вместе с запасом маны: иначе на высоких
  // уровнях щит держится десятками секунд почти бесплатно, и вся тактика
  // ломается. Ориентир — окно защиты 8-10 секунд на любом уровне.
  //
  // ВАЖНО: под щитом отключён реген маны (см. combat.js), поэтому реальная
  // цена удержания = upkeep + потерянный реген. На 25 уровне это
  // 5.9 + 15.7 = 21.6 маны/с. Это осознанно дорого: щит — не образ жизни,
  // а короткое укрытие от того, что нельзя сбить.
  //
  // Ориентир — окно защиты 8-10 секунд на ЛЮБОМ уровне. Попытка поднять
  // upkeepPerLevel до 0.95 (чтобы разорвать цикл укрытия на 70 уровне)
  // сломала именно это: окно разъехалось до 5.0..11.1 с, а зависший бой
  // никуда не делся. Причина затора была не в цене удержания.
  upkeepBase: 9,
  upkeepPerLevel: 0.55,
  castTime: 0.25,
  drawTime: 1.0,
  desc: 'Барьер, поглощающий весь урон. Пока активен — колдовать нельзя. Жрёт ману постоянно.',
  blocksAll: true,
};

/** Текущий расход маны на удержание щита для персонажа данного уровня. */
export function shieldUpkeep(level) {
  return SHIELD_SIGIL.upkeepBase + SHIELD_SIGIL.upkeepPerLevel * (level - 1);
}

/** Список всех боевых символов, отсортированный по рангу. */
export const SIGIL_LIST = Object.values(SIGILS).sort(
  (a, b) => a.tier - b.tier || a.manaCost - b.manaCost
);

/** Символы, доступные игроку на данном уровне прогрессии. */
export function sigilsForLevel(level) {
  const maxTier = level <= 2 ? 1 : level <= 5 ? 2 : level <= 10 ? 3 : level <= 16 ? 4 : 5;
  return SIGIL_LIST.filter((s) => s.tier <= maxTier);
}

export function getSigil(id) {
  return SIGILS[id] || (id === 'shield' ? SHIELD_SIGIL : null);
}

/**
 * Приводит сырую траекторию к последовательности дискретных направлений.
 * @param {Array<{x:number,y:number}>} points
 * @returns {number[]} направления (0..7)
 */
export function pathToDirections(points) {
  if (!points || points.length < 2) return [];

  // ------------------------------------------------------------------
  // ШАГ 1. Прореживание входа.
  // Сырой поток указателя содержит микродрожь. Если её не убрать,
  // одно движение руки распадается на десяток мелких сегментов
  // со случайными направлениями, и распознавание ломается.
  // ------------------------------------------------------------------
  const simplified = [points[0]];
  const MIN_STEP = 4; // пикселей — всё, что меньше, считаем дрожью
  for (let i = 1; i < points.length; i++) {
    const prev = simplified[simplified.length - 1];
    if (Math.hypot(points[i].x - prev.x, points[i].y - prev.y) >= MIN_STEP) {
      simplified.push(points[i]);
    }
  }
  // Последнюю точку сохраняем всегда — она задаёт конец штриха.
  const lastPt = points[points.length - 1];
  const tail = simplified[simplified.length - 1];
  if (tail !== lastPt && Math.hypot(lastPt.x - tail.x, lastPt.y - tail.y) > 1) {
    simplified.push(lastPt);
  }
  if (simplified.length < 2) return [];

  // ------------------------------------------------------------------
  // ШАГ 2. Сегменты между прореженными точками.
  // ------------------------------------------------------------------
  const segs = [];
  for (let i = 1; i < simplified.length; i++) {
    const dx = simplified[i].x - simplified[i - 1].x;
    const dy = simplified[i].y - simplified[i - 1].y;
    const len = Math.hypot(dx, dy);
    if (len > 0.01) segs.push({ dx, dy, len, angle: Math.atan2(dy, dx) });
  }
  if (!segs.length) return [];

  const total = segs.reduce((a, s) => a + s.len, 0);
  if (total < 8) return []; // слишком мелкий рисунок — не символ

  // ------------------------------------------------------------------
  // ШАГ 3. Схлопывание в штрихи.
  //
  // Наивный подход «сравнить два соседних сегмента» ломается на дрожании.
  // Подход «сравнить с окном вперёд» ломается на поворотах: окно ещё
  // захватывает хвост пройденного участка.
  //
  // Рабочий способ — сначала сгладить траекторию, затем разрезать её
  // по точкам устойчивого изменения направления. Сглаживание убирает
  // дрожь, а поиск устойчивого поворота (а не мгновенного) отличает
  // настоящий угол символа от случайного выброса.
  // ------------------------------------------------------------------

  // 3a. Сглаживание скользящим средним по позициям.
  const WINDOW = 2;
  const smooth = simplified.map((p, i) => {
    let sx = 0, sy = 0, n = 0;
    for (let k = -WINDOW; k <= WINDOW; k++) {
      const j = i + k;
      if (j < 0 || j >= simplified.length) continue;
      sx += simplified[j].x; sy += simplified[j].y; n++;
    }
    return { x: sx / n, y: sy / n };
  });

  // 3b. Пересчитываем сегменты уже по сглаженной линии.
  const ssegs = [];
  for (let i = 1; i < smooth.length; i++) {
    const dx = smooth[i].x - smooth[i - 1].x;
    const dy = smooth[i].y - smooth[i - 1].y;
    const len = Math.hypot(dx, dy);
    if (len > 0.01) ssegs.push({ dx, dy, len, angle: Math.atan2(dy, dx) });
  }
  if (!ssegs.length) return [];

  const stotal = ssegs.reduce((a, s) => a + s.len, 0);
  if (stotal < 8) return [];

  const angleDiff = (a1, a2) => {
    let d = Math.abs(a1 - a2);
    if (d > Math.PI) d = Math.PI * 2 - d;
    return d;
  };

  // 3c. Режем линию там, где направление устойчиво меняется.
  // «Устойчиво» = подряд идёт несколько сегментов с новым направлением.
  const TURN_TOLERANCE = Math.PI / 4 * 0.85; // ~38° — допуск на неровность руки
  const CONFIRM = 2;                          // сколько сегментов подтверждают поворот

  const strokes = [];
  let accX = 0, accY = 0, accLen = 0;

  const flush = () => {
    if (accLen > 0) strokes.push({ dx: accX, dy: accY, len: accLen });
    accX = 0; accY = 0; accLen = 0;
  };

  for (let i = 0; i < ssegs.length; i++) {
    const s = ssegs[i];
    if (accLen === 0) {
      accX = s.dx; accY = s.dy; accLen = s.len;
      continue;
    }

    const accAngle = Math.atan2(accY, accX);

    // Проверяем, начинается ли здесь устойчивый поворот:
    // смотрим на следующие CONFIRM сегментов, каждый должен уводить в сторону.
    let turnConfirmed = false;
    if (i + CONFIRM <= ssegs.length) {
      let allDiffer = true;
      for (let k = 0; k < CONFIRM; k++) {
        if (angleDiff(accAngle, ssegs[i + k].angle) <= TURN_TOLERANCE) { allDiffer = false; break; }
      }
      turnConfirmed = allDiffer;
    }

    // Короткий накопленный участок не считаем отдельным штрихом —
    // это почти всегда дрожание. Приклеиваем его к следующему.
    const significant = accLen > stotal * 0.05;

    if (turnConfirmed && significant) {
      flush();
      accX = s.dx; accY = s.dy; accLen = s.len;
    } else {
      accX += s.dx; accY += s.dy; accLen += s.len;
    }
  }
  flush();

  // ------------------------------------------------------------------
  // ШАГ 4. Отсев мусорных штрихов и квантование в 8 направлений.
  // ------------------------------------------------------------------
  const minStroke = Math.max(stotal * 0.075, 9);
  const dirs = [];
  for (const st of strokes) {
    if (st.len < minStroke) continue;
    let ang = Math.atan2(st.dy, st.dx);
    if (ang < 0) ang += Math.PI * 2;
    const oct = Math.round(ang / (Math.PI / 4)) % 8;
    // Соседние одинаковые направления не дублируем.
    if (dirs.length === 0 || dirs[dirs.length - 1] !== oct) dirs.push(oct);
  }

  // Если после отсева ничего не осталось — берём самые длинные штрихи,
  // чтобы короткий, но осмысленный рисунок не пропадал.
  if (dirs.length === 0) {
    const sorted = [...strokes].sort((a, b) => b.len - a.len).slice(0, 4);
    for (const st of sorted) {
      let ang = Math.atan2(st.dy, st.dx);
      if (ang < 0) ang += Math.PI * 2;
      const oct = Math.round(ang / (Math.PI / 4)) % 8;
      if (dirs.length === 0 || dirs[dirs.length - 1] !== oct) dirs.push(oct);
    }
  }

  return dirs;
}

/**
 * Сравнивает нарисованное с шаблоном. Возвращает 0..1.
 * Учитывает совпадение длины и поштучное совпадение направлений,
 * а также "прощающее" выравнивание, если игрок сделал лишний/пропустил штрих.
 */
export function patternScore(drawn, pattern) {
  if (!drawn.length) return 0;
  const n = Math.max(drawn.length, pattern.length);
  if (n === 0) return 0;
  // Классическое выравнивание (Левенштейн) со стоимостью замены по угловой дистанции.
  const cost = (a, b) => {
    if (a === undefined || b === undefined) return 1; // вставка/удаление
    let d = Math.abs(a - b);
    if (d > 4) d = 8 - d; // направления по кругу
    return Math.min(1, d / 2); // 0 при точном совпадении, 0.5 при соседнем
  };
  const dp = Array.from({ length: drawn.length + 1 }, () => new Array(pattern.length + 1).fill(0));
  for (let i = 0; i <= drawn.length; i++) dp[i][0] = i;
  for (let j = 0; j <= pattern.length; j++) dp[0][j] = j;
  for (let i = 1; i <= drawn.length; i++) {
    for (let j = 1; j <= pattern.length; j++) {
      const sub = dp[i - 1][j - 1] + cost(drawn[i - 1], pattern[j - 1]);
      const del = dp[i - 1][j] + 1;
      const ins = dp[i][j - 1] + 1;
      dp[i][j] = Math.min(sub, del, ins);
    }
  }
  const dist = dp[drawn.length][pattern.length];
  return Math.max(0, 1 - dist / n);
}

/**
 * Распознаёт, какой символ нарисован.
 * @param {Array<{x,y}>} points
 * @param {object} opts { accuracy: 0..1 } — чем ниже, тем строже порог
 * @returns {{sigil, score, drawn}|null}
 */
export function recognize(points, opts = {}) {
  const accuracy = opts.accuracy ?? 1;
  const drawn = pathToDirections(points);
  if (drawn.length === 0) return null;

  const pool = [SHIELD_SIGIL, ...SIGIL_LIST];
  let best = null;
  for (const s of pool) {
    const raw = patternScore(drawn, s.pattern);
    // Бонус за точное совпадение количества штрихов — поощряет чёткость.
    const exact = drawn.length === s.pattern.length ? 0.12 : 0;
    const score = Math.min(1, raw + exact);
    if (!best || score > best.score) best = { sigil: s, score, drawn };
  }
  if (!best) return null;

  // Порог распознавания растёт с рангом: сложные символы требуют точности.
  const tierPenalty = (best.sigil.tier - 1) * 0.035;
  const threshold = 0.62 + tierPenalty;
  const adjusted = best.score * accuracy;
  if (adjusted < threshold) {
    return { sigil: null, score: best.score, drawn, failed: best.sigil };
  }
  return best;
}

/** Подсказка для игрока: как рисовать символ. */
export function sigilHint(sigil) {
  return sigil.pattern.map((d) => DIR_NAME[d]).join(' ');
}
