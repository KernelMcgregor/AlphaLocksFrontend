// Fighter Styles — how fighters fight: a map of the style space and a tree of who
// descends from whom.
//
// Backed by /ufc/styles (every style-eligible fighter's family, map position, lineage),
// rebuilt after every event by style_page_service. Positions and lineage live in an
// ERA-ADJUSTED space, so a 2010 grappler and a 2024 grappler can sit together.
//
// Tab and selected fighter are in the URL (?tab=tree&fighter=123) so any view is a
// link someone can share. Opening the tree with ?fighter= isolates that fighter.
import { Orbit } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageLoader from '../components/PageLoader'
import { Card, CardContent } from '../components/ui/card'
import { SlideTabs } from '../components/ui/slide-tabs'
import StyleMapView from '../components/styles/StyleMapView'
import StyleTreeView from '../components/styles/StyleTreeView'
import { fetchStyles, peekCached } from '../lib/api'
import { byP4P, useP4P } from '../hooks/useP4P'

const TABS = [
  { key: 'map', label: 'Style Map' },
  { key: 'tree', label: 'Style Tree' },
]

// Opening fighter when the URL names none: the #1 P4P fighter (men's list), falling back
// to the highest-quality active fighter until the P4P list has loaded.
function defaultFighter(fighters, p4p) {
  const pool = fighters.filter((f) => f.active)
  return [...(pool.length ? pool : fighters)].sort(byP4P(p4p))[0]?.id ?? null
}

export default function FighterStylesPage() {
  const [data, setData] = useState(() => peekCached('/ufc/styles'))
  const [error, setError] = useState(null)
  const [params, setParams] = useSearchParams()
  const p4p = useP4P()
  // Old links (?tab=lineage / explorer / archetypes) land on the nearest new tab.
  const raw = params.get('tab')
  const tab = TABS.some((t) => t.key === raw) ? raw : raw === 'lineage' || raw === 'explorer' ? 'tree' : 'map'

  useEffect(() => {
    let live = true
    fetchStyles().then((d) => live && setData(d)).catch((e) => live && setError(e.message))
    return () => { live = false }
  }, [])

  const byId = useMemo(() => {
    const m = new Map()
    for (const f of data?.fighters || []) m.set(f.id, f)
    return m
  }, [data])

  const chosen = byId.has(params.get('fighter')) ? params.get('fighter') : null
  const fighterId = useMemo(() => chosen || (data ? defaultFighter(data.fighters, p4p) : null), [chosen, data, p4p])

  const go = (next) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) (v == null ? p.delete(k) : p.set(k, v))
    setParams(p, { replace: false })
  }

  const tabs = <SlideTabs tabs={TABS} value={tab} onChange={(t) => go({ tab: t })} />

  if (error) {
    return <Card><CardContent className="p-6"><p className="text-destructive">Couldn't load fighter styles: {error}</p></CardContent></Card>
  }
  if (!data) return <PageLoader />

  const shared = { data, byId, fighterId, onSelect: (id, toTab) => go({ fighter: id, tab: toTab || tab }) }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 pb-3">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600"><Orbit className="h-5 w-5 text-white" /></span>
          Fighter Styles
        </h1>
        {tabs}
      </div>

      {!data.fighters.length ? (
        <Card><CardContent className="p-6"><p className="text-muted-foreground">Fighter styles haven't been computed yet. They're built after each event.</p></CardContent></Card>
      ) : tab === 'tree' ? (
        // The tree is a fixed-height canvas with its own pan/zoom, so no page scroll.
        <div className="min-h-0 flex-1 pb-1">
          <StyleTreeView {...shared} chosenId={chosen} />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <StyleMapView {...shared} />
        </div>
      )}
    </div>
  )
}
