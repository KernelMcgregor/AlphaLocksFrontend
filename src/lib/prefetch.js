// Background cache warmer.
//
// The Upcoming dashboard swaps its featured preview on every rail click, and each swap
// needs three requests the /ufc/upcoming payload does not carry: the fight's context
// (Glicko percentiles, age, rank) and both fighters' bout histories. Fetched on click
// those take long enough to show a loading state on every single selection, which is
// the whole of the "blank for a second" problem.
//
// So they are fetched up front instead, in the background, straight into the api.js
// cache. By the time a click happens the data is usually already there and the swap is
// a synchronous render.
//
// Concurrency is deliberately low. The browser allows six connections per host, and the
// context endpoint is the expensive one (~1-2s); saturating the pool with prefetches
// would make a click that misses the cache queue behind them, which is the opposite of
// the goal. Four leaves headroom for the click to get through.

/**
 * Run `tasks` (thunks returning promises) with bounded concurrency.
 * Returns a cancel function — pending tasks are abandoned, in-flight ones are not
 * aborted but their results still land in the cache, which is harmless.
 */
export function runQueue(tasks, concurrency = 4) {
  let next = 0
  let cancelled = false

  const worker = async () => {
    while (!cancelled && next < tasks.length) {
      const task = tasks[next++]
      // A failed prefetch is not an error: the component refetches on demand and the
      // user sees the ordinary loading path. Swallow it rather than surfacing it.
      try { await task() } catch { /* cold cache is the fallback */ }
    }
  }

  for (let i = 0; i < Math.min(concurrency, tasks.length); i++) worker()
  return () => { cancelled = true }
}
