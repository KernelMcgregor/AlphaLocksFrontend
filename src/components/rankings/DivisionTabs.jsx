// The Rankings header's division switch: Men / Women, then the pool's boards as short
// tabs (P4P · BMF · FLY · BW ...), full names on hover.
import { SlideTabs } from '../ui/slide-tabs'
import { baseOf, poolCounterpart, poolOf, SHORT } from './divisions'

const POOLS = [{ key: 'men', label: 'Men' }, { key: 'women', label: 'Women' }]

export default function DivisionTabs({ items, value, onChange }) {
  const pool = poolOf(value)
  const tabs = items
    .filter((it) => poolOf(it.key) === pool)
    .map((it) => ({ key: it.key, label: <span title={it.label}>{SHORT[baseOf(it.key)] || it.label}</span> }))
  return (
    <div className="flex min-w-0 items-center gap-2">
      <SlideTabs size="sm" tabs={POOLS} value={pool}
        onChange={(p) => p !== pool && onChange(poolCounterpart(value, items, p))} />
      <div className="min-w-0 overflow-x-auto [scrollbar-width:none]">
        <SlideTabs size="sm" tabs={tabs} value={value} onChange={onChange} />
      </div>
    </div>
  )
}
