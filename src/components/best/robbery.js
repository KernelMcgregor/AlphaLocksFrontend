// Who lost a decision and how much of it they deserved, from a /ufc/robberies row.
export function loserOf(r) {
  const side = r.result > 0 ? 'blue' : 'red'
  const media = r.media.red + r.media.blue + r.media.draw
  return {
    side,
    winner: r.result > 0 ? r.red : r.blue,
    loser: r[side],
    share: side === 'red' ? r.p_red : r.p_blue,
    media: { n: r.media[side], of: media },
    fans: r.fans ? r.fans[side] : null,
  }
}

// A name for a tight column: as is up to `max` characters, then first initial and
// surname ("M. Aswell Jr."), then cut with an ellipsis.
export function shortName(name, max = 15) {
  if (!name || name.length <= max) return name || ''
  const parts = name.split(' ')
  const initialed = parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(' ')}` : name
  return initialed.length <= max ? initialed : `${initialed.slice(0, max - 1)}…`
}
