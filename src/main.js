/**
 * SIGIL MAGE — ГЛАВНЫЙ МОДУЛЬ
 * ===========================
 * Вид от первого лица: игрок смотрит на противника, стоящего напротив.
 * Символы рисуются прямо в воздухе — это и есть «кастование».
 *
 * Тактический цикл, ради которого всё построено:
 *   1. Враг начинает рисовать символ — вы видите его форму и ранг.
 *   2. Оцениваете: успеть сбить (Ранг I, дёшево и быстро) или ставить щит.
 *   3. Щит спасает, но жрёт ману и блокирует ваши касты.
 *   4. Как только враг ушёл в щит — копите ману и готовьте пробой.
 *   5. Кто первым ошибётся в ритме щит/каст — тот теряет жизнь.
 */

import { SHIELD_SIGIL, SIGILS, SIGIL_LIST, recognize, sigilHint, TIERS, DIR_NAME, shieldUpkeep } from './core/sigils.js';
import { Combatant, CONFIG } from './core/combat.js';
import { EnemyAI } from './core/enemy-ai.js';
import { ENEMIES, enemyByLevel, BOSS_LEVELS } from './data/enemies.js';
// Врага теперь рисует enemy-fx: он оборачивает character.js и добавляет
// реакцию на урон и смену состояний по здоровью.
import { createHitState, applyHit, updateHit, drawEnemyV2 } from './render/enemy-fx.js';
import { fxFor, drawSpellV2, drawImpactV2 } from './render/spell-fx.js';
import {
  createIntro, createDeath, updateCard, cardExpired, cardSkippable,
  drawIntro, drawDeath, CARD_INTRO, DEATH_CARD_LEN,
} from './render/title-card.js';
import { AudioEngine } from './audio/audio.js';
import { EnemyVoice } from './audio/enemy-voice.js';
import { drawArena, drawBossArena, timeOfDay } from './render/arenas.js';

const audio = new AudioEngine();

// Голоса врагов: враг произносит «тёмное» слово, начиная чертить символ.
// Живёт отдельно от AudioEngine, потому что это не Web Audio, а
// браузерный синтез речи — у него свои правила и своя громкость.
const enemyVoice = new EnemyVoice();

/**
 * Сколько секунд враг оседает и тает после смертельного удара, прежде чем
 * появится экран победы. За это время успевает отыграть анимация смерти.
 */
const DEATH_ANIM = 1.1;

// ================================================================ СОСТОЯНИЕ

const game = {
  scene: 'menu',          // menu | battle | victory | defeat | gameover | codex
  level: 1,
  difficulty: undefined,  // режимов сложности нет: сложность растёт по уровням
  mode: 'normal',         // режим испытания: normal | resolve | fury
  battleTrack: null,      // выбранная игроком мелодия для обычных боёв
  player: null,
  enemy: null,
  ai: null,
  enemyData: null,
  carryHpRatio: 1,        // здоровье, перенесённое из прошлого боя (0..1)
  projectiles: [],
  particles: [],
  floaters: [],           // всплывающий текст урона
  impacts: [],            // эффекты попадания каждого заклинания (свой у каждого)
  enemyHit: null,         // реакция врага на урон: отшатывание, сжатие, вспышка
  enemyDying: null,       // прогресс анимации смерти врага (0..1)
  enemyDyingT: 0,
  phase: 1,               // форма босса: 1 — обычная, 2 — истинная
  phase2Done: false,      // переход уже случился (одноразовый)
  phaseShiftT: 0,         // оставшееся время анимации превращения
  card: null,             // активная заставка: вступление или предсмертная
  time: 0,
  battleTime: 0,
  input: { drawing: false, points: [], lastRecognition: null, message: '', messageT: 0 },
  shake: 0,
  hitFlash: 0,
  enemyHitFlash: 0,
  showHelp: false,
  stats: { wins: 0, losses: 0 },
  unlockedTier: 1,
};

// ================================================================ CANVAS

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = canvas.clientWidth;
  H = canvas.clientHeight;
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  // Поворот телефона: портрет меняется на ландшафт, и вся раскладка
  // должна пересчитаться. Одного события resize мало — на iOS оно
  // приходит РАНЬШЕ, чем браузер обновит размеры, поэтому клиентские
  // ширина и высота ещё старые, и кадр остаётся обрезанным.
  // Отложенный вызов через кадр читает уже правильные значения.
  game.portrait = H > W;
}

window.addEventListener('resize', resize);

// Поворот устройства. На части браузеров приходит только он, без
// resize, поэтому обрабатываем оба события.
window.addEventListener('orientationchange', () => {
  requestAnimationFrame(() => {
    resize();
    // После поворота размеры меняются не мгновенно (адресная строка
    // прячется) — догоняем ещё раз с задержкой.
    setTimeout(resize, 120);
  });
});

// Мобильный Safari прячет адресную строку при прокрутке и меняет
// высоту вьюпорта — пересчитываем после этого.
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', resize);
}

// ============================================================ СЛОЖНОСТЬ
/**
 * СЛОЖНОСТЬ — НЕ ВЫБИРАЕТСЯ, А РАСТЁТ САМА.
 *
 * Раньше в меню стояли три режима («Испытание» до 20-го, «Поход» до
 * 40-го, «Полный путь» до 70-го). Они различались только длиной, а
 * скорость рисования знака была привязана к режиму константой.
 *
 * Теперь режимов нет вообще. Вся игра — одна линия в 70 уровней, и
 * темп врага на каждом уровне считается функцией от номера уровня:
 * на первом знак рисуется втрое дольше, к середине пути — вдвое,
 * а на последнем уровне — обычная скорость.
 *
 * Что это дало: игрок больше не выбирает «сколько будет сложно», он
 * просто идёт по пути, и сложность поднимается под ноги. Меню перестало
 * спрашивать то, на что нельзя ответить неправильно: три режима были не
 * разными играми, а тремя точками обрыва одной и той же линии.
 *
 * Короткого пути больше нет. Вместо «Испытания до 20-го уровня» игрок
 * просто останавливается, когда хочет, — пройденные уровни сохраняются
 * и вернуться к ним можно в любой момент.
 *
 * Что рампа НЕ трогает: урон, здоровье, мана и скорость каста после
 * рисунка. Меняется только, сколько времени у игрока на разгадку знака.
 *
 * Отдельно работает общая пауза между кастами (см. ENEMY_CAST_GAP
 * в enemy-ai.js): она одинакова везде и не даёт врагу выстроить
 * заклинания очередью.
 */

/** Всего уровней в игре: 70, семь Стражей. */
const TOTAL_LEVELS = 70;

/**
 * РЕЖИМЫ ИСПЫТАНИЙ.
 *
 * Обычный путь даёт игроку отдышаться между боями: здоровье
 * восстанавливается на 75% недостающего. Испытания это отбирают —
 * и именно это делает их испытаниями, а не «сложностью на плюс».
 *
 *   normal    — обычный путь
 *   resolve   — «Стойкость»: лечения между уровнями нет вовсе
 *   fury      — «Ярость»: лечения нет, и ВСЕ враги рисуют знак в темпе
 *               последнего стража (уровня 70) — то есть в полную силу
 *               с первого боя
 *
 * Дальше режим живёт в game.mode и проверяется в двух местах:
 * healed (сколько здоровья переносится) и difficultyPace (темп).
 *
 * heal — ДОЛЯ ПОТЕРЯННОГО здоровья, которая восстанавливается.
 * Обычный путь лечит 75% недостающего, как и было задумано изначально;
 * испытания не лечат вовсе (0).
 */
const MODES = {
  normal:  { heal: 0.75, fixedPace: null, label: 'Обычный путь' },
  resolve: { heal: 0,    fixedPace: null, label: 'Стойкость' },
  fury:    { heal: 0,    fixedPace: 1.0,  label: 'Ярость' },
};

/** Настройки текущего режима. */
function currentMode() {
  return MODES[game.mode] || MODES.normal;
}

/** Опоры рамки: темп рисования знака в начале, в середине и в конце пути. */
const PACE_EASY = 1 / 3;   // уровень 1 — самый медленный рисунок
const PACE_MID = 1 / 2;    // середина пути
const PACE_HARD = 1;       // уровень 70 — обычная скорость

/**
 * Темп рисования знака врагом на уровне.
 *
 * Плавная рампа по двум отрезкам, без ступенек:
 *
 *   1 → середина      втрое → вдвое       (лёгкая половина пути)
 *   середина → конец  вдвое → как обычно  (трудная половина пути)
 *
 * В режиме «Ярость» рампа отключена: tempo всегда PACE_HARD, поэтому
 * первый же бой идёт в скорости последнего стража.
 *
 * @param {number} level уровень боя, 1..TOTAL_LEVELS
 * @returns {number} доля от базового темпа рисования
 */
function difficultyPace(level) {
  // Испытание «Ярость»: враг с первого уровня в полную силу.
  const fixed = currentMode().fixedPace;
  if (fixed !== null) return fixed;

  const end = TOTAL_LEVELS;
  const mid = (end + 1) / 2;
  if (level <= 1) return PACE_EASY;
  if (level <= mid) {
    const t = (level - 1) / (mid - 1);
    return PACE_EASY + (PACE_MID - PACE_EASY) * t;
  }
  const t = (level - mid) / (end - mid);
  return PACE_MID + (PACE_HARD - PACE_MID) * Math.min(1, t);
}


/** Последний уровень игры — он же конец рампы. */
function maxLevelOfRun() {
  return TOTAL_LEVELS;
}

// ================================================================ ЗАПУСК БОЯ

function startBattle(level) {
  game.level = level;

  // КОПИЯ, а не ссылка.
  //
  // enemyByLevel() возвращает объект из общего массива ENEMIES. Вторая
  // фаза переписывает имя, титул, механику и множитель урона — если
  // делать это прямо в общем объекте, страж останется «истинной
  // формой» навсегда: и при повторном бое, и в галерее, и в меню.
  // Поэтому каждый бой работает со своей копией.
  const data = { ...enemyByLevel(level) };
  game.enemyData = data;

  // Сброс формы босса: новый бой — страж снова обычный.
  game.phase = 1;
  game.phase2Done = false;
  game.phaseShiftT = 0;

  // Игрок усиливается с уровнем, чтобы прогрессия была ощутимой.
  const maxHp = CONFIG.baseMaxHp + CONFIG.maxHpPerLevel * (level - 1) + 18;
  const maxMana = CONFIG.baseMaxMana + CONFIG.maxManaPerLevel * (level - 1) + 12;

  // Здоровье восстанавливается между боями — но не полностью.
  //
  // Здесь была попытка переносить здоровье жёстко (лечить лишь 35%
  // недостающего), чтобы заставить игрока защищаться. Замер показал,
  // что это ломает игру: игрок гибнет на 1-2 уровнях, а щит не спасает,
  // потому что смерть приходит от истощения, а не от одного удара.
  //
  // Компенсация выбрана мягкая: 75% недостающего здоровья. Одна тяжёлая
  // ошибка запоминается, но серия боёв не превращается в казнь.
  const prevHpRatio = game.carryHpRatio ?? 1;
  // Сколько недостающего здоровья восстанавливается.
  //
  // ВАЖНО: доля лечения относится к ПОТЕРЯННОМУ здоровью, а не к
  // полному. Наивная запись `1 - (1-prev) * heal` при heal=0 даёт
  // ровно 1 — то есть в испытании без лечения игрок входил в бой
  // полностью здоровым, и режим работал наоборот.
  // Правильно: hp = prev + (1 - prev) * heal.
  const heal = currentMode().heal;
  const healed = prevHpRatio + (1 - prevHpRatio) * heal;

  game.player = new Combatant({
    name: 'Вы',
    level,
    isPlayer: true,
    maxHp,
    maxMana,
  });
  game.player.hp = Math.max(1, Math.round(maxHp * healed));

  game.enemy = new Combatant({
    name: data.name,
    level,
    isPlayer: false,
    maxHp: data.stats.hp,
    maxMana: data.stats.mana,
  });

  // Броня: в обычной форме её нет, во второй появляется.
  game.enemy.armor = 0;
  game.armorBlocked = 0;

  // Боссам даём усиленный профиль и уникальную механику.
  //
  // Темп рисования знака берётся по уровню, а не по режиму: все
  // режимы стартуют одинаково и только ускоряются по-разному.
  game.ai = new EnemyAI(game.enemy, game.player, data.profile, {
    bossId: data.isBoss ? data.mechanicKey : null,
    pace: difficultyPace(level),
  });

  game.projectiles = [];
  game.particles = [];
  game.floaters = [];
  game.impacts = [];
  game.enemyHit = createHitState();
  game.enemyDying = null;
  game.enemyDyingT = 0;
  game.battleTime = 0;
  game.shake = 0;
  game.input.points = [];
  game.input.drawing = false;
  game.input.lastRecognition = null;

  game.unlockedTier = level <= 2 ? 1 : level <= 5 ? 2 : level <= 10 ? 3 : level <= 16 ? 4 : 5;

  game.scene = 'battle';
  // Босс получает свою тему по стихии; обычный враг — либо выбранный
  // игроком трек, либо основной боевой.
  const bossTrack = data.isBoss
    ? (AudioEngine.BOSS_TRACKS[data.element] || 'boss')
    : (game.battleTrack || (level % 5 === 0 ? 'duel' : 'journey'));
  audio.playTrack(bossTrack);
  audio.setIntensity(data.isBoss ? 0.7 : 0.3);
  showMessage(data.isBoss ? `БОСС: ${data.name}` : `Противник: ${data.name}`, 3.0);
}

