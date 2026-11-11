import logoSrc from '../../assets/chinlytics-logo.png'
import { cn } from '../../lib/utils'

// "CHIN" takes the surface's ink (white on the gray sidebar, black on a white bar);
// "LYTICS" is always UFC red.
export function Wordmark({ className, chinClass = 'text-white' }) {
  return (
    <span className={cn('font-display font-extrabold italic uppercase leading-none tracking-tight', className)}>
      <span className={chinClass}>Chin</span><span className="text-primary">lytics</span>
    </span>
  )
}

export function BrandLockup() {
  return (
    <div className="flex items-center gap-2.5 2xl:gap-3">
      <img src={logoSrc} alt="Chinlytics" className="h-9 w-9 shrink-0 2xl:h-11 2xl:w-11" />
      <Wordmark className="text-[24px] 2xl:text-[28px]" />
    </div>
  )
}
