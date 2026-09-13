import { ChevronLeft, ChevronRight } from 'lucide-react'

// Back/forward pair shared by the windowed charts.
export default function SlideControls({ label, win }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] tabular-nums text-muted-foreground">{label}</span>
      <button
        type="button"
        onClick={win.older}
        disabled={!win.canOlder}
        aria-label="Earlier"
        className="rounded-md border border-border p-0.5 text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronLeft className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={win.newer}
        disabled={!win.canNewer}
        aria-label="Later"
        className="rounded-md border border-border p-0.5 text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronRight className="h-3 w-3" />
      </button>
    </div>
  )
}
