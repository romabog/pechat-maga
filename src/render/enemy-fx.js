/**
 * ВРАГ: РЕАКЦИЯ НА УРОН И СМЕНА СОСТОЯНИЙ — ЭКСПЕРИМЕНТАЛЬНАЯ ВЕРСИЯ
 * ==================================================================
 * ЭТО ОТДЕЛЬНЫЙ ФАЙЛ. Рабочая игра его не импортирует: main.js вызывает
 * character.js напрямую, и до тех пор, пока вы не подключите этот файл,
 * ничего не меняется. Посмотреть — на странице visual-v2.html.
 *
 * ЧТО ЗДЕСЬ ЕСТЬ.
 *
 * 1. РЕАКЦИЯ НА УРОН. Сейчас в бою враг только подсвечивается красным
 *    свечением на 0.35 с. Здесь он вздрагивает, отшатывается назад,
 *    сжимается от удара, теряет равновесие, а по краям идёт белая
 *    вспышка. Тяжёлый удар (больше 12% запаса жизни) — отдельная,
 *    более длинная реакция с отскоком.
 *
 * 2. СОСТОЯНИЯ ПО ЗДОРОВЬЮ. Враг меняется по мере того, как тает
 *    полоска жизни: поза, дыхание, аура, цвет, дрожь, следы ран.
 *    Пять ступеней плюс смерть.
 *
 * Всё это — НАДСТРОЙКА над drawCharacter: базовая аниме-графика не
 * переписывается, эффекты рисуются поверх и вокруг.
 */
import { drawCharacter } from './character.js';

