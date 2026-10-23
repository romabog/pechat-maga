/**
 * ИИ ПРОТИВНИКА
 * =============
 * Враг играет по тем же правилам, что и игрок: он рисует символы, они
 * распознаются с той же логикой, он тратит ману и может держать щит.
 *
 * Ключ к честной тактике — враг рисует СВОЙ символ ВИДИМО.
 * Игрок видит, как проступает фигура, и может:
 *   а) успеть сбить дешёвым Рангом I, если символ длинный;
 *   б) поставить щит, если символ короткий и сбить не успеть;
 *   в) продолжить свой каст, если враг ушёл в щит.
 *
 * Характер врага задаётся весами (profile):
 *   aggression  — как часто атакует вместо защиты
 *   patience    — умеет ли ждать просадки маны игрока
 *   reflex      — скорость реакции на щит игрока
 *   discipline  — насколько точно рисует (влияет на успех распознавания)
 *   patternPref — предпочтение рангов
 */

import { SIGILS, SHIELD_SIGIL, SIGIL_LIST } from './sigils.js';
import { Combatant } from './combat.js';

/**
 * Пауза между заклинаниями врага, в секундах.
 *
 * Без неё рисунок и каст шли впритык: враг начинал новый символ сразу
 * после окончания предыдущего, и тихие символы рангов I-III (откат
 * 0.45-1.6 с) выстраивались в очередь. Замер первых секунд боя
 * (tools/_diag-opening.mjs) показал интервалы 0.47, 0.72, 0.80 с — три
 * заклинания подряд без паузы, и на 1-м уровне ману выжигало со 100%
 * до 54% за три секунды.
 *
 * 0.9 с разорывал очереди полностью, но оказался слишком долгим. Замер
 * (tools/sim.mjs, 576 боёв) показал 6 зависаний: враг с паузой тратит
 * меньше маны, копит её и начинает дольше сидеть под щитом, а тестовый
 * бот сознательно не бьёт по защищённому врагу (бережёт ману) — бой
 * доходит до лимита времени. Поэтому взяли наибольшее значение, которое
 * ещё не вызывает зависаний: 0.4 с.
 *
 * 0.4 с: медиана между кастами вырастает примерно до 1.5 с, а самый
 * короткий интервал — 0.87 с (пауза + рисунок + каст самого быстрого
 * символа). Замер 576 боёв — ноль зависаний. Проверяется автоматически
 * в tools/difficulty-balance.mjs.
 *
 * Пауза НЕ мешает защите: пока она идёт, враг по-прежнему успевает
 * поднять щит и сбить каст игрока. Она гейтит только атаку.
 */
const ENEMY_CAST_GAP = 0.4;

export class EnemyAI {
  /**
   * @param {Combatant} self
   * @param {Combatant} foe
   * @param {object} profile
   * @param {object} opts { bossId, pace } — механика босса и темп рисования
   */
  constructor(self, foe, profile = {}, opts = {}) {
    this.self = self;
    this.foe = foe;
    this.profile = {
      aggression: 0.5,
      patience: 0.5,
      reflex: 0.5,
      discipline: 0.85,
      patternPref: [1, 1, 1, 0.4, 0.1],
      ...profile,
    };

    // Темп рисования знака.
    //
    // Знак — это то, что игрок читает и на что реагирует, поэтому
    // режимы трогают только его. 1/3 — знак выводится втрое дольше,
    // и на это время появляется дополнительное окно на разгадку.
    //
    // Урон, здоровье, мана и скорость фазы каста после рисунка не
    // меняются: у врага остаются те же цифры.
    this.pace = opts.pace ?? 1;

    // Остаток паузы между заклинаниями. Обнуляется только темпом:
    // отсчёт идёт, когда враг не кастует.
    this.castGap = 0;

    this.state = 'idle';         // idle | drawing | casting | shielding | recovering
    this.timer = 0;
    this.decisionCooldown = 0;
    this.shieldHoldTime = 0;     // сколько враг держит щит (чтобы не застрять в нём)
    this.drawnPoints = [];       // точки, которые "рисует" враг (для отрисовки)
    this.targetSigil = null;
    this.drawProgress = 0;
    this.lastDecision = null;
    this.intent = null;          // 'attack' | 'defend' | 'bait'

    // Откат быстрых кастов. Задаёт ТЕМП уникальной угрозы, к которой
    // нужен именно щит. Без него проверка вызывалась каждый кадр,
    // вероятность накапливалась, и враг прерывал почти каждый свой
    // рисунок — игрок не видел, что кастуется (см. think()).
    // Стартовое значение даёт врагу договорить первый символ.
    this.instantTimer = 3 + Math.random() * 3;

    // --- Поля для уникальных механик боссов ---
    this.bossId = opts.bossId || null;   // ID механики босса
    this.mirrorCharge = 0;               // накопленный "отражённый" символ
    this.fakeCastTimer = 0;              // ложный замах (босс 20)
    this.burnAuraTimer = 0;              // аура поджога (босс 40)
    this.freezeBuildup = 0;              // накопление заморозки (босс 50)
  }

