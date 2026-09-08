import { cn } from '../../utils/cn'

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block animate-spin rounded-full border-2 border-current border-t-transparent',
        className || 'w-5 h-5'
      )}
      aria-label="加载中"
    />
  )
}
