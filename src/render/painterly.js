/**
 * ЖИВОПИСНЫЙ СЛОЙ.
 *
 * Игра рисует фигуры векторными примитивами — эллипсами и путями
 * с плоской заливкой. Это читаемо, но выглядит как аппликация:
 * у формы нет объёма, материал не сообщает, из чего он сделан.
 *
 * Здесь собраны приёмы, которые превращают плоскую заливку в
 * живопись. Все они — надстройка ПОВЕРХ готового силуэта, поэтому
 * ни одна существующая фигура не ломается: слой включается
 * флагом и рисует только то, что ему разрешено.
 *
 * ПРИЁМЫ (сняты с референсного бестиария):
 *
 *   1. НАПРАВЛЕННЫЙ СВЕТ. Источник сверху-слева. Верхняя левая
 *      часть формы светлеет, нижняя правая уходит в тень. Без
 *      этого фигура выглядит наклейкой.
 *
 *   2. ХОЛОДНЫЕ ТЕНИ. Тень не «тот же цвет темнее», а сдвиг в
 *      синеву. Это главный признак живописи: тёплый свет и
 *      холодная тень дают глубину, которой нет у плоской заливки.
 *
 *   3. ТЁПЛЫЕ БЛИКИ. На металле и коже — узкие пятна почти
 *      белого с тёплым оттенком. Именно блики читаются как
 *      «полированный доспех» или «лоснящаяся кожа».
 *
 *   4. ТЁМНЫЙ КОНТУР. Фигура обводится не ярким акцентом, а
 *      затемнённым цветом самой формы. Так силуэт отделяется от
 *      фона, но не выглядит нарисованным фломастером.
 *
 *   5. ЦВЕТНОЙ РЕФЛЕКС. Снизу в форму подмешивается цвет пола —
 *      свет, отражённый от земли. Мелочь, но без неё фигура
 *      «висит» над ареной, а не стоит на ней.
 */

/** Сдвиг цвета в синеву — «холодная тень». */
export function coolShade(hex, k) {
  const { r, g, b } = parseHex(hex);
  // Синий поднимаем сильнее красного: тень не просто темнеет,
  // она уходит в холод.
  return rgb(
    Math.round(clamp(r * (1 - k) + 10 * k)),
    Math.round(clamp(g * (1 - k) + 18 * k)),
    Math.round(clamp(b * (1 - k) + 46 * k))
  );
}

/** Сдвиг цвета в тепло — «тёплый блик». */
export function warmLight(hex, k) {
  const { r, g, b } = parseHex(hex);
  return rgb(
    Math.round(clamp(r + (255 - r) * k)),
    Math.round(clamp(g + (238 - g) * k * 0.9)),
    Math.round(clamp(b + (196 - b) * k * 0.72))
  );
}

