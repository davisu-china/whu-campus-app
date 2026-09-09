import { useCallback, useState } from 'react'

const STORAGE_KEY = 'luo_search_history'
const MAX = 20

function read(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v): v is string => typeof v === 'string' && v.trim() !== '').slice(0, MAX)
  } catch {
    return []
  }
}

function write(list: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // 隐私模式 / 存储满：静默降级，历史功能失效但不影响搜索
  }
}

/** 本地搜索历史：去重、最新在前、最多 20 条。 */
export function useSearchHistory() {
  const [history, setHistory] = useState<string[]>(read)

  const add = useCallback((term: string) => {
    const t = term.trim()
    if (!t) return
    setHistory((prev) => {
      const next = [t, ...prev.filter((v) => v !== t)].slice(0, MAX)
      write(next)
      return next
    })
  }, [])

  const clear = useCallback(() => {
    setHistory([])
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // 同上
    }
  }, [])

  return { history, add, clear }
}
