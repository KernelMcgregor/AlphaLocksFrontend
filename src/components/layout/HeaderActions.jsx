// src/components/layout/HeaderActions.jsx
// Portals page-level actions (back buttons, filters, badges) into the Layout's
// breadcrumb row instead of costing the page a second toolbar row — which matters
// on short laptop viewports where every ~50px of vertical space is content.
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export default function HeaderActions({ children }) {
  // Lazily create a stable host node; mount it into the Layout slot on commit.
  const [el] = useState(() => {
    const node = document.createElement('div')
    node.className = 'flex items-center gap-2'
    return node
  })

  useEffect(() => {
    const host = document.getElementById('page-header-actions')
    if (!host) return
    host.appendChild(el)
    return () => el.remove()
  }, [el])

  return createPortal(children, el)
}
