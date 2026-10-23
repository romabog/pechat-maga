/**
 * ПРОВЕРКА СОБРАННОГО ФАЙЛА
 * =========================
 * Открывает Печать-Мага.html в эмуляции браузера и проверяет, что игра
 * не просто «загрузилась», а реально работает: меню, старт боя,
 * отрисовка кадров.
 *
 * ЗАЧЕМ. Собранный файл может быть синтаксически верным и всё равно
 * нерабочим: ошибка в склейке проявится только при вызове конкретной
 * функции — например, когда враг впервые что-то нарисует. Такой
 * провал виден в браузере как застывший экран, а не как сообщение.
 *
 * ЧТО ЭМУЛИРУЕТСЯ. canvas (запоминает вызовы), document, window,
 * requestAnimationFrame, Web Audio (заглушкой — звук в Node не
 * проверить, и это не то, что мы здесь проверяем).
 *
 * Запуск:
 *     node check-single.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(ROOT, 'Печать-Мага.html');

let bad = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'ПРОВАЛ'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) bad++;
};

if (!fs.existsSync(FILE)) {
  console.log('НЕТ ФАЙЛА: ' + FILE + '\nСначала запустите: node build-single.mjs');
  process.exit(1);
}

const html = fs.readFileSync(FILE, 'utf8');

// ------------------------------------------------- 1. Структура файла
console.log('ФАЙЛ:');
check('файл один, внешних ссылок нет',
  !/(?:src|href)="(?!data:|https?:|#)[^"]+"/.test(html),
  'иначе сборка требует папку рядом');
check('стили внутри', /<style>/.test(html));
check('скрипт внутри и не module',
  /<script>/.test(html) && !/<script[^>]*type="module"/.test(html),
  'type="module" не работает с диска — в этом и была задача');
check('нет внешних запросов',
  !/https?:\/\/(?!127\.0\.0\.1|localhost)/.test(html.replace(/<!--[\s\S]*?-->/g, '')),
  'игра должна работать офлайн');

const scriptMatch = html.match(/<script>\n([\s\S]*?)\n<\/script>/);
check('код извлечён', !!scriptMatch, scriptMatch ? (scriptMatch[1].length / 1024).toFixed(0) + ' КБ' : '');
if (!scriptMatch) process.exit(1);
const code = scriptMatch[1];

// --------------------------------------------- 2. Эмуляция браузера
const calls = [];
/** 2D-контекст: считает вызовы, отдаёт заглушки для градиентов. */
function ctx2d() {
  const grad = { addColorStop() {} };
  const o = {};
  return new Proxy(o, {
    get(t, p) {
      if (p === 'createLinearGradient' || p === 'createRadialGradient' || p === 'createPattern') return () => grad;
      if (p === 'measureText') return () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 });
      if (p === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      if (p === 'isPointInPath') return () => false;
      if (p in t) return t[p];
      return (...a) => { calls.push([p, a]); };
    },
    set(t, p, v) { t[p] = v; return true; },
  });
}

const made = {};
function el(tag) {
  return {
    tagName: String(tag).toUpperCase(), style: {}, dataset: {}, children: [],
    textContent: '', innerHTML: '', value: '',
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    width: 1280, height: 720, getContext: () => ctx2d(),
    addEventListener() {}, removeEventListener() {},
    appendChild(c) { this.children.push(c); return c; },
    querySelector: () => el('div'), querySelectorAll: () => [],
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
    focus() {}, blur() {}, click() {}, remove() {}, insertBefore() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720, right: 1280, bottom: 720 }),
  };
}

// Аудио-заглушка: любой метод возвращает рабочий объект.
const audioParam = () => new Proxy({ value: 1 }, {
  get(t, p) { if (p in t) return t[p]; return () => {}; },
  set(t, p, v) { t[p] = v; return true; },
});
const audioNode = () => new Proxy({}, {
  get(t, p) {
    if (['gain', 'frequency', 'pan', 'Q', 'delayTime', 'detune', 'playbackRate'].includes(p)) return audioParam();
    if (['buffer', 'curve', 'type', 'oversample'].includes(p)) return null;
    return (...a) => (a.length === 0 ? audioParam() : audioNode());
  },
  set(t, p, v) { t[p] = v; return true; },
});
class AudioCtx {
  constructor() {
    this.sampleRate = 44100; this.destination = audioNode();
    this.currentTime = 0; this.state = 'running';
  }
  createBuffer() { return { getChannelData: () => new Float32Array(256), length: 256, numberOfChannels: 2 }; }
  resume() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
}
// Всё, что не перечислено, приходит из audioNode() — так новая
// функция Web Audio не сломает проверку.
for (const m of ['createGain', 'createOscillator', 'createBiquadFilter', 'createConvolver',
  'createStereoPanner', 'createBufferSource', 'createDynamicsCompressor', 'createWaveShaper',
  'createDelay', 'createAnalyser', 'createChannelMerger']) {
  AudioCtx.prototype[m] = () => audioNode();
}
AudioCtx.prototype.createPeriodicWave = () => ({});

