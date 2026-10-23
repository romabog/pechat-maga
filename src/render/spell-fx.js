/**
 * АНИМАЦИЯ ЗАКЛИНАНИЙ — ЭКСПЕРИМЕНТАЛЬНАЯ ВЕРСИЯ
 * =============================================
 * ЭТО ОТДЕЛЬНЫЙ ФАЙЛ. Он ничего не меняет в рабочей игре: main.js и
 * character.js его не импортируют. Посмотреть можно на странице
 * visual-v2.html, а подключить к бою — одной строкой (см. низ файла).
 *
 * ЗАЧЕМ. В рабочей версии у заклинаний разная ГЕОМЕТРИЯ (форма), но
 * одинаковая АНИМАЦИЯ: один и тот же ореол, один и тот же шлейф из
 * четырёх кружков, одно и то же вращение. Из-за этого искра и приговор
 * небес выглядят как одна и та же пуля с разным контуром.
 *
 * Здесь у каждого заклинания свой характер движения: у камня — кувырок
 * с пылью, у пламени — рваное мерцание и угли, у льда — медленное
 * вращение с иглами, у печати — торжественные кольца, у бездны —
 * затягивающаяся спираль. Различаются: скорость, траектория, вращение,
 * пульсация размера, шлейф, искры и ореол.
 */

