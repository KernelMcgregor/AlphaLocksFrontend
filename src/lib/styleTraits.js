// Shared vocabulary for the style-similarity features (backend style_service.ALL_FEATURES).
// One place, so the profile page's similarity panel and the Fighter Styles page name a
// trait the same way.

// Feature key -> what to actually call it on screen. The raw column names (gnp15g,
// td15s, sub_att15g) are backend vocabulary and mean nothing to a reader.
export const TRAIT_LABELS = {
  slpm: 'strikes landed',
  str_att_pm: 'strikes thrown',
  head_att_share: 'head targeting',
  body_att_share: 'body targeting',
  leg_att_share: 'leg kicks',
  dist_att_share: 'work at range',
  clinch_att_share: 'clinch work',
  ground_att_share: 'ground work',
  gnp_att15g: 'ground strikes thrown',
  sub_att15: 'submission attempts',
  ctrld_share: 'time controlled',
  nonsig_share: 'short strikes',
  gnp_per_ctrl: 'ground strikes on top',
  ctrl_share: 'control time',
  sapm: 'strikes absorbed',
  sig_acc: 'striking accuracy',
  sig_def: 'striking defense',
  head_pct: 'head targeting',
  body_pct: 'body work',
  leg_pct: 'leg kicks',
  dist_pct: 'distance striking',
  clinch_pct: 'clinch work',
  ground_pct: 'ground striking',
  td15s: 'takedowns landed',
  td_att15s: 'takedown attempts',
  td_acc: 'takedown accuracy',
  td_def: 'takedown defense',
  ctrl15g: 'control time',
  sub_att15g: 'submission attempts',
  gnp15g: 'ground and pound',
  kd15s: 'knockdown rate',
  rev15: 'reversals',
  finish_rate: 'finish rate',
  avg_fight_sec: 'fight length',
  ko_win_share: 'KO wins',
  sub_win_share: 'submission wins',
  glicko_pts: 'round-winning',
  glicko_ko: 'KO power',
  glicko_kod: 'chin',
  glicko_sub: 'submission offense',
  glicko_subd: 'submission defense',
  glicko_td: 'takedowns',
  glicko_tdd: 'takedown defense',
  glicko_ctrl: 'control',
  glicko_str_vol: 'striking volume',
  glicko_str_acc: 'striking accuracy',
  glicko_str_def: 'striking defense',
  glicko_dist: 'distance game',
  glicko_clinch: 'clinch game',
  glicko_gnd: 'ground striking',
  glicko_durability: 'durability',
}

export const traitLabel = (key) => TRAIT_LABELS[key] || key.replace(/_/g, ' ')

// Column groups for the style DNA strip: the habits (what they try, opponent-adjusted),
// how it goes, then the skill ratings (shown, not matched on).
export const TRAIT_GROUPS = [
  { key: 'volume', label: 'Volume', traits: ['str_att_pm', 'td_att15s', 'sub_att15', 'nonsig_share'] },
  { key: 'target', label: 'Targeting', traits: ['head_att_share', 'body_att_share', 'leg_att_share'] },
  { key: 'position', label: 'Position', traits: ['dist_att_share', 'clinch_att_share', 'ground_att_share', 'ctrl_share', 'gnp_per_ctrl'] },
  {
    key: 'efficacy', label: 'How it goes',
    traits: ['sig_acc', 'td_acc', 'sig_def', 'td_def', 'sapm', 'kd15s', 'ctrld_share', 'finish_rate', 'ko_win_share', 'sub_win_share', 'avg_fight_sec'],
  },
  {
    key: 'skills', label: 'Skill ratings',
    traits: ['glicko_pts', 'glicko_str_vol', 'glicko_str_acc', 'glicko_str_def', 'glicko_dist', 'glicko_clinch',
      'glicko_ko', 'glicko_kod', 'glicko_durability', 'glicko_td', 'glicko_tdd', 'glicko_ctrl', 'glicko_gnd',
      'glicko_sub', 'glicko_subd'],
  },
]

// Eight radar axes from the skill ratings — the same reading as the profile page radar.
export const RADAR_TRAITS = [
  ['glicko_str_vol', 'Volume'], ['glicko_str_acc', 'Accuracy'], ['glicko_ko', 'KO Power'], ['glicko_kod', 'Chin'],
  ['glicko_td', 'Takedowns'], ['glicko_tdd', 'TD Defense'], ['glicko_ctrl', 'Control'], ['glicko_sub', 'Submission'],
]

