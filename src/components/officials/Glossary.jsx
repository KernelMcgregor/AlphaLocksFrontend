// The Officials page's glossary: a button that opens a short list of what each table
// column means, for the view on screen.
import * as Dialog from '@radix-ui/react-dialog'
import { BookOpen, X } from 'lucide-react'

const TERMS = {
  judges: [
    ['With stats', 'How often they score rounds the way the stats do, vs most judges on the same rounds.'],
    ['With panel', 'How often they agree with the other two judges, vs expected.'],
    ['Last rd', 'How much they lean toward whoever won their previous round in close rounds.'],
    ['Favorite', 'How much they lean toward the betting favorite in close rounds.'],
    ['Home', 'How much they lean toward the fighter from the host country in close rounds.'],
    ['Majority', 'Split or majority decisions where they sided with the result.'],
    ['Dissents', 'Decisions where their card went against the result.'],
  ],
  referees: [
    ['Finish rate', 'Share of their fights ending inside the distance; percentile among referees with 50+ fights.'],
    ['Stoppages', 'Strikes a beaten fighter takes before the stop, compared with similar stoppages, accounting for each fighter’s KO power and durability. Fewer = stops early, more = lets it go.'],
    ['Ded./100', 'Point deductions per 100 decisions.'],
    ['DQ', 'Share of fights ending in a disqualification.'],
  ],
}

export default function Glossary({ view = 'judges' }) {
  const terms = TERMS[view] || TERMS.judges
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-[12px] font-semibold text-foreground/80 transition-colors hover:border-primary/40 hover:text-primary"
        >
          <BookOpen className="h-3.5 w-3.5" />Glossary
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(480px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-4 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <Dialog.Title className="font-display text-lg font-extrabold uppercase italic tracking-tight">Glossary</Dialog.Title>
            <Dialog.Close className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">What the terms on this page mean</Dialog.Description>
          <dl className="divide-y divide-border/70">
            {terms.map(([term, def]) => (
              <div key={term} className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 py-1">
                <dt className="text-[12px] font-bold">{term}</dt>
                <dd className="text-[12px] text-muted-foreground">{def}</dd>
              </div>
            ))}
          </dl>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