  /** Строит траекторию рисования для символа (для визуализации). */
  buildStrokePath(sigil) {
    // Преобразуем последовательность направлений в ломаную линию.
    const dirVec = (d) => {
      const a = (d * Math.PI) / 4;
      return { x: Math.cos(a), y: Math.sin(a) };
    };
    const pts = [{ x: 0, y: 0 }];
    let cx = 0, cy = 0;
    const step = 1; // нормализованные единицы
    for (const d of sigil.pattern) {
      const v = dirVec(d);
      cx += v.x * step;
      cy += v.y * step;
      pts.push({ x: cx, y: cy });
    }
    return pts;
  }

  /**
   * Ключевая механика: ВРАГ БЬЁТ БЕЗ ПОДГОТОВКИ.
   *
   * Замер показал фундаментальный изъян прежней схемы: искра игрока
   * кастуется 0.10 с, а самый быстрый чужой каст — 0.55 с. Игрок успевал
   * сбить ЛЮБОЕ заклинание, поэтому щит не был нужен ни на одном уровне
   * (0.0 ситуаций «сбить нечем» на всех проверенных уровнях).
   *
   * Решение: у части кастов врага ЕСТЬ короткая вспышка-предупреждение,
   * но нет фазы рисования символа. Сбить такой каст искрой нельзя —
   * искра (0.10 с) не успевает, а окно ответа меньше времени её каста.
   *
   * Важно: каст НЕ должен быть невидимым. Игрок обязан успеть понять,
   * что произошло, иначе это не тактика, а нечестная лотерея. Поэтому:
   *   - вспышка видна и окрашена в цвет опасности;
   *   - её длительность (0.55 с) меньше времени каста искры (0.10 с)
   *     плюс реакции, то есть сбить НЕЛЬЗЯ, но поднять щит — можно;
   *   - урон повышен (×1.15), у каста отдельный откат 5.5 с.
   *
   * Это ЕДИНСТВЕННАЯ атака, от которой щит защищает надёжно, поэтому
   * именно она делает чередование щита и заклинаний необходимым:
   *   - увидел рисование символа → сбивай искрой или бей сам;
   *   - увидел вспышку → поднимай щит, сбить не успеешь.
   *
   * Частота растёт с уровнем врага: ранние бои учат читать символы,
   * поздние требуют мгновенной реакции щитом.
   */
  canSurpriseCast() {
    const p = this.profile;
    const self = this.self;
    // Частота быстрых кастов — ключ к тому, чтобы щит стал нужен.
    //
    // Замеры показали вилку:
    //   шанс 0.5 и откат 2.6 с → враг бьёт неотбиваемо каждые 3-4 секунды,
    //     игрок проигрывает при любой тактике;
    //   шанс 0.06-0.18 (было)  → механика почти не встречается,
    //     искра всегда успевает, щит не нужен ни разу за бой.
    //
    // Рабочая точка: примерно каждые 8-10 секунд, то есть 4-6 раз за бой.
    // Этого достаточно, чтобы игрок держал ману на щит и следил за
    // вспышкой, но не настолько часто, чтобы бой стал лотереей.
    //
    // Частота растёт с уровнем врага: ранние бои учат читать символы,
    // поздние требуют мгновенной реакции щитом.
    const levelGate = Math.min(1, Math.max(0, (self.level - 2) / 20));
    const chance = levelGate * (0.22 + p.aggression * 0.25);
    return Math.random() < chance;
  }

  /**
   * Быстрый каст: вспышка без рисования символа.
   *
   * Время каста намеренно БОЛЬШЕ, чем у искры игрока (0.10 с), но БОЛЬШЕ
   * и порога реакции: игрок не успевает ответить искрой, потому что к
   * моменту, когда он понял, что это за каст, тот уже завершён. Зато
   * щит, поднятый ЗАРАНЕЕ или в момент вспышки, успевает встать.
   *
   * Проще говоря: искрой это не сбить, щитом — можно.
   */
  instantCast(sigil) {
    const self = this.self;
    if (self.shieldUp) return false;

    // Если идёт быстрый каст — не перезапускаем его.
    // Без этой проверки think() при каждом кадре сбрасывал elapsed на 0,
    // и быстрый каст никогда не завершался (начинался 48 раз за бой,
    // завершался 0 раз).
    if (self.casting?.sigil?.instant) return false;

    const cost = Math.round(sigil.manaCost * 1.4);
    if (self.mana < cost) return false;
    if (!self.isReady('instant')) return false;

    // Быстрый каст ЗАМЕНЯЕТ текущую подготовку: враг бросает начатый
    // символ и бьёт без предупреждения. Без этого механика почти никогда
    // не срабатывала — замер показал, что враг проводит в состоянии
    // 'casting' около 75% времени, и проверка «уже кастую» блокировала
    // быстрый каст почти всегда (0 успехов из 23 попыток).
    self.casting = null;
    this.drawProgress = 0;
    this.targetSigil = null;
    this.state = 'casting';
    // Мгновенный каст уважает общую паузу так же, как обычный: иначе
    // в момент, когда его откат освобождается, враг мог бы бить
    // мгновенным и тут же начать новый рисунок — два удара впритык.
    this.castGap = ENEMY_CAST_GAP;

    self.mana -= cost;
    // Откат на быстрые касты. Держим его заметным: это редкий приём,
    // а не основной способ наносить урон.
    self.cooldowns['instant'] = 5.5;
    // Время быстрого каста — окно реакции игрока.
    //
    // Замер (tools/reaction-window.mjs): при 0.35 с от вспышки до удара
    // остаётся всего 0.15 с чистого времени на решение — человеческая
    // реакция (0.2 с) в это окно не укладывается. То есть щит формально
    // успевал, но на практике механика была нечестной.
    //
    // 0.55 с даёт 0.35 с на реакцию: игрок видит вспышку, узнаёт её
    // и успевает поднять щит. При этом сбить искрой всё равно нельзя —
    // искра кастуется 0.10 с и требует, чтобы игрок уже начал её до
    // вспышки, а порог прерывания у каста 0.9 означает, что он уязвим
    // лишь в последние 10% времени.
    const CAST_TIME = 0.55;
    self.casting = {
      sigil: { ...sigil, instant: true, damage: Math.round(sigil.damage * 1.15) },
      elapsed: 0,
      total: CAST_TIME,
      // Уязвим лишь в самом конце: сбить искрой не успеть.
      interruptThreshold: 0.9,
    };
    return true;
  }