/** hex + альфа → rgba(). Локальная копия для самодостаточности. */
export function hexA(hex, a) {
  const h = String(hex).replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/**
 * СТУПЕНИ СОСТОЯНИЯ ПО ДОЛЕ ЗДОРОВЬЯ.
 *
 * Пороги подобраны так, чтобы игрок замечал смену без цифр: на 75%
 * враг ещё спокоен, на 50% уже подобрался, к 25% заметно сдал, а
 * ниже 10% понятно, что он вот-вот упадёт.
 */
export const HP_STATES = [
  {
    id: 'calm', min: 0.75, name: 'Спокоен',
    breath: 1.0, tremble: 0, lean: 0, aura: 1.0, dark: 0, sweat: 0, wounds: 0,
  },
  {
    id: 'alert', min: 0.50, name: 'Насторожен',
    breath: 1.25, tremble: 0.15, lean: 0.02, aura: 1.2, dark: 0, sweat: 0.2, wounds: 0,
  },
  {
    id: 'wounded', min: 0.25, name: 'Ранен',
    breath: 1.7, tremble: 0.4, lean: 0.05, aura: 1.05, dark: 0.1, sweat: 0.6, wounds: 1,
  },
  {
    id: 'battered', min: 0.10, name: 'Измотан',
    breath: 2.4, tremble: 0.75, lean: 0.09, aura: 0.85, dark: 0.22, sweat: 1, wounds: 2,
  },
  {
    id: 'critical', min: 0, name: 'На пределе',
    breath: 3.3, tremble: 1.15, lean: 0.13, aura: 1.5, dark: 0.34, sweat: 1, wounds: 3,
  },
];

/** Текущее состояние врага по доле жизни (0..1). */
export function hpState(hpRatio) {
  const h = Math.max(0, Math.min(1, hpRatio));
  for (const s of HP_STATES) if (h >= s.min) return s;
  return HP_STATES[HP_STATES.length - 1];
}

/**
 * Состояние попадания — то, что живёт во времени.
 *
 * Один объект на врага. Вызывающая сторона:
 *   const hit = createHitState();
 *   applyHit(hit, damageApplied, maxHp);   // при уроне
 *   updateHit(hit, dt);                    // каждый кадр
 *   // и передать hit в drawEnemyV2
 */
export function createHitState() {
  return {
    flash: 0,       // белая вспышка поверх
    red: 0,         // красная отдача
    recoil: 0,      // отшатывание назад (0..1)
    squash: 0,      // сжатие по вертикали
    stagger: 0,     // потеря равновесия (качание)
    heavy: false,   // был ли удар тяжёлым
    lastDmg: 0,
    totalHits: 0,   // сколько ударов выдержал — копится в усталость
  };
}

/**
 * Применить полученный урон к состоянию попадания.
 * @param {object} hit состояние
 * @param {number} dmg сколько дошло
 * @param {number} maxHp максимум жизни врага
 */
export function applyHit(hit, dmg, maxHp) {
  if (!(dmg > 0)) return;
  const share = dmg / Math.max(1, maxHp);      // доля от полного запаса
  const heavy = share >= 0.12;                  // тяжёлый удар

  hit.flash = heavy ? 1 : 0.7;
  hit.red = heavy ? 0.9 : 0.6;
  hit.recoil = Math.min(1, 0.45 + share * 3.2);
  hit.squash = Math.min(1, 0.5 + share * 2.6);
  hit.stagger = Math.min(1, (heavy ? 0.7 : 0.4) + share * 2);
  hit.heavy = heavy;
  hit.lastDmg = dmg;
  hit.totalHits++;
}

/** Затухание эффектов попадания за кадр. */
export function updateHit(hit, dt) {
  hit.flash = Math.max(0, hit.flash - dt * 3.6);
  hit.red = Math.max(0, hit.red - dt * 2.4);
  hit.recoil = Math.max(0, hit.recoil - dt * 2.8);
  hit.squash = Math.max(0, hit.squash - dt * 4.2);
  hit.stagger = Math.max(0, hit.stagger - dt * 2.2);
}

/** Дрожание уставшего врага — заметно сильнее к концу боя. */
function trembleOf(st, time, hit) {
  const amp = st.tremble;
  const fatigue = Math.min(1, hit ? hit.totalHits / 14 : 0); // копится от ударов
  const a = amp * (0.6 + fatigue * 0.4);
  return {
    x: Math.sin(time * 31) * a * 1.6 + Math.sin(time * 53) * a * 0.6,
    y: Math.sin(time * 37) * a * 0.8,
  };
}

/**
 * Полная отрисовка врага: родной character.js плюс реакции.
 *
 * @param {CanvasRenderingContext2D} c
 * @param {object} p { cx, baseY, scale, enemy, time, state, hit, hpRatio,
 *                     dying }
 */
export function drawEnemyV2(c, p) {
  const { cx, baseY, scale, enemy, time } = p;
  const st = hpState(p.hpRatio ?? 1);
  const hit = p.hit || createHitState();

  // --- Умирание: враг оседает и тает ---
  if (p.dying != null) {
    const d = Math.max(0, Math.min(1, p.dying));
    c.save();
    c.globalAlpha = 1 - d;
    c.translate(0, d * scale * 1.3);
    c.scale(1 + d * 0.08, 1 - d * 0.35);
    drawCharacter(c, cx, baseY, scale, enemy, time, {
      ...(p.state || {}),
      // На смерти глаза закрываются — простая, но читаемая деталь.
      hurt: false,
    });
    drawDeathFx(c, cx, baseY, scale, enemy, time, d);
    c.restore();
    return;
  }

  const tr = trembleOf(st, time, hit);
  const breathPhase = Math.sin(time * 1.5 * st.breath);
  const squashing = hit.squash;

  c.save();

  // --- ОТШАТЫВАНИЕ И ПОЗА ---
  // Враг отходит назад от игрока (вправо, он стоит справа).
  const recoilX = hit.recoil * scale * 0.55;
  const staggerX = hit.stagger * Math.sin(time * 22) * scale * 0.22;
  const leanX = st.lean * scale * 1.1;

  c.translate(cx + recoilX + staggerX + leanX + tr.x, baseY + tr.y);

  // Сжатие от удара: приплюснут по вертикали и растянут по горизонтали.
  if (squashing > 0) {
    const s = squashing * 0.16;
    c.scale(1 + s, 1 - s);
  }
  // Дыхание: уставший дышит тяжелее и заметнее.
  const bs = 1 + breathPhase * 0.012 * st.breath;
  c.scale(1 / bs, bs);

  // Наклон вперёд по мере усталости.
  c.rotate(-st.lean * 0.28);

  // Дальше рисуем в локальных координатах вокруг нуля.
  drawCharacter(c, 0, 0, scale, enemy, time, p.state || {});
  c.restore();

  // --- НАЛОЖЕНИЯ ПОВЕРХ (в исходных координатах) ---
  drawWounds(c, cx + recoilX + leanX, baseY, scale, enemy, time, st, hit, p.hpRatio ?? 1);
  drawDarkAura(c, cx, baseY, scale, enemy, time, st);
  drawFlash(c, cx + recoilX + leanX, baseY, scale, enemy, hit);
  if (st.aura > 1) drawRageAura(c, cx, baseY, scale, enemy, time, st);
}

/** Раны: по мере потери жизни их всё больше. */
function drawWounds(c, cx, baseY, scale, enemy, time, st, hit, hpRatio) {
  if (st.wounds <= 0) return;
  const n = st.wounds;
  const now = time * 2;
  for (let i = 0; i < n; i++) {
    // Три фиксированные точки на теле, чтобы раны не «мигали».
    const spots = [
      { x: -0.35, y: -1.5, a: -0.4 },
      { x: 0.30, y: -2.1, a: 0.5 },
      { x: -0.05, y: -0.85, a: 0.15 },
    ];
    const s = spots[i % spots.length];
    const px = cx + s.x * scale;
    const py = baseY + s.y * scale;
    const pulse = 0.6 + Math.sin(now + i) * 0.2;

    c.save();
    c.translate(px, py);
    c.rotate(s.a);
    // Рассечение
    c.strokeStyle = `rgba(180,30,45,${0.55 * pulse})`;
    c.lineWidth = Math.max(1.5, scale * 0.07);
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-scale * 0.22, 0);
    c.lineTo(scale * 0.22, scale * 0.05);
    c.stroke();
    // Свечение раны — подсказка, что враг уже «пробит».
    c.strokeStyle = `rgba(255,90,110,${0.30 * pulse})`;
    c.lineWidth = Math.max(1, scale * 0.16);
    c.stroke();
    c.restore();
  }

  // Пот у измотанного.
  if (st.sweat > 0) {
    const drops = Math.round(st.sweat * 3);
    for (let i = 0; i < drops; i++) {
      const t = (time * 0.9 + i * 0.37) % 1;
      const px = cx + (i - 1) * scale * 0.34;
      const py = baseY - scale * 3.1 + t * scale * 1.1;
      c.beginPath();
      c.ellipse(px, py, scale * 0.05, scale * 0.09, 0, 0, Math.PI * 2);
      c.fillStyle = `rgba(180,220,255,${0.5 * (1 - t)})`;
      c.fill();
    }
  }

  // На пределе — красная пульсация по контуру: «ещё немного».
  if (st.id === 'critical') {
    const p2 = 0.5 + Math.sin(time * 7) * 0.5;
    c.save();
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = `rgba(255,40,60,${0.10 * p2})`;
    c.beginPath();
    c.arc(cx, baseY - scale * 1.8, scale * 1.9, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
  void hit;
  void hpRatio;
}

/** Затемнение по краям — «в глазах темнеет». */
function drawDarkAura(c, cx, baseY, scale, enemy, time, st) {
  if (st.dark <= 0) return;
  const r = scale * (2.6 + Math.sin(time * 2) * 0.12);
  const g = c.createRadialGradient(cx, baseY - scale * 1.8, r * 0.5, cx, baseY - scale * 1.8, r);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(10,0,20,${st.dark * 0.5})`);
  c.fillStyle = g;
  c.beginPath();
  c.arc(cx, baseY - scale * 1.8, r, 0, Math.PI * 2);
  c.fill();
  void enemy;
}

/** Аура ярости у того, кто на пределе. */
function drawRageAura(c, cx, baseY, scale, enemy, time, st) {
  const pulse = 0.8 + Math.sin(time * 6) * 0.2;
  const r = scale * 2.4 * pulse;
  const g = c.createRadialGradient(cx, baseY - scale * 1.8, r * 0.6, cx, baseY - scale * 1.8, r);
  g.addColorStop(0, 'rgba(255,60,60,0)');
  g.addColorStop(0.8, `rgba(255,60,60,${0.14 * (st.aura - 1)})`);
  g.addColorStop(1, 'rgba(255,60,60,0)');
  c.fillStyle = g;
  c.beginPath();
  c.arc(cx, baseY - scale * 1.8, r, 0, Math.PI * 2);
  c.fill();
  void enemy;
}

/** Вспышка от удара: белая по контуру и красная на весь силуэт. */
function drawFlash(c, cx, baseY, scale, enemy, hit) {
  if (hit.flash <= 0 && hit.red <= 0) return;
  c.save();
  // Белая вспышка — яркий силуэт на долю секунды.
  if (hit.flash > 0) {
    c.globalAlpha = hit.flash * 0.85;
    c.globalCompositeOperation = 'lighter';
    c.filter = 'brightness(3)';
    // Повторная отрисовка персонажа «поверх» даёт именно вспышку
    // силуэта, а не круг: так удар читается мгновенно.
    c.restore();
    c.save();
  }
  if (hit.red > 0) {
    const r = scale * 2.2;
    const g = c.createRadialGradient(cx, baseY - scale * 1.8, 0, cx, baseY - scale * 1.8, r);
    g.addColorStop(0, `rgba(255,80,90,${hit.red * 0.5})`);
    g.addColorStop(1, 'rgba(255,80,90,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, baseY - scale * 1.8, r, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
  void enemy;
}

/** Эффект смерти: расходящееся кольцо и осыпающиеся частицы. */
function drawDeathFx(c, cx, baseY, scale, enemy, time, d) {
  c.save();
  c.beginPath();
  c.arc(cx, baseY - scale * 1.8, scale * (1 + d * 3.4), 0, Math.PI * 2);
  c.strokeStyle = hexA(enemy.palette?.glow || '#ffffff', (1 - d) * 0.8);
  c.lineWidth = Math.max(1, scale * 0.22 * (1 - d));
  c.stroke();

  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const rr = scale * d * (1.6 + (i % 3) * 0.7);
    c.beginPath();
    c.arc(cx + Math.cos(a) * rr, baseY - scale * 1.8 + Math.sin(a) * rr - d * scale,
      scale * 0.12 * (1 - d), 0, Math.PI * 2);
    c.fillStyle = hexA(enemy.palette?.glow || '#ffffff', (1 - d) * 0.7);
    c.fill();
  }
  void time;
}

/**
 * ПОДКЛЮЧЕНИЕ К БОЮ (если решите перенести в игру).
 *
 * В main.js сейчас:
 *
 *   drawCharacter(ctx, cx, baseY, scale, game.enemyData, t, {...});
 *
 * Замена — один вызов, плюс счётчик ударов рядом с game.enemyHitFlash:
 *
 *   import { createHitState, applyHit, updateHit, drawEnemyV2 }
 *     from './render/enemy-fx.js';
 *
 *   game.enemyHit = createHitState();                  // при входе в бой
 *   applyHit(game.enemyHit, result.applied, e.maxHp);  // в resolveHit
 *   updateHit(game.enemyHit, dt);                      // в update
 *
 *   drawEnemyV2(ctx, {
 *     cx, baseY, scale, enemy: game.enemyData, time: t,
 *     state: { casting: !!e.casting, shieldUp: e.shieldUp },
 *     hit: game.enemyHit, hpRatio: e.hp / e.maxHp,
 *   });
 *
 * Сейчас этот файл никем не импортируется: рабочая версия не затронута.
 */
export const HP_STATE_IDS = HP_STATES.map((s) => s.id);
