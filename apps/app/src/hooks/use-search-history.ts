import { useCallback, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = 'luo_search_history'
const MAX = 20

function sanitize(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v): v is string => typeof v === 'string' && v.trim() !== '').slice(0, MAX)
  } catch {
    return []
  }
}

/** 本地搜索历史：去重、最新在前、最多 20 条。 */
export function useSearchHistory() {
  const [history, setHistory] = useState<string[]>([])

  useEffect(() => {
    let alive = true
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (alive) setHistory(sanitize(raw))
      })
      .catch(() => {
        // 读取失败（存储不可用）：保持空历史，不影响搜索
      })
    return () => {
      alive = false
    }
  }, [])

  const add = useCallback((term: string) => {
    const t = term.trim()
    if (!t) return
    setHistory((prev) => {
      const next = [t, ...prev.filter((v) => v !== t)].slice(0, MAX)
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {})
      return next
    })
  }, [])

  const clear = useCallback(() => {
    setHistory([])
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {})
  }, [])

  return { history, add, clear }
}
