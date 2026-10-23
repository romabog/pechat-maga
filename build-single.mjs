/**
 * СБОРКА В ОДИН ФАЙЛ
 * ==================
 * Собирает игру в один-единственный HTML-файл, который открывается
 * двойным щелчком — без сервера.
 *
 * ЗАЧЕМ ЭТО НУЖНО. Обычная сборка состоит из ES-модулей, а браузер
 * грузит их только по HTTP: с диска (`file://`) срабатывает CORS, и
 * вместо игры остаётся белый экран. Для проверки на модели, которая
 * просто получает файлы, это неудобно.
 *
 * ЧТО ДЕЛАЕТ СБОРЩИК.
 *
 *   1. Читает граф импортов от точки входа (src/main.js).
 *   2. Топологически сортирует модули: зависимости идут раньше.
 *   3. Проверяет, что имена между модулями не пересекаются — иначе
 *      склейка молча сломалась бы (второе объявление перекрыло бы
 *      первое).
 *   4. Заменяет `import ... from '...'` на ссылки на те же имена,
 *      `export` убирает (в одном файле экспорт не нужен).
 *   5. Кладёт всё внутрь IIFE — модули не протекают в глобальную
 *      область и не конфликтуют со страницей.
 *   6. Встраивает CSS и подключает скрипт как обычный, не module.
 *
 * ПОЧЕМУ НЕ ПРОСТО КОНКАТЕНАЦИЯ. Простая склейка ломается на
 * одинаковых именах: в двух модулях может быть `drawRing` или
 * `hexA`, и второй определит поверх первого — игра запустится, но с
 * чужими функциями. Ниже это проверяется явно.
 *
 * Запуск:
 *     node build-single.mjs
 * Результат: Печать-Мага.html рядом с этим файлом.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const ENTRY = path.join(ROOT, 'src', 'main.js');
const OUT = path.join(ROOT, 'Печать-Мага.html');

let problems = 0;
const fail = (msg) => { console.log('  ОШИБКА  ' + msg); problems++; };
const ok = (msg) => console.log('  OK      ' + msg);

// ------------------------------------------------------ 1. Чтение графа
console.log('ЧТЕНИЕ МОДУЛЕЙ:');

/** Убирает комментарии, сохраняя длину строк (для безопасного поиска). */
function stripCommentsForScan(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((line) => (/^\s*\/\//.test(line) ? '' : line))
    .join('\n');
}

const mods = new Map(); // absPath -> { src, scan, deps }

function loadModule(abs) {
  if (mods.has(abs)) return;
  if (!fs.existsSync(abs)) { fail('нет файла: ' + path.relative(ROOT, abs)); return; }
  const src = fs.readFileSync(abs, 'utf8');
  const scan = stripCommentsForScan(src);
  const deps = [];
  for (const m of scan.matchAll(/^\s*import\s+[\s\S]*?from\s+['"]([^'"]+)['"]/gm)) {
    const depAbs = path.resolve(path.dirname(abs), m[1]);
    deps.push({ spec: m[1], abs: depAbs });
    loadModule(depAbs);
  }
  // import без from (побочный эффект): import './x.js'
  for (const m of scan.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)) {
    const depAbs = path.resolve(path.dirname(abs), m[1]);
    deps.push({ spec: m[1], abs: depAbs });
    loadModule(depAbs);
  }
  mods.set(abs, { src, scan, deps });
}

loadModule(ENTRY);
ok(`модулей в графе: ${mods.size}`);

if (problems) { console.log('\nСБОРКА ОСТАНОВЛЕНА'); process.exit(1); }

// ----------------------------------------------- 2. Порядок зависимостей
const order = [];
const state = new Map(); // abs -> 'visiting' | 'done'

function visit(abs, trail = []) {
  if (state.get(abs) === 'done') return;
  if (state.get(abs) === 'visiting') {
    // Цикл — не всегда ошибка в ES-модулях, но при склейке в один файл
    // он означал бы обращение к ещё не объявленному коду. Лучше знать.
    fail('циклический импорт: ' + [...trail, abs].map((p) => path.relative(ROOT, p)).join(' → '));
    return;
  }
  state.set(abs, 'visiting');
  for (const d of mods.get(abs).deps) visit(d.abs, [...trail, abs]);
  state.set(abs, 'done');
  order.push(abs);
}

console.log('');
console.log('ПОРЯДОК СБОРКИ:');
visit(ENTRY);
ok(`${order.length} модулей упорядочено`);

// --------------------------------- 3. Проверка: кто что экспортирует
//
// Имена ПОВТОРЯЮТСЯ между модулями, и это нормально: `hexA` есть в
// шести файлах, `drawRageAura` — в двух. В ES-модулях это не мешает:
// у каждого файла своя область видимости.
//
// Простая склейка в один файл это сломала бы: второе объявление
// `hexA` перекрыло бы первое, и часть графики начала бы рисоваться
// чужими цветами. Ошибка была бы тихой — игра запустилась бы.
//
// Поэтому каждый модуль заворачивается в свою функцию-обёртку. Тогда
// одинаковые имена разных модулей не видят друг друга, и нужные связи
// идут только через явный список экспорта.
console.log('');
console.log('ЭКСПОРТ И ПОВТОРЫ ИМЁН:');

/**
 * Разбирает список экспортируемых имён модуля.
 * Понимает три формы:
 *   export function f(...)      export class C
 *   export const a = ...        export let b
 *   export { x, y as z }
 * Возвращает Map: внешнее имя -> внутреннее имя.
 */
function parseExports(src) {
  const scan = stripCommentsForScan(src);
  const out = new Map();

  for (const m of scan.matchAll(/^\s*export\s+(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/gm)) {
    out.set(m[1], m[1]);
  }
  for (const m of scan.matchAll(/^\s*export\s+class\s+([A-Za-z_$][\w$]*)/gm)) {
    out.set(m[1], m[1]);
  }
  for (const m of scan.matchAll(/^\s*export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm)) {
    out.set(m[1], m[1]);
  }
  for (const m of scan.matchAll(/^\s*export\s*\{([^}]*)\}/gm)) {
    for (const piece of m[1].split(',')) {
      const t = piece.trim();
      if (!t) continue;
      const asM = t.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/);
      if (asM) out.set(asM[2], asM[1]);
      else out.set(t, t);
    }
  }
  return out;
}