/** hex + альфа → rgba(). Локальная копия, чтобы файл был самодостаточным. */
export function hexA(hex, a) {
  const h = String(hex).replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Осветлить/затемнить цвет. */
export function shade(hex, amt) {
  const h = String(hex).replace('#', '');
  const n = parseInt(h, 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.max(0, Math.min(255, Math.round(r + r * amt)));
  g = Math.max(0, Math.min(255, Math.round(g + g * amt)));
  b = Math.max(0, Math.min(255, Math.round(b + b * amt)));
  return `rgb(${r},${g},${b})`;
}

/**
 * ХАРАКТЕР КАЖДОГО ЗАКЛИНАНИЯ.
 *
 * Поля:
 *   fly     — как летит: 'straight' | 'arc' | 'undulate' | 'inward' | 'drift'
 *   spin    — сколько оборотов за полёт (0 — не вращается)
 *   trail   — тип шлейфа: 'none' | 'dots' | 'streak' | 'smoke' | 'embers'
 *             | 'frost' | 'sparks' | 'wind' | 'glyphs'
 *   pulse   — насколько дышит размер (0 — ровный)
 *   halo    — форма свечения: 'round' | 'long' | 'wide' | 'none'
 *   emit    — что сыплется по пути: null | 'dust' | 'ember' | 'ice'
 *             | 'petal' | 'spark' | 'shadow'
 *   impact  — во что превращается при попадании
 *   draw    — своя геометрия корпуса (главное отличие)
 */
export const SPELL_FX = {
  // ---------------- РАНГ I ----------------
  spark: {
    fly: 'straight', spin: 0, trail: 'sparks', pulse: 0.35, halo: 'round',
    emit: 'spark', impact: 'burst', speed: 1.25,
    // Искра — торопливая и рваная: мелко дрожит, сыплет искрами назад.
    draw(c, o) {
      const j = o.jitter;
      const nx = o.x + j.x, ny = o.y + j.y;
      const r = o.r * (1 + Math.sin(o.time * 40) * 0.12);
      // Рваный язык огня, вытянутый по полёту.
      c.beginPath();
      c.moveTo(nx + o.dir * r * 1.5, ny);
      c.quadraticCurveTo(nx + o.dir * r * 0.2, ny - r * 0.75, nx - o.dir * r * 0.9, ny - r * 0.25);
      c.quadraticCurveTo(nx - o.dir * r * 0.3, ny, nx - o.dir * r * 0.9, ny + r * 0.25);
      c.quadraticCurveTo(nx + o.dir * r * 0.2, ny + r * 0.75, nx + o.dir * r * 1.5, ny);
      c.fillStyle = hexA(o.color, 0.95);
      c.fill();
      c.fillStyle = 'rgba(255,250,220,0.95)';
      c.beginPath();
      c.arc(nx + o.dir * r * 0.15, ny, r * 0.42, 0, Math.PI * 2);
      c.fill();
    },
  },

  pebble: {
    fly: 'arc', spin: 2.1, trail: 'dots', pulse: 0, halo: 'none',
    emit: 'dust', impact: 'shatter', speed: 0.95,
    // Камень — тяжёлый и тупой: кувыркается, почти не светится.
    draw(c, o) {
      c.rotate(o.spin);
      const r = o.r;
      c.beginPath();
      c.moveTo(o.dir * r * 1.15, 0);
      c.lineTo(r * 0.1, r * 0.95);
      c.lineTo(-o.dir * r * 1.0, r * 0.35);
      c.lineTo(-o.dir * r * 0.5, -r * 0.75);
      c.lineTo(o.dir * r * 0.45, -r * 0.9);
      c.closePath();
      // Камень — единственный, кто рисуется плотной заливкой с гранью,
      // а не свечением: он не «магия», а брошенный булыжник.
      c.fillStyle = shade(o.color, -0.35);
      c.fill();
      c.strokeStyle = hexA('#ffffff', 0.28);
      c.lineWidth = Math.max(1, r * 0.14);
      c.stroke();
    },
  },

  veil: {
    fly: 'drift', spin: 0.6, trail: 'smoke', pulse: 0.22, halo: 'wide',
    emit: null, impact: 'cloud', speed: 0.8,
    // Дымка — облако: клубится, растёт и почти не имеет контура.
    draw(c, o) {
      const r = o.r * (1.1 + o.prog * 0.9);
      for (let i = 0; i < 5; i++) {
        const a = o.time * 1.6 + (i / 5) * Math.PI * 2;
        const d = r * (0.35 + (i % 3) * 0.22);
        c.beginPath();
        c.arc(Math.cos(a) * d, Math.sin(a) * d * 0.8, r * (0.5 + (i % 2) * 0.2), 0, Math.PI * 2);
        c.fillStyle = hexA(o.color, 0.16);
        c.fill();
      }
      c.beginPath();
      c.arc(0, 0, r * 0.55, 0, Math.PI * 2);
      c.fillStyle = hexA(o.color, 0.3);
      c.fill();
    },
  },

  // ---------------- РАНГ II ----------------
  bolt: {
    fly: 'straight', spin: 0, trail: 'streak', pulse: 0, halo: 'long',
    emit: null, impact: 'burst', speed: 1.15,
    // Стрела — самый «чистый» снаряд: ровный, без украшений.
    draw(c, o) {
      const r = o.r;
      c.beginPath();
      c.moveTo(o.dir * r * 1.9, 0);
      c.lineTo(-o.dir * r * 0.6, r * 0.7);
      c.lineTo(-o.dir * r * 1.3, 0);
      c.lineTo(-o.dir * r * 0.6, -r * 0.7);
      c.closePath();
      c.fillStyle = hexA(o.color, 0.95);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.9)';
      c.beginPath();
      c.moveTo(o.dir * r * 1.5, 0);
      c.lineTo(-o.dir * r * 0.3, r * 0.22);
      c.lineTo(-o.dir * r * 0.3, -r * 0.22);
      c.closePath();
      c.fill();
    },
  },

  ward_pulse: {
    fly: 'straight', spin: 0, trail: 'wind', pulse: 0.5, halo: 'wide',
    emit: null, impact: 'wave', speed: 0.9,
    // Волна — расширяющаяся дуга: с каждым кадром шире и бледнее.
    draw(c, o) {
      const r = o.r * (0.8 + o.prog * 1.17);
      for (let k = 0; k < 3; k++) {
        c.beginPath();
        c.arc(0, 0, r * (1 - k * 0.22), -Math.PI * 0.6, Math.PI * 0.6);
        c.strokeStyle = hexA(o.color, 0.75 - k * 0.2);
        c.lineWidth = Math.max(1.5, o.r * (0.3 - k * 0.07));
        c.stroke();
      }
    },
  },

  mend: {
    fly: 'arc', spin: 0.5, trail: 'none', pulse: 0.3, halo: 'round',
    emit: 'petal', impact: 'bloom', speed: 0.75,
    // Лечение — не снаряд, а поднимающийся цветок: летит по дуге вверх.
    draw(c, o) {
      const r = o.r * (1 + o.prog * 0.25);
      c.rotate(o.spin * 0.4);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const cx = Math.cos(a) * r * 0.62, cy = Math.sin(a) * r * 0.62;
        c.beginPath();
        c.arc(cx, cy, r * 0.52, 0, Math.PI * 2);
        c.fillStyle = hexA(o.color, 0.55);
        c.fill();
      }
      c.beginPath();
      c.arc(0, 0, r * 0.45, 0, Math.PI * 2);
      c.fillStyle = 'rgba(240,255,240,0.95)';
      c.fill();
    },
  },

  // ---------------- РАНГ III ----------------
  lance: {
    fly: 'straight', spin: 0, trail: 'streak', pulse: 0, halo: 'long',
    emit: 'spark', impact: 'pierce', speed: 1.6,
    // Копьё — самое быстрое: длинный росчерк, узкий наконечник.
    draw(c, o) {
      const r = o.r;
      // Древко
      c.fillStyle = hexA(o.color, 0.75);
      c.fillRect(-o.dir * r * 2.4, -r * 0.13, o.dir * r * 3.0, r * 0.26);
      // Наконечник
      c.beginPath();
      c.moveTo(o.dir * r * 2.6, 0);
      c.lineTo(o.dir * r * 0.9, r * 0.58);
      c.lineTo(o.dir * r * 0.6, 0);
      c.lineTo(o.dir * r * 0.9, -r * 0.58);
      c.closePath();
      c.fillStyle = hexA(o.color, 0.98);
      c.fill();
      c.beginPath();
      c.moveTo(o.dir * r * 2.3, 0);
      c.lineTo(o.dir * r * 1.2, r * 0.2);
      c.lineTo(o.dir * r * 1.2, -r * 0.2);
      c.closePath();
      c.fillStyle = 'rgba(255,255,255,0.92)';
      c.fill();
    },
  },

  frost_bind: {
    fly: 'straight', spin: 0.35, trail: 'frost', pulse: 0.12, halo: 'round',
    emit: 'ice', impact: 'freeze', speed: 0.85,
    // Лёд — медленное вращение и иглы по граням, никакого огня.
    draw(c, o) {
      c.rotate(o.spin);
      const r = o.r;
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const rr = i % 2 === 0 ? r * 1.3 : r * 0.55;
        const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.closePath();
      c.fillStyle = hexA(o.color, 0.55);
      c.fill();
      c.strokeStyle = 'rgba(235,250,255,0.9)';
      c.lineWidth = Math.max(1, r * 0.12);
      c.stroke();
      // Иглы, торчащие из граней.
      c.strokeStyle = 'rgba(220,245,255,0.75)';
      c.lineWidth = Math.max(1, r * 0.1);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        c.beginPath();
        c.moveTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
        c.lineTo(Math.cos(a) * r * 1.65, Math.sin(a) * r * 1.65);
        c.stroke();
      }
    },
  },

  flame_wall: {
    fly: 'undulate', spin: 0, trail: 'embers', pulse: 0.45, halo: 'wide',
    emit: 'ember', impact: 'burn', speed: 0.9,
    // Пламя — живое: колышется, дышит, оставляет угли.
    draw(c, o) {
      const wob = Math.sin(o.time * 14) * 0.22;
      const r = o.r * (1 + Math.sin(o.time * 11) * 0.14);
      c.beginPath();
      c.moveTo(0, -r * 1.6);
      c.quadraticCurveTo(o.dir * r * (1.25 + wob), -r * 0.3, o.dir * r * 0.35, r * 0.85);
      c.quadraticCurveTo(0, r * 0.25, -o.dir * r * (0.6 - wob), r * 1.0);
      c.quadraticCurveTo(-o.dir * r * 0.95, -r * 0.25, 0, -r * 1.6);
      c.fillStyle = hexA(o.color, 0.9);
      c.fill();
      ctx2(c, 0, r * 0.15, r * 0.42, 'rgba(255,245,200,0.9)');
    },
  },

  // ---------------- РАНГ IV ----------------
  mirror: {
    fly: 'straight', spin: 0, trail: 'glyphs', pulse: 0.18, halo: 'round',
    emit: 'spark', impact: 'split', speed: 1.0,
    // Зеркало — призма, которая делит свет: два бледных двойника рядом.
    draw(c, o) {
      const r = o.r;
      for (const off of [-0.75, 0.75]) {
        c.save();
        c.translate(0, off * r);
        c.beginPath();
        c.moveTo(0, -r * 1.25);
        c.lineTo(r * 1.05, r * 0.85);
        c.lineTo(-r * 1.05, r * 0.85);
        c.closePath();
        c.fillStyle = hexA('#ffffff', 0.13);
        c.fill();
        c.restore();
      }
      c.beginPath();
      c.moveTo(0, -r * 1.4);
      c.lineTo(r * 1.2, r * 0.92);
      c.lineTo(-r * 1.2, r * 0.92);
      c.closePath();
      c.fillStyle = hexA(o.color, 0.8);
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.9)';
      c.lineWidth = Math.max(1, r * 0.12);
      c.stroke();
      // Радужная грань — единственное место в игре с переливом.
      const g = c.createLinearGradient(-r, -r, r, r);
      g.addColorStop(0, 'rgba(255,120,200,0.55)');
      g.addColorStop(0.5, 'rgba(140,220,255,0.55)');
      g.addColorStop(1, 'rgba(180,255,180,0.55)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(0, -r * 0.9);
      c.lineTo(r * 0.72, r * 0.6);
      c.lineTo(-r * 0.72, r * 0.6);
      c.closePath();
      c.fill();
    },
  },

  siphon: {
    fly: 'inward', spin: -1.4, trail: 'smoke', pulse: 0.3, halo: 'round',
    emit: 'shadow', impact: 'drain', speed: 0.8,
    // Воронка — щупальца, которые сходятся к центру и тянут к себе.
    draw(c, o) {
      c.rotate(o.spin);
      const r = o.r;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        c.beginPath();
        c.moveTo(Math.cos(a) * r * 1.7, Math.sin(a) * r * 1.7);
        c.quadraticCurveTo(
          Math.cos(a + 0.6) * r * 0.9, Math.sin(a + 0.6) * r * 0.9,
          Math.cos(a + 1.1) * r * 0.25, Math.sin(a + 1.1) * r * 0.25,
        );
        c.strokeStyle = hexA(o.color, 0.8 - i * 0.13);
        c.lineWidth = Math.max(1.5, r * 0.22);
        c.stroke();
      }
      c.beginPath();
      c.arc(0, 0, r * 0.5, 0, Math.PI * 2);
      c.fillStyle = hexA('#1a0033', 0.85);
      c.fill();
    },
  },

  tempest: {
    fly: 'undulate', spin: 1.1, trail: 'wind', pulse: 0.28, halo: 'wide',
    emit: null, impact: 'gust', speed: 1.05,
    // Вихрь — ромб в кольцах ветра, крутится быстрее всех.
    draw(c, o) {
      c.rotate(o.spin);
      const r = o.r;
      for (let k = 0; k < 3; k++) {
        c.beginPath();
        c.ellipse(0, 0, r * (1.5 - k * 0.3), r * (0.95 - k * 0.2), k * 0.5, 0, Math.PI * 2);
        c.strokeStyle = hexA(o.color, 0.42 - k * 0.1);
        c.lineWidth = Math.max(1, r * 0.12);
        c.stroke();
      }
      c.beginPath();
      c.moveTo(0, -r * 1.35);
      c.lineTo(r * 0.9, 0);
      c.lineTo(0, r * 1.35);
      c.lineTo(-r * 0.9, 0);
      c.closePath();
      c.fillStyle = hexA(o.color, 0.9);
      c.fill();
    },
  },

  // ---------------- РАНГ V ----------------
  judgment: {
    fly: 'drift', spin: 0.22, trail: 'glyphs', pulse: 0.2, halo: 'wide',
    emit: 'spark', impact: 'seal', speed: 0.7,
    // Приговор — торжественный и медленный: кольца печати и насечки.
    draw(c, o) {
      c.rotate(o.spin);
      const r = o.r;
      for (let k = 0; k < 3; k++) {
        const rr = r * (1.7 - k * 0.35);
        c.beginPath();
        c.arc(0, 0, rr, 0, Math.PI * 2);
        c.strokeStyle = hexA(o.color, 0.5 - k * 0.12);
        c.lineWidth = Math.max(1, r * 0.09);
        c.stroke();
      }
      c.beginPath();
      c.arc(0, 0, r * 0.85, 0, Math.PI * 2);
      c.strokeStyle = hexA(o.color, 0.95);
      c.lineWidth = Math.max(1.5, r * 0.16);
      c.stroke();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        c.beginPath();
        c.moveTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85);
        c.lineTo(Math.cos(a) * r * 1.45, Math.sin(a) * r * 1.45);
        c.strokeStyle = hexA(o.color, 0.8);
        c.lineWidth = Math.max(1, r * 0.1);
        c.stroke();
      }
    },
  },

  vortex: {
    fly: 'inward', spin: 1.9, trail: 'shadow', pulse: 0.15, halo: 'none',
    emit: 'shadow', impact: 'collapse', speed: 0.75,
    // Бездна — спираль, которая с каждым кадром затягивается туже.
    draw(c, o) {
      const r = o.r;
      c.beginPath();
      for (let i = 0; i < 60; i++) {
        const a = i * 0.34 + o.spin;
        const rr = (i / 60) * r * (1.6 - o.prog * 0.5);
        const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.strokeStyle = hexA(o.color, 0.9);
      c.lineWidth = Math.max(2, r * 0.3);
      c.lineCap = 'round';
      c.stroke();
      c.beginPath();
      c.arc(0, 0, r * 0.3, 0, Math.PI * 2);
      c.fillStyle = 'rgba(0,0,0,0.9)';
      c.fill();
    },
  },
};