function nextLevel() {
  if (game.level >= 70) { game.scene = 'gameover'; audio.playTrack('victory'); return; }
  startBattle(game.level + 1);
}

// ================================================================ СООБЩЕНИЯ

function showMessage(text, dur = 1.6) {
  game.input.message = text;
  game.input.messageT = dur;
}

function addFloater(x, y, text, color) {
  game.floaters.push({ x, y, text, color, life: 1.2, vy: -60 });
}

// ================================================================ ВВОД: РИСОВАНИЕ

/**
 * Координаты указателя в системе canvas.
 *
 * У касания координаты берутся из touches, но при touchend этот список
 * уже пуст — там нужен changedTouches. Без этой ветки отпускание пальца
 * за пределами канваса (а на телефоне это обычное дело) читало
 * undefined и роняло весь жест.
 */
function pointerPos(e) {
  const rect = canvas.getBoundingClientRect();
  const t = (e.touches && e.touches[0])
    || (e.changedTouches && e.changedTouches[0])
    || e;
  return { x: t.clientX - rect.left, y: t.clientY - rect.top };
}

function beginDraw(e) {
  // Заставка: клик — это «дальше». Рисовать пока нельзя.
  if (game.card) { finishCard(); return; }
  if (game.scene !== 'battle') return;
  const p = pointerPos(e);

  // Рисовать можно только в области "воздуха" перед собой.
  game.input.drawing = true;
  game.input.points = [p];
  game.input.startTime = game.time;
}

function moveDraw(e) {
  if (!game.input.drawing) return;
  const p = pointerPos(e);
  const pts = game.input.points;
  const last = pts[pts.length - 1];

  // ПОРОГ ПРОРЕЖИВАНИЯ.
  //
  // Точки пишутся не чаще, чем раз в N пикселей, иначе распознавание
  // захлёбывается мусором. Но порог нельзя брать одинаковым для мыши
  // и пальца:
  //
  //   мышь   — ведёт точно, шаг 3 px сохраняет форму мелких завитков;
  //   палец  — крупнее, дрожит, и на тач-экране 3 px дают вдвое больше
  //            точек на тот же штрих, а вместе с дрожанием это ломает
  //            распознавание простых фигур.
  //
  // Поэтому на касании порог шире, а мелкое дрожание отсекается:
  // точка пишется только если палец сдвинулся заметно.
  const isTouch = !!(e.touches || e.changedTouches);
  const minStep = isTouch ? 6 : 3;

  if (Math.hypot(p.x - last.x, p.y - last.y) > minStep) {
    pts.push(p);
    // Искры на кончике "пальца"
    if (Math.random() < 0.35) {
      game.particles.push({
        x: p.x, y: p.y, vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30,
        life: 0.4, maxLife: 0.4, color: '#8fd3ff', size: 2,
      });
    }
  }
}

function endDraw() {
  if (!game.input.drawing) return;
  game.input.drawing = false;
  const pts = game.input.points;
  if (pts.length < 3) { game.input.points = []; return; }

  const result = recognize(pts, { accuracy: game.player.accuracy });
  game.input.lastRecognition = result;
  game.input.points = [];

  if (!result || !result.sigil) {
    audio.sfxRecognize(false);
    showMessage('Символ не распознан', 1.2);
    return;
  }

  const sigil = result.sigil;

  if (sigil.id === 'shield') {
    // Тоггл щита: если уже поднят — опускаем.
    if (game.player.shieldUp) {
      game.player.lowerShield();
      audio.sfxShieldUp();
      showMessage('Щит опущен', 1.0);
    } else {
      const r = game.player.raiseShield();
      if (r.ok) {
        audio.sfxShieldUp();
        showMessage('Щит поднят — колдовать нельзя', 1.6);
      } else {
        showMessage(r.reason === 'mana' ? 'Не хватает маны на щит' : 'Сейчас нельзя', 1.4);
      }
    }
    return;
  }

  if (sigil.tier > game.unlockedTier) {
    showMessage(`Ранг ${sigil.tier} пока недоступен`, 1.4);
    audio.sfxRecognize(false);
    return;
  }

  const r = game.player.startCast(sigil);
  if (r.ok) {
    audio.sfxRecognize(true);
    audio.sfxCast(sigil.tier);
    showMessage(`${sigil.name} — каст!`, 1.0);
  } else {
    audio.sfxRecognize(false);
    const reasons = {
      shield_up: 'Нельзя колдовать под щитом',
      mana: 'Не хватает маны',
      busy: 'Уже кастуете',
      stunned: 'Вы оглушены',
      frozen: 'Вы заморожены',
      cooldown: `Символ ещё не готов (${game.player.cooldownLeft(sigil.id).toFixed(1)} с)`,
    };
    showMessage(reasons[r.reason] || 'Не выходит', 1.3);
  }
}

canvas.addEventListener('mousedown', beginDraw);
window.addEventListener('mousemove', moveDraw);
window.addEventListener('mouseup', endDraw);
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); beginDraw(e); }, { passive: false });
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); moveDraw(e); }, { passive: false });
canvas.addEventListener('touchend', (e) => { e.preventDefault(); endDraw(); }, { passive: false });

// Палец может уехать за край канваса (или система отберёт касание —
// входящий звонок, переключение приложения). Без этих обработчиков
// жест остался бы «висеть»: game.input.drawing навсегда true, и игрок
// больше не смог бы нарисовать ни одного знака.
canvas.addEventListener('touchcancel', (e) => { e.preventDefault(); endDraw(); }, { passive: false });

// Колесо мыши — переключение подсказки по символам
window.addEventListener('keydown', (e) => {
  // Заставка: Пробел и Enter пропускают её — та же мета, что и клик.
  if (game.card && (e.code === 'Space' || e.code === 'Enter')) {
    e.preventDefault();
    finishCard();
    return;
  }
  if (e.code === 'Space' && game.scene === 'battle') {
    e.preventDefault();
    // Быстрый тоггл щита с клавиатуры — для доступности.
    if (game.player.shieldUp) { game.player.lowerShield(); showMessage('Щит опущен', 1.0); }
    else {
      const r = game.player.raiseShield();
      if (r.ok) { audio.sfxShieldUp(); showMessage('Щит поднят — колдовать нельзя', 1.6); }
      else showMessage('Не хватает маны на щит', 1.3);
    }
  }
  if (e.code === 'KeyH') game.showHelp = !game.showHelp;
  if (e.code === 'Escape') game.showHelp = false;
  // Enter в меню начинает игру. Режимов больше нет, поэтому выбор
  // теряться нечему — путь всегда один.
  if (e.code === 'Enter' && game.scene === 'menu') newGame();
});

// ================================================================ СОХРАНЕНИЕ

/**
 * Прогресс сохраняется в localStorage: без этого после случайного
 * обновления страницы игрок терял бы все пройденные уровни.
 */
const SAVE_KEY = 'sigil-mage-progress-v1';

/**
 * Ключ сохранения зависит от режима.
 *
 * Иначе прохождение «Стойкости» на уровне 40 затирало бы обычный путь,
 * и вернуться к нему было бы невозможно. У каждого режима свой прогресс.
 */
function saveKey() {
  const mode = game.mode || 'normal';
  return mode === 'normal' ? SAVE_KEY : `${SAVE_KEY}-${mode}`;
}

function saveProgress() {
  try {
    localStorage.setItem(saveKey(), JSON.stringify({
      level: game.level,
      wins: game.stats.wins,
      losses: game.stats.losses,
      best: game.stats.best || game.level,
      mode: game.mode || 'normal',
      // Здоровье переносится между боями, поэтому его тоже нужно хранить:
      // иначе перезагрузка страницы «лечила» бы игрока бесплатно
      // и обесценивала щит.
      hpRatio: game.carryHpRatio ?? 1,
    }));
  } catch {
    // Приватный режим или отключённое хранилище — игра работает без сохранения.
  }
}

