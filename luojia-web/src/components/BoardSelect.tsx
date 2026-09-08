import { useEffect, useRef, useState } from 'react'
import { useCategoryStore } from '../store/category'
import { cn } from '../utils/cn'

interface BoardSelectProps {
  value: string // '' = 全部板块（当 allowAll 时）
  onChange: (id: string) => void
  compact?: boolean
  align?: 'left' | 'right'
  allowAll?: boolean // 是否显示「全部板块」选项（搜索用 true，发帖用 false）
  placeholder?: string // value 为空且 !allowAll 时显示
  fullWidth?: boolean
}

// 板块选择（父子级联）：先选分类（父），再选板块（子）。
export function BoardSelect({
  value,
  onChange,
  compact,
  align = 'left',
  allowAll = true,
  placeholder = '请选择',
  fullWidth
}: BoardSelectProps) {
  const categories = useCategoryStore((s) => s.categories)
  const loadCategories = useCategoryStore((s) => s.load)
  const [open, setOpen] = useState(false)
  const [level, setLevel] = useState<'root' | 'board'>('root')
  const [catId, setCatId] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const selected = categories.flatMap((c) => c.boards).find((b) => b.id === value)
  const activeCat = categories.find((c) => c.id === catId)

  const label = selected ? selected.name : allowAll ? '全部板块' : placeholder

  function toggle() {
    if (open) {
      setOpen(false)
    } else {
      setLevel('root')
      setCatId('')
      setOpen(true)
    }
  }

  function pickBoard(id: string) {
    onChange(id)
    setOpen(false)
  }

  const itemCls = (active: boolean) =>
    cn(
      'w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between gap-2',
      active ? 'text-brand font-medium bg-brand-soft' : 'text-ink hover:bg-black/[0.04]'
    )

  return (
    <div ref={ref} className={cn('relative', fullWidth ? 'w-full' : 'shrink-0')}>
      <button
        type="button"
        onClick={toggle}
        className={cn(
          'inline-flex items-center gap-1 rounded-lg transition-colors',
          fullWidth && 'w-full justify-between',
          compact
            ? 'h-8 pl-3 pr-1.5 text-[13px] text-ink-2 hover:text-ink'
            : 'h-11 px-3 border border-line bg-surface text-sm text-ink hover:border-brand/40'
        )}
      >
        <span className={cn('truncate', compact ? 'max-w-[120px]' : '')}>{label}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          className={cn(
            'absolute top-full mt-1 max-h-80 overflow-y-auto bg-surface rounded-xl border border-line shadow-pop py-1 z-50',
            fullWidth ? 'w-full' : 'w-64',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          {level === 'root' ? (
            <>
              {allowAll && (
                <button onClick={() => pickBoard('')} className={itemCls(value === '')}>
                  <span>全部板块</span>
                </button>
              )}
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setCatId(c.id)
                    setLevel('board')
                  }}
                  className={itemCls(false)}
                >
                  <span>{c.name}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-ink-3 shrink-0">
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </button>
              ))}
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setLevel('root')
                  setCatId('')
                }}
                className="w-full text-left px-3 py-2 text-sm text-ink-2 hover:bg-black/[0.04] transition-colors flex items-center gap-1.5"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
                  <path d="m15 6-6 6 6 6" />
                </svg>
                <span className="font-medium text-ink">{activeCat?.name}</span>
              </button>
              <div className="my-1 border-t border-line/60" />
              {(activeCat?.boards || []).map((b) => (
                <button key={b.id} onClick={() => pickBoard(b.id)} className={itemCls(value === b.id)}>
                  <span>{b.name}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
