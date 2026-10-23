/**
 * ПРОТИВНИКИ ИЗ ПОДЗЕМЕЛЬЯ И ДРАКОНОВ (тестовый вариант)
 * ======================================================
 * Альтернативный состав врагов: существа из вселенной Dungeons & Dragons
 * вместо японских антропоморфных зверей. Механики, характеристики и
 * поведение ИИ — те же, что в основной игре: меняется только облик и
 * названия. Данные полностью совместимы с enemies.js.
 *
 * ОТКУДА ВЗЯТ СОСТАВ. По таблице существ, которую прислал игрок:
 * аасимар, тифлинг, дварф, эльф, полурослик, драконорождённый, гном,
 * полуэльф, орк, колдун дикой магии, ледяной великан, иллитид, мимик,
 * красный дракон, фей. Список расширен, чтобы закрыть все 70 уровней
 * и дать каждому уровню своё существо.
 *
 * ВАЖНО: файл самостоятелен. Он НЕ импортирует enemies.js, чтобы
 * можно было собрать отдельную тестовую сборку, не трогая основную
 * игру. Всё, что нужно, повторено здесь.
 */

/** Палитры: те же ключи, что в основной игре — их знает staves.js. */
const P = {
  sakura:   { skin: '#ffe0d0', hair: '#ff9ec4', robe: '#fff0f5', accent: '#ff5c9e', glow: '#ff8ec4' },
  night:    { skin: '#f2d9c8', hair: '#2b2b45', robe: '#1a1a2e', accent: '#7b5cff', glow: '#9d7bff' },
  jade:     { skin: '#ffe3cd', hair: '#1f5c4a', robe: '#e8fff6', accent: '#22c39a', glow: '#4fe8bb' },
  ember:    { skin: '#ffd9b3', hair: '#c0392b', robe: '#4a1f14', accent: '#ff7a18', glow: '#ff9d4d' },
  frost:    { skin: '#f0f6ff', hair: '#a8d8ff', robe: '#e6f2ff', accent: '#4aa8ff', glow: '#8ecfff' },
  gold:     { skin: '#ffe9c9', hair: '#d4a017', robe: '#3a2a10', accent: '#ffd700', glow: '#ffe066' },
  blood:    { skin: '#f5d0c5', hair: '#1a1a1a', robe: '#2d0a0a', accent: '#e01e37', glow: '#ff3b52' },
  void:     { skin: '#ddd0e8', hair: '#0d0d1a', robe: '#150a20', accent: '#b026ff', glow: '#d47bff' },
  storm:    { skin: '#e8e0d0', hair: '#3d5a80', robe: '#1c2a3a', accent: '#89d4ff', glow: '#b8e6ff' },
  spirit:   { skin: '#f5f0ff', hair: '#c9b8e8', robe: '#efe6ff', accent: '#9d7bff', glow: '#c9b8ff' },
  oni:      { skin: '#e85d5d', hair: '#1a0a0a', robe: '#3d1010', accent: '#ffb703', glow: '#ff6b35' },
  celestial:{ skin: '#fff5e6', hair: '#ffd97d', robe: '#fffaf0', accent: '#ffc300', glow: '#ffe9a8' },
};

/** Архетипы силуэта: те же ключи, что понимает character.js. */
export const ARCHETYPES = {
  miko:      { build: 'slim',   robeLen: 1.0, sleeve: 'wide',  hat: 'none' },
  ronin:     { build: 'toned',  robeLen: 0.55, sleeve: 'tight', hat: 'kasa' },
  onmyoji:   { build: 'slim',   robeLen: 1.1, sleeve: 'wide',  hat: 'eboshi' },
  monk:      { build: 'broad',  robeLen: 0.9, sleeve: 'wide',  hat: 'none' },
  assassin:  { build: 'lean',   robeLen: 0.45, sleeve: 'tight', hat: 'hood' },
  noble:     { build: 'slim',   robeLen: 1.2, sleeve: 'wide',  hat: 'kanzashi' },
  beast:     { build: 'feral',  robeLen: 0.3, sleeve: 'none',  hat: 'horns' },
  general:   { build: 'broad',  robeLen: 0.7, sleeve: 'armor', hat: 'kabuto' },
  oracle:    { build: 'ethereal', robeLen: 1.3, sleeve: 'wide', hat: 'veil' },
  demon:     { build: 'tall',   robeLen: 0.8, sleeve: 'wide',  hat: 'horns' },
  child:     { build: 'small',  robeLen: 0.9, sleeve: 'wide',  hat: 'none' },
  dragon:    { build: 'serpent', robeLen: 0.0, sleeve: 'none', hat: 'antlers' },
  spirit:    { build: 'ethereal', robeLen: 1.3, sleeve: 'wide',  hat: 'veil' },
  celestial: { build: 'tall',     robeLen: 1.2, sleeve: 'wide',  hat: 'kanzashi' },
};

/**
 * ВИДЫ СУЩЕСТВ.
 *
 * Каждый вид описывает анатомию головы и признаки тела. Это НЕ старые
 * звериные поля: `anatomy` выбирает способ рисования в
 * src/render/creatures.js. Звериная морда с овальным носом не
 * превращается в дварфа или иллитида перекраской — у них другая форма
 * черепа, другие глаза и другие детали.
 *
 * У каждого вида два НЕЗАВИСИМЫХ описания:
 *
 *   anatomy  — чем нарисовать ГОЛОВУ (creatures.js)
 *   body     — чем нарисовать ТЕЛО (bodies.js)
 *
 * Раньше тело было одно на всех: мантия-конус с поясом и рукавами.
 * Голова при этом менялась, и получалось странное — дракон, слизь и
 * призрак стояли в одинаковых халатах. Теперь строение тела задаётся
 * отдельно, и силуэт читается до того, как прочитано имя.
 *
 * Поля головы:
 *   anatomy     — human | dragon | illithid | skull | beholder | blob | ghost | beast
 *   earKind     — elf | round | pointed | feather | none
 *   hornKind    — tiefling | dragon | bull | small | antlers
 *   glowEyes    — светящиеся глаза (нежить, чудовища)
 *   slitEyes    — вертикальный зрачок (драконы, рептилии)
 *   tusks       — клыки снизу (орк, тролль, гнолл)
 *
 * Поле тела:
 *   body        — robe | armor | quadruped | serpent | floating |
 *                 blob | eye | giant | winged | tree
 */