function loadProgress(mode = game.mode || 'normal') {
  try {
    const key = mode === 'normal' ? SAVE_KEY : `${SAVE_KEY}-${mode}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.level !== 'number' || data.level < 1 || data.level > 70) return null;
    return data;
  } catch {
    return null;
  }
}

function clearProgress() {
  try { localStorage.removeItem(saveKey()); } catch { /* хранилище недоступно */ }
}

// ================================================================ БОЕВАЯ ЛОГИКА

/** Применяет эффект завершённого заклинания. */
function applySigil(caster, target, sigil, isPlayer) {
  // Форма — часть образа заклинания, наравне с цветом. Считаем её здесь,
  // чтобы снаряд нёс её с собой до отрисовки.
  const visual = {
    color: TIERS[sigil.tier].color,
    tier: sigil.tier,
    shape: projectileShape(sigil),
  };

  // Снаряд летит от кастера к цели — визуальная обратная связь.
  // seed даёт каждому снаряду свой сдвиг фаз: два одинаковых заклинания
  // подряд не выглядят как копия друг друга.
  game.projectiles.push({
    from: isPlayer ? 'player' : 'enemy',
    sigil,
    t: 0,
    dur: 0.42,
    seed: Math.random() * 100,
    ...visual,
  });

  // Урон применяется по прилёту снаряда (см. updateProjectiles).
  return visual;
}

/** Разрешение попадания. */
function resolveHit(sigil, isPlayer) {
  const caster = isPlayer ? game.player : game.enemy;
  const target = isPlayer ? game.enemy : game.player;
  const tierInfo = TIERS[sigil.tier];

  let dmg = sigil.damage;
  // Боссы бьют мягче за каст, но кастуют чаще и живут дольше —
  // иначе они убивают игрока с трёх попаданий, и тактика не успевает
  // проявиться (см. damageMult в data/enemies.js).
  if (!isPlayer && game.enemyData?.damageMult) {
    dmg = Math.round(dmg * game.enemyData.damageMult);
  }
  let result = { applied: 0, blocked: 0, brokeShield: false, reflected: 0 };

  // БРОНЯ второй формы: страж гасит часть урона.
  //
  // Это не «+% здоровья» — игрок по-прежнему видит, что урон проходит,
  // просто меньше. Такой способ усложнить бой честнее: ошибка в
  // тактике наказывается временем, а не стеной из HP.
  if (isPlayer && target?.armor > 0) {
    dmg = dmg * (1 - target.armor);
    game.armorBlocked = target.armor;   // для подписи «БРОНЯ» в интерфейсе
  }

  if (dmg > 0) {
    result = target.takeDamage(dmg, {
      shieldPierce: sigil.effect?.shieldPierce || 0,
    });
  }

  // Отражение урона
  if (result.reflected > 0) {
    const rr = caster.takeDamage(result.reflected, { ignoreInterrupt: true, shieldPierce: 1 });
    addFloater(isPlayer ? W * 0.5 : W * 0.75, H * 0.42, `-${Math.round(rr.applied)}`, '#b026ff');
  }

  // Визуальные последствия
  if (result.applied > 0) {
    if (isPlayer) { game.enemyHitFlash = 0.35; game.shake = Math.min(1, 0.25 + result.applied / 120); }
    else { game.hitFlash = 0.45; game.shake = Math.min(1, 0.3 + result.applied / 100); }
    audio.sfxHit(1 + sigil.tier * 0.18);

    const fx = isPlayer ? W * 0.5 : W * 0.75;
    addFloater(fx, H * 0.45, `-${Math.round(result.applied)}`,
      isPlayer ? tierInfo.color : '#ff4d6d');
    spawnImpact(fx, H * 0.45, tierInfo.color, 14 + sigil.tier * 6);

    // Враг вздрагивает и отшатывается — своя реакция на каждый удар.
    if (isPlayer && game.enemyHit) {
      applyHit(game.enemyHit, result.applied, game.enemy.maxHp);
    }
  } else if (result.blocked > 0) {
    audio.sfxShieldBlock();
    const fx = isPlayer ? W * 0.75 : W * 0.5;
    addFloater(fx, H * 0.44, 'БЛОК', '#8fd3ff');
    spawnImpact(fx, H * 0.44, '#8fd3ff', 12);
  }

  // Своя вспышка попадания у каждого заклинания — не только частицы.
  // Играет и на пробитии щита: видно, во что именно попали.
  game.impacts.push({
    x: isPlayer ? W * 0.72 : W * 0.34,
    y: H * 0.5,
    r: 8 + sigil.tier * 4,
    color: tierInfo.color,
    fx: fxFor(sigil),
    dir: isPlayer ? 1 : -1,
    progress: 0,
    dur: 0.42,
  });

  if (result.brokeShield) {
    audio.sfxShieldBreak();
    const fx = isPlayer ? W * 0.75 : W * 0.5;
    addFloater(fx, H * 0.40, 'ЩИТ РАЗБИТ!', '#ff9d5c');
    spawnImpact(fx, H * 0.44, '#ffd166', 40);
  }

  // Прочие эффекты
  const eff = sigil.effect || {};
  if (eff.stagger) target.stunTimer = Math.max(target.stunTimer, eff.stagger);
  if (eff.freeze) target.addEffect('freeze', { duration: eff.freeze });
  if (eff.burn) target.addEffect('burn', { duration: eff.burn.duration, dmg: eff.burn.dmg });
  if (eff.heal) {
    caster.hp = Math.min(caster.maxHp, caster.hp + eff.heal);
    addFloater(isPlayer ? W * 0.35 : W * 0.75, H * 0.5, `+${eff.heal}`, '#4fe8bb');
  }
  if (eff.manaDrain) {
    const drained = Math.min(target.mana, eff.manaDrain);
    target.mana -= drained;
    // Часть украденной маны возвращается кастеру — награда за риск.
    caster.mana = Math.min(caster.maxMana, caster.mana + drained * 0.55);
    addFloater(isPlayer ? W * 0.75 : W * 0.35, H * 0.5, `ци -${Math.round(drained)}`, '#9d7bff');
  }
  if (eff.accuracy) {
    target.addEffect('accuracy', { duration: eff.duration, accuracy: eff.accuracy });
  }
  if (eff.reflect) {
    caster.addEffect('reflect', { duration: eff.reflect.duration, ratio: eff.reflect.ratio });
  }

  // Прерывание чужого каста при попадании — уже внутри takeDamage.
}

function spawnImpact(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * 260;
    game.particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.5 + Math.random() * 0.5, maxLife: 1.0,
      color, size: 1.5 + Math.random() * 3,
    });
  }
}

function updateProjectiles(dt) {
  for (let i = game.projectiles.length - 1; i >= 0; i--) {
    const p = game.projectiles[i];
    p.t += dt;
    if (p.t >= p.dur) {
      resolveHit(p.sigil, p.from === 'player');
      game.projectiles.splice(i, 1);
    }
  }
}

function updateParticles(dt) {
  for (let i = game.particles.length - 1; i >= 0; i--) {
    const p = game.particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 240 * dt;
    p.vx *= 0.97;
    if (p.life <= 0) game.particles.splice(i, 1);
  }
  for (let i = game.floaters.length - 1; i >= 0; i--) {
    const f = game.floaters[i];
    f.life -= dt;
    f.y += f.vy * dt;
    f.vy *= 0.94;
    if (f.life <= 0) game.floaters.splice(i, 1);
  }
}

/** Наложенные эффекты (горение) тикают. */
function updateDots(dt) {
  for (const c of [game.player, game.enemy]) {
    const burn = c.getEffect('burn');
    if (burn) {
      c.hp = Math.max(0, c.hp - burn.data.dmg * dt);
      if (c.hp <= 0) c.alive = false;
    }
  }
}

/**
 * ПЕРЕХОД БОССА ВО ВТОРУЮ ФАЗУ.
 *
 * На 40% здоровья страж сбрасывает облик: имя меняется на истинное,
 * урон, скорость рисования и броня растут, а сам он становится
 * крупнее и обрастает деталями (character.js, drawBossCreature).
 *
 * Почему именно 40%, а не 50: полсередины боя — это ещё «поровну»,
 * и смена формы там читалась бы как рядовое событие. Ниже сорока
 * здоровья у игрока начинается азарт добивания, и именно в этот
 * момент удар по правилам бьёт сильнее всего.
 *
 * Переход одноразовый: флаг game.phase2Done не даёт откатиться назад,
 * если игрок отлечится (щит, лечение) и снова поднимется выше 40%.
 */
function checkBossPhase(dt) {
  const data = game.enemyData;
  const foe = game.enemy;

  // Откат анимации превращения.
  if (game.phaseShiftT > 0) {
    game.phaseShiftT = Math.max(0, game.phaseShiftT - dt);
  }

  if (!data || !data.isBoss || !data.phase || game.phase2Done) return;
  if (!foe || !foe.alive) return;

  if (foe.hpRatio > data.phaseAt) return;

  // --- Превращение ---
  game.phase2Done = true;
  game.phase = 2;
  game.phaseShiftT = 1.6;      // длительность вспышки и тряски
  game.shake = 1;

  // Имя: истинное вместо обычного. Титул меняется на «Истинная форма».
  //
  // trueNameFull — имя вместе с подписью в скобках («Древний Красный
  // Дракон (дракон)»). В этом варианте у каждого существа есть вторая
  // строка, и после превращения она не должна пропадать: иначе страж
  // терял бы подпись ровно в самый важный момент боя.
  data.name = data.trueNameFull || data.trueName || data.name;
  data.bossTitle = 'Истинная форма';
  data.mechanic = data.phaseMech || data.mechanic;

  // Урон стража растёт: множитель домножается.
  data.damageMult = (data.damageMult || 1) * data.phase.damage;

  // Броня: страж гасит часть входящего урона.
  foe.armor = data.phase.armor;

  // Рисует знаки быстрее — у игрока меньше времени на разгадку.
  if (game.ai && typeof game.ai.haste === 'number') {
    game.ai.haste *= data.phase.haste;
  }

  // Громкий отклик: игрок должен момент превращения не пропустить.
  audio.sfxInterrupt();
  audio.setIntensity(1);
  showMessage(`${data.cry || 'Истинная форма!'}`, 3.2);
  addFloater(W * 0.72, H * 0.34, 'ИСТИННАЯ ФОРМА', '#ffb45a');

  // Кольцо силы расходится от стража.
  for (let i = 0; i < 3; i++) {
    game.impacts.push({
      x: W * 0.72, y: H * 0.52,
      r: 40 + i * 26,
      color: '#ffd08a',
      fx: 'ring',
      dir: 1,
      progress: 0,
      dur: 0.75 + i * 0.12,
    });
  }
  spawnImpact(W * 0.72, H * 0.52, '#ffb45a', 46);
}

/** Главный апдейт боя. */
function updateBattle(dt) {
  game.battleTime += dt;
  const player = game.player, enemy = game.enemy;

  player.update(dt);
  enemy.update(dt);

  // --- ИИ врага
  const ev = game.ai.update(dt);
  if (ev) {
    if (ev.type === 'cast_start') {
      audio.sfxCast(ev.sigil.tier);
      // Говорят только стражи и только про мощные заклинания — те,
      // что нужно отразить или сбить. Рядовые враги молчат, иначе их
      // частые касты превращаются в стрёкот поверх музыки.
      //
      // Проверка «это страж» и «ранг достаточно высокий» живёт внутри
      // EnemyVoice.speak: здесь её дублировать не нужно, иначе правила
      // разъедутся между двумя файлами.
      //
      // Уровень берём из данных врага, а не из game.enemy: game.enemy —
      // это класс бойца (здоровье, каст, таймеры), уровня у него нет.
      const foeData = game.enemyData || {};
      enemyVoice.speak(ev.sigil.tier, foeData.level);
    } else if (ev.type === 'draw_failed') {
      showMessage(`${enemy.name} ошибся в символе!`, 1.2);
    } else if (ev.type && ev.type.startsWith('boss_')) {
      // Уникальные механики боссов: игрок должен видеть, что произошло.
      showMessage(ev.text, 2.2);
      audio.sfxInterrupt();
      // Запоминаем последний символ игрока — босс-зеркало его скопирует.
      if (ev.type === 'boss_mirror') game.enemyHitFlash = 0.25;
      if (ev.amount) addFloater(W * 0.32, H * 0.52, `ци -${Math.round(ev.amount)}`, '#b026ff');
    }
  }

  // Босс-зеркало запоминает, что игрок кастовал последним.
  if (game.enemyData.isBoss && game.enemyData.mechanicKey === 'mirror' && player.casting) {
    game.ai.lastPlayerSigil = player.casting.sigil;
  }

  // --- Завершённые касты
  const ps = player.pollCompletedCast();
  if (ps) applySigil(player, enemy, ps, true);
  const es = enemy.pollCompletedCast();
  if (es) applySigil(enemy, player, es, false);

  updateProjectiles(dt);
  updateParticles(dt);
  updateImpacts(dt);
  updateDots(dt);
  if (game.enemyHit) updateHit(game.enemyHit, dt);

  // --- Напряжение музыки: чем меньше HP у обоих, чем больше кастов, тем выше.
  const tension = 1 - Math.min(player.hpRatio, enemy.hpRatio);
  const activity = (player.casting ? 0.3 : 0) + (enemy.casting ? 0.3 : 0) + (player.shieldUp ? 0.2 : 0);
  audio.setIntensity(Math.min(1, tension * 0.75 + activity));

  // --- Экранная тряска и вспышки
  game.shake = Math.max(0, game.shake - dt * 2.4);
  game.hitFlash = Math.max(0, game.hitFlash - dt * 1.8);
  game.enemyHitFlash = Math.max(0, game.enemyHitFlash - dt * 2.2);
  if (game.input.messageT > 0) game.input.messageT -= dt;

  // --- Вторая фаза босса ---
  checkBossPhase(dt);

  // --- Исход боя
  //
  // Смерти даём отыграть: пока враг оседает и тает (enemyDying растёт
  // до 1), экран победы не показываем. Иначе анимация не видна вообще —
  // бой заканчивается в тот же кадр, что и последний удар.
  if (!enemy.alive) {
    game.enemyDyingT += dt;
    game.enemyDying = Math.min(1, game.enemyDyingT / DEATH_ANIM);
    if (game.enemyDying >= 1) { winBattle(); return; }
  } else {
    game.enemyDyingT = 0;
    game.enemyDying = null;
  }
  if (!player.alive) { startDeathCard(); return; }
}

/**
 * Предсмертная заставка.
 *
 * Раньше здесь стоял прямой вызов loseBattle(): панель «Поражение»
 * появлялась в тот же кадр, что и последний удар, и анимации смерти
 * игрок не видел вообще. Теперь бой замирает, печать трескается
 * (см. title-card.js), и только потом показывается экран с кнопками.
 */
function startDeathCard() {
  if (game.card) return;          // уже играет — второй раз не запускаем
  game.card = createDeath();
  audio.playTrack('defeat');
  audio.setIntensity(0);
}

function finishCard() {
  const card = game.card;
  if (!card) return;
  // Пропуск разрешён, когда заставка досмотрела себя (или клик прозвучал
  // уже на подсказке «нажмите»). Рано кликнуть нельзя — иначе игрок
  // случайным щелчком промотал бы и вступление, и предсмертную сцену.
  //
  // Смерть обязана досмотреть себя САМА: кликов там нет (в бою не рисуем),
  // поэтому полагаемся на таймаут DEATH_CARD_LEN.
  if (card.kind === CARD_INTRO) {
    if (!cardSkippable(card)) return;
  } else {
    if (!cardExpired(card)) return;
  }
  game.card = null;
  if (card.kind === CARD_INTRO) startBattle(1);
  else loseBattle();
}

function winBattle() {
  game.scene = 'victory';
  game.stats.wins++;
  // Запоминаем, с каким здоровьем закончился бой: в следующий бой
  // игрок войдёт частично восстановившимся (см. startBattle).
  // Без этого урон не имел последствий, и щит был не нужен.
  game.carryHpRatio = game.player.hpRatio;
  saveProgress();
  audio.playTrack('victory');
  audio.setIntensity(0);

  const last = maxLevelOfRun();
  const done = game.level >= last;
  const isBoss = game.enemyData.isBoss;

  // Финал игры — только когда пройден последний уровень. Всё раньше —
  // обычная победа: режимов больше нет, поэтому и «концов короткого пути»
  // не существует, только финал всей линии.
  if (done) {
    document.getElementById('victory-title').textContent = 'Небесный Трон ваш!';
    document.getElementById('victory-text').textContent =
      `${game.enemyData.name} падает. Семь Стражей пройдены — путь окончен.`;
  } else {
    document.getElementById('victory-title').textContent = isBoss ? 'Страж повержен!' : 'Победа!';
    document.getElementById('victory-text').textContent =
      isBoss
        ? `${game.enemyData.name} отступает. Путь дальше открыт.`
        : `${game.enemyData.name} побеждён.`;
  }

  // На последнем уровне режима кнопка «Дальше» превращается в «В меню»:
  // продолжать некуда, и предлагать несуществующий уровень нельзя.
  const nextBtn = document.getElementById('btn-continue');
  if (done) {
    nextBtn.textContent = 'В меню';
    nextBtn.dataset.done = '1';
    document.getElementById('victory-next').textContent = '';
  } else {
    nextBtn.dataset.done = '';
    nextBtn.innerHTML = 'Дальше: <span id="victory-next"></span>';
    document.getElementById('victory-next').textContent = `Уровень ${game.level + 1}`;
  }

  showScreen('victory');
}

function loseBattle() {
  game.scene = 'defeat';
  game.stats.losses++;
  audio.playTrack('defeat');
  audio.setIntensity(0);
  document.getElementById('defeat-text').textContent =
    `${game.enemyData.name} оказался сильнее. Пересмотрите ритм щита и кастов.`;
  // К этому моменту заставка уже снята (game.card = null), так что панель
  // показываем сразу — без отложенного показа, из-за которого кнопки
  // могли остаться невидимыми лишний кадр.
  showScreen('defeat');
  focusDefeatButtons();
}

/**
 * Сажаем фокус на «Повторить», чтобы панель не выглядела «мертвой».
 *
 * Чтобы кнопки гарантированно попадали в экран, панели убран прокручиваемый
 * потолок (см. style.css) — раньше на низких экранах они уезжали за
 * нижний край, и игрок видел только заголовок «Поражение».
 */
function focusDefeatButtons() {
  const btn = document.getElementById('btn-retry');
  if (btn && btn.focus) btn.focus();
}

// ================================================================ ОТРИСОВКА

/** Фон: ночное небо, луна, силуэты гор и пагоды — вид от первого лица. */
function drawBackground(t) {
  // В бою рисуем арену противника: у каждого зверя свой биом,
  // у боссов — живая сцена его стихии (вулкан, океан, гроза и т.д.).
  // Время суток чередуется по уровню: утро → день → вечер → ночь.
  const foe = game.enemyData;
  if (game.scene === 'battle' && foe) {
    const timeKey = game.timeOverride || timeOfDay(foe.level);
    if (foe.isBoss && drawBossArena(ctx, W, H, foe, t, timeKey)) return;
    drawArena(ctx, W, H, foe, t, timeKey);
    return;
  }

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0b0f1e');
  g.addColorStop(0.45, '#161d33');
  g.addColorStop(0.75, '#242a44');
  g.addColorStop(1, '#12131f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Луна
  const mx = W * 0.78, my = H * 0.16, mr = Math.min(W, H) * 0.075;
  const mg = ctx.createRadialGradient(mx, my, mr * 0.2, mx, my, mr * 3.2);
  mg.addColorStop(0, 'rgba(255,245,220,0.95)');
  mg.addColorStop(0.32, 'rgba(255,235,200,0.28)');
  mg.addColorStop(1, 'rgba(255,220,180,0)');
  ctx.fillStyle = mg;
  ctx.beginPath(); ctx.arc(mx, my, mr * 3.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fdf6e3';
  ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();

  // Звёзды
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = 0; i < 90; i++) {
    const sx = ((i * 7919) % 1000) / 1000 * W;
    const sy = ((i * 104729) % 1000) / 1000 * H * 0.55;
    const tw = 0.4 + Math.abs(Math.sin(t * 1.3 + i)) * 0.6;
    ctx.globalAlpha = tw * 0.75;
    ctx.fillRect(sx, sy, 1.6, 1.6);
  }
  ctx.globalAlpha = 1;

  // Дальние горы
  ctx.fillStyle = '#0d1120';
  ctx.beginPath();
  ctx.moveTo(0, H * 0.62);
  for (let i = 0; i <= 12; i++) {
    const x = (W / 12) * i;
    const y = H * 0.62 - Math.abs(Math.sin(i * 1.7)) * H * 0.16;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();

  // Пагода на горизонте
  drawPagoda(W * 0.14, H * 0.63, Math.min(W, H) * 0.055);

  // Ближние горы
  ctx.fillStyle = '#080a14';
  ctx.beginPath();
  ctx.moveTo(0, H * 0.78);
  for (let i = 0; i <= 8; i++) {
    const x = (W / 8) * i;
    const y = H * 0.78 - Math.abs(Math.sin(i * 2.3 + 1)) * H * 0.1;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();

  // Земля — «арена»
  const eg = ctx.createLinearGradient(0, H * 0.78, 0, H);
  eg.addColorStop(0, '#1a1a2e');
  eg.addColorStop(1, '#0a0a12');
  ctx.fillStyle = eg;
  ctx.fillRect(0, H * 0.78, W, H * 0.22);

  // Магический круг на полу
  const ccx = W * 0.62, ccy = H * 0.86;
  const cr = Math.min(W, H) * 0.22;
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = '#7b5cff';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(ccx, ccy, cr * (1 - i * 0.22), cr * 0.3 * (1 - i * 0.22), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(140,200,255,0.5)';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + t * 0.25;
    ctx.beginPath();
    ctx.moveTo(ccx, ccy);
    ctx.lineTo(ccx + Math.cos(a) * cr, ccy + Math.sin(a) * cr * 0.3);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPagoda(x, baseY, s) {
  ctx.fillStyle = '#0a0d18';
  const tiers = 4;
  for (let i = 0; i < tiers; i++) {
    const w = s * (2.0 - i * 0.34);
    const y = baseY - i * s * 0.72;
    // Крыша
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x, y - s * 0.5, x + w, y);
    ctx.lineTo(x + w * 0.72, y + s * 0.14);
    ctx.lineTo(x - w * 0.72, y + s * 0.14);
    ctx.closePath(); ctx.fill();
    // Стены
    ctx.fillRect(x - w * 0.42, y + s * 0.14, w * 0.84, s * 0.58);
  }
  // Шпиль
  ctx.fillRect(x - s * 0.05, baseY - tiers * s * 0.72 - s * 0.5, s * 0.1, s * 0.55);
}

/** Верхний HUD: здоровье, мана, состояние. */
function drawHud(t = 0) {
  const p = game.player, e = game.enemy;
  if (!p || !e) return;

  const barW = Math.min(W * 0.34, 340);
  const barH = 16;
  const pad = 20;

  // --- Игрок (слева снизу)
  drawBar(pad, H - 104, barW, barH, p.hpRatio, '#ff4d6d', '#7a1f2e', `${Math.ceil(p.hp)} / ${p.maxHp}`, 'ЖИЗНЬ');
  drawBar(pad, H - 78, barW, barH, p.manaRatio, '#4aa8ff', '#123a63', `${Math.ceil(p.mana)} / ${p.maxMana}`, 'МАНА');

  // Индикатор щита с расходом маны
  if (p.shieldUp) {
    const drain = shieldUpkeep(p.level);
    const secs = p.mana / drain;
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = '#8fd3ff';
    ctx.textAlign = 'left';
    ctx.fillText(`ЩИТ АКТИВЕН — мана кончится через ${secs.toFixed(1)} с`, pad, H - 50);
    // Полоса-предупреждение
    ctx.fillStyle = secs < 3 ? 'rgba(255,80,80,0.7)' : 'rgba(120,200,255,0.45)';
    ctx.fillRect(pad, H - 44, barW * Math.min(1, secs / 10), 3);
  } else if (p.casting) {
    const sig = p.casting.sigil;
    const prog = p.casting.elapsed / p.casting.total;
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = TIERS[sig.tier].color;
    ctx.textAlign = 'left';
    ctx.fillText(`КАСТ: ${sig.name}`, pad, H - 50);
    ctx.fillStyle = TIERS[sig.tier].color;
    ctx.fillRect(pad, H - 44, barW * prog, 3);

    // ФОРМА кастуемого заклинания рядом с текстом: игрок видит,
    // ЧТО он кастует, а не только сколько осталось ждать.
    const shape = projectileShape(sig);
    ctx.save();
    ctx.translate(pad + barW + 30, H - 52);
    ctx.globalAlpha = 0.4 + prog * 0.6;
    ctx.shadowColor = TIERS[sig.tier].color;
    ctx.shadowBlur = 12;
    if (shape === 'spiral' || shape === 'seal') {
      ctx.strokeStyle = TIERS[sig.tier].color;
      ctx.lineWidth = 2;
      drawProjectileShape(shape, 0, 0, 11, 1, t * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = TIERS[sig.tier].color;
      drawProjectileShape(shape, 0, 0, 11, 1, t * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // --- Враг (справа сверху)
  const ebW = Math.min(W * 0.3, 300);
  drawBar(W - pad - ebW, 32, ebW, 14, e.hpRatio, '#ff6b35', '#6b2410',
    `${Math.ceil(e.hp)} / ${e.maxHp}`, null, true);
  drawBar(W - pad - ebW, 54, ebW * 0.7, 10, e.manaRatio, '#9d7bff', '#2d1b4d', null, null, true);

  ctx.font = '700 15px system-ui, sans-serif';
  ctx.fillStyle = game.enemyData.isBoss ? '#ffd700' : '#e8e8f0';
  ctx.textAlign = 'right';
  ctx.fillText(e.name + (game.enemyData.isBoss ? ' ★' : ''), W - pad, 24);

  // Состояние врага
  const states = [];
  if (e.shieldUp) states.push('ЩИТ');
  if (e.casting) states.push(`КАСТ Р${e.casting.sigil.tier}`);
  if (e.isFrozen) states.push('ЗАМОРОЖЕН');
  if (e.isStunned) states.push('ОГЛУШЁН');
  if (states.length) {
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.fillText(states.join(' · '), W - pad, 76);
  }

  // Уровень и выбранный путь.
  //
  // Знаменатель берём у режима, а не жёстко 70: в «Испытании» игрок
  // должен видеть «5 / 20», иначе непонятно, где конец его пути.
  ctx.textAlign = 'center';
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(200,200,220,0.6)';
  ctx.fillText(`Уровень ${game.level} / ${TOTAL_LEVELS}`, W / 2, 24);

  // Показываем текущий темп рисования знака — он меняется с уровнем,
  // поэтому число не константа. На обычной скорости строку убираем:
  // подсказка должна помогать, а не шуметь.
  const pace = difficultyPace(game.level || 1);
  if (pace < 0.999) {
    const times = 1 / pace;
    // «втрое», «вдвое» читаются лучше дробей: 1/3 — это +200%, и такая
    // цифра звучит как наказание, а не как «втрое больше времени».
    const label = times >= 2.75 ? 'втрое' : times >= 1.9 ? 'вдвое'
      : `в ${times.toFixed(1).replace('.', ',')} раза`;
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(140,215,170,0.85)';
    ctx.fillText(`враг выводит знак ${label} дольше`, W / 2, 42);
  }
}

function drawBar(x, y, w, h, ratio, color, bg, label, title, rightAlign = false) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);

  const fw = w * Math.max(0, Math.min(1, ratio));
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, color);
  g.addColorStop(1, shade(color, -0.35));
  ctx.fillStyle = g;
  ctx.fillRect(x + (rightAlign ? w - fw : 0), y, fw, h);

  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  if (label) {
    ctx.font = `600 ${Math.max(10, h - 5)}px system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.textAlign = rightAlign ? 'right' : 'left';
    ctx.fillText(label, rightAlign ? x + w - 5 : x + 5, y + h - 4);
  }
  if (title) {
    ctx.font = '600 10px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(180,180,200,0.8)';
    ctx.textAlign = 'left';
    ctx.fillText(title, x, y - 5);
  }
}