export const radarAxes = (profile) =>
  RADAR_TRAITS.map(([key, label]) => ({ key, label, value: profile?.[key] ?? 0 }))

// Family colour. Fixed slot per family id (validated 8-slot set in index.css); a filter
// that hides families must not repaint the survivors, so this never depends on order.
export const famColor = (id) => `var(--color-fam-${id + 1})`

// Resolved hex for canvas drawing, which cannot read CSS variables itself.
export const famColorsResolved = () => {
  const cs = getComputedStyle(document.documentElement)
  return Array.from({ length: 8 }, (_, i) => cs.getPropertyValue(`--color-fam-${i + 1}`).trim())
}

export const DIVISION_ORDER = [
  'flyweight', 'bantamweight', 'featherweight', 'lightweight', 'welterweight', 'middleweight',
  'light_heavyweight', 'heavyweight', 'w_strawweight', 'w_flyweight', 'w_bantamweight', 'w_featherweight',
]

// Registry division keys ("light_heavyweight", "w_strawweight") -> display names.
export const divisionLabel = (d) => {
  if (!d) return '—'
  const women = d.startsWith('w_')
  const base = d.replace(/^w_/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  return women ? `Women's ${base}` : base
}

// Tendency traits grouped the way the profile page groups skills: striking reads amber,
// grappling indigo (DimBar's convention), and how fights end in slate.
export const TENDENCY_GROUPS = [
  { key: 'striking', label: 'Striking habits', cls: 'text-amber-600',
    traits: ['str_att_pm', 'head_att_share', 'body_att_share', 'leg_att_share', 'dist_att_share'] },
  { key: 'grappling', label: 'Grappling habits', cls: 'text-indigo-600',
    traits: ['td_att15s', 'clinch_att_share', 'ground_att_share', 'sub_att15', 'ctrl_share', 'gnp_per_ctrl', 'nonsig_share'] },
  { key: 'outcome', label: 'How it goes', cls: 'text-slate-600',
    // Time controlled is in the style vector (guard players, strikers pinned to the cage) but
    // it also tracks losing grappling exchanges, so it is shown with how it goes.
    traits: ['sig_acc', 'sig_def', 'td_acc', 'td_def', 'sapm', 'kd15s', 'ctrld_share', 'finish_rate', 'avg_fight_sec'] },
]

// The habits — what a fighter tries — as opposed to how it goes.
export const HABIT_TRAITS = TENDENCY_GROUPS.filter((g) => g.key !== 'outcome').flatMap((g) => g.traits)

export const SKILL_GROUPS = [
  { key: 'striking', label: 'Striking skill', cls: 'text-amber-600',
    traits: ['glicko_str_vol', 'glicko_str_acc', 'glicko_str_def', 'glicko_dist', 'glicko_clinch', 'glicko_ko', 'glicko_kod', 'glicko_durability', 'glicko_pts'] },
  { key: 'grappling', label: 'Grappling skill', cls: 'text-indigo-600',
    traits: ['glicko_td', 'glicko_tdd', 'glicko_ctrl', 'glicko_gnd', 'glicko_sub', 'glicko_subd'] },
]

const GROUP_OF = Object.fromEntries(
  [...TENDENCY_GROUPS, ...SKILL_GROUPS].flatMap((g) => g.traits.map((t) => [t, g.key])),
)
export const traitGroup = (key) => GROUP_OF[key] || 'outcome'

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
export const traitTitle = (key) => cap(traitLabel(key))

// A fighter's blend: [{family, share}], strongest first (backend style_page_service). A
// second family at 25%+ is named as a lean, e.g. "Wrestle-control, leaning Strike-and-pounce".
export const LEAN_MIN = 0.25
export const blendOf = (fighter) => fighter?.blend?.length ? fighter.blend : [{ family: fighter?.family, share: 1 }]
export const leanOf = (fighter) => {
  const b = blendOf(fighter)
  return b[1] && b[1].share >= LEAN_MIN ? b[1].family : null
}
export const styleLabel = (fighter, families) => {
  const name = families?.[fighter?.family]?.name
  const lean = leanOf(fighter)
  return lean != null && families?.[lean] ? `${name}, leaning ${families[lean].name}` : name
}
