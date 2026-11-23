// Formatting shared by the best-of tabs (a bout's names, result and excitement parts).

export const winnerOf = (f) => (f.winner === 'red' ? f.red : f.winner === 'blue' ? f.blue : null)

// "UFC Fight Night: Ngannou vs. Velasquez" -> ["UFC Fight Night", "Ngannou vs. Velasquez"]
// (a name with no colon is all series).
export function splitEvent(name) {
  const i = (name || '').indexOf(':')
  return i === -1 ? [name || '', ''] : [name.slice(0, i).trim(), name.slice(i + 1).trim()]
}

// "KO R2 3:14", "Sub R1 0:58", "Dec (S)", "Draw".
export function resultText(f) {
  const m = f.method || ''
  const at = f.round ? ` R${f.round}${f.time ? ` ${f.time}` : ''}` : ''
  if (/Decision/i.test(m)) {
    const k = /Split/i.test(m) ? 'S' : /Majority/i.test(m) ? 'M' : 'U'
    return f.winner ? `Dec (${k})` : 'Draw'
  }
  if (/Sub/i.test(m)) return `Sub${at}`
  if (/KO/i.test(m)) return `KO${at}`
  if (/Doctor/i.test(m)) return `Dr. stop${at}`
  return m || '—'
}

export const pctText = (p) => (p == null ? '—' : `${Math.round(p * 100)}%`)

const SUFFIX = /^(jr\.?|sr\.?|ii|iii|iv)$/i

// A short name for a bout label: the full name when it's short ("Liu Ce", "Ciryl Gane"),
// else the surname, keeping a suffix with it ("Rosas Jr.").
export function surname(name, max = 12) {
  if (!name) return ''
  if (name.length <= max) return name
  const parts = name.split(' ')
  const n = parts.length
  return n > 2 && SUFFIX.test(parts[n - 1]) ? `${parts[n - 2]} ${parts[n - 1]}` : parts[n - 1]
}

export const pairName = (f, max = 12) => (f ? `${surname(f.red.name, max)} vs ${surname(f.blue.name, max)}` : '—')

// The model's bonus winners for a card, next to UFC's. The model's Fight of the Night is
// its likeliest bout; its Performance winners are its top N, N = the awards UFC gave
// (2 when it gave none).
export function bonusCall(card) {
  const byFotn = [...card.fights].sort((a, b) => b.p_fotn - a.p_fotn)
  const byPerf = card.fights.filter((f) => f.p_perf != null).sort((a, b) => b.p_perf - a.p_perf)
  const fotn = card.fights.find((f) => f.fotn) || null
  const perf = card.fights.filter((f) => f.perf)
  const perfPicks = byPerf.slice(0, perf.length || 2)
  const picked = new Set(perfPicks.map((f) => f.fight_id))
  return {
    fotn,
    fotnPick: byFotn[0] || null,
    perf,
    perfPicks,
    perfInstead: perf.filter((f) => !picked.has(f.fight_id)),
    byFotn,
    byPerf,
  }
}

// A bout's numbers in plain units (the excitement model stores counts and rates
// log-scaled): strikes a minute, knockdowns, submission attempts, lead changes, minutes.
export function fightNumbers(f) {
  const r = f?.raw || {}
  const mins = r.minutes || 0
  return {
    pace: mins > 0 ? (Math.expm1(r.sig_pm || 0) * (mins + 2)) / mins : 0,
    kd: Math.round(Math.expm1(r.kd || 0)),
    subs: Math.round(Math.expm1(r.sub_att || 0)),
    leadChanges: r.lead_changes || 0,
    minutes: mins,
  }
}

// Short reasons a fight was exciting, from its stats, most telling first (one-line chips).
export function whyExciting(f) {
  const r = f?.raw
  if (!r) return []
  const n = fightNumbers(f)
  const finish = r.ko || r.sub
  const out = []
  if (n.kd >= 1) out.push(n.kd === 1 ? '1 KD' : `${n.kd} KDs`)
  if (r.upset >= 0.92) out.push(`Upset · ${Math.round(Math.exp(-r.upset) * 100)}%`)
  if (n.leadChanges >= 1) out.push(n.leadChanges === 1 ? '1 lead change' : `${n.leadChanges} lead changes`)
  if (finish && r.late_finish >= 0.8) out.push('Late finish')
  if (finish && r.quick_finish) out.push('Fast finish')
  if (n.pace >= 9) out.push(`${Math.round(n.pace)} strikes/min`)
  if (n.subs >= 2) out.push(`${n.subs} sub attempts`)
  if (r.round_close >= 0.7) out.push('Close rounds')
  if (n.minutes >= 20) out.push(`${Math.round(n.minutes)} minutes`)
  return out
}

// What made a card: counts across its bouts (from the excitement model's raw features).
export function cardStats(c) {
  const fs = c.fights
  return {
    finishes: fs.filter((f) => f.raw?.ko || f.raw?.sub).length,
    knockdowns: fs.reduce((a, f) => a + Math.round(Math.expm1(f.raw?.kd || 0)), 0),
    upsets: fs.filter((f) => (f.raw?.upset || 0) >= 0.92).length,
    bonuses: fs.reduce((a, f) => a + (f.fotn ? 1 : 0) + (f.perf ? 1 : 0), 0),
    total: fs.length,
  }
}

// The two most telling of those, as short chips for a table row (one line each).
export function cardHighlights(c) {
  const s = cardStats(c)
  const all = [
    { k: s.finishes / Math.max(s.total, 1), text: `${s.finishes} finishes`, on: s.finishes >= 3 },
    { k: s.knockdowns / 10, text: `${s.knockdowns} KDs`, on: s.knockdowns >= 3 },
    { k: s.upsets / 4, text: `${s.upsets} upsets`, on: s.upsets >= 2 },
  ]
  return all.filter((x) => x.on).sort((a, b) => b.k - a.k).slice(0, 2).map((x) => x.text)
}
