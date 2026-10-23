/**
 * БОЕВАЯ СИСТЕМА
 * ==============
 * Модель боя построена на одном напряжении:
 *
 *   Щит  ->  безопасно, но мана тает и ты не можешь колдовать.
 *   Каст ->  ты наносишь урон, но открыт и тратишь ману.
 *
 * Если держать щит постоянно — мана кончится, и ты останешься беззащитным
 * ровно в тот момент, когда враг кастует что-то тяжёлое.
 * Если кастовать бездумно — тебя прервут на полуслове.
 *
 * Поэтому побеждает тот, кто читает намерение противника:
 *   - видишь, что враг начал долгий Ранг IV — сбей дешёвой Искрой (Ранг I);
 *   - видишь быстрый Ранг I — не трать время на сбивание, ставь щит;
 *   - враг под щитом — копи ману и не жги её впустую.
 */

import { SIGILS, SHIELD_SIGIL, shieldUpkeep, pathToDirections, patternScore } from './sigils.js';

export const CONFIG = {
  baseMaxHp: 100,
  // Здоровье растёт заметно: символы высоких рангов наносят 46-190 урона,
  // и при 4 HP за уровень игрок умирал с трёх попаданий, не успевая
  // показать тактику. 7 за уровень даёт на 70 уровне 583 HP — бой длится
  // достаточно, чтобы чередование щита и каста успело сработать.
  maxHpPerLevel: 7,
  baseMaxMana: 100,
  // Запас маны растёт быстрее регена: к поздним боссам игроку нужно
  // «плечо» в 2-3 каста Ранга V подряд, иначе он вынужден кастовать
  // только дешёвые символы и проигрывает по темпу.
  maxManaPerLevel: 4,
  // Регенерация маны — главный ограничитель урона игрока.
  //
  // Подобрано по расчёту потолка урона: за 60 секунд боя игрок должен
  // суметь снять примерно 1.6 HP врага своего уровня, иначе боссы
  // становятся непобедимыми (замер: при 0.34/уровень боссы 60 и 70
  // требовали больше маны, чем игрок физически мог собрать).
  //
  // 0.42/уровень даёт на 70 уровне 36 маны/с — этого хватает, чтобы
  // «Суд Небес» (190 урона за 62 маны) был применим каждые ~2 секунды.
  manaRegenPerSecond: 7.5,
  manaRegenPerLevel: 0.42,
  // Пауза восстановления после каста.
  //
  // Снижена с 0.9 до 0.45 по результатам трассировки финального боя
  // (tools/final-boss-trace.mjs). При 0.9 мана у обоих бойцов почти
  // не восстанавливалась: игрок проводил с маной ниже 20 целых 82%
  // времени (в среднем 46 маны из 388) и простаивал 79% боя — не от
  // нехватки здоровья, а от нехватки ресурса. Бой превращался
  // в вялое перетягивание и мог не закончиться вовсе.
  //
  // Причина в том, что каст начинается часто, и каждый старт заново
  // запускал паузу: восстановление не успевало начаться. 0.45 оставляет
  // наказание за бездумный спам, но даёт ресурсу возвращаться.
  manaRegenDelayAfterCast: 0.45,
  shieldBreakStun: 1.5,         // оглушение, если щит пробит
  freezeDampen: 0.35,
  // Нарастающее истощение в затянувшемся бою.
  //
  // Замер tools/sim.mjs ловил бои, которые не заканчивались за 180 секунд:
  // оба бойца уходят в глухую защиту, щит не пробить, а на атаку не хватает
  // маны. Игрок при этом жив — бой не проигран, а просто не разрешается.
  //
  // Правило: после fatigueAfter секунд боя восстановление маны падает
  // на fatigueStep каждые fatigueEvery секунд, вплоть до fatigueMax.
  // Истощение двустороннее, но наказывает именно того, кто тянет:
  // без маны не поднять ни щит, ни атаку.
  //
  // Порог снижен с 60 до 35 секунд. После пересмотра силы стражей
  // (см. enemies.js) обычный бой идёт 10-25 секунд, а напряжённый —
  // до 40. При пороге 60 истощение включалось уже ПОСЛЕ того,
  // как бой успевал застрять, и один бой из 96 всё равно зависал.
  // 35 секунд означает: если бой тянется вдвое дольше обычного,
  // он начинает подталкиваться к развязке.
  fatigueAfter: 35,
  fatigueEvery: 12,
  fatigueStep: 0.15,
  fatigueMax: 0.45,
};

