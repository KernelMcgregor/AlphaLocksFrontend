import { useEffect, useState } from 'react'
import { fetchStyleDetail } from '../lib/api'

// A fighter's profile and comps. Stamped with the id it answers so a slow response for
// a previous fighter can never overwrite the current one.
export function useStyleDetail(id) {
  const [state, setState] = useState({ id: null, data: null, error: null })
  useEffect(() => {
    if (!id) return undefined
    let live = true
    fetchStyleDetail(id)
      .then((d) => live && setState({ id, data: d, error: null }))
      .catch((e) => live && setState({ id, data: null, error: e.message }))
    return () => { live = false }
  }, [id])
  const current = state.id === id
  return { detail: current ? state.data : null, error: current ? state.error : null, loading: !current }
}
