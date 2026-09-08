import { ReactNode } from 'react'
import { cn } from '../../utils/cn'

interface EmptyStateProps {
  icon?: ReactNode
  title?: string
  desc?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title = '暂无内容', desc, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-6 text-center', className)}>
      {icon && <div className="text-ink-3 mb-4 text-5xl leading-none">{icon}</div>}
      {!icon && (
        <div className="mb-4 w-12 h-12 rounded-2xl bg-black/[0.03] flex items-center justify-center text-ink-3 text-xl">
          ✦
        </div>
      )}
      <p className="text-ink-2 font-medium">{title}</p>
      {desc && <p className="mt-1 text-ink-3 text-sm">{desc}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