/**
 * Доля каста, после которой он становится уязвим к прерыванию уроном.
 *
 * Смысл: первые мгновения каста защищены — маг «схватил» энергию,
 * и сбить его можно только очень быстрым ударом. Ближе к завершению
 * каст становится хрупким, потому что энергия вот-вот вырвется наружу.
 *
 * Это создаёт настоящее тактическое решение: сбивать надо РАНО,
 * а если опоздал — остаётся только щит.
 * Значение небольшим: слишком высокий порог делает сбивание
 * невозможным для быстрых заклинаний и обесценивает Ранг I.
 */
export const CAST_INTERRUPT_THRESHOLD = 0.15;

/**
 * Сколько маны стоит заблокировать 1 единицу урона щитом.
 *
 * Значение 0.32 подобрано расчётом, а не на глаз. Чистый тест
 * (tools/shield-economy.mjs) показал, что при 1.15 щит был НЕВЫГОДЕН
 * в четыре раза: удар на 50 единиц требовал 70 маны на блок,
 * а те же 70 маны в «Суде Небес» давали 213 урона.
 *
 * Арифметика баланса:
 *   атака: 190 урона за 62 маны = 3.06 урона за ману
 *   щит:  1 урон за 0.32 маны = 3.13 «защиты» за ману
 *
 * То есть блокировка и атака примерно РАВНОЦЕННЫ по эффективности.
 * Это и делает выбор настоящим: закрыться или ударить — вопрос
 * ситуации, а не арифметики.
 *
 * Почему это не ломает игру в «стояние в щите»:
 *   1. Под щитом НЕЛЬЗЯ колдовать — атака останавливается полностью.
 *   2. Удержание стоит еще 9-48 маны в секунду в зависимости от уровня.
 *   3. Щит не убивает врага, поэтому «стоять в щите» — это проигрыш
 *      по времени, а не выигрышная стратегия.
 *   4. Пробой щита (shieldPierce) и разрыв от нехватки маны
 *      оставляют риск даже под защитой.
 *
 * Щит выгоден ровно тогда, когда удар сильнее вашего ответа:
 * против тяжёлого каста Ранга IV-V закрыться дешевле, чем обменяться.
 */
export const SHIELD_BLOCK_COST_PER_DAMAGE = 0.32;

export class Combatant {
  /**
   * @param {object} opts
   * @param {string} opts.name
   * @param {number} opts.level
   * @param {boolean} opts.isPlayer
   */
  constructor(opts) {
    this.name = opts.name || 'Безымянный';
    this.isPlayer = !!opts.isPlayer;
    this.level = opts.level || 1;

    this.maxHp = opts.maxHp ?? (CONFIG.baseMaxHp + CONFIG.maxHpPerLevel * (this.level - 1));
    this.hp = this.maxHp;
    this.maxMana = opts.maxMana ?? (CONFIG.baseMaxMana + CONFIG.maxManaPerLevel * (this.level - 1));
    this.mana = this.maxMana;

    this.shieldUp = false;
    this.casting = null;      // { sigil, elapsed, total, drawnPoints }
    this.drawing = null;      // { points } — текущий рисунок
    this.effects = [];        // активные эффекты
    this.stunTimer = 0;
    this.manaRegenLock = 0;
    this.battleTime = 0;
    this.alive = true;
    this.cooldowns = {};      // id символа -> оставшееся время отката

    this.history = [];        // последние применённые символы (для читаемости боя)
  }

  get hpRatio() { return Math.max(0, this.hp / this.maxHp); }
  get manaRatio() { return Math.max(0, this.mana / this.maxMana); }
  get isStunned() { return this.stunTimer > 0; }
  get isFrozen() { return this.hasEffect('freeze'); }
  get isBusy() { return !!this.casting; }

  hasEffect(type) { return this.effects.some((e) => e.type === type); }
  getEffect(type) { return this.effects.find((e) => e.type === type); }

  addEffect(type, data) {
    const existing = this.getEffect(type);
    if (existing) {
      existing.remaining = Math.max(existing.remaining, data.duration);
      Object.assign(existing.data, data);
    } else {
      this.effects.push({ type, remaining: data.duration, data: { ...data } });
    }
  }

  /** Точность распознавания символов с учётом дебаффов. */
  get accuracy() {
    let acc = 1;
    const fog = this.getEffect('accuracy');
    if (fog) acc += fog.data.accuracy; // accuracy отрицательный -> штраф
    if (this.isFrozen) acc -= 0.3;
    return Math.max(0.35, Math.min(1.15, acc));
  }

