// The picked row (?<key>=) for a best-of tab; on a narrow screen the panel sits above the
// table, so a pick scrolls it into view.
import { useRef } from 'react'
import { useSearchParams } from 'react-router-dom'

export function useSelect(key) {
  const [params, setParams] = useSearchParams()
  const panelRef = useRef(null)
  const select = (id) => {
    const p = new URLSearchParams(params)
    p.set(key, id)
    setParams(p, { replace: true })
    if (!window.matchMedia('(min-width: 1024px)').matches) panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  return [params.get(key), select, panelRef]
}