const listeners = {};
const doc = {
  createElement: el,
  getElementById: (id) => (made[id] = made[id] || el('div')),
  querySelector: () => el('div'), querySelectorAll: () => [],
  addEventListener: (k, f) => { listeners[k] = f; }, removeEventListener() {},
  body: el('body'), documentElement: el('html'),
  fonts: { ready: Promise.resolve(), add() {}, load: () => Promise.resolve([]) },
  hidden: false, visibilityState: 'visible',
};
const frames = [];
const win = {
  devicePixelRatio: 1, innerWidth: 1280, innerHeight: 720,
  addEventListener: (k, f) => { listeners[k] = f; }, removeEventListener() {},
  requestAnimationFrame: (f) => { frames.push(f); return frames.length; },
  cancelAnimationFrame() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
  location: { href: 'file:///game.html', search: '' },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  AudioContext: AudioCtx,
};

const define = (n, v) => {
  try { globalThis[n] = v; } catch {
    Object.defineProperty(globalThis, n, { value: v, configurable: true, writable: true });
  }
};
define('document', doc);
define('window', win);
define('navigator', { userAgent: 'node', maxTouchPoints: 0, language: 'ru' });
define('localStorage', win.localStorage);
define('requestAnimationFrame', win.requestAnimationFrame);
define('cancelAnimationFrame', win.cancelAnimationFrame);
// location объявлен и как глобальная переменная, а не только как свойство
// window: в браузере это одно и то же, а в Node — нет. Без него код,
// читающий адрес страницы (?level=N), падал с «location is not defined».
define('location', win.location);
define('AudioContext', AudioCtx);
define('webkitAudioContext', AudioCtx);
define('devicePixelRatio', 1);
define('addEventListener', (k, f) => { listeners[k] = f; });
define('Image', class {
  constructor() { this.naturalWidth = 0; this.naturalHeight = 0; }
  set src(v) {}
  addEventListener() {}
});

// ------------------------------------------------ 3. Запуск
console.log('');
console.log('ЗАПУСК:');

let err = null;
try { new Function(code)(); } catch (e) { err = e; }
check('код запускается без ошибок', !err, err ? err.message : 'инициализация прошла');
if (err) {
  console.log('\n' + (err.stack || '').split('\n').slice(1, 6).join('\n'));
  process.exit(1);
}

check('игра запросила элементы страницы', Object.keys(made).length > 5,
  Object.keys(made).length + ' штук');
check('стартовый кадр что-то нарисовал', calls.length > 50,
  calls.length + ' графических вызовов');

// ------------------------------------------------- 4. Прокрутка кадров
console.log('');
console.log('КАДРЫ:');

// Нажимаем «Начать путь», чтобы уйти из меню в бой.
const startBtn = made['btn-start'];
if (startBtn && typeof startBtn.onclick === 'function') {
  try { startBtn.onclick(); } catch (e) { check('кнопка «Начать путь» работает', false, e.message); }
}

const before = calls.length;
let drawn = 0;
let drawErr = null;
for (let i = 0; i < 180; i++) {
  const f = frames.shift();
  if (!f) break;
  try { f(16.7 * (i + 1)); drawn++; } catch (e) { drawErr = e; break; }
}

check('кадры отрисовываются', !drawErr && drawn > 100,
  drawErr ? `ошибка на кадре ${drawn}: ${drawErr.message}` : `${drawn} кадров`);
if (drawErr) console.log('\n' + (drawErr.stack || '').split('\n').slice(1, 6).join('\n'));

check('в кадрах идёт рисование', calls.length - before > 1000,
  (calls.length - before) + ' вызовов за прокрутку');

// ------------------------------------------- 5. Разные разрешения
console.log('');
console.log('ЭКРАНЫ:');
{
  // Телефон в портрете — самый тесный случай.
  const cfg = [[390, 844, 'телефон, портрет'], [844, 390, 'телефон, альбом'], [1920, 1080, 'десктоп']];
  for (const [w, h, label] of cfg) {
    win.innerWidth = w; win.innerHeight = h;
    calls.length = 0;
    let e = null;
    // Кадр считает размеры из ctx.canvas или window — подставляем оба.
    const c = made['game'];
    if (c) { c.width = w; c.height = h; }
    const f = frames.shift();
    try { if (f) f(1000); } catch (err) { e = err; }
    check(`${label} ${w}×${h}`, !e, e ? e.message : calls.length + ' вызовов');
  }
}

// ------------------------------------------------------------- Итог
console.log('');
console.log(bad === 0 ? 'СОБРАННЫЙ ФАЙЛ РАБОТАЕТ' : 'ПРОБЛЕМ: ' + bad);
process.exit(bad === 0 ? 0 : 1);
