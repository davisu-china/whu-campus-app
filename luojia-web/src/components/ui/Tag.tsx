import { ReactNode } from 'react'
import { cn } from '../../utils/cn'

type TagColor = 'brand' | 'ink' | 'hot'

interface TagProps {
  children: ReactNode
  active?: boolean
  color?: TagColor
  className?: string
  onClick?: () => void
}

const colorCls: Record<TagColor, string> = {
  brand: 'text-brand bg-brand-soft',
  ink: 'text-ink-2 bg-black/[0.04]',
  hot: 'text-hot bg-rose-50'
}

export function Tag({ children, active, color = 'ink', className, onClick }: TagProps) {
  const Comp = onClick ? 'button' : 'span'
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-[12px] leading-5',
        onClick && 'cursor-pointer transition-colors hover:opacity-80',
        colorCls[color],
        active && 'ring-1 ring-inset ring-brand text-brand font-medium',
        className
      )}
    >
      {children}
    </Comp>
  )
}