/** Маленький помощник: круг заданным цветом. */
function ctx2(c, x, y, r, fill) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
}

/** Профиль по умолчанию, если у заклинания своего нет. */
const DEFAULT_FX = {
  fly: 'straight', spin: 0.5, trail: 'dots', pulse: 0.2, halo: 'round',
  emit: null, impact: 'burst', speed: 1,
  draw(c, o) {
    c.beginPath();
    c.arc(0, 0, o.r, 0, Math.PI * 2);
    c.fillStyle = hexA(o.color, 0.9);
    c.fill();
  },
};

/** Характер заклинания по его символу. */
export function fxFor(sigil) {
  return SPELL_FX[sigil?.id] || DEFAULT_FX;
}

/**
 * Полёт снаряда с учётом характера.
 * Возвращает позицию и поправки для текущего кадра.
 */
export function flightOf(fx, from, to, prog, r, time, seed = 0) {
  let t = prog;
  if (fx.fly === 'arc') {
    // Камень и лечение идут по дуге: чуть выше середины пути.
    t = prog;
  } else if (fx.fly === 'undulate') {
    t = prog;
  } else if (fx.fly === 'drift') {
    // Медленное «плавание»: чуть отстаёт в начале.
    t = 1 - Math.pow(1 - prog, 1.6);
  } else if (fx.fly === 'inward') {
    // Затягивание: сначала быстро, потом всё медленнее к цели.
    t = Math.pow(prog, 0.72);
  }
  const x = from.x + (to.x - from.x) * t;
  let y = from.y + (to.y - from.y) * t;

  // Дополнительная высота дуги.
  if (fx.fly === 'arc') y -= Math.sin(t * Math.PI) * r * 2.4;
  if (fx.fly === 'undulate') y += Math.sin(time * 9 + seed) * r * 0.75;
  if (fx.fly === 'drift') y += Math.sin(time * 2.2 + seed) * r * 0.5;

  // Мелкая дрожь у быстрых.
  const jx = fx.fly === 'straight' && fx.pulse > 0.3 ? Math.sin(time * 47 + seed) * r * 0.12 : 0;
  const jy = fx.fly === 'straight' && fx.pulse > 0.3 ? Math.cos(time * 39 + seed) * r * 0.12 : 0;

  return { x, y, t, jitter: { x: jx, y: jy } };
}