/** Имена объявлений верхнего уровня — для поиска повторов. */
function topLevelDecls(scan) {
  const names = new Set();
  let depth = 0;
  for (const line of scan.split('\n')) {
    if (depth === 0) {
      let m;
      if ((m = line.match(/^(?:export\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/))) names.add(m[1]);
      else if ((m = line.match(/^(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/))) names.add(m[1]);
      else if ((m = line.match(/^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)/))) names.add(m[1]);
    }
    for (const ch of line) {
      if (ch === '{') depth++;
      else if (ch === '}') depth = Math.max(0, depth - 1);
    }
  }
  return names;
}

const exportsOf = new Map(); // abs -> Map(внешнее -> внутреннее)
const declsOf = new Map();   // abs -> Set(имена)

for (const abs of order) {
  exportsOf.set(abs, parseExports(mods.get(abs).src));
  declsOf.set(abs, topLevelDecls(mods.get(abs).scan));
}

const nameOwners = new Map();
for (const abs of order) {
  for (const name of declsOf.get(abs)) {
    if (!nameOwners.has(name)) nameOwners.set(name, []);
    nameOwners.get(name).push(path.relative(ROOT, abs));
  }
}
const repeated = [...nameOwners.entries()].filter(([, l]) => l.length > 1);
ok(`${nameOwners.size} имён верхнего уровня`);
if (repeated.length) {
  for (const [name, list] of repeated) {
    console.log(`          повтор: «${name}» в ${list.length} модулях (${list.map((p) => path.basename(p)).join(', ')})`);
  }
  ok('это не проблема: каждый модуль будет завёрнут в свою область видимости');
}

// У каждого импорта имя должно существовать в модуле-источнике.
{
  let badImports = 0;
  for (const abs of order) {
    const { src } = mods.get(abs);
    const scan = stripCommentsForScan(src);
    for (const m of scan.matchAll(/^\s*import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/gm)) {
      const depAbs = path.resolve(path.dirname(abs), m[2]);
      const exp = exportsOf.get(depAbs);
      if (!exp) continue;
      const clause = m[1];
      const braceIdx = clause.indexOf('{');
      const inner = braceIdx === -1 ? '' : clause.slice(braceIdx + 1, clause.lastIndexOf('}'));
      for (const piece of inner.split(',')) {
        const t = piece.trim();
        if (!t) continue;
        const orig = t.split(/\s+as\s+/)[0].trim();
        if (!exp.has(orig)) {
          fail(`${path.relative(ROOT, abs)} импортирует «${orig}» из ${path.basename(depAbs)}, а тот это не экспортирует`);
          badImports++;
        }
      }
    }
  }
  if (!badImports) ok('все импорты указывают на реально экспортированные имена');
}

// ------------------------------------------------- 4. Склейка тел модулей
/**
 * Переписывает модуль для склейки.
 *
 * КАК УСТРОЕНА СВЯЗЬ МЕЖДУ МОДУЛЯМИ.
 *
 * Каждый модуль становится функцией-обёрткой:
 *
 *     var __mod_character = (function () {
 *       ...тело модуля...
 *       return { drawCharacter: drawCharacter, /* ... *\/ };
 *     })();
 *
 * А обращение к чужому коду превращается в чтение из этой обёртки:
 *
 *     import { drawCharacter } from './character.js';
 *     ->
 *     var drawCharacter = __mod_character.drawCharacter;
 *
 * Так локальные имена остаются прежними — тело модуля менять не надо, —
 * а одинаковые `hexA` в разных файлах больше не мешают друг другу.
 *
 * ПОЧЕМУ НЕ ПРОСТО ПЛОСКАЯ СКЛЕЙКА. `hexA` объявлен в шести модулях
 * (см. выше). Плоская склейка оставила бы одно объявление, и половина
 * графики рисовалась бы чужими цветами — без единой ошибки в консоли.
 */
function wrappedName(abs) {
  const rel = path.relative(path.join(ROOT, 'src'), abs).replace(/\\/g, '/');
  return '__mod_' + rel.replace(/\.js$/, '').replace(/[^A-Za-z0-9]/g, '_');
}

function rewriteModule(abs) {
  let out = mods.get(abs).src;
  const rel = path.relative(ROOT, abs);

  // import { a, b as c } from './x.js'  →  var c = __mod_x.a;
  out = out.replace(
    /^([ \t]*)import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"];?[ \t]*$/gm,
    (full, indent, clause, spec) => {
      const depAbs = path.resolve(path.dirname(abs), spec);
      const modVar = wrappedName(depAbs);
      clause = clause.trim();

      const braceIdx = clause.indexOf('{');
      const defaultPart = braceIdx === -1 ? clause : clause.slice(0, braceIdx).replace(/,\s*$/, '').trim();
      if (defaultPart) {
        fail(`${rel}: импорт по умолчанию из «${spec}» — проект так не экспортирует`);
        return full;
      }

      const lines = [];
      if (braceIdx !== -1) {
        const inner = clause.slice(braceIdx + 1, clause.lastIndexOf('}'));
        for (const piece of inner.split(',')) {
          const t = piece.trim();
          if (!t) continue;
          const asM = t.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/);
          const orig = asM ? asM[1] : t;
          const local = asM ? asM[2] : t;
          lines.push(`${indent}var ${local} = ${modVar}.${orig};`);
        }
      }
      return lines.join('\n');
    },
  );

  // import './x.js' — только ради побочного эффекта: модуль уже
  // выполнится выше по порядку, поэтому строку просто убираем.
  out = out.replace(/^[ \t]*import\s+['"][^'"]+['"];?[ \t]*$/gm, '');

  // export перед объявлением — в обёртке экспорт не нужен.
  out = out.replace(/^([ \t]*)export\s+(?=(?:async\s+)?function|class|const|let|var)/gm, '$1');

  // export { a, b as c };  — только список, объявления остаются.
  out = out.replace(/^[ \t]*export\s*\{[^}]*\};?[ \t]*$/gm, '');

  if (/^[ \t]*export\s+default/m.test(out)) {
    fail(`${rel}: «export default» не поддерживается`);
  }

  // Возвращаем наружу ровно то, что модуль экспортировал.
  const exp = exportsOf.get(abs);
  const fields = [...exp.entries()].map(([outer, inner]) =>
    outer === inner ? `    ${outer}: ${inner},` : `    ${outer}: ${inner}, // ${inner}`
  );

  return [
    `${wrappedName(abs)} = (function () {`,
    out.trim(),
    '',
    '  return {',
    fields.join('\n'),
    '  };',
    '})();',
  ].join('\n');
}