  /** Выбирает символ для каста с учётом маны, откатов, характера и ситуации. */
  /**
   * Максимальный ранг символа, доступный врагу на его уровне.
   *
   * Враг подчиняется ТОЙ ЖЕ прогрессии, что и игрок (см. sigilsForLevel).
   * До этого правила враг выбирал символы только по мане и уже на 1-м
   * уровне мог бросить ранг IV на 76 урона в игрока с 118 HP.
   *
   * @returns {number} 1..5
   */
  tierCap() {
    const lv = this.self.level;
    if (lv <= 2) return 1;
    if (lv <= 5) return 2;
    if (lv <= 10) return 3;
    if (lv <= 16) return 4;
    return 5;
  }

  chooseSigil() {
    const p = this.profile;

    // ВРАГ ТОЖЕ ОГРАНИЧЕН РАНГОМ ПО УРОВНЮ.
    //
    // Раньше здесь был фильтр только по мане, и получалась грубая
    // асимметрия. Замер (tools/campaign-run.mjs):
    //
    //   уровень 1: враг мог скастовать ранг IV (76 урона),
    //              у игрока 118 HP и доступен только ранг I.
    //              Один удар = 64% здоровья игрока.
    //   босс 10:   враг бросал «Сифон» (52 урона, ранг IV),
    //              игрок ограничен рангом III с HP 181.
    //
    // Из-за этого кампания обрывалась: оба независимых инструмента
    // (campaign-run.mjs и режим кампании в playable.mjs) показали
    // смерть на 10-м уровне почти в каждом прохождении.
    //
    // Теперь враг подчиняется тем же правилам прогрессии, что и игрок:
    // сила растёт вместе с уровнем, а не обгоняет её.
    const tierCap = this.tierCap();

    const available = SIGIL_LIST.filter(
      (s) => s.manaCost <= this.self.mana * 0.95 && this.self.isReady(s.id)
        && s.tier <= tierCap
    );
    if (!available.length) return null;

    // Взвешиваем по предпочтению ранга и ситуативности.
    const foeShield = this.foe.shieldUp;
    const foeLowMana = this.foe.manaRatio < 0.3;
    const selfLowHp = this.self.hpRatio < 0.35;

    const weights = available.map((s) => {
      let w = p.patternPref[Math.min(4, s.tier - 1)] || 0.1;

      // Если враг под щитом — бесполезно бить слабым, нужен пробой или ждать.
      if (foeShield) {
        if (s.effect?.shieldPierce) w *= 3.0;
        else if (s.kind === 'drain' || s.kind === 'control') w *= 1.6;
        else w *= 0.25;
      }
      // Если у врага мало маны — давим, не давая восстановиться.
      if (foeLowMana && this.profile.patience > 0.6) w *= 1.8;
      // Если сам на грани — лечимся.
      if (selfLowHp && s.kind === 'heal') w *= 6.0;
      if (selfLowHp && s.kind === 'buff') w *= 2.0;
      // Не тратить последнюю ману на слабый каст.
      if (this.self.manaRatio < 0.25 && s.manaCost > this.self.maxMana * 0.3) w *= 0.3;

      // Скромный символ не должен забивать тяжёлые касты.
      //
      // Замер: враг завершал 38-50 кастов за бой, но наносил лишь
      // 142-362 урона — около 3.8 за каст. Причина в том, что на низкой
      // мане фильтр выше оставлял только дешёвые символы, и враг
      // беспрерывно бросал искры по 6 урона.
      //
      // Ранг I — инструмент для сбивания и добивания, а не основной удар.
      // Вес снижен, чтобы враг предпочитал копить ману на серьёзный символ.
      if (s.tier === 1 && this.self.manaRatio > 0.35) w *= 0.25;

      return { s, w };
    });

    const total = weights.reduce((a, x) => a + x.w, 0);
    if (total <= 0) return available[0];
    let roll = Math.random() * total;
    for (const x of weights) {
      roll -= x.w;
      if (roll <= 0) return x.s;
    }
    return weights[weights.length - 1].s;
  }