/**
 * Рисует снаряд целиком: ореол, шлейф, искры и корпус.
 *
 * @param {CanvasRenderingContext2D} c
 * @param {object} o {sigil, fx, color, from, to, prog, r, dir, time, seed}
 */
export function drawSpellV2(c, o) {
  const fx = o.fx || DEFAULT_FX;
  const r = o.r;
  const pos = flightOf(fx, o.from, o.to, o.prog, r, o.time, o.seed || 0);

  c.save();

  // --- ОРЕОЛ: форма зависит от характера ---
  if (fx.halo !== 'none') {
    const hw = fx.halo === 'long' ? r * 4.5 : fx.halo === 'wide' ? r * 3.6 : r * 3;
    const hh = fx.halo === 'long' ? r * 1.1 : fx.halo === 'wide' ? r * 2.2 : r * 3;
    const g = c.createRadialGradient(0, 0, 0, 0, 0, hw);
    g.addColorStop(0, hexA('#ffffff', 0.9));
    g.addColorStop(0.3, hexA(o.color, 0.75));
    g.addColorStop(1, hexA(o.color, 0));
    c.save();
    c.translate(pos.x, pos.y);
    c.scale(hw / (hw || 1), hh / (hw || 1));
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, hw, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  // --- ШЛЕЙФ ---
  drawTrailV2(c, fx, o, pos);

  // --- ИСКРЫ/ЧАСТИЦЫ ПО ПУТИ ---
  if (fx.emit) drawEmitV2(c, fx, o, pos);

  // --- КОРПУС ---
  const pulse = 1 + Math.sin(o.time * 12) * (fx.pulse * 0.18);
  c.save();
  c.translate(pos.x, pos.y);
  c.shadowColor = o.color;
  c.shadowBlur = fx.halo === 'none' ? 6 : 16;
  fx.draw(c, {
    x: 0, y: 0, r: r * pulse, dir: o.dir, prog: o.prog, time: o.time,
    color: o.color, spin: o.prog * Math.PI * 2 * fx.spin,
    jitter: pos.jitter,
  });
  c.restore();

  c.restore();
}

/** Шлейф — то, что сильнее всего отличает заклинания друг от друга. */
function drawTrailV2(c, fx, o, pos) {
  const r = o.r;
  const back = { x: o.from.x, y: o.from.y };
  const steps = fx.trail === 'streak' ? 9 : fx.trail === 'smoke' ? 4 : 6;

  for (let i = 1; i <= steps; i++) {
    const tp = Math.max(0, (o.prog * steps - i) / steps);
    const fpos = flightOf(fx, back, o.to, tp, r, o.time, o.seed || 0);
    const fade = 1 - i / (steps + 1);
    const dx = pos.x - fpos.x, dy = pos.y - fpos.y;

    switch (fx.trail) {
      case 'streak': { // тонкий длинный росчерк (копьё, стрела)
        c.beginPath();
        c.moveTo(pos.x, pos.y);
        c.lineTo(fpos.x, fpos.y);
        c.strokeStyle = hexA(o.color, 0.35 * fade);
        c.lineWidth = Math.max(1, r * 0.5 * fade);
        c.lineCap = 'round';
        c.stroke();
        break;
      }
      case 'smoke': { // клубы дыма, растут и бледнеют
        const rad = r * (0.5 + i * 0.3);
        ctx2(c, fpos.x, fpos.y, rad, hexA(o.color, 0.13 * fade));
        break;
      }
      case 'embers': { // угли: падают вниз
        ctx2(c, fpos.x + Math.sin(o.time * 6 + i) * r * 0.5,
          fpos.y - i * r * 0.4 + (i % 2) * r * 0.3, r * 0.22 * fade, hexA('#ffcc66', 0.7 * fade));
        break;
      }
      case 'frost': { // ледяная крошка: мелкие ромбики
        c.save();
        c.translate(fpos.x, fpos.y);
        c.rotate(Math.PI / 4);
        c.fillStyle = hexA('#dff4ff', 0.6 * fade);
        c.fillRect(-r * 0.18, -r * 0.18, r * 0.36, r * 0.36);
        c.restore();
        break;
      }
      case 'sparks': { // искры: рваные точки
        ctx2(c, fpos.x + dx * 0.2, fpos.y + dy * 0.2, r * 0.3 * fade, hexA('#ffd27f', 0.75 * fade));
        break;
      }
      case 'wind': { // дуги ветра
        c.beginPath();
        c.arc(fpos.x, fpos.y, r * (0.9 + i * 0.25), o.time * 3 + i, o.time * 3 + i + 1.1);
        c.strokeStyle = hexA(o.color, 0.3 * fade);
        c.lineWidth = Math.max(1, r * 0.14);
        c.stroke();
        break;
      }
      case 'glyphs': { // миниатюрные руны, тают
        c.save();
        c.translate(fpos.x, fpos.y);
        c.rotate(o.time * 1.5 + i * 0.8);
        c.strokeStyle = hexA(o.color, 0.4 * fade);
        c.lineWidth = Math.max(1, r * 0.1);
        c.beginPath();
        c.moveTo(-r * 0.3, 0); c.lineTo(0, -r * 0.3); c.lineTo(r * 0.3, 0); c.lineTo(0, r * 0.3);
        c.closePath();
        c.stroke();
        c.restore();
        break;
      }
      case 'shadow': { // тёмные лоскуты
        ctx2(c, fpos.x + Math.sin(o.time * 4 + i) * r * 0.4,
          fpos.y + Math.cos(o.time * 5 + i) * r * 0.4, r * 0.35 * fade, hexA('#2a0044', 0.5 * fade));
        break;
      }
      default: { // dots — ровные горошины
        ctx2(c, fpos.x, fpos.y, r * 0.45 * fade, hexA(o.color, 0.2 * fade));
      }
    }
  }
}

/** Частицы, которые заклинание сыплет по пути. */
function drawEmitV2(c, fx, o, pos) {
  const r = o.r;
  const n = 3;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + o.time * 2;
    const d = r * (0.8 + (i % 2) * 0.5);
    const px = pos.x + Math.cos(a) * d;
    const py = pos.y + Math.sin(a) * d;
    switch (fx.emit) {
      case 'dust':
        ctx2(c, px, py, r * 0.2, 'rgba(190,170,140,0.5)');
        break;
      case 'ember':
        ctx2(c, px, py - (o.time * 30 % 12), r * 0.16, 'rgba(255,190,90,0.75)');
        break;
      case 'ice':
        ctx2(c, px, py, r * 0.14, 'rgba(220,245,255,0.85)');
        break;
      case 'petal':
        ctx2(c, px, py, r * 0.22, hexA(o.color, 0.4));
        break;
      case 'spark':
        ctx2(c, px, py, r * 0.11, 'rgba(255,245,210,0.9)');
        break;
      case 'shadow':
        ctx2(c, px, py, r * 0.28, 'rgba(20,0,40,0.45)');
        break;
    }
  }
}

