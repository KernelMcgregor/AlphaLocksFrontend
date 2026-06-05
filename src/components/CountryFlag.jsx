import { cn } from '../lib/utils'

export default function CountryFlag({ countryCode, className }) {
  if (!countryCode) return null

  return (
    <span
      className={cn(
        'fi inline-block rounded-sm shadow-sm',
        `fi-${countryCode.toLowerCase()}`,
        className,
      )}
      title={countryCode.toUpperCase()}
      style={{ width: '1.15em', height: '0.85em', verticalAlign: '-0.1em' }}
    />
  )
}
