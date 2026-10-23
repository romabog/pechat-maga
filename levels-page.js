(function () {
  const { ENEMIES, BOSS_LEVELS, SPECIES } = __mod_data_enemies;
  const { drawArena, drawBossArena, biomeFor, TIMES, timeOfDay } = __mod_render_arenas;
  const { drawCharacter } = __mod_render_character;


  /*
    ПЕРЕКЛЮЧАТЕЛЬ ВРАГОВ ПО УРОВНЯМ
    ==============================
    Показывает противника каждого уровня. Смена уровня мгновенная:
    фигура перерисовывается на следующем кадре.

    Источник данных — тот же, что у самой игры (src/data/enemies.js),
    поэтому здесь видно ровно то, что встретится в бою.
  */



  const canvas = document.getElementById('arena');
  const ctx = canvas.getContext('2d');

  let W = 0, H = 0;
  let current = 1;
  let frozenT = 0;
  let lastNow = 0;
  // Показывать ли вторую форму стража. Переключается кнопкой
  // «Фаза 2» и действует только на боссов.
  let phase2 = false;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));

  const byLevel = (l) => ENEMIES.find((e) => e.level === l) || ENEMIES[0];

  /**
   * Русские названия видов.
   *
   * В этом варианте игры виды — существа Подземелья, поэтому словарь
   * свой. Неизвестный ключ показывается как есть: лучше сырое слово,
   * чем пустая подпись.
   */
  const SPECIES_RU = {
    aasimar: 'аасимар', tiefling: 'тифлинг', dwarf: 'дварф', elf: 'эльф',
    halfling: 'полурослик', dragonborn: 'драконорождённый', gnome: 'гном',
    halfelf: 'полуэльф', orc: 'орк', goblinoid: 'гоблин', mindflayer: 'иллитид',
    mimic: 'мимик', fairy: 'фей', troll: 'тролль', owlbear: 'совомедведь',
    displacer: 'сместитель', beholder: 'бехолдер', lich: 'лич', giant: 'великан',
    gargoyle: 'горгулья', salamander: 'саламандра', wraith: 'призрак', ooze: 'слизь',
    kobold: 'кобольд', treant: 'древень', harpy: 'гарпия', minotaur: 'минотавр',
    basilisk: 'василиск', vampire: 'вампир', gnoll: 'гнолл', elementals: 'элементаль',
    // на случай, если открыть с обычным набором зверей
    fox: 'лис', tanuki: 'барсук', wolf: 'волк', cat: 'кот', rabbit: 'кролик',
    crane: 'журавль', owl: 'сова', boar: 'кабан', stag: 'олень', serpent: 'змея',
    monkey: 'обезьяна', toad: 'жаба',
  };
  const ruSpecies = (k) => SPECIES_RU[k] || k;

  // ------------------------------------------------------ Переключение
  function setLevel(lvl, opts = {}) {
    current = Math.max(1, Math.min(70, Math.round(lvl)));
    document.getElementById('lvlnum').value = String(current);
    document.getElementById('slider').value = String(current);
    // У обычного врага второй формы нет — сбрасываем переключатель,
    // чтобы он не «залипал» при переходе с босса на обычный уровень.
    syncPhaseButton();
    renderInfo();
    markCurrent();
    if (opts.scrollList) {
      const btn = document.querySelector(`#all-grid button[data-lvl="${current}"]`);
      if (btn) btn.scrollIntoView({ block: 'nearest' });
    }
  }

  // Вторая форма есть только у стражей. У остальных кнопка гаснет.
  function syncPhaseButton() {
    const btn = document.getElementById('phase2');
    if (!btn) return;
    const foe = byLevel(current);
    const canPhase = !!foe.isBoss;
    btn.disabled = !canPhase;
    btn.classList.toggle('on', canPhase && phase2);
    btn.textContent = canPhase && phase2 ? 'Фаза 2 ✓' : 'Фаза 2';
    btn.title = canPhase
      ? (phase2 ? 'Показана вторая форма — нажмите, чтобы вернуть первую'
                : 'Показать вторую форму стража')
      : 'Вторая форма есть только у стражей';
  }

  function renderInfo() {
    const e = byLevel(current);
    const nameEl = document.getElementById('foe-name');
    nameEl.innerHTML = e.isBoss
      ? `<span class="star">★</span> ${e.shortName || e.name}`
      : (e.shortName || e.name);

    // Вторая строка — «профессия» из таблицы: «(чародей)».
    document.getElementById('foe-role').textContent = e.role ? `(${e.role})` : '';

    const parts = [];
    parts.push(`уровень ${e.level} из 70`);
    parts.push(`время: ${TIMES[timeOfDay(e.level)].name}`);

    if (e.isBoss) {
      parts.push(`страж · ${e.bossTitle}`);
      if (e.realm) parts.push(`арена: «${e.realm}»`);
      // Какая форма показана — прямо в подписи, чтобы не гадать.
      if (e.phase) parts.push(phase2 ? 'форма: истинная (2)' : 'форма: обычная (1)');
    } else {
      parts.push(`существо: ${ruSpecies(e.species)}`);
      parts.push(`арена: «${biomeFor(e).name}»`);
    }
    parts.push(`HP ${e.stats.hp} · мана ${e.stats.mana}`);

    document.getElementById('foe-meta').textContent = parts.join(' · ');
    document.getElementById('foe-mech').textContent = e.isBoss
      ? `Механика: ${e.mechanic}`
      : '';
  }

  // ------------------------------------------------------- Разметка списка
  function buildDecades() {
    const box = document.getElementById('decades');
    box.innerHTML = '';
    // По кнопке на каждые 10 уровней: так до нужного места два нажатия.
    const marks = [1, 10, 20, 30, 40, 50, 60, 70];
    for (const lvl of marks) {
      const b = document.createElement('button');
      b.dataset.lvl = String(lvl);
      b.textContent = lvl === 1 ? 'начало' : `${lvl}`;
      if (BOSS_LEVELS.includes(lvl)) b.className = 'boss';
      b.onclick = () => setLevel(lvl);
      box.appendChild(b);
    }
  }

  function buildAllList() {
    const grid = document.getElementById('all-grid');
    grid.innerHTML = '';
    for (const e of ENEMIES) {
      const b = document.createElement('button');
      b.dataset.lvl = String(e.level);
      if (e.isBoss) b.className = 'boss';
      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = e.isBoss ? '★' : String(e.level);
      b.appendChild(num);
      b.appendChild(document.createTextNode(
        `${e.isBoss ? e.level + ' · ' : ''}${e.shortName || e.name}`
      ));
      b.onclick = () => { setLevel(e.level); closeAll(); };
      grid.appendChild(b);
    }
    markCurrent();
  }

  function markCurrent() {
    document.querySelectorAll('#all-grid button').forEach((b) => {
      b.classList.toggle('cur', Number(b.dataset.lvl) === current);
    });
    document.querySelectorAll('#decades button').forEach((b) => {
      b.style.background = Number(b.dataset.lvl) === current && current % 10 === 0
        ? 'rgba(58, 92, 160, 0.95)' : '';
    });
  }

  function openAll() {
    document.getElementById('all').classList.add('open');
    const btn = document.querySelector(`#all-grid button[data-lvl="${current}"]`);
    if (btn) btn.scrollIntoView({ block: 'center' });
  }
  function closeAll() { document.getElementById('all').classList.remove('open'); }

  // ----------------------------------------------------------- Отрисовка
  function frame(now) {
    const t = now / 1000;
    frozenT = t;

    const foe = byLevel(current);
    const tk = timeOfDay(foe.level);

    // Фон: у стража своя арена, у существа — биом по уровню.
    let painted = false;
    if (foe.isBoss) painted = drawBossArena(ctx, W, H, foe, t, tk);
    if (!painted) drawArena(ctx, W, H, foe, t, tk);

    // Раскладка та же, что в бою: фигуры уменьшены в 1.5 раза,
    // стражи с надбавкой 20% и потолком высоты.
    const isBoss = !!foe.isBoss;
    const portrait = H > W;
    const cx = W * 0.5;

    const base = Math.min(W, H) * 0.085 * 1.5 * (2 / 1.5);
    let scale = base * (foe.scale || 1) * (isBoss ? (1.2 / 1.5) : 1);
    const TOP_UNITS = isBoss ? 4.6 : 4.2;
    if (isBoss) scale = Math.min(scale, (H * 1.22) / TOP_UNITS);

    const feetBelow = portrait ? 0.06 : 0.10;
    const figureH = TOP_UNITS * scale;
    const baseY = Math.min(H * (1 + feetBelow), H * 0.97 + figureH);

    drawCharacter(ctx, cx, baseY, scale, foe, t, { phase: phase2 ? 2 : 1 });

    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------ События
  document.getElementById('prev').onclick = () => setLevel(current - 1);
  document.getElementById('next').onclick = () => setLevel(current + 1);
  document.getElementById('slider').oninput = (ev) => setLevel(Number(ev.target.value));
  document.getElementById('lvlnum').onchange = (ev) => {
    const v = Number(ev.target.value);
    setLevel(Number.isFinite(v) && v > 0 ? v : current);
  };
  document.getElementById('openAll').onclick = openAll;
  document.getElementById('phase2').onclick = () => {
    const foe = byLevel(current);
    if (!foe.isBoss) return;      // у обычных врагов второй формы нет
    phase2 = !phase2;
    syncPhaseButton();
    renderInfo();
  };
  document.getElementById('all').onclick = (ev) => {
    if (ev.target.id === 'all') closeAll();
  };
  document.getElementById('play').onclick = () => {
    // Открываем игру и передаём уровень через адрес. Игра читает
    // ?level=N при старте — если не читает, откроется меню.
    const url = new URL('index.html', location.href);
    url.searchParams.set('level', String(current));
    location.href = url.toString();
  };

  window.addEventListener('keydown', (ev) => {
    // Стрелки: перебор. Home/End — края. Esc — закрыть список.
    if (ev.key === 'Escape') { closeAll(); return; }
    if (ev.target instanceof HTMLInputElement && ev.target.type === 'number') return;
    if (ev.key === 'ArrowLeft') { setLevel(current - 1); ev.preventDefault(); }
    else if (ev.key === 'ArrowRight') { setLevel(current + 1); ev.preventDefault(); }
    else if (ev.key === 'ArrowDown') { setLevel(current - 10); ev.preventDefault(); }
    else if (ev.key === 'ArrowUp') { setLevel(current + 10); ev.preventDefault(); }
    else if (ev.key === 'Home') { setLevel(1); ev.preventDefault(); }
    else if (ev.key === 'End') { setLevel(70); ev.preventDefault(); }
  });

  // Начальный уровень можно передать в адресе: ?level=30
  const startLvl = Number(new URLSearchParams(location.search).get('level')) || 1;

  resize();
  buildDecades();
  buildAllList();
  setLevel(startLvl);
  requestAnimationFrame(frame);

})();
