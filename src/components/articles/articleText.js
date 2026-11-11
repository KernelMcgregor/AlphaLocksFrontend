// Article text: splitting a preview's markdown into title / dek / body / verdict, and
// pulling the takeaways block out so a layout can place it. Plain functions, kept apart
// from article.jsx (components only) for fast refresh.
// "Gane vs. Hokit | UFC 334: The 103-Day Mirror Match" -> title "The 103-Day Mirror
// Match", matchup "Gane vs. Hokit", event "UFC 334".
export function splitHeadline(h = '') {
  const [matchup, ...rest] = h.split('|')
  const tail = rest.join('|').trim()
  const i = tail.indexOf(':')
  return {
    matchup: matchup.trim(),
    event: i < 0 ? null : tail.slice(0, i).trim(),
    title: (i < 0 ? tail : tail.slice(i + 1)).trim() || matchup.trim(),
  }
}

// Title, the opening paragraph (shown as the dek), the body without either, and the
// closing "**Prediction: ...**" line (shown as its own callout).
export function parseArticle(content = '') {
  const lines = content.split('\n')
  let headline = ''
  const body = []
  for (const line of lines) {
    if (!headline && /^#\s/.test(line)) { headline = line.replace(/^#\s+/, '').trim(); continue }
    if (/^##\s+Overview\s*$/i.test(line)) continue
    body.push(line)
  }
  let text = body.join('\n').trim()
  // Older articles carry a tale-of-the-tape table; the page's sidebar shows it now.
  text = text.replace(/^##\s+Tale of the Tape\s*\n[\s\S]*?(?=^##\s)/m, '')
  // Dek: the first plain paragraph.
  const paras = text.split(/\n\s*\n/)
  const firstIdx = paras.findIndex((p) => p.trim() && !/^(#|\||-|\*|>|```)/.test(p.trim()))
  const dek = firstIdx >= 0 ? paras[firstIdx].trim() : ''
  if (firstIdx >= 0) paras.splice(firstIdx, 1)
  text = paras.join('\n\n')
  const pm = text.match(/\*\*Prediction:\s*(.+?)\.?\*\*\s*$/m)
  const verdict = pm ? pm[1].trim() : null
  if (pm) text = text.replace(pm[0], '').trim()
  return { headline, ...splitHeadline(headline), dek, body: text, verdict }
}

export const takeawayItems = (src) => src.split('\n').map((l) => l.replace(/^\s*[-*]\s*/, '').trim()).filter(Boolean)

// Pulls the takeaways block out of the body, so a layout can place it (e.g. above the art).
export function extractTakeaways(body) {
  const m = body.match(/```chin-takeaways\n([\s\S]*?)```/)
  return m ? { items: takeawayItems(m[1]), body: body.replace(m[0], '').trim() } : { items: null, body }
}