  /**
   * Уникальные механики боссов.
   *
   * Каждая меняет ВЫБОР игрока, а не просто увеличивает числа.
   * Возвращает событие для отображения игроку, если что-то сработало.
   */
  updateBossMechanic(dt) {
    const self = this.self;
    const foe = this.foe;

    // Финальный босс владеет всеми механиками по очереди.
    // Важно: механика не должна полностью блокировать обычные решения,
    // иначе босс становится пассивным. Поэтому здесь применяется ровно
    // ОДНА механика за вызов, а не все сразу.
    if (this.bossId === 'all') {
      const keys = ['mirror', 'mana_punish', 'burn_aura', 'freeze_buildup', 'mana_drain', 'feint'];
      this.allIndex = (this.allIndex || 0) % keys.length;
      const key = keys[this.allIndex];
      this.allIndex++;

      const saved = this.bossId;
      this.bossId = key;
      let ev = null;
      try {
        ev = this.updateBossMechanic(dt);
      } finally {
        this.bossId = saved;
      }
      // Если механика ничего не сделала — не мешаем обычной логике ИИ.
      if (ev) return ev;
      return null;
    }

    switch (this.bossId) {
      // --- Босс 20: ложный замах ---
      // Босс делает вид, что кастует тяжёлое заклинание, и игрок тратит
      // щит или искру впустую. Наказывает за рефлекторную игру щитом.
      case 'feint': {
        this.fakeTimer = (this.fakeTimer || 0) - dt;
        if (this.fakeTimer > 0) {
          // Ложный замах активен: игрок видит «рисование», но каста не будет.
          //
          // Таймер следующей попытки ТОЖЕ тикает, пока идёт замах.
          //
          // Раньше он отсчитывался только в ветке ниже, после замаха:
          // за 0.9 с замаха накапливалось отставание, а при частых
          // замахах таймер уходил в минус и «съедал» следующие попытки.
          // Замер: 0.7 ложных замаха за 90-секундный бой вместо ~12.
          this.fakeCastTimer = (this.fakeCastTimer || 0) - dt;
          this.state = 'drawing';
          this.targetSigil = this.fakeSigil;
          this.strokePath = this.buildStrokePath(this.fakeSigil);
          this.drawProgress = Math.min(0.85, 1 - this.fakeTimer / 0.9);
          const path = this.strokePath;
          const idx = this.drawProgress * (path.length - 1);
          this.drawnPoints = path.filter((_, i) => i <= idx);
          // Сброс состояния — на СЛЕДУЮЩЕМ кадре, когда таймер уже <= 0.
          //
          // Раньше проверка стояла здесь же, сразу после уменьшения таймера:
          //     if (this.fakeTimer > 0) { ...; if (this.fakeTimer <= 0) {...} }
          // Условие входа противоречило условию сброса, поэтому ветка была
          // недостижима, а state навсегда оставался 'drawing'.
          this.justFeinted = true;
          return null;
        }
        // Ноль вместо отрицательного значения: таймер отсчитывается заново.
        this.fakeTimer = 0;
        // Замах закончился — возвращаем босса к обычной жизни.
        if (this.justFeinted) {
          this.justFeinted = false;
          this.state = 'idle';
          this.targetSigil = null;
          this.drawProgress = 0;
          this.drawnPoints = [];
          this.decisionCooldown = 0.4;
        }
        this.fakeCastTimer = (this.fakeCastTimer || 0) - dt;
        if (this.fakeCastTimer <= 0) {
          this.fakeCastTimer = 5 + Math.random() * 4;
          if (Math.random() < 0.55) {
            // Ранг ограничен той же прогрессией, что и у обычных кастов:
            // иначе механика в обход правила бросала бы символы, которых
            // у врага на этом уровне быть не должно.
            //
            // МАНА. Здесь раньше стояло условие `self.mana >= s.manaCost`,
            // и механика почти не работала: замер показал 10 провалов из
            // 12 попыток за 90-секундный бой с маной 1-31 при цене
            // тяжёлого символа 36. Причина — босс тратит ману на обычные
            // касты быстрее, чем успевает накопить на Ранг IV.
            //
            // Это ложный замах: настоящего заклинания не будет, мана на
            // него не нужна. Требование денег за то, что не покупается,
            // и было причиной молчания механики. Доступность тяжёлых
            // символов по рангу сохранена — проверка ниже.
            const heavy = SIGIL_LIST.filter(
              (s) => s.tier >= 4 && s.tier <= this.tierCap()
            );
            if (heavy.length) {
              // ВАЖНО: замах ПРЕРЫВАЕТ собственный каст босса.
              //
              // Без этого механика не срабатывала вообще: условие требовало
              // `!self.casting`, а босс занят кастом 99.9% времени (замер
              // tools/feint-why.mjs). Ложный замах — это и есть отмена
              // собственного каста ради обмана, поэтому сбрасываем его сами.
              // Иначе Курогами терял свою единственную особенность.
              if (self.casting) {
                self.casting = null;
                this.drawProgress = 0;
                this.targetSigil = null;
              }
              this.fakeSigil = heavy[Math.floor(Math.random() * heavy.length)];
              this.fakeTimer = 0.9;
              return { type: 'boss_feint', text: 'Курогами делает ложный замах — не тратьте щит!' };
            }
          }
        }
        break;
      }

      // --- Босс 40: аура поджога ---
      // Пока горит, у игрока не восстанавливается мана. Это прямо
      // наказывает за долгую игру в щите: мана не вернётся, и щит упадёт.
      case 'burn_aura': {
        this.burnAuraTimer -= dt;
        if (this.burnAuraTimer <= 0) {
          this.burnAuraTimer = 7 + Math.random() * 4;
          if (!foe.hasEffect('burn')) {
            foe.addEffect('burn', { duration: 4, dmg: 2.5 });
            return { type: 'boss_burn', text: 'Пламя обвивает вас — мана не восстанавливается!' };
          }
        }
        break;
      }

      // --- Босс 50: накопление заморозки ---
      // Заморозка копится и срабатывает в самый неудобный момент,
      // обрывая рисунок символа на середине.
      case 'freeze_buildup': {
        this.freezeBuildup += dt;
        if (this.freezeBuildup >= 9) {
          this.freezeBuildup = 0;
          foe.addEffect('freeze', { duration: 1.6 });
          return { type: 'boss_freeze', text: 'Лед сковывает ваши руки!' };
        }
        break;
      }

      // --- Босс 60: вытягивание маны ---
      // Щит здесь — ловушка: он тратит ману, а босс её ещё и крадёт.
      case 'mana_drain': {
        this.drainTimer = (this.drainTimer || 0) - dt;
        if (this.drainTimer <= 0) {
          this.drainTimer = 5;
          const stolen = Math.min(foe.mana, 18);
          if (stolen > 1) {
            foe.mana -= stolen;
            self.mana = Math.min(self.maxMana, self.mana + stolen * 0.8);
            return { type: 'boss_drain', text: 'Пустой Трон выпивает вашу ману!', amount: stolen };
          }
        }
        break;
      }

      // --- Босс 30: ждёт просадки маны ---
      // Босс не атакует, пока у игрока много маны, но обрушивается,
      // как только та просела. Требует держать ману под контролем.
      case 'mana_punish': {
        this.punishTimer = (this.punishTimer || 0) - dt;
        if (this.punishTimer <= 0 && foe.manaRatio < 0.4) {
          this.punishTimer = 6;
          const heavy = SIGIL_LIST.filter(
            (s) => s.tier >= 3 && s.tier <= this.tierCap() && self.mana >= s.manaCost
          );
          if (heavy.length && !self.casting && !self.shieldUp) {
            const pick = heavy[heavy.length - 1];
            const r = self.startCast(pick);
            if (r.ok) {
              this.state = 'casting';
              return { type: 'boss_punish', text: 'Голос Бури обрушивается на вас!', sigil: pick };
            }
          }
        }
        break;
      }

      // --- Босс 10: зеркало ---
      // Копирует последний символ игрока, но усиленным.
      case 'mirror': {
        // Юмэ повторяет ВАШ последний символ — и этим наказывает за
        // предсказуемость. Механика читает реальную историю применённых
        // заклинаний (combat.js), а не отдельное поле: раньше здесь
        // стояло this.lastPlayerSigil, которое нигде не заполнялось,
        // поэтому босс не скопировал ни одного символа за бой
        // (замер: 0 зеркал), и его главная способность была мертва.
        this.mirrorTimer = (this.mirrorTimer || 0) - dt;
        if (this.mirrorTimer <= 0 && !self.casting && !self.shieldUp) {
          // Берём последний ЗАВЕРШЁННЫЙ символ игрока. Щит не копируем:
          // это не заклинание, и повторять его бессмысленно.
          const last = [...foe.history].reverse().find((h) => h.sigil && h.sigil.damage > 0);
          if (last?.sigil) {
            this.mirrorTimer = 7;
            // Отражённый символ бьёт ослабленно (60%).
            //
            // Без этого послабления механика наказывала игрока его же
            // сильнейшим заклинанием в полную силу: замер показывал 26%
            // всего урона босса из «зеркал», и бой превращался в наказание
            // за хорошую игру — чем сильнее игрок кастует, тем больнее
            // получает. 60% сохраняют угрозу и читаемость («босс повторяет
            // ваш символ!»), но оставляют игроку возможность выиграть.
            const mirrored = {
              ...last.sigil,
              damage: Math.round(last.sigil.damage * 0.6),
              mirrored: true,
            };
            const r = self.startCast(mirrored);
            if (r.ok) {
              this.state = 'casting';
              return {
                type: 'boss_mirror',
                text: `Хранительница повторяет ваш символ: ${last.sigil.name}!`,
                sigil: mirrored,
              };
            }
          }
        }
        break;
      }

      default:
        break;
    }
    return null;
  }