  // ---------------------------------------------------------------- мана
  canAfford(cost) { return this.mana >= cost; }

  spendMana(cost) {
    this.mana = Math.max(0, this.mana - cost);
    this.manaRegenLock = CONFIG.manaRegenDelayAfterCast;
  }

  /**
   * Списывает ману БЕЗ блокировки восстановления.
   *
   * Нужно для удержания щита: оно тикает каждый кадр, и если бы каждый
   * тик продлевал паузу восстановления, регенерация не возобновилась бы
   * никогда. Под щитом восстановление и так отключено отдельным условием
   * (см. canRegen ниже), поэтому дополнительная блокировка избыточна.
   */
  drainMana(cost) {
    this.mana = Math.max(0, this.mana - cost);
  }

  // ---------------------------------------------------------------- щит
  /**
   * Поднять щит. Требует символ щита.
   * Пока щит активен, casting запрещён — это и есть цена защиты.
   */
  raiseShield() {
    if (this.shieldUp) return { ok: false, reason: 'already' };
    if (this.isStunned || this.isFrozen) return { ok: false, reason: 'disabled' };
    if (!this.canAfford(SHIELD_SIGIL.manaCost)) return { ok: false, reason: 'mana' };
    this.spendMana(SHIELD_SIGIL.manaCost);
    this.shieldUp = true;

    // Уже начатый каст ДОВОДИТСЯ до конца, а не обнуляется.
    //
    // Здесь была ошибка, из-за которой щит был заведомо невыгоден:
    // поднятие щита обнуляло каст, и вся вложенная в него мана исчезала.
    // Замер (tools/playable.mjs, кампания) показал прямую зависимость:
    // игрок с щитом доходил до 3.5 уровня, без щита — до 6.3.
    // Защита обходилась дороже, чем урон, от которого спасала.
    //
    // Теперь щит — это решение о БУДУЩЕМ: текущее заклинание завершится,
    // но следующее начать уже нельзя, пока щит держится. Ограничитель
    // «под щитом нельзя колдовать» полностью сохраняется, но перестаёт
    // наказывать за уже потраченную ману.
    this.history.push({ id: 'shield', t: performance.now() });
    return { ok: true };
  }

  lowerShield() {
    if (!this.shieldUp) return { ok: false, reason: 'not_up' };
    this.shieldUp = false;
    return { ok: true };
  }

  // ---------------------------------------------------------------- перезарядка
  /** Остаток отката символа в секундах (0 — готов к применению). */
  cooldownLeft(sigilId) {
    return this.cooldowns[sigilId] || 0;
  }

  isReady(sigilId) {
    return this.cooldownLeft(sigilId) <= 0;
  }

  // ---------------------------------------------------------------- каст
  /**
   * Завершить рисование и запустить каст.
   * @returns {{ok:boolean, sigil?:object, reason?:string}}
   */
  startCast(sigil) {
    if (this.shieldUp) return { ok: false, reason: 'shield_up' };
    if (this.isStunned) return { ok: false, reason: 'stunned' };
    if (this.isFrozen) return { ok: false, reason: 'frozen' };
    if (this.casting) return { ok: false, reason: 'busy' };
    if (!this.isReady(sigil.id)) return { ok: false, reason: 'cooldown' };
    if (!this.canAfford(sigil.manaCost)) return { ok: false, reason: 'mana' };
    this.spendMana(sigil.manaCost);
    // Откат назначается сразу: символ нельзя спамить.
    if (sigil.cooldown) this.cooldowns[sigil.id] = sigil.cooldown;
    // Порог, с которого каст становится уязвим к прерыванию уроном.
    this.casting = { sigil, elapsed: 0, total: sigil.castTime, interruptThreshold: CAST_INTERRUPT_THRESHOLD };
    return { ok: true, sigil };
  }

  /**
   * Прервать каст (получен урон / сбит).
   *
   * ВАЖНО: часть маны возвращается. Без этого обнаружился дефект:
   * оба бойца непрерывно сбивали касты друг другу, мана уходила
   * «в пустоту» и не возвращалась, оба упирались в ноль и бой
   * никогда не заканчивался (11 зависаний из 96 в симуляции).
   *
   * Возврат 60%: сбивание остаётся наказанием (40% маны потеряно),
   * но не превращает бой в бесконечный обмен пустыми ударами.
   */
  interruptCast() {
    if (!this.casting) return false;
    const refund = Math.round(this.casting.sigil.manaCost * 0.6);
    this.mana = Math.min(this.maxMana, this.mana + refund);
    this.casting = null;
    return true;
  }