function shade(hex, amt) {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.max(0, Math.min(255, Math.round(r + r * amt)));
  g = Math.max(0, Math.min(255, Math.round(g + g * amt)));
  b = Math.max(0, Math.min(255, Math.round(b + b * amt)));
  return `rgb(${r},${g},${b})`;
}

/** Отрисовка врага в перспективе от первого лица. */
function drawEnemy(t) {
  const e = game.enemy;
  if (!e) return;

  const isBoss = !!game.enemyData.isBoss;

  // Ориентация экрана меняет всю раскладку.
  //
  // На широком экране (ноутбук, телефон боком) противник стоит справа
  // от центра: слева рука игрока рисует знак, и фигура не должна его
  // закрывать.
  //
  // На вертикальном (телефон, планшет) делить экран по ширине нельзя —
  // он узкий. Там противник стоит по центру, а знаки рисуются поверх
  // нижней трети: рука с кистью всё равно ниже головы зверя.
  const portrait = H > W;

  const cx = W * (portrait ? 0.5 : 0.62);
  // РАЗМЕР ПРОТИВНИКА.
  //
  //   зверь  — 4.2 единицы вверх от основания
  //   страж  — 4.6 единицы (рога и крылья выше), плюс объём из данных
  //
  // Оба множителя ниже уменьшены в 1.5 раза по просьбе «уменьши
  // боссов в полтора раза» — но звери остались как были, поэтому
  // делим именно надбавку стража, а не базу: иначе вместе с боссами
  // уменьшились бы и все остальные противники, о которых просьбы
  // не было.
  const BOSS_EXTRA = 1.2 / 1.5;   // было 1.2, стало 0.8

  // ПРЕДЕЛ ВЫСОТЫ СТРАЖА.
  //
  // Потолок нужен, чтобы страж не вылезал за кадр и не срезался по
  // морде. Но если поставить его низко, он СЪЕДАЕТ всю разницу со
  // зверем: при слишком жёстком потолке страж выходил лишь на 14%
  // крупнее зверя, и «босс» перестал читаться.
  //
  // Поэтому потолок держим высоким (1.22), а размер уменьшаем
  // множителем BOSS_EXTRA выше. Такой порядок честнее: потолок — это
  // страховка от выхода за кадр, а не инструмент масштабирования.
  //
  // После уменьшения страж занимает 81% высоты кадра и влезает
  // целиком, поэтому потолок фактически не срабатывает.
  const BOSS_MAX_H = 1.22;

  // История множителей, чтобы не запутаться при чтении:
  //   · исходно  · 1
  //   · затем    · ×2   (все вдвое крупнее)
  //   · теперь   · ÷1.5 (просьба уменьшить в полтора раза)
  //
  // Итог: 1.5 × 2 / 1.5 = 2.0 от исходной формулы, то есть звери
  // остались вдвое крупнее того вида, что был до всех правок, но на
  // треть меньше перегруженного варианта.
  const baseScale = Math.min(W, H) * 0.085 * 1.5 * (2 / 1.5);
  let scale = baseScale * (game.enemyData.scale || 1) * (isBoss ? BOSS_EXTRA : 1);

  // Потолок для стражей: пересчитываем масштаб, если фигура выше предела.
  const TOP_UNITS = isBoss ? 4.6 : 4.2;
  if (isBoss) {
    const maxScale = (H * BOSS_MAX_H) / TOP_UNITS;
    scale = Math.min(scale, maxScale);
  }

  // ОСНОВАНИЕ ФИГУРЫ — считается от её реальной высоты, а не «на глаз».
  //
  // Раньше здесь стояли множители вроде H*1.09, подобранные под один
  // конкретный монитор. На телефоне в портрете они давали дыру в
  // верхней половине экрана: фигура прижималась к низу. Теперь мы
  // сначала считаем, сколько фигура занимает вверх в пикселях, и только
  // потом решаем, где поставить основание.
  //
  // FEET_BELOW — насколько стопы уходят ниже края кадра.
  //
  // Раньше фигура стояла «вплотную», стопы уходили за нижний край, и
  // враг читался как наклейка на стекле: он был ближе, чем арена, и
  // перспектива не работала. Теперь стопы стоят ВЫШЕ нижнего края —
  // фигура уходит в глубину, на пол арены, а не в лицо игроку.
  //
  // FEET_RAISE — доля высоты кадра, на которую стопы подняты над
  // нижним краем. Чем больше, тем глубже в сцене стоит враг.
  //
  //   портрет (телефон):  0.14 — фигуре тесно, поднимаем умеренно
  //   альбом и десктоп:   0.20 — места больше, враг уходит дальше
  //
  // Вместе с этим фигура чуть меньше: дальше в перспективе — значит
  // мельче. Множитель DEPTH_SCALE подобран так, чтобы верх фигуры
  // остался примерно там же, а низ поднялся.
  const FEET_RAISE = portrait ? 0.14 : 0.20;
  const DEPTH_SCALE = portrait ? 0.94 : 0.90;
  const HEADROOM = 0.05;          // воздух над макушкой, доля высоты

  scale *= DEPTH_SCALE;

  const figureH = TOP_UNITS * scale;
  const feetY = H * (1 - FEET_RAISE);
  const maxFeet = H * (1 - HEADROOM) + figureH;
  const baseY = Math.min(feetY, maxFeet);

  ctx.save();
  if (game.enemyHitFlash > 0) {
    ctx.globalAlpha = 1;
    // Красная вспышка при попадании
    ctx.shadowColor = '#ff3b52';
    ctx.shadowBlur = 40 * game.enemyHitFlash;
  }

  // Анимация смерти: враг оседает и тает, прежде чем показать экран победы.
  const dying = e.alive ? null : (game.enemyDying ??= 0);

  // Новая отрисовка: родной персонаж плюс отшатывание от удара,
  // сжатие, дрожь усталости, пот, раны и состояние по здоровью.
  //
  // staffOut — обратный вызов отрисовки: фигура сообщает, где у неё
  // навершие посоха. Это единственный надёжный способ узнать позицию
  // посоха: она зависит от роста, наклона и дыхания, и вычислять её
  // снаружи по формулам значило бы дублировать всю геометрию.
  let staffPos = null;
  if (e.alive || dying < 1) {
    drawEnemyV2(ctx, {
      cx, baseY, scale,
      enemy: game.enemyData,
      time: t,
      state: {
        casting: !!e.casting,
        castColor: e.casting ? TIERS[e.casting.sigil.tier].color : null,
        shieldUp: e.shieldUp,
        // Форма босса: во второй зверь крупнее и с деталями ярости.
        phase: game.phase,
        staffOut: (g) => { staffPos = g; },
      },
      hit: game.enemyHit,
      hpRatio: e.hpRatio,
      dying,
    });
  }
  ctx.restore();

  // --- Видимое рисование символа врагом: ключ ко всей тактике ---
  //
  // Знак рисуется СЛЕВА от противника, а не поверх него. Раньше он стоял
  // ровно по центру врага и наезжал на фигурку — при увеличенном размере
  // это стало совсем нечитаемо. Теперь область каста — в свободном
  // воздухе слева: враг «пишет перед собой», и знак не спорит с его
  // телом за одно и то же место.
  if (game.ai && game.ai.state === 'drawing' && game.ai.targetSigil) {
    const sigilX = cx - W * 0.18;
    const sigilY = H * 0.42;

    // ПОСОХ ПОКАЗЫВАЕТ, ЧТО ЗНАК ЧЕРТИТ ОН.
    //
    // Без этой связи посох и знак жили отдельно: маг стоял с палкой,
    // а рядом сам собой проступал символ. Линия от навершия к текущей
    // точке знака объясняет, кто что делает.
    //
    // Линия привязана к ТЕКУЩЕЙ точке росчерка, а не к центру знака:
    // тогда она ходит за кончиком, как за пером. Иначе она была бы
    // статичной палкой, торчащей из воздуха.
    if (staffPos) {
      const s = game.ai.strokePath;
      let tipX = sigilX;
      let tipY = sigilY;
      if (s && s.length) {
        // Прогресс росчерка берём из e.casting — того же источника,
        // по которому считается полоса каста. У AI-объекта полей
        // elapsed/total нет, и расчёт по ним всегда давал бы ноль.
        const prog = e.casting
          ? Math.min(1, e.casting.elapsed / Math.max(0.001, e.casting.total))
          : 0;
        const drawn = Math.max(1, Math.min(s.length, Math.round(prog * s.length)));
        const p = s[drawn - 1];
        const sigScale = Math.min(W, H) * 0.085;
        tipX = sigilX + p.x * sigScale;
        tipY = sigilY + p.y * sigScale;
      }

      ctx.save();
      ctx.strokeStyle = TIERS[game.ai.targetSigil.tier].color;
      ctx.globalAlpha = 0.16 + Math.sin(t * 6) * 0.05;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([5, 7]);
      ctx.lineDashOffset = -t * 40;
      ctx.beginPath();
      // Изогнутая линия читается как «магия течёт», прямая — как
      // техническая пунктирная разметка.
      ctx.moveTo(staffPos.headX, staffPos.headY);
      ctx.quadraticCurveTo(
        (staffPos.headX + tipX) / 2,
        Math.min(staffPos.headY, tipY) - H * 0.06,
        tipX, tipY
      );
      ctx.stroke();
      ctx.restore();
    }

    drawEnemySigil(game.ai, sigilX, sigilY, t);
  }

  // Полоса каста врага — насколько он продвинулся
  if (e.casting) {
    const prog = e.casting.elapsed / e.casting.total;
    const sig = e.casting.sigil;
    const bw = Math.min(W * 0.26, 260);
    const bx = cx - bw / 2;
    const by = H * 0.22;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(bx - 1, by - 1, bw + 2, 10);
    ctx.fillStyle = TIERS[sig.tier].color;
    ctx.fillRect(bx, by, bw * prog, 8);
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillStyle = TIERS[sig.tier].color;
    ctx.textAlign = 'center';
    ctx.fillText(`${sig.name} · Ранг ${sig.tier}`, cx, by - 6);

    // ФОРМА заклинания слева от полосы: цвет у всех рангов похож,
    // а форма различает заклинания мгновенно и без чтения текста.
    const shape = projectileShape(sig);
    ctx.save();
    ctx.translate(bx - 26, by + 4);
    ctx.globalAlpha = 0.35 + prog * 0.65;
    ctx.shadowColor = TIERS[sig.tier].color;
    ctx.shadowBlur = 10 + prog * 14;
    if (shape === 'spiral' || shape === 'seal') {
      ctx.strokeStyle = TIERS[sig.tier].color;
      ctx.lineWidth = 2;
      drawProjectileShape(shape, 0, 0, 9, 1, t * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = TIERS[sig.tier].color;
      drawProjectileShape(shape, 0, 0, 9, 1, t * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/**
 * Рисует символ, который "пишет" враг в воздухе.
 * Игрок видит форму и ранг — по ним и принимает решение: сбить или блокировать.
 */
function drawEnemySigil(ai, cx, cy, t) {
  const sigil = ai.targetSigil;
  const pts = ai.drawnPoints;
  if (!pts || pts.length < 2) return;

  const s = Math.min(W, H) * 0.075;
  const tierInfo = TIERS[sigil.tier];

  // Подложка: круг с рангом
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = tierInfo.glow;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, s * 1.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = tierInfo.glow;
  ctx.beginPath();
  ctx.arc(cx, cy, s * 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Показываем бледный полный шаблон — игрок понимает, что рисуется,
  // но реальный прогресс виден по яркой линии.
  const full = ai.strokePath;
  if (full) {
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = tierInfo.color;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx + full[0].x * s, cy + full[0].y * s);
    for (let i = 1; i < full.length; i++) ctx.lineTo(cx + full[i].x * s, cy + full[i].y * s);
    ctx.stroke();
    ctx.restore();
  }

  // Яркая линия — то, что уже нарисовано
  ctx.save();
  ctx.strokeStyle = tierInfo.color;
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = tierInfo.glow;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.moveTo(cx + pts[0].x * s, cy + pts[0].y * s);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(cx + pts[i].x * s, cy + pts[i].y * s);
  ctx.stroke();
  ctx.restore();

  // Текущая "кисть"
  const tip = pts[pts.length - 1];
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(cx + tip.x * s, cy + tip.y * s, 4, 0, Math.PI * 2);
  ctx.fill();

  // Название ранга
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.fillStyle = tierInfo.color;
  ctx.textAlign = 'center';
  ctx.fillText(`${tierInfo.name} · ${sigil.name}`, cx, cy - s * 1.9);
}

/** Снаряды и вспышки. */
/**
 * Форма снаряда.
 *
 * Раньше все заклинания летели одинаковым кругом, и различались ТОЛЬКО
 * цветом. Игрок жаловался, что форма не меняется. Теперь у каждого
 * символа своя геометрия, и она связана с тем, что игрок начертил:
 * у искры — остриё, у стены огня — ромб, у вихря — спираль.
 *
 * Форма берётся по id символа, а не по рангу: внутри одного ранга
 * заклинания должны выглядеть по-разному, иначе смысла в форме нет.
 *
 * @param {object} sigil заклинание
 * @returns {string} ключ формы
 */
function projectileShape(sigil) {
  const byId = {
    // Ранг I — короткие быстрые знаки.
    spark: 'spike',        // остриё: дёшево и колюче
    pebble: 'shard',       // осколок камня
    veil: 'ring',          // дымчатое кольцо
    // Ранг II.
    bolt: 'dart',          // стрела
    ward_pulse: 'shock',   // расходящаяся волна
    mend: 'bloom',         // целительный цветок
    // Ранг III.
    lance: 'spear',        // копьё с древком
    frost_bind: 'crystal', // ледяной кристалл
    flame_wall: 'flame',   // язык пламени
    // Ранг IV.
    mirror: 'prism',       // зеркальная призма
    siphon: 'maw',         // воронка, тянущая ману
    tempest: 'vortex',     // вихрь
    // Ранг V.
    judgment: 'seal',      // небесная печать
    vortex: 'spiral',      // спираль бездны
  };
  if (byId[sigil.id]) return byId[sigil.id];
  // Запасной вариант — по рангу, чтобы новый символ не остался без формы.
  return ['spike', 'dart', 'spear', 'prism', 'seal'][Math.min(4, (sigil.tier || 1) - 1)];
}

/**
 * Рисует геометрию снаряда в точке (x, y) радиусом r.
 * Направление полёта передаётся через dir (+1 слева направо, -1 обратно).
 *
 * Контекст передаётся параметром, а не берётся из замыкания: ту же
 * геометрию нужно рисовать и на игровом холсте, и на миниатюрах в справке.
 */
function drawShapeOn(c, shape, x, y, r, dir, spin) {
  c.save();
  c.translate(x, y);
  // Поворот нужен только «вращающимся» формам; остальные стабильны,
  // иначе остриё копья смотрело бы вбок.
  if (shape === 'vortex' || shape === 'spiral' || shape === 'shock' || shape === 'ring') {
    c.rotate(spin);
  }
  c.beginPath();
  switch (shape) {
    case 'spike': // узкое остриё по направлению полёта
      c.moveTo(dir * r * 1.9, 0);
      c.lineTo(-dir * r * 0.5, r * 0.62);
      c.lineTo(-dir * r * 0.2, 0);
      c.lineTo(-dir * r * 0.5, -r * 0.62);
      c.closePath();
      break;
    case 'shard': // гранёный осколок
      c.moveTo(dir * r * 1.3, 0);
      c.lineTo(0, r * 0.9);
      c.lineTo(-dir * r * 1.1, r * 0.3);
      c.lineTo(-dir * r * 0.6, -r * 0.7);
      c.lineTo(dir * r * 0.3, -r * 0.85);
      c.closePath();
      break;
    case 'dart': // стрела с оперением
      c.moveTo(dir * r * 1.8, 0);
      c.lineTo(-dir * r * 0.7, r * 0.85);
      c.lineTo(-dir * r * 1.25, r * 0.3);
      c.lineTo(-dir * r * 1.25, -r * 0.3);
      c.lineTo(-dir * r * 0.7, -r * 0.85);
      c.closePath();
      break;
    case 'spear': // копьё: длинное древко и наконечник
      c.moveTo(dir * r * 2.4, 0);
      c.lineTo(dir * r * 0.7, r * 0.6);
      c.lineTo(-dir * r * 2.2, r * 0.22);
      c.lineTo(-dir * r * 2.2, -r * 0.22);
      c.lineTo(dir * r * 0.7, -r * 0.6);
      c.closePath();
      break;
    case 'flame': // язык пламени с рваным краем
      c.moveTo(0, -r * 1.5);
      c.quadraticCurveTo(dir * r * 1.15, -r * 0.35, dir * r * 0.35, r * 0.75);
      c.quadraticCurveTo(0, r * 0.25, -dir * r * 0.55, r * 0.9);
      c.quadraticCurveTo(-dir * r * 0.85, -r * 0.2, 0, -r * 1.5);
      break;
    case 'crystal': // шестигранный ледяной кристалл
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const rr = i % 2 === 0 ? r * 1.25 : r * 0.55;
        const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.closePath();
      break;
    case 'ring': // дымчатое кольцо
      c.arc(0, 0, r * 1.15, 0, Math.PI * 2);
      c.arc(0, 0, r * 0.55, 0, Math.PI * 2, true);
      break;
    case 'shock': // расходящаяся дуга-волна
      c.arc(0, 0, r * 1.3, -Math.PI * 0.62, Math.PI * 0.62);
      c.arc(0, 0, r * 0.62, Math.PI * 0.62, -Math.PI * 0.62, true);
      c.closePath();
      break;
    case 'bloom': // лепестки лечения
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const cx = Math.cos(a) * r * 0.62, cy = Math.sin(a) * r * 0.62;
        c.moveTo(cx + r * 0.5, cy);
        c.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
      }
      break;
    case 'prism': // зеркальная призма — три грани
      c.moveTo(0, -r * 1.35);
      c.lineTo(r * 1.2, r * 0.9);
      c.lineTo(-r * 1.2, r * 0.9);
      c.closePath();
      break;
    case 'maw': // воронка, тянущая к себе
      c.moveTo(0, -r * 1.25);
      c.quadraticCurveTo(dir * r * 1.3, 0, 0, r * 1.25);
      c.quadraticCurveTo(-dir * r * 0.75, 0, 0, -r * 1.25);
      c.closePath();
      break;
    case 'dome': // купол щита: арка сверху и прямой низ
      c.moveTo(-r * 1.3, r * 0.65);
      c.quadraticCurveTo(0, -r * 1.7, r * 1.3, r * 0.65);
      c.closePath();
      break;
    case 'vortex': // ромбовидный вихрь
      c.moveTo(0, -r * 1.4);
      c.lineTo(r * 0.95, 0);
      c.lineTo(0, r * 1.4);
      c.lineTo(-r * 0.95, 0);
      c.closePath();
      break;
    case 'spiral': // спираль бездны
      for (let i = 0; i < 46; i++) {
        const a = i * 0.32;
        const rr = (i / 46) * r * 1.5;
        const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      break;
    case 'seal': // небесная печать: круг с насечками
      c.arc(0, 0, r * 0.85, 0, Math.PI * 2);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        c.moveTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85);
        c.lineTo(Math.cos(a) * r * 1.5, Math.sin(a) * r * 1.5);
      }
      break;
    default:
      c.arc(0, 0, r, 0, Math.PI * 2);
  }
  c.restore();
}

/** Рисует форму на ОСНОВНОМ игровом холсте. */
function drawProjectileShape(shape, x, y, r, dir, spin) {
  drawShapeOn(ctx, shape, x, y, r, dir, spin);
}

function drawProjectiles() {
  for (const p of game.projectiles) {
    const prog = p.t / p.dur;
    const fromX = p.from === 'player' ? W * 0.32 : W * 0.62;
    const toX = p.from === 'player' ? W * 0.62 : W * 0.32;
    const y = H * 0.55;
    const r = 8 + p.tier * 4;

    // Каждое заклинание летит по-своему: форма, скорость, дуга,
    // вращение, шлейф и искры берутся из профиля в spell-fx.js.
    drawSpellV2(ctx, {
      fx: fxFor(p.sigil),
      color: p.color,
      from: { x: fromX, y },
      to: { x: toX, y },
      prog,
      r,
      dir: p.from === 'player' ? 1 : -1,
      time: performance.now() / 1000,
      seed: p.seed || 0,
    });
  }
}

/** Эффекты попадания: свой у каждого заклинания. */
function updateImpacts(dt) {
  for (let i = game.impacts.length - 1; i >= 0; i--) {
    const im = game.impacts[i];
    im.progress += dt / im.dur;
    if (im.progress >= 1) game.impacts.splice(i, 1);
  }
}

function drawImpacts() {
  for (const im of game.impacts) {
    drawImpactV2(ctx, im.fx, {
      x: im.x, y: im.y, r: im.r, progress: im.progress,
      dir: im.dir, color: im.color,
    });
  }
}

function hexA(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function drawParticles() {
  for (const p of game.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (const f of game.floaters) {
    ctx.globalAlpha = Math.min(1, f.life * 1.6);
    ctx.font = '800 20px system-ui, sans-serif';
    ctx.fillStyle = f.color;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 6;
    ctx.fillText(f.text, f.x, f.y);
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;
}

/** Линия, которую рисует игрок прямо сейчас. */
function drawPlayerStroke() {
  const pts = game.input.points;
  if (!pts.length) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Свечение
  ctx.strokeStyle = 'rgba(140,220,255,0.35)';
  ctx.lineWidth = 12;
  ctx.shadowColor = '#4aa8ff';
  ctx.shadowBlur = 22;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();

  // Ядро линии
  ctx.strokeStyle = '#dff2ff';
  ctx.lineWidth = 3.5;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();

  // Кончик
  const last = pts[pts.length - 1];
  ctx.fillStyle = '#fff';
  ctx.shadowBlur = 16;
  ctx.beginPath(); ctx.arc(last.x, last.y, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Живое распознавание: показываем, что уже угадывается.
  if (pts.length > 6) {
    const r = recognize(pts, { accuracy: game.player.accuracy });
    if (r && r.sigil) {
      ctx.font = '700 16px system-ui, sans-serif';
      ctx.fillStyle = TIERS[r.sigil.tier].color;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 6;
      ctx.fillText(`${r.sigil.name} (${Math.round(r.score * 100)}%)`, W / 2, H - 140);
      ctx.shadowBlur = 0;
    }
  }
}

/** Панель символов: какой рисунок что даёт. */
function drawSigilGuide() {
  const list = SIGIL_LIST.filter((s) => s.tier <= game.unlockedTier);
  const x = 16;
  let y = 120;
  const lineH = 17;

  ctx.textAlign = 'left';
  ctx.font = '700 12px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(200,200,220,0.85)';
  ctx.fillText('СИМВОЛЫ (рисовать мышью):', x, y);
  y += lineH + 3;

  // Щит — всегда первым, он особенный
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillStyle = game.player.shieldUp ? '#dff2ff' : '#8fd3ff';
  ctx.fillText(`盾 Щит  ${sigilHint(SHIELD_SIGIL)}  (${SHIELD_SIGIL.manaCost})`, x, y);
  y += lineH;

  for (const s of list) {
    const cd = game.player.cooldownLeft(s.id);
    const ready = cd <= 0;
    const affordable = game.player.canAfford(s.manaCost);
    const hint = sigilHint(s);

    // Символ, который сейчас нельзя применить, приглушается — иначе игрок
    // не понимает, почему знакомый рисунок не сработал.
    if (!ready) {
      ctx.fillStyle = 'rgba(120,130,150,0.55)';
      const label = `${s.hanzi} ${s.name}  ${hint}`;
      ctx.fillText(label, x, y);
      // Полоса отката справа от текста
      const w = ctx.measureText(label).width;
      const total = s.cooldown || 1;
      ctx.fillStyle = 'rgba(140,200,255,0.35)';
      ctx.fillRect(x + w + 8, y - 8, 40 * (1 - cd / total), 3);
      ctx.fillStyle = 'rgba(150,160,180,0.7)';
      ctx.fillText(`${cd.toFixed(1)}с`, x + w + 54, y);
    } else {
      ctx.fillStyle = affordable ? TIERS[s.tier].color : 'rgba(120,130,150,0.6)';
      ctx.fillText(`${s.hanzi} ${s.name}  ${hint}  (${s.manaCost})`, x, y);
    }
    y += lineH;
    if (y > H * 0.62) break;
  }

  ctx.fillStyle = 'rgba(150,150,170,0.7)';
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillText('H — помощь · Space — щит', x, y + 6);
}

/**
 * Руки мага от первого лица.
 *
 * Без них кадр выглядит как камера в пустоте. Руки дают ощущение
 * присутствия и, что важнее, показывают состояние игрока:
 *   - при касте между ладонями собирается energy-сфера цвета ранга;
 *   - под щитом перед вами проступает барьер;
 *   - при рисовании ладонь ведёт светящуюся линию.
 */
function drawPlayerHands(t) {
  const p = game.player;
  if (!p || !p.alive) return;

  const baseY = H + 20;
  const sway = Math.sin(t * 1.1) * 8;
  const tier = p.casting ? p.casting.sigil.tier : 0;
  const castColor = tier ? TIERS[tier].color : '#8fd3ff';

  // Насколько ладони подняты: при касте руки вытянуты вперёд.
  const castProg = p.casting ? Math.min(1, p.casting.elapsed / p.casting.total) : 0;
  const lift = p.casting ? 60 + castProg * 50 : (p.shieldUp ? 30 : 0);
  // При рисовании руки следуют за кончиком линии.
  const drawing = game.input.drawing && game.input.points.length;
  const drawPt = drawing ? game.input.points[game.input.points.length - 1] : null;

  for (const side of [-1, 1]) {
    const hx = W * 0.5 + side * (220 - lift * 0.7) + sway * side * 0.6;
    const hy = baseY - lift - 40;

    // Смещение к точке рисования, если игрок ведёт линию.
    let px = hx, py = hy;
    if (drawPt) {
      const k = 0.35;
      px = hx + (drawPt.x - hx) * k;
      py = hy + (drawPt.y - hy) * k;
    }

    const handR = 52;
    const rot = side * (0.35 - lift * 0.002);

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rot);

    // Тень ладони на «полу» кадра — мягкая, чтобы рука не выглядела наклейкой
    const shade = ctx.createRadialGradient(0, 0, handR * 0.3, 0, 0, handR * 2.2);
    shade.addColorStop(0, 'rgba(0,0,0,0.45)');
    shade.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shade;
    ctx.beginPath(); ctx.arc(0, 0, handR * 2.2, 0, Math.PI * 2); ctx.fill();

    // Сама ладонь — упрощённый силуэт, развёрнутый к зрителю
    ctx.fillStyle = '#f0d2b8';
    ctx.strokeStyle = 'rgba(90,50,40,0.5)';
    ctx.lineWidth = 2;

    // Кисть
    ctx.beginPath();
    ctx.ellipse(0, 0, handR * 0.78, handR * 0.95, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Пальцы — веером, при касте чуть разведены
    const spread = p.casting ? 0.30 : 0.18;
    for (let f = 0; f < 4; f++) {
      const a = -Math.PI * 0.75 + f * spread + side * 0.06;
      const len = handR * (0.95 - Math.abs(f - 1.5) * 0.09);
      const fx = Math.cos(a) * len;
      const fy = Math.sin(a) * len - handR * 0.55;
      ctx.beginPath();
      ctx.ellipse(fx, fy, handR * 0.15, len * 0.5, a + Math.PI / 2, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }

    // Большой палец
    const ta = Math.PI * 0.85 * (side > 0 ? 1 : 1) - 0.3;
    ctx.beginPath();
    ctx.ellipse(Math.cos(ta) * handR * 0.62, Math.sin(ta) * handR * 0.5,
      handR * 0.19, handR * 0.42, ta, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Свечение под ладонью: у игрока всегда есть магический свет
    const glowCol = p.casting ? castColor : '#4aa8ff';
    const glowStrength = p.casting ? 0.5 + castProg * 0.4 : 0.18;
    const gg = ctx.createRadialGradient(0, -handR * 0.4, 0, 0, -handR * 0.4, handR * 1.8);
    gg.addColorStop(0, hexA(glowCol, glowStrength));
    gg.addColorStop(1, hexA(glowCol, 0));
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.arc(0, -handR * 0.4, handR * 1.8, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
  }

  // --- Энергия между ладонями во время каста ---
  if (p.casting) {
    const cx = W * 0.5;
    const cy = H - 150 - lift;
    const r = 18 + castProg * 46 + Math.sin(t * 16) * 4;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.4);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.3, hexA(castColor, 0.85));
    g.addColorStop(1, hexA(castColor, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r * 2.4, 0, Math.PI * 2); ctx.fill();

    // Вращающиеся руны ранга — игрок видит, что именно он кастует
    for (let i = 0; i < tier + 2; i++) {
      const a = t * 3.4 + (i / (tier + 2)) * Math.PI * 2;
      ctx.strokeStyle = hexA(castColor, 0.7);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r * (1.1 + i * 0.16), a, a + Math.PI * 0.55);
      ctx.stroke();
    }
  }

  // --- Барьер щита перед игроком ---
  if (p.shieldUp) {
    const pulse = 0.85 + Math.sin(t * 5) * 0.15;
    const cx = W * 0.5, cy = H * 0.56;
    const r = Math.min(W, H) * 0.42 * pulse;
    const gg = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
    gg.addColorStop(0, 'rgba(120,200,255,0)');
    gg.addColorStop(0.8, 'rgba(120,200,255,0.10)');
    gg.addColorStop(0.94, 'rgba(190,235,255,0.42)');
    gg.addColorStop(1, 'rgba(120,200,255,0)');
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();

    // Рёбра барьера — чтобы щит читался как купол, а не как засветка
    ctx.strokeStyle = 'rgba(200,240,255,0.22)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + t * 0.25;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.45, cy + Math.sin(a) * r * 0.45);
      ctx.lineTo(cx + Math.cos(a) * r * 0.96, cy + Math.sin(a) * r * 0.96);
      ctx.stroke();
    }
  }
}

/** Прицел — точка, куда смотрит маг. */
function drawCrosshair(t) {
  const cx = W / 2, cy = H / 2;
  ctx.save();
  ctx.globalAlpha = 0.35 + Math.sin(t * 2) * 0.08;
  ctx.strokeStyle = '#8fd3ff';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 18, cy); ctx.lineTo(cx - 6, cy);
  ctx.moveTo(cx + 6, cy); ctx.lineTo(cx + 18, cy);
  ctx.moveTo(cx, cy - 18); ctx.lineTo(cx, cy - 6);
  ctx.moveTo(cx, cy + 6); ctx.lineTo(cx, cy + 18);
  ctx.stroke();
  ctx.restore();
}

/** Виньетка от первого лица — края кадра затемнены. */
function drawVignette() {
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.78);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawMessage() {
  if (game.input.messageT <= 0 || !game.input.message) return;
  const a = Math.min(1, game.input.messageT * 2);
  ctx.globalAlpha = a;
  ctx.font = '700 20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 8;
  // Сообщение стоит вверху экрана, в полосе между верхним HUD (уровень,
  // полоски, состояния) и полоской каста врага. Раньше оно рисовалось
  // на H*0.72 — в самом бою, поверх врага и его полосы, и мешало смотреть
  // на противника. Здесь видно, но бой ничем не перекрыто.
  ctx.fillText(game.input.message, W / 2, messageY());
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

/**
 * Y для боевого сообщения. Полоса сверху занята HUD (до ~90px) и полоской
 * каста врага (H*0.22). Ищем середину между ними, но не вылезаем из
 * экрана на маленьких высотах.
 */
function messageY() {
  const top = 96;
  const castLine = H * 0.22 - 48;
  return Math.min(Math.max(top, castLine), H * 0.3);
}

/**
 * Отрисовка активной заставки.
 *
 * Под титром всегда лежит «мир»: для вступления — сцена меню, для
 * предсмертной — арена с врагом. Так заставка не выглядит вырезанной
 * из игры: она ложится поверх знакомого кадра.
 */
function renderCard(t) {
  const card = game.card;
  if (card.kind === CARD_INTRO) {
    drawBackground(t);
    drawMenuScene(t);
    drawIntro(ctx, { W, H, t, card });
  } else {
    drawBackground(t);
    if (game.enemy) drawEnemy(t);
    drawProjectiles();
    drawParticles();
    drawDeath(ctx, { W, H, t, card, enemy: game.enemyData ? game.enemyData.name : '' });
  }
}

function render(t) {
  // Заставка — самый верхний слой. Она не трясется вместе с боем и
  // перекрывает и HUD, и оверлеи: пока титр идёт, на экране только он.
  if (game.card) {
    renderCard(t);
    return;
  }

  ctx.save();

  // Тряска экрана
  if (game.shake > 0) {
    const s = game.shake * 12;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }

  if (game.scene === 'battle' || game.scene === 'victory' || game.scene === 'defeat') {
    drawBackground(t);
    // Врага рисуем и после его смерти: пока идёт анимация оседания,
    // экран победы ещё не показан, и он должен быть на месте.
    if (game.enemy) drawEnemy(t);
    drawProjectiles();
    drawImpacts();
    drawParticles();
    // Руки рисуются после мира, но до интерфейса: это «слой игрока».
    drawPlayerHands(t);
    drawCrosshair(t);
    drawPlayerStroke();
    drawVignette();
    if (game.scene === 'battle') {
      drawHud(t);
      drawSigilGuide();
      drawMessage();
    }
  } else if (game.scene === 'menu') {
    drawBackground(t);
    drawMenuScene(t);
  } else if (game.scene === 'gameover') {
    drawBackground(t);
    drawMenuScene(t);
  }

  ctx.restore();

  // Красная вспышка при получении урона (поверх всего)
  if (game.hitFlash > 0) {
    ctx.fillStyle = `rgba(200,20,40,${game.hitFlash * 0.35})`;
    ctx.fillRect(0, 0, W, H);
  }
}

/** Сцена меню: силуэт мага от первого лица и парящие символы. */
function drawMenuScene(t) {
  // Парящие символы на фоне
  const sigils = Object.values(SIGILS);
  ctx.save();
  for (let i = 0; i < sigils.length; i++) {
    const s = sigils[i];
    const a = t * 0.3 + i * 1.1;
    const x = W * 0.5 + Math.cos(a) * W * 0.3;
    const y = H * 0.45 + Math.sin(a * 1.3) * H * 0.22;
    ctx.globalAlpha = 0.14 + Math.sin(t + i) * 0.05;
    ctx.font = `${40 + s.tier * 8}px serif`;
    ctx.fillStyle = TIERS[s.tier].color;
    ctx.textAlign = 'center';
    ctx.fillText(s.hanzi, x, y);
  }
  ctx.restore();
}

// ================================================================ ИНТЕРФЕЙС

function showScreen(id) {
  document.querySelectorAll('.overlay').forEach((el) => el.classList.remove('active'));
  if (id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  }
}

function newGame() {
  enemyVoice.init();
  audio.init();
  audio.resume();
  game.stats = { wins: 0, losses: 0 };
  game.carryHpRatio = 1; // новая игра — полное здоровье
  // Новая игра начинается с заставки. «Продолжить» и «Дальше» её
  // пропускают: игрок уже в пути, и смотреть вступление заново незачем.
  game.card = createIntro();
  game.scene = 'intro';
  showScreen(null);
}

function continueGame() {
  // После последнего уровня продолжать некуда — уходим в меню.
  if (game.level >= maxLevelOfRun()) { backToMenu(); return; }
  startBattle(game.level + 1);
  showScreen(null);
}

/** Продолжить с сохранённого уровня, а не с начала. */
function resumeGame() {
  const saved = loadProgress();
  if (!saved) { newGame(); return; }
  enemyVoice.init();
  audio.init();
  audio.resume();
  game.stats.wins = saved.wins || 0;
  game.stats.losses = saved.losses || 0;
  // Восстанавливаем незалеченное здоровье: иначе перезагрузка страницы
  // работала бы как бесплатное лечение и обесценивала щит.
  game.carryHpRatio = typeof saved.hpRatio === 'number' ? saved.hpRatio : 1;
  startBattle(saved.level);
  showScreen(null);
}

function retryLevel() {
  startBattle(game.level);
  showScreen(null);
}

/**
 * Перейти на уровень из адреса: index.html?level=30
 *
 * Нужно для страницы переключения врагов (levels.html): там видно, кто
 * стоит на каждом уровне, и кнопка «Играть» должна открывать бой именно
 * с выбранным противником, а не с первого.
 *
 * Уровень НЕ записывается в сохранение и не считается прогрессом —
 * это переход для проверки. Иначе перебор уровней подменял бы
 * настоящий проход игры.
 *
 * Параметр со значением вне 1..70 игнорируется: опечатка в адресе
 * не должна ронять игру.
 */
function startFromUrl() {
  const raw = new URLSearchParams(location.search).get('level');
  if (raw === null) return false;
  const lvl = Math.round(Number(raw));
  if (!Number.isFinite(lvl) || lvl < 1 || lvl > 70) return false;

  enemyVoice.init();
  audio.init();
  audio.resume();
  game.stats = { wins: 0, losses: 0 };
  // Полное здоровье: игрок заходит посмотреть уровень, а не продолжить
  // израненным после прошлого боя.
  game.carryHpRatio = 1;
  startBattle(lvl);
  showScreen(null);
  return true;
}

function backToMenu() {
  game.scene = 'menu';
  audio.playTrack('title');
  // ПОКАЗЫВАЕМ меню, а не просто прячем оверлеи.
  //
  // Раньше здесь стояло showScreen(null): он снимает класс .active со всех
  // панелей, и после «В меню» экран становился пустым — ни меню, ни боя.
  // Причина была в расхождении имён: панель меню называлась
  // 'menu-overlay', а сюда передавался не он. Теперь id совпадает.
  refreshMenuState();
  showScreen('menu');
}

// Кнопки
document.getElementById('btn-start').addEventListener('click', () => {
  // Новая игра затирает сохранение, но только после подтверждения,
  // если прогресс уже есть.
  const saved = loadProgress();
  if (saved && saved.level > 1) {
    if (!confirm(`Начать заново? Текущий прогресс (уровень ${saved.level}) будет потерян.`)) return;
  }
  clearProgress();
  newGame();
});

// Выбора режимов больше нет: в меню остался один путь.
document.getElementById('btn-resume').addEventListener('click', () => { resumeGame(); });
document.getElementById('btn-continue').addEventListener('click', () => { continueGame(); });
document.getElementById('btn-retry').addEventListener('click', () => { retryLevel(); });
document.getElementById('btn-menu').addEventListener('click', () => { backToMenu(); });
document.getElementById('btn-menu2').addEventListener('click', () => { backToMenu(); });
document.getElementById('btn-help').addEventListener('click', () => {
  game.showHelp = !game.showHelp;
  showScreen(game.showHelp ? 'help' : null);
});
document.getElementById('btn-help-close').addEventListener('click', () => {
  game.showHelp = false;
  showScreen(null);
});

// ================================================================ МУЗЫКА В МЕНЮ

/**
 * Ползунок громкости.
 *
 * Значение хранится в localStorage и живёт дольше сессии: игрок,
 * убавивший звук, не должен крутить его заново после перезапуска.
 * Пишем в обе структуры — engine (для мгновенного эффекта) и
 * game (для перерисовки меню).
 */
const MUSIC_VOL_KEY = 'sigil-music-volume';
const MUSIC_TRACK_KEY = 'sigil-music-track';
const VOICE_VOL_KEY = 'sigil-voice-volume';

function savedMusicVolume() {
  // parseFloat, а не Number: Number(null) даёт 0, и при первом запуске
  // музыка оказывалась выключенной, хотя ползунок показывал 55%.
  const raw = parseFloat(localStorage.getItem(MUSIC_VOL_KEY));
  return Number.isFinite(raw) && raw >= 0 && raw <= 1 ? raw : 0.55;
}

/**
 * Громкость голосов врагов — отдельная от музыки.
 *
 * Это нарочно не общий ползунок: синтез речи звучит ровнее и резче
 * музыки, и многим он мешает именно своей громкостью. Отдельная
 * ручка позволяет оставить музыку, но приглушить голоса.
 *
 * Читаем через parseFloat, а НЕ через Number. Number(null) даёт 0 —
 * то есть при первом запуске, когда в хранилище ещё ничего нет,
 * громкость молча становилась нулевой и враги «не звучали» вовсе,
 * хотя ползунок показывал норму. parseFloat(null) даёт NaN, и
 * проверка ниже честно откатывает к значению по умолчанию.
 */
function savedVoiceVolume() {
  const raw = parseFloat(localStorage.getItem(VOICE_VOL_KEY));
  return Number.isFinite(raw) && raw >= 0 && raw <= 1 ? raw : 0.6;
}

function applyVoiceVolume(v) {
  enemyVoice.setVolume(v);
  localStorage.setItem(VOICE_VOL_KEY, String(v));
  const label = document.getElementById('voice-volume-val');
  if (label) label.textContent = Math.round(v * 100) + '%';
  const slider = document.getElementById('voice-volume');
  if (slider && Number(slider.value) !== Math.round(v * 100)) {
    slider.value = String(Math.round(v * 100));
  }
}

function applyMusicVolume(v) {
  audio.setMusicVolume(v);
  localStorage.setItem(MUSIC_VOL_KEY, String(v));
  const label = document.getElementById('music-volume-val');
  if (label) label.textContent = Math.round(v * 100) + '%';
  const slider = document.getElementById('music-volume');
  if (slider && Number(slider.value) !== Math.round(v * 100)) {
    slider.value = String(Math.round(v * 100));
  }
}

// Заполняем список треков названиями — из данных, а не из вёрстки,
// чтобы список не разошёлся с AudioEngine.TRACKS.
function buildTrackSelect() {
  const sel = document.getElementById('music-track');
  // `sel.options` может отсутствовать (нестандартная разметка, тестовая
  // заглушка). Обращение к .length без проверки роняло ВЕСЬ модуль при
  // загрузке — игра не запускалась вовсе.
  if (!sel || !sel.options || sel.options.length) return;
  for (const key of AudioEngine.SELECTABLE) {
    const tr = AudioEngine.TRACKS[key];
    if (!tr) continue;
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = tr.name;
    sel.appendChild(opt);
  }
  const saved = localStorage.getItem(MUSIC_TRACK_KEY);
  const pick = AudioEngine.SELECTABLE.includes(saved) ? saved : 'journey';
  sel.value = pick;
  game.battleTrack = pick;
}

buildTrackSelect();

document.getElementById('music-volume').addEventListener('input', (e) => {
  enemyVoice.init();
  audio.init();
  audio.resume();
  applyMusicVolume(Number(e.target.value) / 100);
});

/**
 * Ползунок громкости голосов врагов.
 *
 * Кроме громкости ничего не делает — но при первом касании
 * инициализирует синтез: браузеры разрешают речь только после
 * действия пользователя, и щелчок по ползунку как раз им является.
 */
const voiceVolEl = document.getElementById('voice-volume');
if (voiceVolEl) {
  voiceVolEl.addEventListener('input', (e) => {
    enemyVoice.init();
    applyVoiceVolume(Number(e.target.value) / 100);
  });
}

document.getElementById('music-track').addEventListener('change', (e) => {
  game.battleTrack = e.target.value;
  localStorage.setItem(MUSIC_TRACK_KEY, e.target.value);
  // Сразу даём послушать выбор — если мы в меню.
  if (game.scene !== 'battle') audio.playTrack(e.target.value);
});

// ================================================================ РЕЖИМЫ ИСПЫТАНИЙ

/**
 * Запуск испытания.
 *
 * Испытание — это новая игра: прогресс основного пути не трогаем,
 * а сохраняем отдельно, чтобы «Стойкость» не затирала обычное
 * прохождение. Ключ сохранения включает режим.
 */
function startChallenge(mode) {
  // Режим ставим ПЕРВЫМ: от него зависят ключи сохранения, поэтому
  // loadProgress и clearProgress ниже уже работают с нужным слотом.
  const prevMode = game.mode;
  game.mode = mode;

  const saved = loadProgress(mode);
  if (saved && saved.level > 1) {
    if (!confirm(`Начать испытание «${MODES[mode].label}»? Прогресс этого испытания (уровень ${saved.level}) будет потерян.`)) {
      game.mode = prevMode;
      return;
    }
  }
  clearProgress();
  game.stats = { wins: 0, losses: 0 };
  game.level = 1;
  newGame();
  showMessage(`ИСПЫТАНИЕ: ${MODES[mode].label}`, 3.0);
}

document.getElementById('btn-challenge-1').addEventListener('click', () => startChallenge('resolve'));
document.getElementById('btn-challenge-2').addEventListener('click', () => startChallenge('fury'));

// ================================================================ ГЛАВНЫЙ ЦИКЛ

let lastT = performance.now();

function loop(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  game.time += dt;

  if (game.card) {
    // Во время заставки мир замирает: бой не тикает, но пыль и искры
    // продолжают жить — иначе сцена выглядит как стоп-кадр.
    updateCard(game.card, dt);
    updateParticles(dt);
    finishCard();
  } else if (game.scene === 'battle') {
    updateBattle(dt);
  } else {
    // Частицы и снаряды догорают и в конце боя
    updateParticles(dt);
    updateProjectiles(dt);
  }

  render(game.time);
  requestAnimationFrame(loop);
}

// ================================================================ ТАБЛИЦА СИМВОЛОВ В СПРАВКЕ

/** Заполняет справку карточками всех символов — чтобы игрок мог их выучить. */
function buildSigilTable() {
  const host = document.getElementById('sigil-table');
  if (!host) return;

  const all = [SHIELD_SIGIL, ...SIGIL_LIST];
  host.innerHTML = '';

  for (const s of all) {
    const tierInfo = TIERS[s.tier];
    const card = document.createElement('div');
    card.className = 'sigil-card';
    card.style.borderLeftColor = tierInfo.color;

    const upkeep = s.id === 'shield'
      ? `<div class="sc-cost">Активация ${s.manaCost} · удержание ${s.upkeepBase} + ${s.upkeepPerLevel}/ур. в секунду</div>`
      : `<div class="sc-cost">Мана ${s.manaCost} · каст ${s.castTime.toFixed(2)} с</div>`;

    card.innerHTML = `
      <div class="sc-head">
        <span class="sc-hanzi" style="color:${tierInfo.color}">${s.hanzi}</span>
        <span class="sc-name">${s.name}</span>
        <span class="sc-tier" style="color:${tierInfo.color}">Ранг ${s.tier}</span>
      </div>
      <div class="sc-arrows">${sigilHint(s)}</div>
      <p class="sc-desc">${s.desc}</p>
      ${upkeep}
    `;

    // Мини-превью формы снаряда: игрок должен УЗНАТЬ заклинание в бою
    // по силуэту. Без этого подсказка «у каждого символа своя форма»
    // остаётся словами — учить форму негде.
    //
    // Щит снарядом не летит, у него своя форма (купол), поэтому
    // превью рисуем не для него.
    const preview = document.createElement('canvas');
    preview.className = 'sc-shape';
    preview.width = 56;
    preview.height = 56;
    const pctx = preview.getContext('2d');
    if (pctx) {
      pctx.translate(28, 28);
      pctx.strokeStyle = tierInfo.color;
      pctx.fillStyle = tierInfo.color;
      pctx.lineWidth = 2;
      const shape = s.id === 'shield' ? 'dome' : projectileShape(s);
      if (shape === 'spiral' || shape === 'seal') {
        drawShapeOn(pctx, shape, 0, 0, 13, 1, 0);
        pctx.stroke();
      } else {
        drawShapeOn(pctx, shape, 0, 0, 13, 1, 0);
        pctx.fill();
      }
    }
    card.appendChild(preview);

    host.appendChild(card);
  }
}

// ================================================================ СТАРТ

resize();
buildSigilTable();
audio.playTrack('title');
requestAnimationFrame(loop);

// Тестовый доступ к состоянию игры.
//
// Модуль ничего не экспортирует (он точка входа), поэтому раньше
// автотесты не могли прогнать РЕАЛЬНЫЙ игровой цикл — они подменяли
// его собственной симуляцией и проверяли модули по отдельности.
// Из-за этого путь «ввод → распознавание → каст → урон» оставался
// непроверенным.
//
// Хук выставляется ТОЛЬКО под флагом DSH_SIM, который ставит tools/sim.mjs.
// Проверка идёт через globalThis, потому что в браузере нет process.
if (globalThis.DSH_SIM) {
  let simT = 0;
  globalThis.__game = {
    game,
    // loop() принимает МЕТКУ ВРЕМЕНИ (performance.now), а не dt,
    // поэтому шаг имитируем сдвигом часов на нужную величину.
    step: (dt) => { simT += dt * 1000; loop(simT); },
    startBattle,
    beginDraw,
    moveDraw,
    endDraw,
    // Длина пути: по ней проверяется, что игра кончается там, где
    // обещано, а не тянется бесконечно.
    maxLevelOfRun,
    // Темп рисования знака по уровню и применение заклинания: нужны,
    // чтобы измерить поведение врага по факту, а не по таблице.
    difficultyPace,
    TOTAL_LEVELS,
    applySigil,
  };
}

/**
 * Обновляет подписи меню при входе в него.
 *
 * Показывает «Продолжить» только при реальном прогрессе и заполняет
 * строку под заголовком. Раньше этой функции не было вовсе, и меню
 * открывалось с пустыми подписями.
 */
function refreshMenuState() {
  const saved = loadProgress();
  const resumeBtn = document.getElementById('btn-resume');
  const startBtn = document.getElementById('btn-start');

  const canResume = saved && saved.level > 1;
  if (canResume) {
    if (!game.level || game.level < 1) game.level = saved.level;
    game.stats.wins = saved.wins || 0;
    game.stats.losses = saved.losses || 0;
    resumeBtn.hidden = false;
    resumeBtn.textContent = `Продолжить — уровень ${saved.level}`;
  } else {
    resumeBtn.hidden = true;
  }

  startBtn.textContent = 'Начать игру';
  document.getElementById('level-count').textContent =
    `Семь Стражей · 70 уровней · всего ${ENEMIES.length} противников`;
}

refreshMenuState();

// Восстанавливаем сохранённую громкость голосов врагов.
//
// Зовём ДО startFromUrl, но самого синтеза ещё не запускаем: браузер
// разрешит речь только после щелчка игрока, а setVolume — это просто
// запись числа, она безопасна в любой момент. Сам EnemyVoice.init()
// произойдёт при старте боя или первом касании ползунка.
applyVoiceVolume(savedVoiceVolume());

// Переход на уровень из адреса (?level=N) — для страницы переключения
// врагов (levels.html). Стоит ПОСЛЕ refreshMenuState: меню уже собрано,
// и если адрес не задан, остаётся обычный экран меню.
startFromUrl();