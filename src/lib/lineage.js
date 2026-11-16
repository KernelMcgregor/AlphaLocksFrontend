// A fighter's style lineage as a small graph, from the ancestor lists on style rows
// (routers/ufc._style_row). Shared by the Lineage tab and the profile page.

export const ancestorsOf = (f, legends) => (legends ? f.notable_ancestors : f.ancestors) || []

// Two generations back from `root`. A legend reached twice is drawn once, with both lines.
export function buildTree(root, byId, legends) {
  const nodes = new Map([[root.id, { f: root, gen: 0, sim: 1 }]])
  const edges = []
  let frontier = [root]
  for (let gen = 1; gen <= 2; gen++) {
    const next = []
    for (const child of frontier) {
      for (const a of ancestorsOf(child, legends)) {
        const f = byId.get(a.id)
        if (!f) continue
        edges.push({ from: a.id, to: child.id, sim: a.sim })
        if (!nodes.has(a.id)) { nodes.set(a.id, { f, gen, sim: a.sim }); next.push(f) }
      }
    }
    frontier = next
  }
  return { nodes: [...nodes.values()], edges }
}
