import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getHomeFeed } from '../api/content'
import { usePaginatedList } from '../hooks/usePaginatedList'
import { PostCard } from '../components/PostCard'
import { LoadMore } from '../components/LoadMore'
import { EmptyState } from '../components/ui/EmptyState'

export default function Home() {
  const { list, loading, hasMore, refresh, loadMore } = usePaginatedList((page) =>
    getHomeFeed(page, 20).then((r) => ({ list: r.list, hasMore: r.has_more }))
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <div>
      {/* 移动端分类快捷入口 */}
      <div className="lg:hidden flex gap-2 overflow-x-auto pb-3 mb-3 -mx-1 px-1">
        {['校园生活', '学习成长', '职业发展', '社交娱乐'].map((t) => (
          <span
            key={t}
            className="shrink-0 px-3 py-1.5 rounded-full bg-surface border border-line/60 text-[13px] text-ink-2"
          >
            {t}
          </span>
        ))}
      </div>

      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-lg font-bold text-ink">为你推荐</h1>
        <Link to="/search" className="text-[13px] text-ink-3 hover:text-brand transition-colors">
          去搜索 →
        </Link>
      </div>

      {list.length === 0 && !loading ? (
        <EmptyState
          title="暂无内容"
          desc="成为第一个发帖的人，分享你的校园生活"
          action={
            <Link
              to="/compose"
              className="inline-flex h-9 px-4 items-center rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-strong transition-colors"
            >
              立即发帖
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {list.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}

      <LoadMore loading={loading} hasMore={hasMore} onLoadMore={loadMore} />
    </div>
  )
}
