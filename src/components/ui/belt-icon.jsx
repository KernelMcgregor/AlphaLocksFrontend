// A championship belt at badge size: the octagonal centre plate with a strap
// running out either side. Drawn as an icon rather than sourced from a set because
// no icon library ships a belt — and at 10px a literal buckle-and-holes belt reads
// as mud, so the strap is two lines and the plate carries the meaning.
//
// Takes the same props as a lucide icon (className sets size and colour) so it can
// drop straight into a badge next to them.
export default function BeltIcon({ className, strokeWidth = 2, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* strap: two lines each side, at the plate's shoulders */}
      <path d="M1 9h6M1 15h6M17 9h6M17 15h6" />
      {/* centre plate */}
      <path d="M9.5 5h5L18 8.5v7L14.5 19h-5L6 15.5v-7L9.5 5Z" />
    </svg>
  )
}