  // ---------------------------------------------------------------- урон
  /**
   * Нанести урон с учётом щита, отражения и пробития.
   * @returns {{applied:number, blocked:number, brokeShield:boolean, reflected:number}}
   */
  takeDamage(amount, opts = {}) {
    const result = { applied: 0, blocked: 0, brokeShield: false, reflected: 0 };
    let incoming = amount;

    if (this.shieldUp) {
      const pierce = opts.shieldPierce || 0;
      const through = incoming * pierce;
      const blockedPart = incoming - through;

      // Щит поглощает урон за счёт маны.
      //
      // БАЛАНС: блокировка специально НЕМНОГО выгоднее, чем принять удар,
      // но хуже, чем ударить самому. Это узкая, но важная разница:
      //
      //   Суд Небес: 190 урона за 62 маны = 3.06 урона/мана (атака)
      //   Щит: 1 заблокированный урон = 1.15 маны ≈ 0.87 урона/мана
      //
      // То есть атаковать по-прежнему выгоднее втрое — щит не становится
      // «основной стратегией». Но закрыться от удара теперь ДЕШЕВЛЕ,
      // чем принять его в лицо, поэтому щит перестаёт быть заведомо
      // убыточным и становится осмысленным ответом на угрозу.
      //
      // История подбора: при 1.6 маны/урон щит был дороже, чем просто
      // получить урон, и не использовался ни разу (2.4% времени) —
      // тактика чередования, требуемая по замыслу, не работала.
      const manaDrain = blockedPart * SHIELD_BLOCK_COST_PER_DAMAGE;
      if (this.mana >= manaDrain) {
        this.mana -= manaDrain;
        result.blocked = blockedPart;
      } else {
        // Маны не хватило — щит ломается, остаток проходит.
        const canBlock = this.mana / SHIELD_BLOCK_COST_PER_DAMAGE;
        result.blocked = canBlock;
        this.mana = 0;
        this.shieldUp = false;
        this.stunTimer = CONFIG.shieldBreakStun;
        result.brokeShield = true;
        incoming = blockedPart - canBlock + through;
      }
      if (!result.brokeShield) incoming = through;
    }

    const reflect = this.getEffect('reflect');
    if (reflect && incoming > 0) {
      result.reflected = incoming * reflect.data.ratio;
    }

    this.hp = Math.max(0, this.hp - incoming);
    result.applied = incoming;
    if (this.hp <= 0) this.alive = false;

    // Прерывание каста уроном — ключ к тактике «сбить чужое заклинание».
    //
    // Правила:
    //   1. Сбить можно только каст, который уже прошёл порог (см. константу).
    //      Сразу после начала каст «защищён» — успеть можно только очень
    //      быстрым заклинанием, и это осознанный риск.
    //   2. Чем выше ранг, тем легче сбить: тяжёлые символы держать труднее.
    //   3. Сила удара решает. Искра (6 урона) — ненадёжное сбивание,
    //      тяжёлый символ — почти гарантированное.
    //
    // Правило 3 — главный балансировщик роли Ранга I.
    //
    // Замеры показали вилку: при слабом влиянии силы удара искра сбивала
    // любой каст, щит не требовался ни разу (0.0 с за бой), и требуемое
    // по замыслу чередование щита и атак не работало. Жёсткий порог
    // («не меньше 8% HP») оказался другой крайностью: искра перестала
    // сбивать вообще, и Ранг I потерял смысл.
    //
    // Рабочая точка: искра сбивает примерно в трети случаев, поэтому
    // на неё нельзя положиться как на единственную защиту — но она
    // остаётся быстрым и дешёвым инструментом. Когда она не сработала
    // или враг кастует слишком быстро, остаётся щит.
    if (incoming > 0 && this.casting && !opts.ignoreInterrupt) {
      const progress = this.casting.elapsed / this.casting.total;
      const past = progress - this.casting.interruptThreshold;
      // Доля здоровья цели — честная мера «серьёзности» удара.
      const powerFactor = Math.min(1, (incoming / this.maxHp) * 3.2);

      if (past > 0) {
        const tierBonus = (this.casting.sigil.tier - 1) * 0.10;
        const progressFactor = Math.min(1, past / Math.max(0.1, 1 - this.casting.interruptThreshold));
        const chance = (0.30 + progressFactor * 0.35 + tierBonus) * powerFactor;
        if (Math.random() < Math.min(0.97, chance)) this.interruptCast();
      }
    }
    return result;
  }

