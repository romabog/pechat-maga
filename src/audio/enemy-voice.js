/**
 * ОЗВУЧКА МОЩНЫХ ЗАКЛИНАНИЙ СТРАЖЕЙ.
 *
 * Голос остался только у СЕМИ СТРАЖЕЙ и только для заклинаний, на
 * которые игрок обязан среагировать — высоких рангов. Смысл в том,
 * чтобы звук был не украшением, а предупреждением: если страж заговорил,
 * значит сейчас прилетит что-то, что нужно отразить или сбить.
 *
 * Рядовые враги молчат. Их касты быстрые и частые — если озвучивать
 * каждый, получается не атмосфера, а стрёкот, который перекрывает
 * музыку и мешает думать.
 *
 * ПОЧЕМУ СИНТЕЗ РЕЧИ, А НЕ ЗАПИСЬ.
 *   Игра — один HTML-файл, открываемый двойным щелчком с диска.
 *   Внешние звуковые файлы пришлось бы либо класть рядом (и тогда
 *   «один файл» перестаёт быть одним), либо вшивать в base64 — это
 *   сотни килобайт на каждую фразу. Браузерный синтез речи есть
 *   в любом современном браузере, работает офлайн и весит ноль.
 *
 * ЧТО ИМЕННО ПРОИЗНОСИТСЯ.
 *   Слова нарочно записаны русскими буквами и составлены из звуков,
 *   которые русский синтезатор читает предсказуемо: нет шипящих
 *   стыков, нет длинных согласных, много «а», «о», «э» и сонорных.
 */

/**
 * Начиная с какого ранга страж говорит.
 *
 * Порог IV выбран по механике, а не на слух: ранг III ещё сбивается
 * «искрой» (сам ИИ считает опасным каст с tier >= 3, см. enemy-ai.js),
 * а вот IV и V — это угроза, которую дешёвым символом не остановить.
 * Именно на них голос и работает как предупреждение.
 */
const SPEAK_MIN_TIER = 4;

/**
 * Слова стражей по рангам.
 *
 * Внутри ранга несколько вариантов: страж не должен повторять одно
 * слово, иначе голос превращается в заевшую пластинку.
 */
const WORDS_BY_TIER = {
  // Ранг IV — четыре слога с паузами.
  4: ['каэль-вор-наар-тиэль', 'эшша-нооль-маор-каэль', 'тиэль-наар-вор-эшша'],
  // Ранг V — полная формула, самое длинное и тяжёлое.
  5: ['каэль-вор-наар-тиэль-эшша', 'наар-тиэль-маор-нооль-каэль-вор'],
};

/**
 * Голос стража по его уровню.
 *
 * Питч и темп подобраны по силуэту: скальный великан басит, а
 * гиносфинкс говорит размеренно и высоко. Так семь стражей звучат
 * по-разному, хотя синтезатор у всех один и тот же.
 */
const VOICE_BY_BOSS = {
  10: { pitch: 0.85, rate: 0.95, volume: 0.80 },  // Кобольд-архижрец — мелкий, визгливый
  20: { pitch: 1.00, rate: 0.78, volume: 0.78 },  // Гиносфинкс — размеренный, высокий
  30: { pitch: 0.20, rate: 0.68, volume: 0.90 },  // Скальный великан — самый низкий
  40: { pitch: 0.30, rate: 0.74, volume: 0.88 },  // Ашардрагон — низкий рык
  50: { pitch: 0.35, rate: 0.80, volume: 0.86 },  // Тримвальд — низкий, ледяной
  60: { pitch: 0.55, rate: 0.72, volume: 0.84 },  // Тень Векны — глухой некромантский
  70: { pitch: 0.45, rate: 0.70, volume: 0.90 },  // Тиамат — тяжёлый, божественный
};

/** Значение по умолчанию, если страж не попал в таблицу. */
const VOICE_DEFAULT = { pitch: 0.5, rate: 0.8, volume: 0.82 };

/**
 * Дефис внутри выдуманного слова некоторые движки читают вслух как
 * «минус» или спотыкаются. Заменяем на короткую паузу-запятую: слово
 * звучит как формула, произнесённая по частям.
 */
function toSpoken(text) {
  return String(text).replace(/-/g, ', ');
}

