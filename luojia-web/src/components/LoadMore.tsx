import { useEffect, useRef } from 'react'
import { Spinner } from './ui/Spinner'

interface LoadMoreProps {
  loading: boolean
  hasMore: boolean
  onLoadMore: () => void
}

export function LoadMore({ loading, hasMore, onLoadMore }: LoadMoreProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !hasMore) return
    const ob = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) onLoadMore()
      },
      { rootMargin: '300px' }
    )
    ob.observe(el)
    return () => ob.disconnect()
  }, [hasMore, onLoadMore])

  return (
    <div ref={ref}>
      {loading && (
        <div className="flex justify-center py-6">
          <Spinner className="text-brand" />
        </div>
      )}
      {!hasMore && !loading && (
        <p className="text-center text-ink-3 text-[13px] py-6">— 已经到底啦 —</p>
      )}
    </div>
  )
}
