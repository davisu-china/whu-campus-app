import { KeyboardEvent, useEffect, useRef, useState } from 'react'
import { DictItem, searchDict } from '../api/search'
import { cn } from '../utils/cn'
import { inputCls } from './AuthShell'

export type DictType = 'college' | 'course' | 'teacher' | 'contest'

interface Props {
  type: DictType
  value: string
  onChange: (v: string) => void
  placeholder?: string
  maxLength?: number
}

// 词典搜索补全下拉：输入即搜索，点选或回车选择。
export function DictSelect({ type, value, onChange, placeholder, maxLength }: Props) {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<DictItem[]>([])
  const [active, setActive] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)

  // 输入变化时搜索补全
  useEffect(() => {
    let cancelled = false
    searchDict(type, value)
      .then((list) => {
        if (!cancelled) setOptions(list)
      })
      .catch(() => {
        if (!cancelled) setOptions([])
      })
    return () => {
      cancelled = true
    }
  }, [type, value])

  // 点击外部关闭下拉
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function select(item: DictItem) {
    onChange(item.name)
    setOpen(false)
    setActive(-1)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') setOpen(true)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, options.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (active >= 0 && options[active]) select(options[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActive(-1)
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete="off"
        className={inputCls}
      />
      {open && options.length > 0 && (
        <ul className="absolute z-20 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-surface border border-line rounded-lg shadow-card py-1">
          {options.map((item, i) => (
            <li key={item.id}>
              <button
                type="button"
                // 阻止 input 失焦先于 click，保证点击能触发选择
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(item)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm transition-colors',
                  i === active ? 'bg-brand-soft text-brand-strong' : 'text-ink hover:bg-black/[0.03]'
                )}
              >
                {item.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