export const CREATURES = {
  // --- Разумные народы ---
  aasimar:   { anatomy: 'human',    earKind: 'round',   horns: false, humanoid: true, halo: true, body: 'robe' },
  tiefling:  { anatomy: 'human',    earKind: 'pointed', horns: true,  hornKind: 'tiefling', humanoid: true, body: 'robe' },
  dwarf:     { anatomy: 'human',    earKind: 'round',   horns: false, humanoid: true, beard: true, body: 'armor' },
  elf:       { anatomy: 'human',    earKind: 'elf',     horns: false, humanoid: true, body: 'robe' },
  halfling:  { anatomy: 'human',    earKind: 'round',   horns: false, humanoid: true, small: true, body: 'robe' },
  // Драконорождённые — прямоходящие: у них человеческое строение,
  // крылья и хвост рисуются отдельными слоями, а не заменяют тело.
  dragonborn:{ anatomy: 'dragon',   earKind: 'none',    horns: true,  hornKind: 'dragon', humanoid: true, tail: true, wings: 'dragon', body: 'armor' },
  gnome:     { anatomy: 'human',    earKind: 'pointed', horns: false, humanoid: true, small: true, body: 'robe' },
  halfelf:   { anatomy: 'human',    earKind: 'elf',     horns: false, humanoid: true, body: 'robe' },
  orc:       { anatomy: 'human',    earKind: 'pointed', horns: false, humanoid: true, tusks: true, body: 'armor' },
  goblinoid: { anatomy: 'human',    earKind: 'pointed', horns: false, humanoid: true, tusks: true, small: true, body: 'robe' },

  // --- Чудовища ---
  mindflayer:{ anatomy: 'illithid', earKind: 'none',    horns: false, glowEyes: true, tentacles: true, body: 'robe', extra: 'brainsacs' },
  mimic:     { anatomy: 'blob',     earKind: 'none',    horns: false, body: 'blob' },
  fairy:     { anatomy: 'human',    earKind: 'pointed', horns: false, humanoid: true, wings: 'gossamer', small: true, body: 'winged' },
  troll:     { anatomy: 'beast',    earKind: 'pointed', horns: false, tusks: true, big: true, body: 'quadruped' },
  owlbear:   { anatomy: 'beast',    earKind: 'feather', horns: false, big: true, body: 'quadruped', extra: 'beak' },
  displacer: { anatomy: 'beast',    earKind: 'pointed', horns: false, glowEyes: true, body: 'quadruped' },
  beholder:  { anatomy: 'beholder', earKind: 'none',    horns: false, body: 'eye' },
  lich:      { anatomy: 'skull',    earKind: 'none',    horns: false, glowEyes: true, body: 'robe' },
  giant:     { anatomy: 'human',    earKind: 'round',   horns: false, humanoid: true, big: true, body: 'giant' },
  gargoyle:  { anatomy: 'beast',    earKind: 'pointed', horns: true,  hornKind: 'small', wings: 'stone', glowEyes: true, body: 'winged', extra: 'rocky' },
  salamander:{ anatomy: 'dragon',   earKind: 'none',    horns: true,  hornKind: 'dragon', tail: true, glowEyes: true, body: 'serpent' },
  wraith:    { anatomy: 'ghost',    earKind: 'none',    horns: false, glowEyes: true, body: 'floating', extra: 'icicles' },
  ooze:      { anatomy: 'blob',     earKind: 'none',    horns: false, body: 'blob' },
  gelatinous:{ anatomy: 'blob',     earKind: 'none',    horns: false, body: 'blob', scaleBoost: 1.06, extra: 'acid' },
  kobold:    { anatomy: 'dragon',   earKind: 'none',    horns: true,  hornKind: 'small', humanoid: true, small: true, tail: true, body: 'robe', extra: 'flame', regalia: 'robe' },
  treant:    { anatomy: 'beast',    earKind: 'none',    horns: true,  hornKind: 'antlers', big: true, body: 'tree', extra: 'leafcloak' },
  harpy:     { anatomy: 'beast',    earKind: 'feather', horns: false, humanoid: true, wings: 'feather', body: 'winged' },
  minotaur:  { anatomy: 'beast',    earKind: 'pointed', horns: true,  hornKind: 'bull', big: true, humanoid: true, body: 'giant', extra: 'warpaint' },
  basilisk:  { anatomy: 'dragon',   earKind: 'none',    horns: true,  hornKind: 'small', tail: true, slitEyes: true, body: 'serpent', extra: 'crest' },
  vampire:   { anatomy: 'human',    earKind: 'pointed', horns: false, humanoid: true, fangs: true, body: 'robe', extra: 'batcape' },
  gnoll:     { anatomy: 'beast',    earKind: 'pointed', horns: false, humanoid: true, tusks: true, body: 'quadruped' },
  elementals:{ anatomy: 'ghost',    earKind: 'none',    horns: false, glowEyes: true, body: 'floating', extra: 'whirl' },

  // ================================================================
  // УНИКАЛЬНЫЕ ВИДЫ ДЛЯ КАЖДОГО УРОВНЯ
  // ================================================================
  //
  // Прежняя роспись повторяла виды: на 70 уровней приходилось 31 вид,
  // а драконов было семнадцать штук с одним и тем же телом и головой.
  // К 60 уровню игрок видел того же дракона в третий раз — и уровень
  // не читался как рост.
  //
  // Теперь каждый уровень — свой вид. Отличия задаются полями:
  //
  //   anatomy / earKind / hornKind — чем нарисовать голову
  //   body                        — строение тела
  //   wings / tail                — отдельные слои
  //   scaleBoost                  — насколько вид крупнее обычного
  //   regalia                     — знаки величия: 'crown' | 'crowns' |
  //                                 'robe' | 'armor' | 'spikes' | 'aura' | 'gold'
  //   extra                       — особая деталь вида (см. creatures.js)

  // --- Уровни 1-10: мелкота подземелья ---
  // У большинства scaleBoost 1.0 и никаких значков величия: это
  // начало пути, враг должен выглядеть слабым.
  koboldspear:    { anatomy: 'dragon', earKind: 'none', horns: true, hornKind: 'small', humanoid: true, small: true, tail: true, body: 'robe', scaleBoost: 1.00, extra: 'crest' },
  goblinscout:    { anatomy: 'human', earKind: 'pointed', horns: false, humanoid: true, small: true, body: 'robe', scaleBoost: 1.00, extra: 'warpaint' },
  giantrat:       { anatomy: 'beast', earKind: 'pointed', horns: false, body: 'quadruped', scaleBoost: 1.00, extra: 'whiskers' },
  skeleton:       { anatomy: 'skull', earKind: 'none', horns: false, glowEyes: true, body: 'robe', scaleBoost: 1.00, extra: 'ribs' },
  halflingrogue:  { anatomy: 'human', earKind: 'round', horns: false, humanoid: true, small: true, body: 'robe', scaleBoost: 1.00, extra: 'plume' },
  gnomeinventor:  { anatomy: 'human', earKind: 'pointed', horns: false, humanoid: true, small: true, body: 'robe', scaleBoost: 1.00, extra: 'goggles' },
  goblinshaman:   { anatomy: 'human', earKind: 'pointed', horns: true, hornKind: 'small', humanoid: true, small: true, body: 'robe', scaleBoost: 1.02, extra: 'warpaint' },
  dwarfpriest:    { anatomy: 'human', earKind: 'round', horns: false, humanoid: true, beard: true, body: 'armor', scaleBoost: 1.02, regalia: 'robe' },
  elfranger:      { anatomy: 'human', earKind: 'elf', horns: false, humanoid: true, body: 'robe', scaleBoost: 1.02, extra: 'leafcloak', regalia: 'robe' },
  orcbarbarian:   { anatomy: 'human', earKind: 'pointed', horns: false, humanoid: true, tusks: true, body: 'armor', scaleBoost: 1.05, extra: 'warpaint' },

  // --- Уровни 11-20: народы и первые чудовища ---
  halfelfdruid:   { anatomy: 'human', earKind: 'elf', horns: false, humanoid: true, body: 'robe', scaleBoost: 1.05, extra: 'leafcloak' },
  tieflingmage:   { anatomy: 'human', earKind: 'pointed', horns: true, hornKind: 'tiefling', humanoid: true, body: 'robe', scaleBoost: 1.05, extra: 'tailspade' },
  dragonbornpaladin:{ anatomy: 'dragon', earKind: 'none', horns: true, hornKind: 'dragon', humanoid: true, tail: true, wings: 'dragon', body: 'armor', scaleBoost: 1.08, extra: 'halo' },
  aasimarwarrior: { anatomy: 'human', earKind: 'round', horns: false, humanoid: true, halo: true, wings: 'feather', body: 'winged', scaleBoost: 1.08, extra: 'swordglow' },
  gnoll:          { anatomy: 'beast', earKind: 'pointed', horns: false, humanoid: true, tusks: true, body: 'quadruped', scaleBoost: 1.08, extra: 'warpaint' },
  mimic:          { anatomy: 'blob', earKind: 'none', horns: false, body: 'blob', scaleBoost: 1.00, extra: 'mouth' },
  fairy:          { anatomy: 'human', earKind: 'pointed', horns: false, humanoid: true, wings: 'gossamer', small: true, body: 'winged', scaleBoost: 0.94, extra: 'glowdust' },
  harpy:          { anatomy: 'beast', earKind: 'feather', horns: false, humanoid: true, wings: 'feather', body: 'winged', scaleBoost: 1.08, extra: 'feathers' },
  salamander:     { anatomy: 'dragon', earKind: 'none', horns: true, hornKind: 'dragon', tail: true, glowEyes: true, body: 'serpent', scaleBoost: 1.10, extra: 'flame' },
  troll:          { anatomy: 'beast', earKind: 'pointed', horns: false, tusks: true, big: true, body: 'quadruped', scaleBoost: 1.14, extra: 'warts' },
  // --- Драконы: у каждого своя порода, но общее строение ---
  //
  // scaleBoost растёт к древним: юнец мельче, древний крупнее всех.
  // Это и есть «чем дальше по уровню, тем внушительнее».
  reddragonwyrmling: { anatomy: 'dragon', earKind: 'none', horns: true, hornKind: 'dragon', tail: true, wings: 'dragon', body: 'serpent', scaleBoost: 1.00, extra: 'horns1' },
  bluedragon:     { anatomy: 'dragon', earKind: 'none', horns: true, hornKind: 'dragon', tail: true, wings: 'dragon', body: 'serpent', scaleBoost: 1.05, extra: 'spikes' },
  greendragon:    { anatomy: 'dragon', earKind: 'none', horns: true, hornKind: 'dragon', tail: true, wings: 'dragon', body: 'serpent', scaleBoost: 1.08, extra: 'acid', regalia: 'aura' },
  whitedragon:    { anatomy: 'dragon', earKind: 'none', horns: true, hornKind: 'dragon', tail: true, wings: 'dragon', body: 'serpent', scaleBoost: 1.10, extra: 'icicles', regalia: 'aura' },
  blackdragon:    { anatomy: 'dragon', earKind: 'none', horns: true, hornKind: 'dragon', tail: true, wings: 'dragon', body: 'serpent', scaleBoost: 1.12, extra: 'acid' },
  bronzedragon:   { anatomy: 'dragon', earKind: 'none', horns: true, hornKind: 'dragon', tail: true, wings: 'dragon', body: 'serpent', scaleBoost: 1.14, extra: 'crest', regalia: 'aura' },
  copperdragon:   { anatomy: 'dragon', earKind: 'none', horns: true, hornKind: 'dragon', tail: true, wings: 'dragon', body: 'serpent', scaleBoost: 1.16, extra: 'icicles' },
  brassdragon:    { anatomy: 'dragon', earKind: 'none', horns: true, hornKind: 'dragon', tail: true, wings: 'dragon', body: 'serpent', scaleBoost: 1.18, extra: 'crest' },
  silverdragon:   { anatomy: 'dragon', earKind: 'none', horns: true, hornKind: 'dragon', tail: true, wings: 'dragon', body: 'serpent', scaleBoost: 1.20, extra: 'icicles2', regalia: 'aura' },
  golddragon:     { anatomy: 'dragon', earKind: 'none', horns: true, hornKind: 'dragon', tail: true, wings: 'dragon', body: 'serpent', scaleBoost: 1.22, extra: 'halo' },
  ancientred:     { anatomy: 'dragon', earKind: 'none', horns: true, hornKind: 'dragon', tail: true, wings: 'dragon', body: 'serpent', scaleBoost: 1.26, extra: 'crownhorns', regalia: 'spikes' },
  ancientblue:    { anatomy: 'dragon', earKind: 'none', horns: true, hornKind: 'dragon', tail: true, wings: 'dragon', body: 'serpent', scaleBoost: 1.28, extra: 'stormcrown', regalia: 'spikes' },
  ancientgold:    { anatomy: 'dragon', earKind: 'none', horns: true, hornKind: 'dragon', tail: true, wings: 'dragon', body: 'serpent', scaleBoost: 1.32, extra: 'halo', regalia: 'aura' },
  dracolich:      { anatomy: 'skull',  earKind: 'none', horns: true, hornKind: 'dragon', tail: true, wings: 'dragon', body: 'serpent', scaleBoost: 1.16, glowEyes: true, extra: 'ribs', regalia: 'aura' },
  tiamatavatar:   { anatomy: 'dragon', earKind: 'none', horns: true, hornKind: 'dragon', tail: true, wings: 'dragon', body: 'serpent', scaleBoost: 1.34, extra: 'heads3', regalia: 'aura' },
  tiamat:         { anatomy: 'dragon', earKind: 'none', horns: true, hornKind: 'dragon', tail: true, wings: 'dragon', body: 'serpent', scaleBoost: 1.40, extra: 'heads5', regalia: 'crowns' },

  // --- Великаны: каждый своего роста и сложения ---
  stonegiant:     { anatomy: 'human', earKind: 'round', horns: false, humanoid: true, big: true, body: 'giant', scaleBoost: 1.10, extra: 'rockyHalo' },
  stonegiantelite:{ anatomy: 'human', earKind: 'round', horns: false, humanoid: true, big: true, body: 'giant', scaleBoost: 1.16, extra: 'rocky', regalia: 'spikes' },
  frostgiant:     { anatomy: 'human', earKind: 'round', horns: false, humanoid: true, big: true, body: 'giant', scaleBoost: 1.18, extra: 'icicles' },
  firegiant:      { anatomy: 'human', earKind: 'round', horns: false, humanoid: true, big: true, body: 'giant', scaleBoost: 1.20, extra: 'flame', fangs: true },
  stormgiant:     { anatomy: 'human', earKind: 'round', horns: false, humanoid: true, big: true, body: 'giant', scaleBoost: 1.22, extra: 'stormcrown' },
  titan:          { anatomy: 'human', earKind: 'round', horns: false, humanoid: true, big: true, body: 'giant', scaleBoost: 1.36, extra: 'stormcrown', regalia: 'crown' },

  // --- Элементали: у каждого своя форма, а не общий призрак ---
  fireelem:       { anatomy: 'ghost', earKind: 'none', horns: false, glowEyes: true, body: 'floating', extra: 'flame' },
  waterelem:      { anatomy: 'ghost', earKind: 'none', horns: false, glowEyes: true, body: 'floating', extra: 'waves' },
  earthelem:      { anatomy: 'beast', earKind: 'none', horns: true, hornKind: 'small', body: 'giant', extra: 'rocky' },
  airelem:        { anatomy: 'ghost', earKind: 'none', horns: false, glowEyes: true, body: 'floating', extra: 'whirl', regalia: 'aura' },

  // --- Нежить: скелет, лич, архилич, вампиры ---
  lichneophyte:   { anatomy: 'skull', earKind: 'none', horns: false, glowEyes: true, body: 'robe', extra: 'ribs', scaleBoost: 1.06, regalia: 'aura' },
  archlich:       { anatomy: 'skull', earKind: 'none', horns: true, hornKind: 'antlers', glowEyes: true, body: 'robe', extra: 'crownhorns', regalia: 'crown', scaleBoost: 1.24 },
  // Векна — некромант, а не лич: живое лицо под капюшоном, стоит на
  // ногах (не парит), тяжёлая мантия. Отсюда anatomy 'human' и body
  // 'robe' — так он не путается с архиличем на 65 уровне.
  necromancer:    { anatomy: 'human', earKind: 'none', horns: false, glowEyes: true, beard: true, body: 'robe', extra: 'ribs', regalia: 'crown', scaleBoost: 1.28 },
  vamplord:       { anatomy: 'human', earKind: 'pointed', horns: false, humanoid: true, fangs: true, body: 'robe', extra: 'batcape', regalia: 'crown' },

  // --- Иллитиды: от пожирателя к старшему мозгу ---
  illithidlord:   { anatomy: 'illithid', earKind: 'none', horns: false, glowEyes: true, tentacles: true, body: 'robe', extra: 'tentacles4', regalia: 'robe' },
  elderbrain:     { anatomy: 'beholder', earKind: 'none', horns: false, glowEyes: true, tentacles: true, body: 'eye', extra: 'brainsacs', regalia: 'aura' },

  // --- Бехолдеры ---
  beholdereye:    { anatomy: 'beholder', earKind: 'none', horns: false, body: 'eye', extra: 'stalkers6' },
  beholdertyrant:{ anatomy: 'beholder', earKind: 'none', horns: false, body: 'eye', extra: 'stalkers10', regalia: 'crown' },

  // --- Гоблиноиды разных ступеней ---
  goblinchief:    { anatomy: 'human', earKind: 'pointed', horns: true, hornKind: 'small', humanoid: true, tusks: true, small: true, body: 'armor', extra: 'warpaint', regalia: 'spikes' },

  // --- Дьявол, аасимар, тифлинг-повелитель ---
  devil:          { anatomy: 'human', earKind: 'pointed', horns: true, hornKind: 'tiefling', humanoid: true, glowEyes: true, body: 'robe', extra: 'batcape', regalia: 'aura' },
  aasimaravenger: { anatomy: 'human', earKind: 'round', horns: false, humanoid: true, halo: true, wings: 'feather', body: 'winged', extra: 'halo2', regalia: 'aura' },
  tieflinglord:   { anatomy: 'human', earKind: 'pointed', horns: true, hornKind: 'tiefling', humanoid: true, body: 'robe', extra: 'tailspade', regalia: 'crown' },

  // --- Мимики и слизи: разные ступени одной ловушки ---
  mimicchest:     { anatomy: 'blob', earKind: 'none', horns: false, body: 'blob', scaleBoost: 1.04, extra: 'lock' },
  mimicvault:     { anatomy: 'blob', earKind: 'none', horns: false, body: 'blob', scaleBoost: 1.14, extra: 'lock', regalia: 'gold' },

  // --- Драконорождённые-воины ---
  dragonbornwarrior: { anatomy: 'dragon', earKind: 'none', horns: true, hornKind: 'dragon', humanoid: true, tail: true, wings: 'dragon', body: 'armor', extra: 'spikes' },

  // --- Чудовища глубин: замена десяти одинаковых драконов ---
  //
  // Каждый вид здесь — СВОЁ ТЕЛО, а не перекраска. Раньше на уровнях
  // 51-60 стояли десять драконов, и все они читались как одна фигура:
  // serpentinae тело, крылья, рога, другой цвет. Здесь же червь
  // кольцами, паук на восьми ногах, три головы у химеры, рот на всё
  // туловище у умбер-халка.
  purpleworm: { anatomy: 'beast', earKind: 'none', horns: false, tail: true, body: 'serpent', scaleBoost: 1.16, extra: 'mandibles' },
  giantspider:{ anatomy: 'beast', earKind: 'none', horns: false, slitEyes: true, body: 'blob', scaleBoost: 1.00, extra: 'spiderlegs' },
  manticore:  { anatomy: 'beast', earKind: 'none', horns: false, tusks: true, wings: 'bat', tail: true, body: 'winged', scaleBoost: 1.10, extra: 'tailspikes' },
  chimera:    { anatomy: 'beast', earKind: 'none', horns: true, hornKind: 'bull', tail: true, wings: 'bat', body: 'quadruped', scaleBoost: 1.14, extra: 'heads3' },
  remorhaz:   { anatomy: 'beast', earKind: 'none', horns: true, hornKind: 'small', body: 'giant', scaleBoost: 1.18, glowEyes: true, extra: 'heatshine' },
  umberhulk:  { anatomy: 'beast', earKind: 'none', horns: false, humanoid: true, big: true, glowEyes: true, body: 'armor', scaleBoost: 1.12, extra: 'mandibles' },
  kraken:     { anatomy: 'beast', earKind: 'none', horns: false, glowEyes: true, body: 'serpent', scaleBoost: 1.20, extra: 'tentacles8' },
};

