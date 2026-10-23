/**
 * СБОРКА ПЕРЕКЛЮЧАТЕЛЯ УРОВНЕЙ
 * =============================
 * Собирает страницу «Уровни-1-70.html» в один файл — так же, как
 * build-single.mjs собирает саму игру.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ СБОРЩИК. Страница уровней — небольшой инструмент:
 * слайдер, кнопки, список всех семидесяти врагов и предпросмотр
 * арены с существом. Ей нужны только данные врагов и отрисовка; тащить
 * туда весь движок боя незачем.
 *
 * ЧТО БЕРЁТСЯ ИЗ ИГРЫ.
 *
 *   src/data/enemies.js     — список врагов, боссы, виды
 *   src/render/arenas.js    — фон арены
 *   src/render/character.js — фигура врага (тянет за собой посохи,
 *                             существа и стражей)
 *
 * Модули собираются теми же обёртками, что и в основной игре: у
 * `hexA` и `shade` по нескольку объявлений в разных файлах, и плоская
 * склейка подменила бы цвета.
 *
 * Запуск:
 *     node build-levels.mjs
 * Результат: Уровни-1-70.html рядом с этим файлом.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'Уровни-1-70.html');

// Точки входа страницы — модули, которые она использует напрямую.
const ENTRIES = [
  path.join(ROOT, 'src', 'data', 'enemies.js'),
  path.join(ROOT, 'src', 'render', 'arenas.js'),
  path.join(ROOT, 'src', 'render', 'character.js'),
];

let problems = 0;
const fail = (msg) => { console.log('  ОШИБКА  ' + msg); problems++; };
const ok = (msg) => console.log('  OK      ' + msg);

function stripCommentsForScan(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((line) => (/^\s*\/\//.test(line) ? '' : line))
    .join('\n');
}

console.log('ЧТЕНИЕ МОДУЛЕЙ:');

const mods = new Map();

function readModule(abs) {
  if (mods.has(abs)) return;
  const src = fs.readFileSync(abs, 'utf8');
  const scan = stripCommentsForScan(src);
  const deps = [];
  for (const m of scan.matchAll(/^\s*import\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]/gm)) {
    deps.push({ spec: m[1], abs: path.resolve(path.dirname(abs), m[1]) });
  }
  mods.set(abs, { src, scan, deps });
  for (const d of deps) readModule(d.abs);
}

for (const e of ENTRIES) readModule(e);
ok(`${mods.size} модулей прочитано`);

// Топологический порядок: зависимости раньше зависимых.
const order = [];
const seen = new Set();
function visit(abs, trail = []) {
  if (seen.has(abs)) return;
  if (trail.includes(abs)) {
    fail(`кольцевой импорт: ${[...trail, abs].map((p) => path.basename(p)).join(' → ')}`);
    return;
  }
  seen.add(abs);
  for (const d of mods.get(abs).deps) visit(d.abs, [...trail, abs]);
  order.push(abs);
}
for (const e of ENTRIES) visit(e);
ok(`${order.length} модулей упорядочено`);

function parseExports(src) {
  const exp = new Map();
  const s = stripCommentsForScan(src);
  for (const m of s.matchAll(/^[ \t]*export\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm)) {
    exp.set(m[1], m[1]);
  }
  for (const m of s.matchAll(/^[ \t]*export\s*\{([^}]*)\}/gm)) {
    for (const piece of m[1].split(',')) {
      const t = piece.trim();
      if (!t) continue;
      const asM = t.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/);
      if (asM) exp.set(asM[2], asM[1]);
      else exp.set(t, t);
    }
  }
  return exp;
}

const exportsOf = new Map();
for (const abs of order) exportsOf.set(abs, parseExports(mods.get(abs).src));

// Каждый импорт должен существовать в модуле-источнике.
{
  let bad = 0;
  for (const abs of order) {
    const scan = stripCommentsForScan(mods.get(abs).src);
    for (const m of scan.matchAll(/^\s*import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/gm)) {
      const depAbs = path.resolve(path.dirname(abs), m[2]);
      const exp = exportsOf.get(depAbs);
      if (!exp) continue;
      const braceIdx = m[1].indexOf('{');
      if (braceIdx === -1) continue;
      const inner = m[1].slice(braceIdx + 1, m[1].lastIndexOf('}'));
      for (const piece of inner.split(',')) {
        const t = piece.trim();
        if (!t) continue;
        const orig = t.split(/\s+as\s+/)[0].trim();
        if (!exp.has(orig)) {
          fail(`${path.basename(abs)} импортирует «${orig}» из ${path.basename(depAbs)}, а тот это не экспортирует`);
          bad++;
        }
      }
    }
  }
  if (!bad) ok('все импорты указывают на реально экспортированные имена');
}

function wrappedName(abs) {
  const rel = path.relative(path.join(ROOT, 'src'), abs).replace(/\\/g, '/');
  return '__mod_' + rel.replace(/\.js$/, '').replace(/[^A-Za-z0-9]/g, '_');
}

function rewriteModule(abs) {
  let out = mods.get(abs).src;
  const rel = path.relative(ROOT, abs);

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

  out = out.replace(/^[ \t]*import\s+['"][^'"]+['"];?[ \t]*$/gm, '');
  out = out.replace(/^([ \t]*)export\s+(?=(?:async\s+)?function|class|const|let|var)/gm, '$1');
  out = out.replace(/^[ \t]*export\s*\{[^}]*\};?[ \t]*$/gm, '');

  if (/^[ \t]*export\s+default/m.test(out)) fail(`${rel}: «export default» не поддерживается`);

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
const body = [];
body.push('// Объявления модулей. Каждый — своя область видимости:');
body.push('// одинаковые имена (hexA, shade) в разных файлах не мешают друг другу.');
for (const abs of order) body.push(`var ${wrappedName(abs)};`);
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

// ---------------------------------------------------------- Код страницы
console.log('');
console.log('СТРАНИЦА:');

const pageSrc = fs.readFileSync(path.join(ROOT, 'levels-page.js'), 'utf8');

// Страница написана как IIFE и обращается к модулям по их обёрткам.
// Проверяем, что все упомянутые обёртки существуют.
const used = [...new Set([...pageSrc.matchAll(/\b(__mod_[A-Za-z0-9_]+)/g)].map((m) => m[1]))];
const known = new Set(order.map(wrappedName));
for (const u of used) {
  if (!known.has(u)) fail(`страница обращается к ${u}, а такого модуля в сборке нет`);
}
ok(`страница использует ${used.length} модулей: ${used.map((u) => u.replace('__mod_src_', '')).join(', ')}`);

body.push('');
body.push('// ' + '='.repeat(72));
body.push('// Страница: слайдер, кнопки и предпросмотр арены');
body.push('// ' + '='.repeat(72));
body.push(pageSrc.trim());

const code = body.join('\n');

// ------------------------------------------------------- HTML и стили
const template = fs.readFileSync(path.join(ROOT, 'levels-template.html'), 'utf8');

// Стили в шаблоне уже встроены: страница уровней пользуется теми же
// правилами оформления, что и игра, а тащить весь style.css незачем —
// в шаблоне лежит только нужная часть.
if (!/<style>/.test(template)) fail('в levels-template.html нет встроенных стилей');
const jsTag = /<script src="levels-page\.js"><\/script>/;
if (!jsTag.test(template)) fail('в levels-template.html не найден тег скрипта');

const banner = `<!--
  ПЕЧАТЬ МАГА — ПЕРЕКЛЮЧАТЕЛЬ УРОВНЕЙ
  ====================================
  Все семьдесят врагов и семь стражей с предпросмотром.
  Открывается двойным щелчком, сервер не нужен.
  Кнопка «Играть» открывает игру на выбранном уровне (?level=N).
-->`;

let html = template.replace(jsTag, () => `<script>\n${code}\n</script>`);
html = banner + '\n' + html;

if (/<link[^>]+href="(?!data:)/.test(html)) fail('внешние ссылки в HTML');
if (/<script[^>]+src=/.test(html)) fail('внешние скрипты в HTML');
ok('внешних ссылок нет — файл самодостаточен');

fs.writeFileSync(OUT, html, 'utf8');
const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
ok(`записан ${path.basename(OUT)}`);

console.log('');
console.log(`ГОТОВО: ${path.basename(OUT)} — ${kb} КБ`);
console.log('Открыть: ' + OUT);
if (problems) process.exit(1);
