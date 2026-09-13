// Small labelled number. The base tile of every stat grid.
export default function StatTile({ label, value }) {
  return (
    <div className="flex flex-col justify-center rounded-md border bg-muted/40 px-2 py-1.5">
      <div className="text-sm font-extrabold leading-none tabular-nums text-foreground">{value}</div>
      <div className="mt-1 text-[9px] font-semibold text-muted-foreground">{label}</div>
    </div>
  )
}
