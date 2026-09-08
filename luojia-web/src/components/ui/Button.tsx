import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '../../utils/cn'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  block?: boolean
}

const variantCls: Record<Variant, string> = {
  primary:
    'bg-brand text-white hover:bg-brand-strong shadow-sm disabled:hover:bg-brand',
  secondary:
    'bg-brand-soft text-brand-strong hover:bg-[#dcefe5]',
  ghost: 'text-ink-2 hover:bg-black/[0.04] hover:text-ink',
  danger: 'bg-hot text-white hover:brightness-95'
}

const sizeCls: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] rounded-lg',
  md: 'h-10 px-4 text-sm rounded-xl',
  lg: 'h-12 px-6 text-base rounded-xl'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, block, className, children, disabled, ...rest }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed select-none',
          variantCls[variant],
          sizeCls[size],
          block && 'w-full',
          className
        )}
        {...rest}
      >
        {loading && <Spinner className="w-4 h-4" />}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
