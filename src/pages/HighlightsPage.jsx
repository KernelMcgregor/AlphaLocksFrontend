// Highlights: the most exciting fights and cards, the bonuses, and the biggest robberies,
// over any window. Tab (?tab=) and window (?w=) live in the URL; switching tabs keeps the window.
import { Flame } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import BonusesView from '../components/best/BonusesView'
import CardsView from '../components/best/CardsView'
import FightsView, { FightControls } from '../components/best/FightsView'
import RobberiesView from '../components/best/RobberiesView'
import WindowPicker from '../components/best/WindowPicker'
import { SlideTabs } from '../components/ui/slide-tabs'

const TABS = [
  { key: 'fights', label: 'Fights', View: FightsView, Controls: FightControls },
  { key: 'cards', label: 'Cards', View: CardsView },
  { key: 'bonuses', label: 'Bonuses', View: BonusesView },
  { key: 'robberies', label: 'Robberies', View: RobberiesView },
]

export default function HighlightsPage() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.find((t) => t.key === params.get('tab')) || TABS[0]
  const setTab = (k) => {
    const p = new URLSearchParams()
    if (k !== TABS[0].key) p.set('tab', k)
    if (params.get('w')) p.set('w', params.get('w'))
    setParams(p, { replace: true })
  }
  const { View, Controls } = tab

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-3 pb-3">
        <h1 className="page-title mr-2 flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary"><Flame className="h-5 w-5 text-white" /></span>
          Highlights
        </h1>
        <SlideTabs tabs={TABS} value={tab.key} onChange={setTab} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {Controls && <Controls />}
          <WindowPicker />
        </div>
      </div>
      <View />
    </div>
  )
}