export class EnemyVoice {
  constructor() {
    this.supported = typeof window !== 'undefined'
      && typeof window.speechSynthesis !== 'undefined'
      && typeof window.SpeechSynthesisUtterance !== 'undefined';

    this.enabled = true;
    this.volume = 0.6;
    this.lastWord = '';
    this.lastSpokeAt = 0;
    this.voice = null;
    this.picked = false;
    this.speaking = false;
  }

  /**
   * Выбрать системный голос.
   *
   * Список голосов в браузере заполняется асинхронно: при первом
   * обращении он часто пуст, а через долю секунды появляется.
   * Поэтому подписка на voiceschanged и повторная попытка.
   */
  pickVoice() {
    if (!this.supported || this.picked) return;
    let voices = [];
    try { voices = window.speechSynthesis.getVoices() || []; } catch { return; }
    if (!voices.length) return;

    // Русский голос, если он есть: слова записаны по-русски, и
    // английский синтезатор произнесёт их как кашу.
    const ru = voices.filter((v) => /^ru/i.test(v.lang || ''));
    const pool = ru.length ? ru : voices;

    // Локальный голос предпочтительнее: он работает без сети.
    this.voice = pool.find((v) => v.localService) || pool[0];
    this.picked = true;
  }

  init() {
    if (!this.supported) return;
    this.pickVoice();
    try {
      window.speechSynthesis.addEventListener('voiceschanged', () => {
        this.picked = false;
        this.pickVoice();
      });
    } catch {
      // Старые движки не поддерживают addEventListener на synthesis.
      window.speechSynthesis.onvoiceschanged = () => {
        this.picked = false;
        this.pickVoice();
      };
    }
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
  }

  setEnabled(on) {
    this.enabled = !!on;
    if (!this.enabled) this.stop();
  }

  stop() {
    if (!this.supported) return;
    try { window.speechSynthesis.cancel(); } catch { /* нечего отменять */ }
    this.speaking = false;
  }

  /** Слово для ранга, без повтора того же слова дважды подряд. */
  pickWord(tier) {
    const list = WORDS_BY_TIER[tier];
    if (!list || !list.length) return null;
    if (list.length === 1) return list[0];
    let word = list[Math.floor(Math.random() * list.length)];
    if (word === this.lastWord) {
      const others = list.filter((w) => w !== word);
      word = others[Math.floor(Math.random() * others.length)];
    }
    this.lastWord = word;
    return word;
  }

  /**
   * Заклинание стража.
   *
   * @param tier   ранг символа (1..5)
   * @param level  уровень стража — задаёт его голос
   * @param forced true — произнести это заклинание независимо от настроек
   *               и порога ранга (нужно для кнопки «проверить голос»)
   *
   * Возвращает true, если фраза действительно прозвучала. Рядовые
   * враги и слабые ранги отсекаются здесь же, поэтому вызывающей
   * стороне не нужно ничего проверять.
   */
  speak(tier, level, forced = false) {
    if (!this.supported || !this.enabled) return false;
    if (this.volume <= 0.001) return false;

    // Говорят только стражи и только про серьёзные заклинания.
    if (!VOICE_BY_BOSS[level]) return false;
    if (!forced && tier < SPEAK_MIN_TIER) return false;

    // Не даём фразам наезжать друг на друга: два каста подряд не
    // должны превратиться в гвалт.
    const now = (typeof performance !== 'undefined' && performance.now)
      ? performance.now() : Date.now();
    const gap = this.speaking ? 420 : 180;
    if (!forced && now - this.lastSpokeAt < gap) return false;

    this.pickVoice();

    const pr = VOICE_BY_BOSS[level] || VOICE_DEFAULT;
    const word = this.pickWord(Math.max(SPEAK_MIN_TIER, Math.min(5, tier)));
    if (!word) return false;

    let u;
    try {
      u = new window.SpeechSynthesisUtterance(toSpoken(word));
    } catch {
      return false;
    }

    u.lang = 'ru-RU';
    if (this.voice) u.voice = this.voice;
    u.pitch = pr.pitch;
    u.rate = pr.rate;
    u.volume = Math.max(0, Math.min(1, pr.volume * this.volume));

    u.onstart = () => { this.speaking = true; };
    u.onend = () => { this.speaking = false; };
    u.onerror = () => { this.speaking = false; };

    try {
      // Снимаем зависшие фразы: если предыдущая не вызвала onend
      // (бывает при сворачивании вкладки), очередь забивается.
      if (this.speaking) window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {
      this.speaking = false;
      return false;
    }

    this.lastSpokeAt = now;
    return true;
  }
}