  /** Главный цикл принятия решений. */
  think(dt) {
    const self = this.self;
    const foe = this.foe;

    if (!self.alive || !foe.alive) { this.state = 'idle'; return; }
    if (self.isStunned || self.isFrozen) { this.state = 'idle'; return; }

    // КРИТИЧНО: если враг уже рисует символ, решения принимать нельзя.
    // Без этой проверки think() каждый кадр перезапускал beginDraw(),
    // обнулял drawProgress, и враг никогда не мог завершить ни одного
    // заклинания — бой превращался в избиение.
    //
    // ИСКЛЮЧЕНИЕ: быстрый каст (без подготовки) может прервать рисование.
    // Иначе он почти никогда не срабатывает: замер показал, что враг
    // проводит в рисовании и касте ~95% времени, и эта проверка съедала
    // все возможности ударить неожиданно (0 срабатываний на 12 попыток).
    //
    // ВАЖНО: проверка ограничена ОТКАТОМ, а не только вероятностью.
    //
    // Раньше здесь стоял просто `if (this.canSurpriseCast())`, и проверка
    // вызывалась КАЖДЫЙ КАДР, пока идёт рисование. Вероятность накапливалась:
    // при шансе 0.32 за кадр и рисунке 1.2 с (72 кадра) вероятность прервать
    // рисунок равна 1-(1-0.32)^72 ≈ 100%.
    //
    // Замер это подтвердил: враг на 20-м уровне прерывал ВСЕ 5 из 5
    // рисунков, ни один символ не был дорисован до конца, и игрок
    // физически не мог увидеть, что враг кастует, — а задание требует
    // именно «угадать, какое будет заклинание».
    //
    // Теперь частота задаётся временем: не чаще одного раза в
    // instantCooldown секунд. Расчётный темп — 4-6 быстрых кастов
    // за бой, как и задумано в комментарии к canSurpriseCast().
    this.instantTimer = (this.instantTimer || 0) - dt;
    if (this.state === 'drawing') {
      if (this.instantTimer <= 0 && this.canSurpriseCast()) {
        const sigil = this.chooseSigil();
        if (sigil && this.instantCast(sigil)) {
          this.intent = 'attack';
          this.decisionCooldown = 0.2;
          // Откат быстрых кастов: 6-9 с в зависимости от характера.
          //
          // Значение подобрано замером. При 9-12 с игра стала заметно
          // легче (боссы 65-100% побед, бой на 20-м боссе сократился
          // с 15 до 7 секунд): именно эти касты нельзя сбить, и они
          // составляют основную угрозу. При 6-9 с винрейт боссов
          // возвращается к 45-95%, а доля неизбежного урона — к 25-35%.
          this.instantTimer = 6.5 - this.profile.aggression * 2 + Math.random() * 1.5;
          return { type: 'instant_cast', sigil };
        }
      }
      return;
    }

    if (self.casting) { this.state = 'casting'; return; }

    this.decisionCooldown -= dt;
    if (this.decisionCooldown > 0) return;
    // Не даём счётчику уходить глубоко в минус: это признак того,
    // что решения давно не принимались, и маскирует зависания логики.
    this.decisionCooldown = 0;

    const p = this.profile;

    // --- Приоритет 1: реагировать на опасный каст игрока ---
    if (foe.casting) {
      const tier = foe.casting.sigil.tier;
      const progress = foe.casting.elapsed / foe.casting.total;
      // Чем выше ранг, тем важнее отреагировать.
      const threat = tier / 5;
      const reactChance = p.reflex * (0.45 + threat * 0.85) * (1 - progress * 0.7);

      if (Math.random() < reactChance) {
        if (self.shieldUp) {
          this.intent = 'defend';
          this.decisionCooldown = 0.35;
          return;
        }
        // Есть ли время сбить дешёвым символом? Проверяем и откат искры:
        // если она на перезарядке, сбить нечем.
        const sparkReady = self.isReady(SIGILS.spark.id) && self.isReady(SIGILS.pebble.id);
        const canInterrupt = tier >= 3 && sparkReady && self.mana >= SIGILS.spark.manaCost
          && Math.random() < 0.4 + p.aggression * 0.45;
        if (canInterrupt) {
          this.beginDraw(SIGILS.spark);
          this.intent = 'attack';
          return;
        }
        // Иначе — щит.
        if (self.mana >= SHIELD_SIGIL.manaCost * 1.4) {
          this.raiseShield();
          this.intent = 'defend';
          this.decisionCooldown = 0.4;
          return;
        }
      }
    }

    // --- Приоритет 2: если сам под щитом — решить, держать или снять ---
    //
    // ВАЖНО: щит не должен быть вечным состоянием. Если враг поднимет щит
    // и не будет опускать его, пока хватает маны, бой выродится в патую:
    // враг не атакует, игрок безнаказанно бьёт. Поэтому у щита есть
    // ограниченное время удержания, зависящее от терпения врага.
    if (self.shieldUp) {
      this.state = 'shielding';
      this.shieldHoldTime += dt;

      const manaPressure = self.manaRatio;
      const foeIsShielding = foe.shieldUp;
      // Терпеливый враг держит щит дольше, но не бесконечно.
      const maxHold = 2.2 + p.patience * 3.2;
      // Снимаем щит, если: вышло время, кончается мана, или игрок сам ушёл в щит.
      const shouldLower =
        this.shieldHoldTime >= maxHold ||
        manaPressure < 0.22 ||
        (foeIsShielding && self.manaRatio < 0.65);

      if (shouldLower) {
        self.lowerShield();
        this.shieldHoldTime = 0;
        // Небольшая пауза после снятия — окно, в которое игрок может ударить.
        this.decisionCooldown = 0.18 + Math.random() * 0.25;
      }
      return;
    }
    this.shieldHoldTime = 0;

    // --- Приоритет 3: выманивание (baiting). Умные враги ждут просадки игрока ---
    if (p.patience > 0.55 && foe.shieldUp && foe.manaRatio > 0.45) {
      // Игрок сидит в щите и ещё не просел — ждём, не тратим ману.
      this.intent = 'bait';
      this.decisionCooldown = 0.3;
      // Восстанавливаем ману, изредка подкалываем дешёвым кастом, чтобы не дать расслабиться.
      if (self.manaRatio > 0.8 && Math.random() < 0.25) {
        const s = SIGILS.spark;
        if (self.mana >= s.manaCost) { this.beginDraw(s); return; }
      }
      return;
    }

    // --- Приоритет 4: собственная защита при низком HP ---
    if (self.hpRatio < 0.3 && Math.random() < 0.35 + p.patience * 0.3) {
      if (self.mana >= SHIELD_SIGIL.manaCost * 2) {
        this.raiseShield();
        this.intent = 'defend';
        this.decisionCooldown = 0.5;
        return;
      }
    }

    // --- Приоритет 5: атака ---
    //
    // Перед атакой выдерживаем фиксированную паузу после прошлого
    // каста. Стоит именно здесь, а не в начале think(): оборонные
    // ветки выше (щит, сбивание каста игрока) должны работать всегда.
    // Враг в паузе не бездействует — он продолжает следить за игроком.
    if (this.castGap > 0) {
      this.castGap -= dt;
      this.state = 'idle';
      return;
    }
    //
    // ВАЖНО: перед атакой враг проверяет, не тратит ли он ману впустую.
    //
    // Замер показал катастрофу: враг выбирал Ранг I в 90-97% кастов
    // и проводил 81-99% времени на низкой мане. Причина — он кастует
    // НЕПРЕРЫВНО, мана не успевает восстанавливаться, и позволить себе
    // он может только искру на 6 урона. Враг сам себя истощал и был
    // безобиден: игрок побеждал, вообще не защищаясь (щит 0.0 с).
    //
    // Порог 0.6 и запрет на ранги I-II ниже него заставляют врага копить
    // ману на серьёзный символ. Именно такой каст (Ранг III+) создаёт
    // угрозу, на которую игрок вынужден отвечать щитом.
    if (self.manaRatio < 0.6 && self.hpRatio > 0.35) {
      const best = this.chooseSigil();
      // Доступен только слабый символ — ждём, а не тратим ману.
      if (!best || best.tier <= 2) {
        this.intent = 'bait';
        this.state = 'idle';
        this.decisionCooldown = 0.25;
        return;
      }
    }

    // Решительность вместо броска кубика.
    //
    // Раньше здесь стояло `Math.random() < 0.35 + aggression*0.5`:
    // при агрессии 0.5 враг атаковал лишь в 60% решений, а в остальных
    // «думал». Замер показал результат: 29 кастов за 120 секунд (один
    // каст в 4.1 секунды), при том что рисование занимает 0.7 секунды.
    // Враг простаивал 83% времени, игрок всегда был свободен, и щит
    // не требовался ни разу — тактика чередования не работала.
    //
    // Теперь враг атакует почти всегда, а характер влияет на выбор
    // символа и на паузу между кастами, а не на сам факт атаки.
    // Порог 0.85 оставляет место для тактических пауз (накопление маны,
    // ожидание просадки игрока), но убирает бессмысленное бездействие.
    if (Math.random() < 0.85) {
      const sigil = this.chooseSigil();
      if (sigil) {
        // Мгновенный каст: сбить его искрой невозможно физически.
        // Это единственная ситуация, в которой спасает щит, — поэтому
        // игрок обязан держать ману на его активацию.
        //
        // Откат общий с проверкой во время рисования: иначе два места
        // независимо накручивали бы частоту, и быстрых кастов становилось
        // вдвое больше задуманного.
        if (this.instantTimer <= 0 && this.canSurpriseCast() && this.instantCast(sigil)) {
          this.state = 'casting';
          this.intent = 'attack';
          this.decisionCooldown = 0.2;
          this.instantTimer = 6.5 - this.profile.aggression * 2 + Math.random() * 1.5;
          return { type: 'instant_cast', sigil };
        }
        this.beginDraw(sigil);
        this.intent = 'attack';
        return;
      }
    }
    this.decisionCooldown = 0.18 + Math.random() * 0.3;
  }

