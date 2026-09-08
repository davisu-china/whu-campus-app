import { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export const inputCls =
  'w-full h-11 rounded-lg border border-line bg-bg px-3 text-sm text-ink placeholder:text-ink-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-all'

export function AuthShell({
  subtitle,
  children,
  footer
}: {
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <img src="/whu-logo.png?v=3" alt="武汉大学校徽" className="w-12 h-12 object-contain" />
            <span className="text-2xl font-bold text-ink font-serif">在武大</span>
          </Link>
          <p className="mt-3 text-sm text-ink-3">{subtitle}</p>
        </div>

        <div className="bg-surface rounded-2xl border border-line/60 p-6 space-y-4 shadow-card">{children}</div>

        {footer && <p className="text-center text-[13px] text-ink-3 mt-6">{footer}</p>}
      </div>
    </div>
  )
}
