// A judge's headline numbers for a hover tooltip: accuracy above expected and their
// most distinctive lean.
import { leanPhrase, ordinal, pts, topLean } from './lib'

export default function JudgeStats({ profile }) {
  if (!profile) return null
  const lean = topLean(profile)
  return (
    <span className="mt-1 block space-y-0.5 tabular-nums">
      <span className="block">
        <b>{pts(profile.acc_above_exp)}</b> agrees with stats vs most judges
        {profile.pct_acc_above_exp != null && <span className="text-muted-foreground"> · {ordinal(profile.pct_acc_above_exp)} pct.</span>}
      </span>
      <span className="block">
        {lean ? <>{leanPhrase(lean)}</> : <span className="text-muted-foreground">No standout lean</span>}
      </span>
    </span>
  )
}