  beginDraw(sigil) {
    this.targetSigil = sigil;
    this.state = 'drawing';
    this.drawProgress = 0;
    this.drawnPoints = [];
    this.strokePath = this.buildStrokePath(sigil);
    // Пауза отсчитывается от конца КАСТА, а не от начала рисунка:
    // рисунок и каст идут подряд, и только после них — тишина.
    this.castGap = ENEMY_CAST_GAP;
  }

  raiseShield() {
    const r = this.self.raiseShield();
    if (r.ok) {
      this.state = 'shielding';
      this.shieldHoldTime = 0; // отсчёт удержания начинается заново
    } else {
      this.state = 'idle';
    }
    this.decisionCooldown = 0.3;
  }

  /**
   * Обновление. Возвращает событие, если враг что-то завершил.
   * @returns {{type:string, sigil?:object}|null}
   */
  update(dt) {
    const self = this.self;

    // Уникальная механика босса срабатывает до обычных решений
    if (this.bossId) {
      const bossEvent = this.updateBossMechanic(dt);
      if (bossEvent) return bossEvent;
    }

    // ВАЖНО: think() может вернуть событие (например, быстрый каст).
    // Раньше возврат игнорировался, и дальше код перезаписывал только что
    // начатый быстрый каст обычным рисованием — механика не работала.
    const thinkEvent = this.think(dt);

    // Если враг только что начал быстрый каст, рисование не запускаем.
    if (thinkEvent && thinkEvent.type === 'instant_cast') {
      this.state = 'casting';
      this.targetSigil = null;
      this.drawProgress = 0;
      return thinkEvent;
    }

    if (this.state === 'drawing' && this.targetSigil) {
      // Скорость рисования зависит от ранга символа и характера.
      const base = 1 / (this.targetSigil.drawTime * 0.55);
      // Темп режима множится последним: он должен ослаблять и быстрые
      // символы, и медленные, иначе «Испытание» обгоняло бы врага,
      // который и так рисует дольше всех.
      // Темп режима множится последним: он должен замедлять и быстрые
      // символы, и медленные, иначе «Испытание» обгоняло бы врага,
      // который и так рисует дольше всех.
      const speed = base * (0.75 + this.profile.discipline * 0.5) * this.pace;
      this.drawProgress = Math.min(1, this.drawProgress + speed * dt);

      // Заполняем видимые точки по мере прогресса — игрок видит рисунок.
      const path = this.strokePath;
      const idx = this.drawProgress * (path.length - 1);
      this.drawnPoints = [];
      for (let i = 0; i < path.length; i++) {
        if (i <= idx) this.drawnPoints.push(path[i]);
        else if (i - 1 < idx) {
          const t = idx - (i - 1);
          const a = path[i - 1], b = path[i];
          this.drawnPoints.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        }
      }

      if (this.drawProgress >= 1) {
        // Враг не «распознаёт» собственный символ — он его и рисует.
        // Поэтому успех зависит от навыка (discipline), а не от повторного
        // прогона через распознаватель игрока. Иначе враг, рисующий
        // идеально, всегда получал бы отказ из-за различий в масштабе точек.
        //
        // На вероятность успеха влияют:
        //   discipline  — базовый навык (растёт с уровнем врага)
        //   ранг        — сложные символы срываются чаще
        //   дебаффы     — «Дымка» и заморозка мешают (accuracy < 1)
        const tierPenalty = (this.targetSigil.tier - 1) * 0.045;
        const base = 0.72 + this.profile.discipline * 0.3;
        const successChance = Math.max(0.15, Math.min(0.98,
          (base - tierPenalty) * (0.75 + self.accuracy * 0.25)
        ));
        const success = Math.random() < successChance;

        // Дочитали символ до конца: забираем его локально и чистим
        // состояние врага ОДНИМ действием, чтобы не осталось полей,
        // переживших свой этап.
        const finished = this.targetSigil;
        this.state = 'idle';
        // Раньше точки оставались в drawnPoints навсегда: картинка не
        // видна (рендер проверяет state === 'drawing'), но состояние
        // врало. На этом ломался замер окна реакции — он ждал, когда
        // точки исчезнут, а они не исчезали, и дальше первого символа
        // измерения не шло вовсе.
        this.drawnPoints = [];
        this.targetSigil = null;

        if (success) {
          const r = self.startCast(finished);
          if (r.ok) {
            this.state = 'casting';
            this.decisionCooldown = 0.15;
            return { type: 'cast_start', sigil: finished };
          }
          this.decisionCooldown = 0.3;
          return { type: 'cast_failed', sigil: finished, reason: r.reason };
        }
        // Ошибся в рисовании — короткая заминка, уязвим.
        this.decisionCooldown = 0.5 + Math.random() * 0.5;
        return { type: 'draw_failed', sigil: finished };
      }
    }
    return null;
  }
}
