/**
 * МУЗЫКА И ЗВУК
 * =============
 * Вся музыка синтезируется в браузере, без внешних файлов.
 * Основа китайской традиционной музыки:
 *   - пентатоника (лад гун): C D E G A — без полутонов, отсюда «открытое» звучание;
 *   - гуцинь/чжэн: щипковые арпеджио с быстрым затуханием;
 *   - эрху: смычковый, «поющий» тон с вибрато и плавным глиссандо;
 *   - дицзы (бамбуковая флейта): высокий дыхательный тон;
 *   - тайко/гонг: ударные для боевых сцен.
 *
 * Треки — это не зацикленные файлы, а генеративные секвенции, поэтому
 * они не надоедают и подстраиваются под интенсивность боя.
 */

const PENTATONIC = [0, 2, 4, 7, 9]; // полутоны от тоники

/** Частота ноты по MIDI-номеру. */
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

/** Простой реверб на основе свёртки с шумовым импульсом. */
function makeReverb(ctx, seconds = 2.2, decay = 2.4) {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  const conv = ctx.createConvolver();
  conv.buffer = buf;
  return conv;
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.reverb = null;
    this.playing = false;
    this.currentTrack = null;
    this.schedulerTimer = null;
    this.nextNoteTime = 0;
    this.step = 0;
    this.intensity = 0; // 0..1 — насколько напряжённый бой
    this.enabled = true;
    this.musicVolume = 0.55; // текущая громкость музыки (ползунок в меню)
  }

  /** Инициализация возможна только после действия пользователя. */
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    // Без поддержки Web Audio движок остаётся в неактивном состоянии,
    // но игра продолжает работать — звук просто отсутствует.
    if (!AC) { this.enabled = false; return; }
    try {
      this.ctx = new AC();
    } catch {
      this.enabled = false;
      return;
    }

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(this.ctx.destination);

    this.reverb = makeReverb(this.ctx);
    const revGain = this.ctx.createGain();
    revGain.gain.value = 0.28;
    this.reverb.connect(revGain);
    revGain.connect(this.master);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.0;
    this.musicGain.connect(this.master);
    this.musicGain.connect(this.reverb);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.7;
    this.sfxGain.connect(this.master);
    this.sfxGain.connect(this.reverb);

    // Базовый шумовой буфер для ударных и дыхания флейты.
    const rate = this.ctx.sampleRate;
    const nb = this.ctx.createBuffer(1, rate * 2, rate);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.noiseBuffer = nb;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMusicVolume(v) {
    // Запоминаем значение: playTrack() выставляет громкость заново,
    // и без этого ползунок «сбрасывался» при смене трека.
    this.musicVolume = Math.max(0, Math.min(1, v));
    if (!this.musicGain) return;
    this.musicGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.4);
  }

  setSfxVolume(v) {
    if (!this.sfxGain) return;
    this.sfxGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.2);
  }

  /** Реакция музыки на напряжение боя: больше ударных, выше регистр. */
  setIntensity(v) {
    this.intensity = Math.max(0, Math.min(1, v));
  }

  // ================================================================ ИНСТРУМЕНТЫ

  /** Гуцинь: щипок с яркой атакой и долгим затуханием. */
  pluck(midi, time, dur = 2.2, gainV = 0.22, dest = null) {
    const c = this.ctx;
    const out = dest || this.musicGain;
    const freq = mtof(midi);

    const osc1 = c.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.value = freq;

    const osc2 = c.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = freq * 2.01;

    const g2 = c.createGain();
    g2.gain.value = 0.3;
    osc2.connect(g2);

    const g = c.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(gainV, time + 0.008);
    g.gain.exponentialRampToValueAtTime(gainV * 0.35, time + dur * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    // Характерный для щипковых "звон" струны.
    const filt = c.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(freq * 8, time);
    filt.frequency.exponentialRampToValueAtTime(freq * 2, time + dur * 0.6);
    filt.Q.value = 1.2;

    osc1.connect(g);
    g2.connect(g);
    g.connect(filt);
    filt.connect(out);

    osc1.start(time); osc2.start(time);
    osc1.stop(time + dur + 0.1); osc2.stop(time + dur + 0.1);
  }

  /** Эрху: смычковый тон с вибрато — «поющий» голос. */
  erhu(midi, time, dur = 1.8, gainV = 0.16, dest = null) {
    const c = this.ctx;
    const out = dest || this.musicGain;
    const freq = mtof(midi);

    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;

    // Вибрато — ключ к «живому» звучанию.
    const vib = c.createOscillator();
    vib.frequency.value = 5.2;
    const vibGain = c.createGain();
    vibGain.gain.value = freq * 0.012;
    vib.connect(vibGain);
    vibGain.connect(osc.frequency);

    const g = c.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(gainV, time + 0.18);
    g.gain.setValueAtTime(gainV, time + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    // Формантный фильтр имитирует резонанс корпуса.
    const filt = c.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = freq * 2.2;
    filt.Q.value = 3.5;

    const filt2 = c.createBiquadFilter();
    filt2.type = 'lowpass';
    filt2.frequency.value = 2600;

    osc.connect(filt);
    filt.connect(filt2);
    filt2.connect(g);
    g.connect(out);

    osc.start(time); vib.start(time);
    osc.stop(time + dur + 0.1); vib.stop(time + dur + 0.1);
  }

  /** Дицзы: бамбуковая флейта с дыханием. */
  flute(midi, time, dur = 1.0, gainV = 0.13, dest = null) {
    const c = this.ctx;
    const out = dest || this.musicGain;
    const freq = mtof(midi);

    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    // Дыхательный шум придаёт флейте воздушность.
    const noise = c.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const nf = c.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = freq * 2;
    nf.Q.value = 6;
    const ng = c.createGain();
    ng.gain.value = gainV * 0.35;
    noise.connect(nf); nf.connect(ng); ng.connect(out);
    noise.start(time); noise.stop(time + dur);

    const g = c.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(gainV, time + 0.09);
    g.gain.setValueAtTime(gainV, time + dur * 0.65);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    osc.connect(g); g.connect(out);
    osc.start(time); osc.stop(time + dur + 0.05);
  }

  /** Тайко: низкий барабан. */
  taiko(time, gainV = 0.5) {
    const c = this.ctx;
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.28);

    const g = c.createGain();
    g.gain.setValueAtTime(gainV, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.5);

    osc.connect(g); g.connect(this.musicGain);
    osc.start(time); osc.stop(time + 0.55);
  }

  /** Гонг: металлический удар с обертонами. */
  gong(time, gainV = 0.32) {
    const c = this.ctx;
    const partials = [1, 2.34, 3.71, 5.12, 7.4];
    const base = mtof(38);
    partials.forEach((p, i) => {
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = base * p;
      const g = c.createGain();
      const v = gainV / (i + 1.6);
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(v, time + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, time + 3.5 - i * 0.4);
      osc.connect(g); g.connect(this.musicGain);
      osc.start(time); osc.stop(time + 3.6);
    });
  }

  // ================================================================ ЗВУКИ БОЯ

  sfxCast(tier = 1) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const base = 260 + tier * 90;

    const osc = c.createOscillator();
    osc.type = tier >= 4 ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * 2.6, t + 0.22);

    const g = c.createGain();
    g.gain.setValueAtTime(0.24, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);

    osc.connect(g); g.connect(this.sfxGain);
    osc.start(t); osc.stop(t + 0.36);
  }

  sfxHit(power = 1) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;

    // Шумовой удар
    const noise = c.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const nf = c.createBiquadFilter();
    nf.type = 'lowpass';
    nf.frequency.setValueAtTime(2200 * power, t);
    nf.frequency.exponentialRampToValueAtTime(220, t + 0.3);
    const ng = c.createGain();
    ng.gain.setValueAtTime(0.4 * Math.min(1.6, power), t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    noise.connect(nf); nf.connect(ng); ng.connect(this.sfxGain);
    noise.start(t); noise.stop(t + 0.4);

    // Тональный "толчок"
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.25);
    const og = c.createGain();
    og.gain.setValueAtTime(0.35, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(og); og.connect(this.sfxGain);
    osc.start(t); osc.stop(t + 0.32);
  }

  sfxShieldUp() {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(720, t + 0.4);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(t); osc.stop(t + 0.75);
  }

  sfxShieldBlock() {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    // Звонкий "дзынь" по барьеру
    const osc = c.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(440, t + 0.3);
    const g = c.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(t); osc.stop(t + 0.42);
  }

  sfxShieldBreak() {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    // Стеклянный звон + низкий провал
    for (let i = 0; i < 5; i++) {
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 1200 + i * 470 + Math.random() * 200;
      const g = c.createGain();
      g.gain.setValueAtTime(0.14 / (i * 0.5 + 1), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      osc.connect(g); g.connect(this.sfxGain);
      osc.start(t); osc.stop(t + 0.65);
    }
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.6);
    const g = c.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(t); osc.stop(t + 0.85);
  }

  sfxRecognize(ok) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const osc = c.createOscillator();
    osc.type = 'sine';
    if (ok) {
      osc.frequency.setValueAtTime(660, t);
      osc.frequency.setValueAtTime(990, t + 0.08);
    } else {
      osc.frequency.setValueAtTime(320, t);
      osc.frequency.exponentialRampToValueAtTime(180, t + 0.2);
    }
    const g = c.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (ok ? 0.26 : 0.3));
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(t); osc.stop(t + 0.35);
  }

  /** Сбивание чужого каста. */
  sfxInterrupt() {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const osc = c.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(420, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.24);
    const g = c.createGain();
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(t); osc.stop(t + 0.3);
  }

  // ================================================================ ТРЕКИ

  /**
   * Треки различаются ладом, темпом, набором инструментов и настроением.
   * stepSeconds — длительность шага сетки; меньше = быстрее.
   */
  static TRACKS = {
    title: {
      name: 'Врата Храма',
      root: 57, tempo: 0.30, scale: [0, 2, 4, 7, 9],
      mood: 'calm',
      use: { pluck: 0.9, erhu: 0.3, flute: 0.5, taiko: 0.05, gong: 0.02 },
      desc: 'Спокойная тема главного меню. Гуцинь и бамбуковая флейта.',
    },
    journey: {
      name: 'Путь Странника',
      root: 55, tempo: 0.26, scale: [0, 2, 4, 7, 9],
      mood: 'flowing',
      use: { pluck: 1.0, erhu: 0.55, flute: 0.35, taiko: 0.18, gong: 0.03 },
      desc: 'Основная боевая тема обычных схваток.',
    },
    duel: {
      name: 'Поединок у Реки',
      root: 53, tempo: 0.22, scale: [0, 2, 3, 7, 8],
      mood: 'tense',
      use: { pluck: 0.8, erhu: 0.75, flute: 0.2, taiko: 0.45, gong: 0.06 },
      desc: 'Напряжённая тема. Использует минорную пентатонику «юй».',
    },
    boss: {
      name: 'Гнев Небесного Дракона',
      root: 50, tempo: 0.18, scale: [0, 2, 3, 5, 7, 8, 10],
      mood: 'epic',
      use: { pluck: 0.7, erhu: 0.85, flute: 0.15, taiko: 0.85, gong: 0.14 },
      desc: 'Тема боссов. Полный лад с тритоном — тревожно и торжественно.',
    },
    victory: {
      name: 'Восход над Пагодой',
      root: 60, tempo: 0.24, scale: [0, 2, 4, 7, 9],
      mood: 'bright',
      use: { pluck: 1.0, erhu: 0.6, flute: 0.7, taiko: 0.25, gong: 0.08 },
      desc: 'Победная тема.',
    },
    defeat: {
      name: 'Опавший Цветок',
      root: 52, tempo: 0.40, scale: [0, 2, 3, 5, 7],
      mood: 'mournful',
      use: { pluck: 0.6, erhu: 0.9, flute: 0.3, taiko: 0.08, gong: 0.10 },
      desc: 'Тема поражения. Медленный эрху.',
    },

    // --- Четыре трека на выбор игрока (меню «Музыка»). ---
    // Написаны в разных настроениях, чтобы был настоящий выбор, а не
    // четыре варианта одного и того же.

    mist: {
      name: 'Туман над Рекой',
      root: 59, tempo: 0.34, scale: [0, 2, 4, 7, 9],
      mood: 'calm',
      use: { pluck: 0.7, erhu: 0.45, flute: 0.8, taiko: 0.04, gong: 0.03 },
      desc: 'Прозрачная, почти неподвижная. Флейта поверх редких щипков.',
    },
    ember: {
      name: 'Угли под Пеплом',
      root: 48, tempo: 0.20, scale: [0, 2, 3, 5, 7, 8],
      mood: 'tense',
      use: { pluck: 0.75, erhu: 0.8, flute: 0.12, taiko: 0.6, gong: 0.08 },
      desc: 'Тлеющее напряжение. Низкий эрху и глухие удары.',
    },
    forge: {
      name: 'Кузня на Закате',
      root: 50, tempo: 0.16, scale: [0, 3, 5, 7, 10],
      mood: 'driving',
      use: { pluck: 1.0, erhu: 0.5, flute: 0.15, taiko: 0.9, gong: 0.12 },
      desc: 'Ритмичная и жёсткая. Частые удары тайко, почти без флейты.',
    },
    ascent: {
      name: 'Восхождение',
      root: 57, tempo: 0.22, scale: [0, 2, 4, 7, 9, 11],
      mood: 'bright',
      use: { pluck: 0.85, erhu: 0.7, flute: 0.65, taiko: 0.3, gong: 0.1 },
      desc: 'Светлая и устремлённая вверх. Полный мажорный лад.',
    },

    // --- БОССЫ: напряжённая музыка, своя для каждой стихии. ---

    boss_thousand: {
      name: 'Тысяча Теней',
      root: 45, tempo: 0.15, scale: [0, 1, 3, 6, 7, 10],
      mood: 'epic',
      use: { pluck: 0.6, erhu: 0.9, flute: 0.05, taiko: 0.8, gong: 0.18 },
      desc: 'Стража теней. Хроматика и низкий эрху — тревожно и скользко.',
    },
    boss_thunder: {
      name: 'Гроза Разверзлась',
      root: 47, tempo: 0.12, scale: [0, 2, 3, 5, 6, 9, 10],
      mood: 'epic',
      use: { pluck: 0.5, erhu: 0.6, flute: 0.25, taiko: 1.0, gong: 0.22 },
      desc: 'Страж бури. Самый быстрый темп, сплошные удары и рваный лад.',
    },
    boss_ember: {
      name: 'Дыхание Кратера',
      root: 43, tempo: 0.155, scale: [0, 1, 4, 6, 7, 11],
      mood: 'epic',
      use: { pluck: 0.75, erhu: 0.7, flute: 0.1, taiko: 0.9, gong: 0.25 },
      desc: 'Страж огня. Низкая тоника, тяжёлый гонг, жар в нижнем регистре.',
    },
    boss_frost: {
      name: 'Молчание Льдов',
      root: 55, tempo: 0.24, scale: [0, 2, 3, 7, 8, 10],
      mood: 'epic',
      use: { pluck: 0.9, erhu: 0.5, flute: 0.4, taiko: 0.25, gong: 0.12 },
      desc: 'Страж льда. Разрежённая звонкая фактура — тишина страшнее рёва.',
    },
    boss_void: {
      name: 'Трон в Ничто',
      root: 41, tempo: 0.28, scale: [0, 1, 3, 6, 8, 11],
      mood: 'epic',
      use: { pluck: 0.4, erhu: 0.75, flute: 0.08, taiko: 0.35, gong: 0.3 },
      desc: 'Страж пустоты. Почти без ритма: редкие ноты в разреженном воздухе.',
    },
    boss_final: {
      name: 'Суд Небес',
      root: 50, tempo: 0.14, scale: [0, 2, 3, 5, 7, 8, 11],
      mood: 'epic',
      use: { pluck: 0.85, erhu: 0.95, flute: 0.3, taiko: 1.0, gong: 0.3 },
      desc: 'Последний страж. Всё сразу и на полную — финальная тема.',
    },
  };

  /** Игровые треки на выбор в меню — те, что доступны кнопкой «Музыка». */
  static SELECTABLE = ['journey', 'mist', 'ember', 'forge', 'ascent'];

  /**
   * Музыка боссов — своя для каждой стихии.
   *
   * На страже игрок не должен слышать «то же, что и раньше, только
   * громче». Поэтому у каждого босса свой лад и свой набор ударных:
   * у вулкана низкий тяжёлый гонг, у грозы рваные всплески, у пустоты
   * почти тишина с редкими нотами.
   */
  static BOSS_TRACKS = {
    sakura: 'boss',
    shadow: 'boss_thousand',
    storm:  'boss_thunder',
    fire:   'boss_ember',
    ice:    'boss_frost',
    void:   'boss_void',
    heaven: 'boss_final',
  };

  playTrack(key) {
    this.init();
    this.resume();
    if (!this.ctx) return;

    if (this.currentTrack === key && this.playing) return;
    this.currentTrack = key;
    this.step = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.playing = true;

    // Громкость берём из ползунка, а не из константы: иначе каждый
    // новый бой возвращал бы звук на прежний уровень.
    this.setMusicVolume(this.musicVolume);

    if (this.schedulerTimer) clearInterval(this.schedulerTimer);
    this.schedulerTimer = setInterval(() => this.scheduler(), 60);

    // Для темы босса — торжественный гонг на входе.
    const track = AudioEngine.TRACKS[key];
    if (track && track.mood === 'epic') this.gong(this.ctx.currentTime + 0.05, 0.4);
  }

  stopMusic() {
    this.playing = false;
    if (this.schedulerTimer) { clearInterval(this.schedulerTimer); this.schedulerTimer = null; }
    this.setMusicVolume(0);
  }

  /** Планировщик: заранее ставит ноты в очередь Web Audio. */
  scheduler() {
    if (!this.playing || !this.ctx) return;
    const track = AudioEngine.TRACKS[this.currentTrack];
    if (!track) return;

    const lookahead = 0.35;
    while (this.nextNoteTime < this.ctx.currentTime + lookahead) {
      this.scheduleStep(track, this.step, this.nextNoteTime);
      this.nextNoteTime += track.tempo;
      this.step++;
    }
  }

  /** Один шаг сетки: решает, какие инструменты звучат. */
  scheduleStep(track, step, time) {
    const use = track.use;
    const inten = this.intensity;
    const scale = track.scale;
    const root = track.root;
    const bar = Math.floor(step / 8);
    const beat = step % 8;

    // Функция выбора ноты лада.
    const noteAt = (deg) => {
      const oct = Math.floor(deg / scale.length);
      const idx = ((deg % scale.length) + scale.length) % scale.length;
      return root + scale[idx] + oct * 12;
    };

    // --- Гуцинь: арпеджио по устойчивым ступеням, плотнее при высоком напряжении.
    if (Math.random() < use.pluck * (0.5 + inten * 0.4)) {
      const deg = [0, 2, 4, 1, 3][(step + bar) % 5];
      this.pluck(noteAt(deg), time, 2.4, 0.18 + inten * 0.06);
      // Изредка — украшение-форшлаг на октаву выше.
      if (Math.random() < 0.3) this.pluck(noteAt(deg + 5), time + 0.09, 1.6, 0.10);
    }

    // --- Эрху: длинная «поющая» фраза на сильных долях.
    if (beat === 0 && Math.random() < use.erhu) {
      const deg = [4, 2, 0, 3][bar % 4];
      this.erhu(noteAt(deg), time, track.tempo * 6, 0.13 + inten * 0.05);
    }

    // --- Дицзы: высокие вставки.
    if ((beat === 3 || beat === 6) && Math.random() < use.flute * (0.6 + inten * 0.3)) {
      const deg = [7, 9, 5, 8][(step / 3 | 0) % 4];
      this.flute(noteAt(deg), time, track.tempo * 2.5, 0.10);
    }

    // --- Тайко: ритмическая основа, усиливается в бою.
    const taikoChance = use.taiko * (0.35 + inten * 0.75);
    if ((beat === 0 || beat === 4 || (inten > 0.5 && beat === 6)) && Math.random() < taikoChance) {
      this.taiko(time, 0.28 + inten * 0.2);
    }
    // Дробь при пиковом напряжении.
    if (inten > 0.7 && beat === 7 && Math.random() < 0.5) {
      this.taiko(time, 0.18); this.taiko(time + track.tempo * 0.5, 0.14);
    }

    // --- Гонг: редкие акценты на границах фраз.
    if (beat === 0 && bar % 8 === 7 && Math.random() < use.gong * 3) {
      this.gong(time, 0.26);
    }
  }
}

export { PENTATONIC };