console.log('');
console.log('СКЛЕЙКА:');

// Точка входа должна идти последней: она запускает игру.
const body = [];
const modVars = order.map(wrappedName);
body.push('// Объявления модулей. Каждый — своя область видимости:');
body.push('// одинаковые имена в разных файлах не мешают друг другу.');
for (const v of modVars) body.push(`var ${v};`);
body.push('');

for (const abs of order) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  body.push('');
  body.push('// ' + '='.repeat(72));
  body.push(`// ${rel}`);
  body.push('// ' + '='.repeat(72));
  body.push(rewriteModule(abs));
}
ok(`${order.length} модулей обёрнуто`);

if (problems) {
  console.log('');
  console.log(`СБОРКА ОСТАНОВЛЕНА — проблем: ${problems}`);
  process.exit(1);
}

// --------------------------------------------------- 5. HTML и CSS внутрь
console.log('');
console.log('СБОРКА HTML:');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'src', 'style.css'), 'utf8');

let out = html;

// Стили: <link rel="stylesheet" href="src/style.css?v=21"> → <style>...
const cssTag = /<link[^>]+href="src\/style\.css[^"]*"[^>]*>/;
if (!cssTag.test(out)) fail('в index.html не найден тег стилей');
out = out.replace(cssTag, () => `<style>\n${css}\n</style>`);

