import { useCallback, useRef, useState } from 'react'

interface PageData<T> {
  list: T[]
  hasMore: boolean
}

/**
 * 通用分页 Hook：上拉加载 + 下拉刷新
 * fetcher 通过 ref 保持最新，调用方可在 sort/筛选变化后手动调 refresh()
 */
export function usePaginatedList<T>(fetcher: (page: number) => Promise<PageData<T>>) {
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const [list, setList] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const pageRef = useRef(1)
  const lockRef = useRef(false)

  const refresh = useCallback(async () => {
    if (lockRef.current) return
    lockRef.current = true
    setRefreshing(true)
    try {
      pageRef.current = 1
      const data = await fetcherRef.current(1)
      setList(data.list)
      setHasMore(data.hasMore)
    } finally {
      setRefreshing(false)
      lockRef.current = false
    }
  }, [])

  const loadMore = useCallback(async () => {
    if (lockRef.current || loading || !hasMore) return
    lockRef.current = true
    setLoading(true)
    try {
      const next = pageRef.current + 1
      const data = await fetcherRef.current(next)
      pageRef.current = next
      setList((prev) => [...prev, ...data.list])
      setHasMore(data.hasMore)
    } finally {
      setLoading(false)
      lockRef.current = false
    }
  }, [loading, hasMore])

  const onReachBottom = useCallback(() => {
    loadMore()
  }, [loadMore])

  return { list, loading, refreshing, hasMore, refresh, loadMore, onReachBottom }
}
