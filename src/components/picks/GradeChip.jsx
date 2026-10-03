// A pick's letter grade, with the backtest band behind it on hover.
//
// The tooltip is the important half. A grade is one EV band's realised ROI, and single
// bands are noisy — neighbouring bands in the same market can sit several letters apart —
// so the band's sample size and confidence interval ride along with every letter.
import Tip from '../ui/tip'
import { bandLabel, familyNoun, fmtRoi, gradeText, gradeTone } from '../../lib/picks'
import { cn } from '../../lib/utils'

const TONES = {
  a: 'bg-emerald-600 text-white border-emerald-700',
  b: 'bg-teal-500/15 text-teal-700 border-teal-500/50 dark:text-teal-300',
  c: 'bg-amber-500/15 text-amber-700 border-amber-500/50 dark:text-amber-300',
  d: 'bg-rose-500/15 text-rose-700 border-rose-500/50 dark:text-rose-300',
  none: 'bg-muted text-muted-foreground border-border',
}

const SIZES = {
  sm: 'h-6 min-w-8 px-1.5 text-[12px] rounded-md',
  md: 'h-9 min-w-11 px-2 text-[17px] rounded-lg',
  lg: 'h-14 min-w-14 px-2.5 text-[26px] rounded-xl',
}

export function GradeBasis({ grade, basis }) {
  if (grade === '—') return <div className="text-[11.5px]">No pick: no side has at least a 3% edge at a typical book.</div>
  if (grade === 'NR' || !basis) {
    return <div className="text-[11.5px]">Not rated: this market has no backtest history at this edge yet.</div>
  }
  const [lo, hi] = basis.ci || []
  return (
    <div className="space-y-1 text-[11.5px] leading-snug">
      <div className="font-bold">
        This band ({familyNoun(basis.family)} picks, {bandLabel(basis.band)})
      </div>
      <div>
        Expected ROI <span className="font-semibold">{fmtRoi(basis.expected_roi)}</span> at a typical book.
        That is the grade.
      </div>
      <div className="text-muted-foreground">
        {basis.n.toLocaleString()} past bets returned {fmtRoi(basis.roi)}
        {basis.ci && <> (95% CI {fmtRoi(lo, 0)} to {fmtRoi(hi, 0)})</>}; the estimate discounts
        that by how much luck could explain it, toward this market&apos;s overall record
        {basis.market_roi != null && <> ({fmtRoi(basis.market_roi)})</>}.
      </div>
      {basis.roi_best != null && (
        <div className="text-muted-foreground">At the best price: {fmtRoi(basis.roi_best)} ROI.</div>
      )}
      {basis.small_sample && <div className="font-semibold text-amber-600">Small sample: fewer than 50 bets.</div>}
    </div>
  )
}

export default function GradeChip({ grade, basis, size = 'md', className }) {
  return (
    <Tip content={<GradeBasis grade={grade} basis={basis} />} className={cn('inline-flex shrink-0', className)}>
      <span
        aria-label={`Grade ${gradeText(grade)}`}
        className={cn(
          'inline-flex cursor-help items-center justify-center border font-black tabular-nums tracking-tight',
          SIZES[size],
          TONES[gradeTone(grade)],
        )}
      >
        {gradeText(grade)}
      </span>
    </Tip>
  )
}
