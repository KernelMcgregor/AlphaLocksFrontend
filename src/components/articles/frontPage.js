// Ranks fight previews and news stories together for the Articles front page.
//
// There are no reader numbers to rank on, so each story gets an editorial weight in their
// place and loses it with age: the "gravity" ranking behind Hacker News and Reddit's hot
// page, with news value standing in for votes.
//   news     kind of story + how widely it was covered + how big the names are, halving
//            every 18 hours. A big story stays on top through a run or two of smaller ones.
//   preview  card slot (main event, title fight, numbered card), rising as the card gets
//            closer and peaking on fight day; nothing once the card is over.

const HALF_LIFE_H = 18
const KIND_WEIGHT = {
  incident: 6, injury: 6, booking: 6, result: 6, controversy: 5, rumored_fight: 5,
  contract: 5, callout: 4, trash_talk: 4, press_conference: 4, other: 3,
}

// Timestamps from the API without a zone are UTC.
export const parseUtc = (iso) => Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(iso || '') ? iso : `${iso}Z`)

export function newsScore(n, now) {
  const coverage = 1.5 * Math.min(5, Math.log2(Math.max(1, n.outlets || 1)))
  const weight = (KIND_WEIGHT[n.kind] ?? 3) + coverage + 3 * (n.star || 0)
  const ageH = Math.max(0, (now - parseUtc(n.published_at)) / 3.6e6)
  return weight * 0.5 ** (ageH / HALF_LIFE_H)
}

const localDay = (t) => {
  const d = new Date(t)
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
}

export function previewScore(r, now) {
  if (!r.event_date || !r.is_upcoming) return 0
  const days = Math.round((Date.parse(r.event_date) - localDay(now)) / 8.64e7)
  if (days < 0) return 0
  const pos = r.card_position ?? 9
  let weight = pos === 0 ? 16 : pos === 1 ? 12 : Math.max(4, 10 - pos)
  if (/title bout/i.test(r.weight_class || '')) weight += 4
  if (!/^UFC\s+\d+/i.test(r.event_name || '')) weight *= 0.75
  return weight * 0.6 ** days
}

// One ranked list: { type: 'preview' | 'news', item, score, at }.
export function rankFront(previews, news, now = Date.now()) {
  const all = [
    ...previews.map((r) => ({ type: 'preview', item: r, score: previewScore(r, now), at: parseUtc(r.generated_at) })),
    ...news.map((n) => ({ type: 'news', item: n, score: newsScore(n, now), at: parseUtc(n.published_at) })),
  ]
  return all.sort((a, b) => b.score - a.score || b.at - a.at)
}