/**
 * ЭФФЕКТ ПОПАДАНИЯ — тоже свой у каждого заклинания.
 * progress: 0 → только что попал, 1 → эффект погас.
 */
export function drawImpactV2(c, fx, o) {
  const p = o.progress;
  const r = o.r;
  const fade = 1 - p;
  if (p >= 1) return;

  c.save();
  c.translate(o.x, o.y);

  switch (fx.impact) {
    case 'shatter': { // камень разлетается осколками
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const d = r * p * 3.2;
        c.save();
        c.translate(Math.cos(a) * d, Math.sin(a) * d);
        c.rotate(a + p * 4);
        c.fillStyle = `rgba(190,170,140,${fade})`;
        c.fillRect(-r * 0.25, -r * 0.25, r * 0.5, r * 0.5);
        c.restore();
      }
      break;
    }
    case 'pierce': { // копьё пробивает: узкий длинный всплеск
      c.strokeStyle = hexA(o.color, fade);
      c.lineWidth = Math.max(1, r * 0.4 * fade);
      c.beginPath();
      c.moveTo(-o.dir * r * 3 * p, 0);
      c.lineTo(o.dir * r * 3 * p, 0);
      c.stroke();
      break;
    }
    case 'freeze': { // лёд: расходящиеся лучи
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(Math.cos(a) * r * 3 * p, Math.sin(a) * r * 3 * p);
        c.strokeStyle = `rgba(200,240,255,${fade * 0.8})`;
        c.lineWidth = Math.max(1, r * 0.2 * fade);
        c.stroke();
      }
      break;
    }
    case 'wave':  // волна: кольцо
    case 'gust':
    case 'cloud':
    case 'drain': {
      c.beginPath();
      c.arc(0, 0, r * (1 + p * 3.4), 0, Math.PI * 2);
      c.strokeStyle = hexA(o.color, fade * 0.75);
      c.lineWidth = Math.max(1, r * 0.35 * fade);
      c.stroke();
      break;
    }
    case 'seal':    // печать: две встречные окружности
    case 'collapse': {
      for (const s of [1, -1]) {
        c.beginPath();
        c.arc(0, 0, r * (1 + p * 2.6) * s, 0, Math.PI * 2);
        c.strokeStyle = hexA(o.color, fade * 0.6);
        c.lineWidth = Math.max(1, r * 0.25 * fade);
        c.stroke();
      }
      break;
    }
    case 'burn': { // пламя: вспышка вверх
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.4;
        ctx2(c, Math.cos(a) * r * p * 2.4, Math.sin(a) * r * p * 2.4,
          r * 0.5 * fade, hexA('#ffae42', fade * 0.7));
      }
      break;
    }
    case 'bloom': { // лечение: лепестки наружу
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + p;
        ctx2(c, Math.cos(a) * r * p * 2.2, Math.sin(a) * r * p * 2.2,
          r * 0.35 * fade, hexA(o.color, fade * 0.6));
      }
      break;
    }
    case 'split': // зеркало: три кольца
    case 'burst':
    default: {
      c.beginPath();
      c.arc(0, 0, r * (0.6 + p * 2.8), 0, Math.PI * 2);
      c.strokeStyle = hexA(o.color, fade);
      c.lineWidth = Math.max(1, r * 0.45 * fade);
      c.stroke();
      ctx2(c, 0, 0, r * 0.8 * fade, hexA('#ffffff', fade * 0.9));
    }
  }
  c.restore();
}

/**
 * ПОДКЛЮЧЕНИЕ К БОЮ (если решите перенести в игру).
 *
 * В main.js функция drawProjectiles() сейчас рисует одинаковый ореол и
 * шлейф для всех. Замена — обернуть её вызов:
 *
 *   import { drawSpellV2, fxFor } from './render/spell-fx.js';
 *
 *   const fx = fxFor(p.sigil);
 *   drawSpellV2(ctx, {
 *     sigil: p.sigil, fx, color: p.color,
 *     from: { x: p.from === 'player' ? W * 0.32 : W * 0.62, y: H * 0.55 },
 *     to:   { x: p.from === 'player' ? W * 0.62 : W * 0.32, y: H * 0.55 },
 *     prog: p.t / p.dur, r: 8 + p.tier * 4,
 *     dir: p.from === 'player' ? 1 : -1,
 *     time: performance.now() / 1000, seed: p.seed || 0,
 *   });
 *
 * И на попадание — drawImpactV2 с fx того же заклинания.
 * Сейчас этот файл никем не импортируется: рабочая версия не затронута.
 */
export const SPELL_FX_IDS = Object.keys(SPELL_FX);