// Создание вроде этого цикла нужно, только если виды драконов
// окажутся заведены по отдельности. Сейчас все драконы в росписи
// используют общий вид `dragonborn`, которому строение задано выше.


/** Волосы, глаза, аксессуары — те же наборы, что в основной игре. */
const HAIR = ['long', 'twin', 'short', 'ponytail', 'bun', 'wild', 'braid', 'bob'];
const EYES = ['calm', 'sharp', 'glowing', 'closed', 'wide', 'heterochromia', 'hollow'];
const ACC = ['none', 'ribbon', 'mask', 'fan', 'talisman', 'bell', 'scarf', 'flute'];

/**
 * ОБЫЧНЫЕ ПРОТИВНИКИ — 70 существ, по одному на уровень.
 *
 * Формат: [имя, вид, стихия-палитра, вторая строка подписи].
 * Второй элемент — «профессия» из таблицы игрока: «(чародей)»,
 * «(жрец)» и так далее. Она показывается рядом с именем.
 *
 * Порядок задан вручную, а не генератором: существ из D&D нужно
 * расставлять по смыслу — гоблины в начале, драконы и личи ближе к
 * концу, а не случайно.
 */
const ROSTER = [
  // 1-10: слабые существа подземелья
  ['Ящер-копиеносец',        'koboldspear',   'jade',      'прислужник дракона'],
  ['Гоблин-разведчик',       'goblinscout',   'jade',      'вор'],
  ['Гигантская крыса',       'giantrat',      'night',     'зверь'],
  ['Скелет-стражник',        'skeleton',      'frost',     'нежить'],
  ['Полурослик-плут',        'halflingrogue', 'sakura',    'вор'],
  ['Гном-изобретатель',      'gnomeinventor', 'gold',      'изобретатель'],
  ['Хобгоблин-шаман',        'goblinshaman',  'storm',     'шаман'],
  ['Дварф-жрец',             'dwarfpriest',   'gold',      'жрец'],
  ['Эльф-рейнджер',          'elfranger',     'jade',      'рейнджер'],
  ['Орк-варвар',             'orcbarbarian',  'blood',     'варвар'],

  // 11-20: разумные народы и первые чудовища
  ['Полуэльф-друид',         'halfelfdruid',  'jade',      'друид'],
  ['Тифлинг-чародей',        'tieflingmage',  'blood',     'чародей'],
  ['Драконорождённый-паладин','dragonbornpaladin','gold',  'паладин'],
  ['Аасимар-небесный воин',  'aasimarwarrior','celestial', 'небесный воин'],
  ['Гнолл-пожиратель',       'gnoll',         'ember',     'зверь'],
  ['Мимик',                  'mimic',         'void',      'притворщик'],
  ['Фей-лесной дух',         'fairy',         'spirit',    'лесной дух'],
  ['Гарпия-певица',          'harpy',         'storm',     'певица'],
  ['Саламандра',             'salamander',    'ember',     'хранитель огня'],
  ['Тролль',                 'troll',         'jade',      'изверг'],

  // 21-30: сильные чудовища
  ['Совомедведь-крикун',     'owlbear',      'ember',     'зверь'],
  ['Притворный сундук',      'mimicchest',   'void',      'ловушка'],
  ['Горгулья-страж',         'gargoyle',     'frost',     'страж'],
  ['Упырь-вампир',           'vampire',      'blood',     'нежить'],
  ['Слизь-пожиратель',       'gelatinous',   'jade',      'пожиратель'],
  ['Дух-мучитель',           'wraith',       'void',      'призрак'],
  ['Минотавр-лабиринт',      'minotaur',     'blood',     'хранитель лабиринта'],
  ['Василиск',               'basilisk',     'jade',      'окаменяющий'],
  ['Драконид-жрец',          'kobold',       'ember',     'жрец дракона'],
  ['Дровяной страж',         'treant',       'jade',      'хранитель леса'],

  // 31-40: могущественные существа
  ['Иллитид-пожиратель разума','mindflayer', 'void',      'иллитид'],
  ['Багбир-вождь',           'goblinchief',  'ember',     'вождь'],
  ['Великан-валун',          'stonegiant',   'frost',     'великан'],
  ['Огненный элементаль',    'fireelem',     'ember',     'элементаль'],
  ['Водяной элементаль',     'waterelem',    'storm',     'элементаль'],
  ['Земляной элементаль',    'earthelem',    'jade',      'элементаль'],
  ['Воздушный элементаль',   'airelem',      'spirit',    'элементаль'],
  ['Дьяволорожденный',       'tieflinglord', 'blood',     'повелитель'],
  ['Лич-неофит',             'lichneophyte', 'void',      'нежить'],
  ['Драконорождённый-воин',  'dragonbornwarrior','ember', 'воин'],

  // 41-50: элита
  ['Старший мозг',           'illithidlord', 'void',      'владыка разума'],
  ['Великан Стужи',          'frostgiant',   'frost',     'великан'],
  ['Огненный великан',       'firegiant',    'ember',     'великан'],
  ['Гранитный страж',        'stonegiantelite','jade',   'великан'],
  ['Штормовой великан',      'stormgiant',   'storm',     'великан'],
  ['Драколич',               'dracolich',    'void',      'дракон-нежить'],
  ['Дьявол-искуситель',      'devil',        'blood',     'искуситель'],
  ['Вампир-лорд',            'vamplord',     'blood',     'лорд'],
  ['Сокровище-пожиратель',   'mimicvault',   'gold',      'притворщик'],
  ['Аасимар-каратель',       'aasimaravenger','celestial','каратель'],

  // 51-60: полубоги и чудовища
  //
  // Раньше здесь стояли десять драконов подряд: разный цвет — и всё.
  // На глаз это одна и та же фигура, перекрашенная десять раз. Теперь
  // разных существ, а драконы остались только там, где они уместны:
  // финал кампании. Красный дракон-юнец не пропал — он вышел на
  // уровень 40 стражем.
  ['Бехолдер',               'beholdereye',  'void',      'око бездны'],
  ['Глаз-тиран',             'beholdertyrant','storm',    'тиран'],
  ['Пожиратель-под-Горой',   'purpleworm',   'frost',     'червь глубин'],
  ['Гигантский паук',        'giantspider',  'void',      'тенетник'],
  ['Мантикора',              'manticore',    'ember',     'охотник'],
  ['Чимера',                 'chimera',      'blood',     'трёхглавая тварь'],
  ['Реморхаз',               'remorhaz',     'frost',     'полярный ужас'],
  ['Умбер-халк',             'umberhulk',    'jade',      'копатель'],
  ['Кракен-отросток',        'kraken',       'void',      'щупальца бездны'],
  // Уровень 60 — страж «Тень Векны»: вид у него свой, некромант,
  // и в ROSTER он должен стоять тоже некромантом, иначе стражи и
  // рядовой враг делят один вид и снова получаются двойники.
  ['Пепел Костяного Трона','necromancer', 'void',      'некромант'],
  // 61-70: легенды
  ['Среброкрыл',             'silverdragon', 'frost',     'дракон'],
  ['Золотой дракон',         'golddragon',   'gold',      'дракон'],
  ['Алый Древень',           'ancientred',   'ember',     'дракон'],
  ['Древний синий дракон',   'ancientblue',  'storm',     'дракон'],
  ['Король-Лич',             'archlich',     'void',      'нежить'],  ['Мозг-владыка',           'elderbrain',   'void',      'владыка'],
  ['Титан-великан',          'titan',        'frost',     'титан'],
  ['Древний золотой дракон', 'ancientgold',  'celestial', 'дракон'],
  ['Праматерь Тиамат',       'tiamatavatar', 'blood',     'аспект'],
  ['Тиамат, Пятиглавая',     'tiamat',       'celestial', 'богиня драконов'],
];

