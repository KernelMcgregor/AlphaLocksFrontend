// Division keys for the Rankings header: divisions by name (w_ for women's),
// cross-division boards as `<kind>_<pool>`.
export const SHORT = {
  p4p: 'P4P', bmf: 'BMF',
  flyweight: 'FLY', bantamweight: 'BW', featherweight: 'FW', lightweight: 'LW',
  welterweight: 'WW', middleweight: 'MW', light_heavyweight: 'LHW', heavyweight: 'HW',
  strawweight: 'SW',
}
// Divisions the time-lapse has history for (fighter_extras_timelapse.DIVISION_ORDER).
export const TIMELAPSE_DIVISIONS = [
  'flyweight', 'bantamweight', 'featherweight', 'lightweight', 'welterweight',
  'middleweight', 'light_heavyweight', 'heavyweight', 'w_strawweight', 'w_flyweight', 'w_bantamweight',
].map((key) => ({
  key,
  label: key.replace(/^w_/, "women's_").split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '),
}))

export const poolOf = (key) => (key.startsWith('w_') || key.endsWith('_women') ? 'women' : 'men')
export const baseOf = (key) => key.replace(/_(men|women)$/, '').replace(/^w_/, '')

// The same board in the other pool when there is one (P4P <-> P4P, FLY <-> FLY),
// else that pool's first.
export function poolCounterpart(key, items, pool) {
  const keys = items.map((it) => it.key).filter((k) => poolOf(k) === pool)
  const base = baseOf(key)
  const want = pool === 'women' ? [`${base}_women`, `w_${base}`] : [`${base}_men`, base]
  return want.find((k) => keys.includes(k)) || keys[0]
}
