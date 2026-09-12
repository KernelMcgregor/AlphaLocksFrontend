// The one place the site decides what a fighter's portrait looks like.
//
// Roughly 1,800 fighters have no photo upstream — UFC.com has no athlete page for them,
// or serves a placeholder instead of a portrait. Rather than scattering initials
// fallbacks across seven files, every caller renders this and gets the silhouette.
//
// The src points at our own endpoint, which serves the cached bytes and falls back to
// redirecting to UFC.com, so portraits keep working when a `?itok=` signature rotates.
// `onError` covers the rest: a dead URL, a network failure, a fighter whose cache has
// not been filled yet.
import { useState } from 'react'
import silhouette from '../../assets/fighter-silhouette.webp'
import { fighterImageUrl } from '../../lib/api'
import { cn } from '../../lib/utils'

export default function FighterImage({
  fighter,
  className,
  imgClassName,
  //: How the portrait sits in its box. 'cover' crops to fill (thumbnails, cards);
  //: 'contain' shows the whole body (profile heroes).
  fit = 'cover',
  alt = '',
}) {
  const src = fighterImageUrl(fighter)
  // Remember which src failed, not just that one did: these components sit in reused
  // rows, and a bare boolean would pin every later fighter in that slot to the
  // silhouette until something forced a remount.
  const [failedSrc, setFailedSrc] = useState(null)

  const showSilhouette = !src || failedSrc === src

  return (
    <span className={cn('block overflow-hidden', className)}>
      <img
        src={showSilhouette ? silhouette : src}
        alt={alt}
        draggable={false}
        onError={() => setFailedSrc(src)}
        className={cn(
          'h-full w-full',
          fit === 'contain' ? 'object-contain object-bottom' : 'object-cover object-top',
          // The silhouette is solid black at full strength, which reads as heavier than
          // the photos it stands in for. Knocking it back keeps a list of fighters even.
          showSilhouette && 'opacity-25',
          imgClassName,
        )}
      />
    </span>
  )
}
