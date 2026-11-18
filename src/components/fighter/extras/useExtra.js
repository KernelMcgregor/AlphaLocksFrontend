import { useEffect, useState } from 'react'

// One fetch keyed by `key`, stamped with the key it answers so a slow response for a
// previous fighter can never land on the current one. `loaded` is false until it settles;
// a failed request (404 for a fighter with no data) settles as null.
export function useExtra(fetcher, key) {
  const [state, setState] = useState({ key: null, data: null })
  useEffect(() => {
    if (key == null) return undefined
    let live = true
    fetcher(key)
      .then((d) => live && setState({ key, data: d }))
      .catch(() => live && setState({ key, data: null }))
    return () => { live = false }
  }, [fetcher, key])
  const loaded = state.key === key
  return { data: loaded ? state.data : null, loaded }
}