// Скрипт: type="module" заменяем на обычный и вставляем код.
const jsTag = /<script[^>]+src="src\/main\.js[^"]*"[^>]*><\/script>/;
if (!jsTag.test(out)) fail('в index.html не найден тег скрипта');

const banner = `<!--
  ПЕЧАТЬ МАГА — Sigil Mage
  ========================
  Вся игра в одном файле. Открывается двойным щелчком, сервер не нужен.

  Почему так: игра написана из ES-модулей, а браузер грузит их только
  по HTTP. Собранный в один файл код работает и с диска.

  Состав: ${order.length} модулей (${order.map((a) => path.basename(a)).join(', ')}).
  Собрано: ${new Date().toISOString().slice(0, 10)}.
-->`;

out = out.replace(/^<!DOCTYPE html>/i, () => `<!DOCTYPE html>\n${banner}`);
out = out.replace(jsTag, () => `<script>\n(function () {\n'use strict';\n${body.join('\n')}\n})();\n</script>`);

// Проверка: не осталось ли ссылок на внешние файлы — иначе сборка
// «одним файлом» на деле требует папку рядом.
const leftovers = [...out.matchAll(/(?:src|href)="(?!data:|https?:|#)([^"]+)"/g)].map((m) => m[1]);
if (leftovers.length) {
  fail('остались внешние ссылки: ' + leftovers.join(', '));
} else {
  ok('внешних ссылок нет — файл самодостаточен');
}

fs.writeFileSync(OUT, out, 'utf8');
ok(`записан ${path.basename(OUT)}`);

// ------------------------------------------------------------ 6. Итог
const sizeKb = (fs.statSync(OUT).size / 1024).toFixed(1);
console.log('');
console.log(`ГОТОВО: ${path.basename(OUT)} — ${sizeKb} КБ`);
console.log(`Открыть: ${OUT}`);
process.exit(0);
