// Officials — judges and referees on one page (?view=referees switches). Each view keeps
// its own filters in the URL; switching views drops the other view's params.
import { Gavel } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import Glossary from '../components/officials/Glossary'
import JudgesView, { JudgeControls } from '../components/officials/JudgesView'
import RefereesView, { RefereeControls } from '../components/officials/RefereesView'
import { SlideTabs } from '../components/ui/slide-tabs'

const VIEWS = [
  { key: 'judges', label: 'Judges' },
  { key: 'referees', label: 'Referees' },
]

export default function OfficialsPage() {
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'referees' ? 'referees' : 'judges'
  // The map explains itself in its own key; the glossary covers the tables.
  const onMap = params.get('tab') === 'map'

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* One row: title and the judges/referees switch, then the view's own controls and the glossary. */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 pb-3">
        <h1 className="page-title mr-2 flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary"><Gavel className="h-5 w-5 text-white" /></span>
          Officials
        </h1>
        <SlideTabs tabs={VIEWS} value={view} onChange={(v) => setParams(v === 'referees' ? { view: v } : {}, { replace: true })} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {!onMap && <Glossary view={view} />}
          {view === 'referees' ? <RefereeControls /> : <JudgeControls />}
        </div>
      </div>
      {view === 'referees' ? <RefereesView /> : <JudgesView />}
    </div>
  )
}