function parseHex(hex) {
  const h = String(hex || '#888888').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  if (!Number.isFinite(n)) return { r: 136, g: 136, b: 136 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgb(r, g, b) {
  const h = (v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
  return '#' + h(r) + h(g) + h(b);
}

function clamp(v) {
  return Math.max(0, Math.min(255, v));
}

/**
 * Объёмная заливка формы с направленным светом.
 *
 * Рисует эллипс, залитый градиентом от тёплого света в левом
 * верхнем углу к холодной тени в правом нижнем. Это замена
 * обычному `fillStyle = цвет; fill()`.
 *
 * @param ctx
 * @param x, y, rx, ry  — геометрия эллипса
 * @param base          — основной цвет материала
 * @param amount        — сила объёма (0..1). 0.5 — мягко, 0.9 — металл
 * @param rot           — поворот эллипса
 * @param groundReflect — цвет отражённого от земли света (для рефлекса снизу)
 */
export function volumeEllipse(ctx, x, y, rx, ry, base, amount = 0.55, rot = 0, groundReflect = null) {
  // Градиент вдоль диагонали «свет → тень»: от левого верха к правому низу.
  const g = ctx.createLinearGradient(x - rx * 0.8, y - ry * 0.9, x + rx * 0.7, y + ry * 0.9);
  g.addColorStop(0, warmLight(base, Math.min(0.95, amount * 0.85)));
  g.addColorStop(0.34, base);
  g.addColorStop(0.78, coolShade(base, amount * 0.42));
  g.addColorStop(1, coolShade(base, amount * 0.7));

  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();

  // Рефлекс снизу: фигура стоит на земле, а не парит.
  if (groundReflect) {
    const rg = ctx.createRadialGradient(x, y + ry * 0.72, 0, x, y + ry * 0.72, rx * 0.85);
    rg.addColorStop(0, hexA(groundReflect, 0.22 * amount));
    rg.addColorStop(1, hexA(groundReflect, 0));
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Узкий блик — «полировка».
 *
 * На металле и коже блик не размазан по всей форме, а сидит
 * узкой полосой со стороны света. Рисуется как маленький
 * вытянутый эллипс почти белого цвета.
 */
export function specular(ctx, x, y, rx, ry, rot, intensity = 0.7) {
  if (intensity <= 0.02) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
  g.addColorStop(0, `rgba(255, 248, 232, ${0.85 * intensity})`);
  g.addColorStop(0.55, `rgba(255, 240, 214, ${0.30 * intensity})`);
  g.addColorStop(1, 'rgba(255, 240, 214, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Тёмный контур силуэта.
 *
 * Обводит уже нарисованную форму затемнённым цветом её самой,
 * а не акцентом. Приём повторяет референс: фигуры там отделены
 * от фона тёмной обводкой, но она не бросается в глаза.
 */
export function inkOutline(ctx, pathFn, base, width, alpha = 0.55) {
  ctx.save();
  ctx.strokeStyle = hexA(coolShade(base, 0.78), alpha);
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  pathFn(ctx);
  ctx.stroke();
  ctx.restore();
}

/**
 * Вертикальная штриховка объёма — «мазок».
 *
 * Живопись не бывает идеально гладкой: по форме идут короткие
 * мазки. Здесь они имитируются полупрозрачными дугами, идущими
 * по направлению света. Очень низкая альфа — это текстура, а не
 * линии; если перебрать, фигура станет полосатой.
 */
export function brushStrokes(ctx, x, y, w, h, base, count = 7, seed = 0) {
  ctx.save();
  // Мягкая кисть: полупрозрачные мазки поверх формы.
  for (let i = 0; i < count; i++) {
    // Псевдослучайное, но детерминированное распределение:
    // фигура не должна мерцать от кадра к кадру.
    const f = (i + 0.5) / count;
    const jitter = Math.sin(seed + i * 2.399) * 0.5 + 0.5;

    const sx = x - w * 0.34 + w * 0.68 * f * 0.55 + (jitter - 0.5) * w * 0.3;
    const sy = y - h * 0.42 + h * 0.84 * f;
    const len = h * (0.14 + jitter * 0.12);
    const tilt = -0.42 + (jitter - 0.5) * 0.16;

    const light = f < 0.28;
    ctx.strokeStyle = light
      ? hexA(warmLight(base, 0.5), 0.13)
      : hexA(coolShade(base, 0.5), 0.11);
    ctx.lineWidth = w * (0.05 + jitter * 0.035);
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(sx, sy - len * 0.5);
    ctx.quadraticCurveTo(
      sx + Math.sin(tilt) * len * 0.5,
      sy,
      sx + Math.sin(tilt) * len,
      sy + len * 0.5
    );
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Полный живописный слой для фигуры человека/гуманоида.
 *
 * Вызывается ПОСЛЕ того, как тело и голова нарисованы плоской
 * заливкой. Накладывает объём, блик и контур поверх готовой
 * геометрии, не меняя её формы.
 *
 * @param geo  { robeTop, bodyH, bodyW } — геометрия из drawBody
 */
export function paintFigure(ctx, cx, baseY, scale, pal, geo, t, opts = {}) {
  const { robeTop, bodyH, bodyW } = geo;
  if (!Number.isFinite(robeTop) || !Number.isFinite(bodyH) || bodyH <= 0) return;

  const strong = opts.strong ?? 0.6;
  const ground = opts.groundReflect || pal.accent;

  // --- Свет со стороны: мягкое пятно там, откуда падает свет.
  //
  // Накладывается на весь силуэт целиком, поэтому форма читается
  // как выпуклая, даже если нарисована плоскими эллипсами.
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';

  const lx = cx - bodyW * 0.55;
  const ly = robeTop + bodyH * 0.18;
  const lr = Math.max(bodyW, bodyH * 0.55) * 1.05;

  const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
  lg.addColorStop(0, `rgba(255, 246, 224, ${0.30 * strong})`);
  lg.addColorStop(0.5, `rgba(255, 240, 210, ${0.11 * strong})`);
  lg.addColorStop(1, 'rgba(255, 240, 210, 0)');
  ctx.fillStyle = lg;
  ctx.fillRect(cx - bodyW * 2, robeTop - scale, bodyW * 4, bodyH + scale * 2);

  // --- Тень с противоположной стороны.
  const sx2 = cx + bodyW * 0.62;
  const sy2 = robeTop + bodyH * 0.62;
  const sg = ctx.createRadialGradient(sx2, sy2, 0, sx2, sy2, lr * 0.95);
  sg.addColorStop(0, `rgba(28, 34, 62, ${0.34 * strong})`);
  sg.addColorStop(0.6, `rgba(28, 34, 62, ${0.13 * strong})`);
  sg.addColorStop(1, 'rgba(28, 34, 62, 0)');
  ctx.fillStyle = sg;
  ctx.fillRect(cx - bodyW * 2, robeTop - scale, bodyW * 4, bodyH + scale * 2);

  // --- Рефлекс от земли снизу.
  const rg = ctx.createLinearGradient(cx, baseY - bodyH * 0.30, cx, baseY);
  rg.addColorStop(0, hexA(ground, 0));
  rg.addColorStop(1, hexA(ground, 0.26 * strong));
  ctx.fillStyle = rg;
  ctx.fillRect(cx - bodyW * 2, baseY - bodyH * 0.30, bodyW * 4, bodyH * 0.30);

  ctx.restore();

  // --- Мазки: живописная фактура по корпусу.
  brushStrokes(ctx, cx, robeTop + bodyH * 0.5, bodyW * 1.5, bodyH * 0.8, pal.robe || '#5a4a6a', 6, 1.7);

  // --- Контур: тёмная обводка силуэта одежды.
  inkOutline(ctx, (c) => {
    c.moveTo(cx - bodyW * 0.55, robeTop);
    c.quadraticCurveTo(cx - bodyW * 1.15, robeTop + bodyH * 0.5, cx - bodyW * 0.88, baseY);
    c.lineTo(cx + bodyW * 0.88, baseY);
    c.quadraticCurveTo(cx + bodyW * 1.15, robeTop + bodyH * 0.5, cx + bodyW * 0.55, robeTop);
  }, pal.robe || '#5a4a6a', scale * 0.05, 0.45);
}

/** hex + альфа → rgba(). */
export function hexA(hex, a) {
  const { r, g, b } = parseHex(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/**
 * Заливка готового пути объёмным градиентом.
 *
 * В отличие от volumeEllipse работает с любой формой: вызывающая
 * сторона сама строит путь (тело, крыло, лапу), а эта функция
 * только красит его так, будто свет падает сверху-слева.
 *
 * @param ctx
 * @param pathFn  функция, строящая путь через ctx
 * @param base    основной цвет
 * @param bounds  {x, y, w, h} — габариты формы, вокруг них считается свет
 * @param opts    { light, shadow, rim } — сила света, тени и подсветки края
 */
export function paintPath(ctx, pathFn, base, bounds, opts = {}) {
  const light = opts.light ?? 0.42;
  const shadow = opts.shadow ?? 0.50;
  const warm = opts.warm ?? '#ffe6b0';

  const { x, y, w, h } = bounds;
  // Градиент идёт по диагонали: левый верх — свет, правый низ — тень.
  const g = ctx.createLinearGradient(x - w * 0.35, y - h * 0.45, x + w * 0.45, y + h * 0.55);
  g.addColorStop(0, mixHex(base, warm, light));
  g.addColorStop(0.30, base);
  g.addColorStop(0.72, coolShade(base, shadow * 0.55));
  g.addColorStop(1, coolShade(base, shadow));

  ctx.fillStyle = g;
  ctx.beginPath();
  pathFn(ctx);
  ctx.fill();
}

/**
 * Подсветка края со стороны света — «rim light».
 *
 * В референсе у каждой фигуры есть тонкая светлая полоска по
 * верхнему левому контуру. Именно она отделяет существо от тёмного
 * фона и читается как объём, а не как наклейка.
 */
export function rimLight(ctx, pathFn, bounds, color = '#fff2cc', strength = 0.5) {
  ctx.save();
  ctx.strokeStyle = hexA(color, strength);
  ctx.lineWidth = Math.max(0.8, bounds.w * 0.018);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  pathFn(ctx);
  ctx.stroke();
  ctx.restore();
}

/**
 * Чешуя по поверхности формы.
 *
 * Кладётся рядами, каждый следующий ряд смещён на полшага — так
 * получается «кирпичная» кладка, которая читается как чешуя.
 * Чешуйки не плоские: у каждой сверху светлый блик, снизу тень.
 *
 * Форма ограничивается областью через clip, поэтому чешуя не
 * вылезает за контур тела.
 *
 * @param clipFn  путь-ограничитель (тело существа)
 * @param region  {x, y, w, h} — где раскладывать чешуйки
 * @param size    размер чешуйки в пикселях
 */
export function scaleTexture(ctx, clipFn, region, base, size, opts = {}) {
  const rows = Math.max(1, Math.floor(region.h / (size * 0.62)));
  const cols = Math.max(1, Math.floor(region.w / size) + 2);
  const alpha = opts.alpha ?? 0.30;
  const dark = opts.dark ?? -0.42;
  const lite = opts.light ?? 0.30;

  ctx.save();
  ctx.beginPath();
  clipFn(ctx);
  ctx.clip();

  for (let r = 0; r < rows; r++) {
    const cy = region.y + r * size * 0.62 + size * 0.3;
    // Полшага вбок на нечётных рядах.
    const offset = (r % 2) ? size * 0.5 : 0;
    for (let c = 0; c < cols; c++) {
      const cx2 = region.x - size + c * size + offset;

      // Сама чешуйка: тень снизу.
      ctx.fillStyle = hexA(coolShade(base, 0.45), alpha * 0.75);
      ctx.beginPath();
      ctx.ellipse(cx2, cy + size * 0.10, size * 0.46, size * 0.30, 0, 0, Math.PI * 2);
      ctx.fill();

      // Блик сверху.
      ctx.fillStyle = hexA(warmLight(base, lite), alpha);
      ctx.beginPath();
      ctx.ellipse(cx2, cy - size * 0.05, size * 0.34, size * 0.19, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * Смешать два цвета. t=0 → a, t=1 → b.
 */
export function mixHex(a, b, t) {
  const A = parseHex(a);
  const B = parseHex(b);
  const f = Math.max(0, Math.min(1, t));
  return rgb(
    Math.round(A.r + (B.r - A.r) * f),
    Math.round(A.g + (B.g - A.g) * f),
    Math.round(A.b + (B.b - A.b) * f)
  );
}

/**
 * Мазок — короткая кривая с переменной толщиной.
 *
 * Живописная фактура не линиями одинаковой толщины, а мазками,
 * которые «нажимают» сильнее в начале и сходят на нет к концу.
 * Здесь это эллипс, повёрнутый по направлению мазка.
 */
export function brushDab(ctx, x, y, len, thick, rot, color, alpha) {
  ctx.save();
  ctx.fillStyle = hexA(color, alpha);
  ctx.beginPath();
  ctx.ellipse(x, y, len * 0.5, thick * 0.5, rot, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
