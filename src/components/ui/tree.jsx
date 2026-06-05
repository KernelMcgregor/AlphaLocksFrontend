import { ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'

export function Tree({ tree, indent = 20, className, children, ...props }) {
  return (
    <div
      role="tree"
      className={cn('text-sm', className)}
      style={{ '--tree-indent': `${indent}px` }}
      {...tree.getProps()}
      {...props}
    >
      {children}
    </div>
  )
}

export function TreeItem({ item, children, className, ...props }) {
  const isFolder = item.isFolder?.()
  const isExpanded = item.isExpanded?.()
  const depth = item.getItemMeta?.()?.depth ?? 0

  return (
    <div
      role="treeitem"
      className={cn('flex flex-col', className)}
      {...item.getProps?.()}
      {...props}
    >
      {children}
    </div>
  )
}

export function TreeItemLabel({ item, onClick, icon, className, children }) {
  const isFolder = item.isFolder?.()
  const isExpanded = item.isExpanded?.()
  const isSelected = item.isSelected?.()
  const depth = item.getItemMeta?.()?.depth ?? 0

  return (
    <button
      onClick={(e) => {
        if (isFolder) {
          item.isExpanded() ? item.collapse() : item.expand()
        }
        onClick?.(e)
      }}
      className={cn(
        'flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        isSelected && 'bg-accent text-accent-foreground font-medium',
        className
      )}
      style={{ paddingLeft: `${depth * 20 + 8}px` }}
    >
      {isFolder && (
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
            isExpanded && 'rotate-90'
          )}
        />
      )}
      {!isFolder && <span className="w-3.5" />}
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="truncate">{children || item.getItemName?.()}</span>
    </button>
  )
}
