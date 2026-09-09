import { useEffect, useRef, useState } from 'react'
import { cn } from '../../utils/cn'

interface PillOption {
  key: string
  label: string
}

interface PillSelectProps {
  value: string
  options: readonly PillOption[]
  onChange: (key: string) => void
  fallbackLabel?: string // value 未命中任何选项时的显示文案
  disabled?: boolean
  title?: string
}

// 轻量下拉 pill：与 BoardSelect 的 pill 视觉一致，用于搜索页的次级筛选（时间、排序）。
export function PillSelect({ value, options, onChange, fallbackLabel = '全部', disabled, title }: PillSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  const current = options.find((o) => o.key === value)

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        title={title}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-1 h-8 rounded-full border pl-3 pr-2.5 text-[13px] transition-colors',
          value
            ? 'border-brand/30 bg-brand-soft text-brand-strong'
            : 'border-line bg-surface text-ink-2 hover:border-brand/40',
          disabled && 'opacity-50 cursor-not-allowed hover:border-line'
        )}
      >
        <span className="truncate max-w-[140px]">{current?.label || fallbackLabel}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-max min-w-full py-1 bg-surface rounded-xl border border-line shadow-pop z-50">
          {options.map((o) => (
            <button
              key={o.key || '__all'}
              onClick={() => {
                onChange(o.key)
                setOpen(false)
              }}
              className={cn(
                'w-full flex items-center justify-between gap-3 px-3 py-1.5 text-[13px] whitespace-nowrap transition-colors',
                o.key === value ? 'text-brand font-medium bg-brand-soft' : 'text-ink hover:bg-black/[0.04]'
              )}
            >
              <span>{o.label}</span>
              {o.key === value && (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
                  <path d="m5 13 4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
