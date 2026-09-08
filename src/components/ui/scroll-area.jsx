import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area'
import { cn } from '../../lib/utils'

// `viewportClassName` targets the Radix viewport — use it to restyle the wrapper
// Radix injects around children, e.g. `[&>div]:!flex [&>div]:!min-h-full` so short
// content stretches to fill the scroll area instead of leaving dead space below.
export function ScrollArea({ className, viewportClassName, children, ...props }) {
  return (
    <ScrollAreaPrimitive.Root className={cn('relative overflow-hidden', className)} {...props}>
      <ScrollAreaPrimitive.Viewport className={cn('h-full w-full rounded-[inherit] pr-3 [&>div]:!block', viewportClassName)} style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({ className, orientation = 'vertical', ...props }) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      forceMount
      orientation={orientation}
      className={cn(
        'flex select-none',
        orientation === 'vertical' && 'h-full w-2.5 border-l border-l-transparent p-px',
        orientation === 'horizontal' && 'h-2.5 flex-col border-t border-t-transparent p-px',
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-border" />
    </ScrollAreaPrimitive.Scrollbar>
  )
}