export function buildEnemies() {
  const list = [];

  // Детерминированный генератор — характеристики стабильны от запуска
  // к запуску, как в основной игре.
  let seed = 1337;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const pick = (arr) => arr[Math.floor(rnd() * arr.length) % arr.length];

  const archetypeKeys = Object.keys(ARCHETYPES);
  const paletteKeys = Object.keys(P);

  for (let lvl = 1; lvl <= 70; lvl++) {
    const t = (lvl - 1) / 69;
    const [name, creatureKey, paletteKey, role] = ROSTER[lvl - 1];

    const aggression = 0.28 + t * 0.55 + (rnd() - 0.5) * 0.18;
    const reflex = 0.22 + t * 0.68 + (rnd() - 0.5) * 0.16;
    const patience = 0.15 + t * 0.75 + (rnd() - 0.5) * 0.2;
    const discipline = 0.62 + t * 0.33 + (rnd() - 0.5) * 0.12;

    const tierBias = t;
    const patternPref = [
      1.0 - tierBias * 0.55,
      0.85 + tierBias * 0.15,
      0.5 + tierBias * 0.6,
      Math.max(0, tierBias * 1.1 - 0.25),
      Math.max(0, tierBias * 0.75 - 0.42),
    ];

    const isBoss = lvl % 10 === 0;
    const hpMult = isBoss ? 3.2 : 1.0;
    const manaMult = isBoss ? 2.1 : 1.0;

    // Те же формулы HP/маны, что в основной игре: баланс проверен и
    // трогать его ради смены облика незачем.
    const earlyBase = 62 + Math.min(1, (lvl - 1) / 11) * 28;

    list.push({
      id: `e${lvl}`,
      level: lvl,
      // Подпись как в таблице игрока: «Тифлинг (чародей)».
      name: `${name} (${role})`,
      shortName: name,
      role,
      isBoss,
      species: creatureKey,
      // Строение ТЕЛА задаётся отдельно от головы: иначе слизь, призрак
      // и дракон стоят в одинаковых мантиях, и силуэт ничего не говорит.
      bodyKind: CREATURES[creatureKey] ? (CREATURES[creatureKey].body || 'robe') : 'robe',
      // Знаки величия и рост вида. Чем выше уровень, тем внушительнее:
      // см. поле scaleBoost в описании видов.
      extra: CREATURES[creatureKey] ? (CREATURES[creatureKey].extra || null) : null,
      regalia: CREATURES[creatureKey] ? (CREATURES[creatureKey].regalia || null) : null,
      palette: P[paletteKey],
      paletteKey,
      archetype: ARCHETYPES[pick(archetypeKeys)],
      hairStyle: pick(HAIR),
      eyeStyle: pick(EYES),
      accessory: pick(ACC),
      aura: isBoss ? 1.0 : 0.25 + t * 0.6,
      // Масштаб = рост уровня × рост вида.
      //
      // Первое слагаемое (0.9 + t*0.28) — общая прогрессия кампании:
      // с каждым уровнем враг чуть крупнее. Второе — scaleBoost вида:
      // у древнего дракона 1.3, у кобольда 1.0. Вместе они дают то,
      // что нужно: «чем дальше по уровню, тем внушительнее», причём
      // внутри одного уровня слабый вид мельче сильного.
      scale: isBoss
        ? 1.35
        : (0.9 + t * 0.28) * ((CREATURES[creatureKey] && CREATURES[creatureKey].scaleBoost) || 1),
      damageMult: 0.9 + t * 0.15,
      stats: {
        hp: Math.round((earlyBase + Math.pow(lvl, 0.82) * 26) * hpMult),
        mana: Math.round((95 + lvl * 5.5) * manaMult * (0.55 + Math.min(1, lvl / 20) * 0.2)),
      },
      profile: {
        aggression: Math.min(0.98, Math.max(0.12, aggression)),
        reflex: Math.min(0.98, Math.max(0.1, reflex)),
        patience: Math.min(0.98, Math.max(0.05, patience)),
        discipline: Math.min(0.99, Math.max(0.5, discipline)),
        patternPref,
      },
    });
  }

  // --- БОСССЫ: семь могучих существ Подземелья ---
  //
  // Выбраны не «кто покрасивее», а по одному принципу: каждое меняет
  // ЧТО ИГРОК ДЕЛАЕТ, а не только сколько у него здоровья.
  //
  //   creature — тип для отрисовки (character.js, drawBossCreature)
  //   element  — стихия: задаёт фон арены и цвет силы
  //   mechanicKey — механика в EnemyAI.updateBossMechanic
  //
  // Механики взяты из основной игры и переосмыслены под существ: у
  // каменного великана «ложный замах» — это замах кулаком, у иллитида
  // «вытягивание маны» читается как пожирание разума. Числа баланса
  // НЕ менялись: они измерены на кампании, и трогать их ради новых
  // имён было бы подменой проверенного на красивое.
  const bossDefs = [
    // 10 — ОБУЧАЮЩИЙ страж. Первая проверка: игрок только что освоил
    // Ранг III. Механика простая и честная — без обмана и поджогов.
    { lvl: 10, name: 'Кобольд-архижрец', role: 'жрец дракона', archetype: 'monk', palette: 'jade',
      title: 'Первый Страж Подземелья',
      creature: 'koboldpriest', element: 'sakura', realm: 'Затопленный Склеп',
      mechanicKey: 'mirror',
      mech: 'Повторяет ваш последний символ усиленным. Покажите ему слабый — получите слабый.',
      trueName: 'Кобольд-архижрец Тиамат',
      cry: 'Драконица видит тебя…',
      damage: 1.35, haste: 1.25, armor: 0.15,
      phaseMech: 'Повторяет ДВА последних символа подряд.' },

    // 20 — ТИТУЛ. Хранитель сокровищ, которого нельзя добить, пока он
    // держит щит своей чешуи. Требует ловить окна между защитами.
    { lvl: 20, name: 'Гиносфинкс', role: 'сфинкс', archetype: 'oracle', palette: 'gold',
      title: 'Второй Страж Подземелья',
      creature: 'sphinx', element: 'shadow', realm: 'Галерея Загадок',
      mechanicKey: 'feint',
      mech: 'Делает ложные замахи, выманивая ваш щит. Реагируйте только на настоящий каст.',
      trueName: 'Гиносфинкс, Хранительница Загадки',
      cry: 'Ты ответил верно. Это ничего не меняет.',
      damage: 1.40, haste: 1.30, armor: 0.15,
      phaseMech: 'Ложных замахов вдвое больше — отличать их труднее.' },

    // 30 — КАМЕННЫЙ ВЕЛИКАН. Медленный, но неотвратимый: игрока
    // наказывают не за ошибку, а за расточительность.
    { lvl: 30, name: 'Скальный великан', role: 'великан', archetype: 'general', palette: 'storm',
      title: 'Третий Страж Подземелья',
      creature: 'stonegiant', element: 'storm', realm: 'Каменный Чертог',
      mechanicKey: 'mana_punish',
      mech: 'Копит силу и обрушивается ударом скалы, как только ваша мана просядет ниже 40%.',
      trueName: 'Скальный великан, Древний Твердыня',
      cry: 'Камень не устаёт.',
      damage: 1.45, haste: 1.35, armor: 0.20,
      phaseMech: 'Бьёт и при мане ниже 55% — экономить больше нельзя.' },

    // 40 — КРАСНЫЙ ДРАКОН. Первое по-настоящему злое существо:
    // поджог запрещает игру в щите.
    { lvl: 40, name: 'Ашардрагон', role: 'дракон', archetype: 'demon', palette: 'ember',
      title: 'Четвёртый Страж Подземелья',
      creature: 'reddragon', element: 'fire', realm: 'Пепельный Пик',
      mechanicKey: 'burn_aura',
      mech: 'Поджигает: пока горите, мана НЕ восстанавливается. Щит здесь — путь к гибели.',
      trueName: 'Ашардрагон, Огненное Дыхание',
      cry: 'Гори. Гори до самого дна.',
      damage: 1.50, haste: 1.25, armor: 0.25,
      phaseMech: 'Горение не даёт маны вовсе, пока не кончится.' },

    // 50 — ЛЕДЯНОЙ ВЕЛИКАН. Заморозка ломает главный навык игры —
    // рисование, а не наносит урон. Требует коротких символов.
    { lvl: 50, name: 'Тримвальд', role: 'великан', archetype: 'oracle', palette: 'frost',
      title: 'Пятый Страж Подземелья',
      creature: 'frostgiant', element: 'ice', realm: 'Чертог Вечного Льда',
      mechanicKey: 'freeze_buildup',
      mech: 'Мороз копится и обрывает ваш рисунок на середине. Рисуйте коротко.',
      trueName: 'Тримвальд, Вечная Зима',
      cry: 'Замолкни. Навсегда.',
      damage: 1.45, haste: 1.30, armor: 0.30,
      phaseMech: 'Мороз копится вдвое быстрее.' },

    // 60 — ТЕНЬ ВЕКНЫ. Великий некромант, а не лич: он не умер, он
    // просто давно перестал быть человеком. Крадёт ману, то есть саму
    // возможность играть. Здесь нельзя позволить себе долгий щит.
    { lvl: 60, name: 'Тень Векны', role: 'некромант', archetype: 'spirit', palette: 'void',
      title: 'Шестой Страж Подземелья',
      creature: 'necromancer', element: 'void', realm: 'Костяной Престол',
      mechanicKey: 'mana_drain',
      mech: 'Вытягивает ману и питается ею — щит становится ловушкой.',
      trueName: 'Векна, Тот-Кто-Не-Умер',
      cry: 'Смерть — это инструмент. Я им пользуюсь.',
      damage: 1.55, haste: 1.35, armor: 0.25,
      phaseMech: 'Тянет ману вдвое чаще.' },

    // 70 — АСПЕКТ ТИАМАТ. Пять голов — пять механик сразу.
    // Финальная проверка всего, чему игра научила.
    { lvl: 70, name: 'Тиамат во Плоти', role: 'аспект драконицы', archetype: 'celestial', palette: 'celestial',
      title: 'Последний Страж Подземелья',
      creature: 'tiamat', element: 'heaven', realm: 'Пятиглавая Твердыня',
      mechanicKey: 'all',
      mech: 'Пять голов — пять механик. Единственная, кто кастует Ранг V осознанно.',
      trueName: 'Тиамат Пятиглавая, Королева Драконов',
      cry: 'Ты видел четыре головы. Пятая — твоя смерть.',
      damage: 1.60, haste: 1.40, armor: 0.25,
      phaseMech: 'Все пять механик разом, на полной силе.' },
  ];

  for (const b of bossDefs) {
    const idx = list.findIndex((e) => e.level === b.lvl);
    if (idx < 0) continue;
    const t = (b.lvl - 1) / 69;

    const BOSS_MAX_MANA = 100 + 4 * (b.lvl - 1) + 12;
    const BOSS_REGEN = 7.5 + 0.42 * (b.lvl - 1);
    const FIGHT_SECONDS = 25;
    const BEST_SPELL_COST = 62;
    const BEST_SPELL_DAMAGE = 190;
    const rawBudget = ((BOSS_MAX_MANA + BOSS_REGEN * FIGHT_SECONDS) / BEST_SPELL_COST)
      * BEST_SPELL_DAMAGE;
    const REAL_EFFICIENCY = 0.55;
    const damageBudget = rawBudget * REAL_EFFICIENCY;

    list[idx] = {
      ...list[idx],
      id: `boss${b.lvl}`,
      // Подпись в стиле таблицы игрока: «Красный дракон (дракон)».
      //
      // У обычных врагов роль стоит в скобках прямо в name, и здесь
      // делаем так же — иначе страж выглядел бы в списке короче
      // обычного врага, хотя он важнее.
      name: `${b.name} (${b.role})`,
      shortName: b.name,
      role: b.role,
      // Истинное имя тоже получает роль: после превращения подпись
      // не должна «терять» вторую строку.
      trueNameFull: `${b.trueName} (${b.role})`,
      isBoss: true,
      bossTitle: b.title,
      creature: b.creature,
      element: b.element,
      realm: b.realm,
      mechanic: b.mech,
      mechanicKey: b.mechanicKey,
      palette: P[b.palette],
      archetype: ARCHETYPES[b.archetype],
      aura: 1.0,
      scale: 1.6,
      phaseAt: 0.40,
      trueName: b.trueName,
      cry: b.cry,
      phaseMech: b.phaseMech,
      phase: { damage: b.damage, haste: b.haste, armor: b.armor },
      damageMult: 0.7 + t * 0.55,
      stats: {
        hp: Math.round(damageBudget * (0.55 + t * 0.5)),
        mana: Math.round((95 + b.lvl * 5.5) * (0.85 + t * 0.3)),
      },
      profile: {
        aggression: 0.48 + t * 0.3,
        reflex: 0.55 + t * 0.35,
        patience: 0.62 + t * 0.34,
        discipline: 0.9 + t * 0.09,
        patternPref: [0.3, 0.6, 1.0, 1.2, 1.1],
      },
    };
  }

  return list;
}

export const ENEMIES = buildEnemies();

export function enemyByLevel(level) {
  return ENEMIES.find((e) => e.level === level) || ENEMIES[ENEMIES.length - 1];
}

export const BOSS_LEVELS = [10, 20, 30, 40, 50, 60, 70];

/**
 * Алиас для совместимости: основной модуль отрисовки ищет `SPECIES`.
 * Здесь виды называются CREATURES и содержат больше признаков (крылья,
 * щупальца, чешуя), но ключи ears/muzzle/tail те же — drawBeastHead
 * понимает их без изменений.
 */
export const SPECIES = CREATURES;