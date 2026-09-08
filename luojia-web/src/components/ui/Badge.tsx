import { cn } from '../../utils/cn'

interface BadgeProps {
  count?: number
  dot?: boolean
  className?: string
}

export function Badge({ count, dot, className }: BadgeProps) {
  if (dot && (!count || count <= 0)) {
    return <span className={cn('block w-2 h-2 rounded-full bg-hot', className)} />
  }
  if (!count || count <= 0) return null
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center min-w-[16px] h-4 px-1',
        'rounded-full bg-hot text-white text-[10px] leading-none font-medium',
        className
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
