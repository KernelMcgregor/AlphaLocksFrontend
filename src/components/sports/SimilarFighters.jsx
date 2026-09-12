// Stylistic comparables for a fighter — "who fights like this guy?".
//
// Backed by ufc_fighter_similarity, which is a k-NN retrieval over a PCA-whitened space
// built from career tendency rates plus mean-centred Glicko dimensions. The mean-centring
// is why an elite and a journeyman with the same habits come out as neighbours: it strips
// the overall-quality axis and leaves the shape of the profile.
//
// The driver chips are not decoration. A similarity panel with no stated reason is an
// oracle, and users correctly distrust it; each chip names a trait both fighters share
// strongly, and every one of them is a column the user can check on this same page.
import { Loader2, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import CountryFlag from '../CountryFlag'
import { SlideTabs } from '../ui/slide-tabs'
import { Tip } from '../ui/tip'
import FighterMini from './FighterMini'
import { fetchRankings, fetchSimilarFighters } from '../../lib/api'
import { cn, formatRecord } from '../../lib/utils'
import FighterImage from './FighterImage'

// Feature key -> what to actually call it on screen. The raw column names (gnp15g,
// td15s, sub_att15g) are backend vocabulary and mean nothing to a reader.
const DRIVER_LABELS = {
  slpm: 'strike volume',
  sapm: 'strikes absorbed',
  sig_acc: 'striking accuracy',
  sig_def: 'striking defense',
  head_pct: 'head targeting',
  body_pct: 'body work',
  leg_pct: 'leg kicks',
  dist_pct: 'distance striking',
  clinch_pct: 'clinch work',
  ground_pct: 'ground striking',
  td15s: 'takedown volume',
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

// Capped rather than scrolled: this panel shares a fixed-height column, and a
// scrollable list inside it competes with the page's own scrolling. Four is what
// fits without the container needing to scroll.
const MAX_ROWS = 4

// z carries the shared direction: both fighters above the mean, or both below. "Low leg
// kicks" is as real a shared trait as "high leg kicks", and collapsing the two would
// make the chips lie.
function driverText({ feature, z }) {
  const label = DRIVER_LABELS[feature] || feature.replace(/_/g, ' ')
  return `${z >= 0 ? 'high' : 'low'} ${label}`
}

export default function SimilarFighters({ fighterId, className }) {
  const [scope, setScope] = useState('all')
  // Results are stamped with the request they answer, and `loading` is derived by
  // comparing that stamp to the current one. Holding a separate loading flag would mean
  // setting state synchronously inside the effect just to flip it true, which cascades a
  // render on every fighter change.
  const [result, setResult] = useState({ key: null, rows: [] })
  // Divisional rank is NOT on the similarity response — its `rank` column is the
  // neighbour's position in *this* similarity list. Pull real ranks from the
  // rankings payload, which cachedRequest already has in memory for this page.
  const [ranks, setRanks] = useState({})
  const key = `${fighterId}:${scope}`

  useEffect(() => {
    let cancelled = false
    fetchRankings()
      .then((data) => {
        if (cancelled) return
        const map = {}
        for (const wc of data?.weight_classes || []) {
          if (wc.key?.startsWith('p4p')) continue // divisional rank is the meaningful one
          for (const f of wc.fighters) map[String(f.id)] = { rank: f.rank, division: wc.label }
        }
        setRanks(map)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!fighterId) return undefined
    let cancelled = false
    fetchSimilarFighters(fighterId, { limit: MAX_ROWS, sameDivisionOnly: scope === 'division' })
      .then((data) => { if (!cancelled) setResult({ key, rows: data }) })
      .catch(() => { if (!cancelled) setResult({ key, rows: [] }) })
    return () => { cancelled = true }
  }, [fighterId, scope, key])

  const loading = result.key !== key
  const rows = loading ? [] : result.rows.slice(0, MAX_ROWS)

  return (
    <div className={cn('rounded-lg border border-border p-3', className)}>
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-foreground/70">
          Similar fighters
        </span>
        <SlideTabs
          size="sm"
          value={scope}
          onChange={setScope}
          tabs={[
            { key: 'all', label: 'All' },
            { key: 'division', label: 'Division' },
          ]}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {loading ? (
          <div className="flex flex-1 items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          // Normal for anyone below the eligibility floor (3 decided fights / 10 rounds),
          // and for an unranked division when the scope is narrowed — not an error.
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-6 text-center">
            <Users className="h-5 w-5 text-muted-foreground/50" />
            <p className="text-[11.5px] font-semibold text-muted-foreground">
              No similar fighters
            </p>
            <p className="max-w-[220px] text-[10px] leading-snug text-muted-foreground/70">
              {scope === 'division'
                ? 'No stylistic neighbours inside this division.'
                : 'Needs at least 3 decided fights and 10 rounds.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {rows.map((f) => (
              <Tip
                key={f.id}
                content={<FighterMini f={{
                  name: `${f.first_name} ${f.last_name}`,
                  image_url: f.image_url,
                  nickname: f.nickname,
                  country_code: f.country_code,
                  record: formatRecord(f.wins, f.losses, f.draws || undefined),
                  ...(ranks[String(f.id)] || {}),
                }} />}
              >
              <Link
                to={`/ufc/fighters/${f.id}`}
                className="flex items-center gap-2.5 rounded-lg border border-border px-2.5 py-1.5 transition-colors hover:bg-muted/40"
              >
                <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-muted">
                  <FighterImage fighter={f} className="h-full w-full" />
                  <CountryFlag countryCode={f.country_code} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[12px] font-bold leading-tight">
                      {f.first_name} {f.last_name}
                    </span>
                    {f.previous_rank == null && (
                      <span className="shrink-0 rounded bg-blue-500/15 px-1 py-px text-[8.5px] font-bold uppercase tracking-wide text-blue-600">
                        New
                      </span>
                    )}
                  </div>
                  <div className="truncate text-[10px] leading-tight text-muted-foreground">
                    {formatRecord(f.wins, f.losses, f.draws || null)}
                    {f.top_drivers?.length > 0 && (
                      <span> · {f.top_drivers.map(driverText).join(', ')}</span>
                    )}
                  </div>
                </div>

                <span className="shrink-0 text-[10.5px] font-extrabold tabular-nums text-viz-1">
                  {Math.round(f.similarity * 100)}%
                </span>
              </Link>
              </Tip>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