  // ---------------------------------------------------------------- апдейт
  update(dt) {
    // Общее время боя — нужно для правила истощения (CONFIG.fatigueAfter).
    this.battleTime += dt;

    // Таймеры эффектов
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.remaining -= dt;
      if (e.remaining <= 0) this.effects.splice(i, 1);
    }
    if (this.stunTimer > 0) this.stunTimer = Math.max(0, this.stunTimer - dt);

    // Откаты символов
    for (const id of Object.keys(this.cooldowns)) {
      if (this.cooldowns[id] > 0) {
        this.cooldowns[id] = Math.max(0, this.cooldowns[id] - dt);
      }
    }

    // Щит: постоянный расход маны, растущий с уровнем (см. shieldUpkeep).
    if (this.shieldUp) {
      const upkeep = shieldUpkeep(this.level) * dt;
      this.mana -= upkeep;
      if (this.mana <= 0) {
        this.mana = 0;
        this.shieldUp = false; // мана кончилась — щит падает сам
      }
    }

    // Регенерация маны: не идёт под щитом и сразу после каста
    if (this.manaRegenLock > 0) this.manaRegenLock = Math.max(0, this.manaRegenLock - dt);
    const canRegen = !this.shieldUp && this.manaRegenLock <= 0 && !this.isFrozen;
    if (canRegen) {
      const regen = CONFIG.manaRegenPerSecond + CONFIG.manaRegenPerLevel * (this.level - 1);
      // Истощение в затянувшемся бою (см. CONFIG.fatigueAfter).
      //
      // Без этого правила поздние бои могли не закончиться никогда:
      // оба бойца уходили в защиту, щит не пробивался, а на атаку
      // не хватало маны. Истощение постепенно отнимает возможность
      // и защищаться, и атаковать, поэтому бой всегда приходит к развязке.
      let fatigue = 1;
      if (this.battleTime > CONFIG.fatigueAfter) {
        const steps = Math.floor((this.battleTime - CONFIG.fatigueAfter) / CONFIG.fatigueEvery);
        fatigue = Math.max(CONFIG.fatigueMax, 1 - steps * CONFIG.fatigueStep);
      }
      // Враги восстанавливают ману МЕДЛЕННЕЕ игрока.
      //
      // Без этого поздние боссы кастуют тяжёлые символы бесконечно:
      // у босса 70 уровня 1344 маны и реген 36/с, то есть «Суд Небес»
      // (62 маны) каждые две секунды без остановки. Бой превращался
      // в 110-секундный марафон, где игрок истощается первым.
      //
      // 0.7 — враг всё ещё опасен, но у него есть «вдохи» между тяжёлыми
      // кастами, и игрок успевает нанести урон.
      const regenMult = this.isPlayer ? 1.0 : 0.7;
      this.mana = Math.min(this.maxMana, this.mana + regen * regenMult * fatigue * dt);
    }

    // Прогресс каста
    if (this.casting) {
      // Медленный темп каста (режимы проще) — это множитель прогресса,
      // а не длины: так он работает и с заморозкой (freezeDampen),
      // и со станом (0), не трогая их отдельные правила.
      const speed = this.isFrozen ? CONFIG.freezeDampen : (this.isStunned ? 0 : 1);
      this.casting.elapsed += dt * speed;
    }
  }

  /** Возвращает завершённый символ, если каст дошёл до конца. */
  pollCompletedCast() {
    if (this.casting && this.casting.elapsed >= this.casting.total) {
      const s = this.casting.sigil;
      this.casting = null;

      // Запоминаем применённый символ.
      //
      // Это не только «для читаемости боя»: на истории строится механика
      // босса-«зеркала» (Юмэ, уровень 10), который повторяет ваш последний
      // символ. Раньше сюда попадал только щит, поэтому босс не мог
      // скопировать НИ ОДНОГО заклинания (0 зеркал за бой) — его главная
      // способность была мертва, и бой превращался в простой размен уроном.
      this.history.push({ id: s.id, sigil: s, t: performance.now() });
      if (this.history.length > 8) this.history.shift();

      return s;
    }
    return null;
  }
}
