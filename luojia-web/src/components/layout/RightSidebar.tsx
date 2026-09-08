import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getBoardPosts } from '../../api/board'
import { getHomeHot } from '../../api/content'
import type { Post } from '../../api/types'
import { useCategoryStore } from '../../store/category'
import { ANNOUNCEMENT_SLUG } from '../../constants/enums'
import { formatCount, formatTime } from '../../utils/format'

const ANNOUNCEMENT_COUNT = 3

export function RightSidebar() {
  const [hot, setHot] = useState<Post[]>([])
  const [announcements, setAnnouncements] = useState<Post[]>([])
  const categories = useCategoryStore((s) => s.categories)
  const loadCategories = useCategoryStore((s) => s.load)

  // 站务公告板块（按 slug 定位）
  const announcementBoard = categories.flatMap((c) => c.boards).find((b) => b.slug === ANNOUNCEMENT_SLUG)

  useEffect(() => {
    getHomeHot()
      .then(setHot)
      .catch(() => setHot([]))
    loadCategories()
  }, [loadCategories])

  useEffect(() => {
    if (!announcementBoard) return
    getBoardPosts(announcementBoard.id, { page: 1, page_size: ANNOUNCEMENT_COUNT, sort: 'latest' })
      .then((res) => setAnnouncements(res.list))
      .catch(() => setAnnouncements([]))
  }, [announcementBoard?.id])

  return (
    <aside className="sticky top-20 self-start space-y-4 max-h-[calc(100vh-6rem)] overflow-y-auto">
      {/* 热榜 */}
      <section className="bg-surface rounded-xl border border-line/60 p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-hot text-sm">🔥</span>
          <h3 className="text-sm font-semibold text-ink">热门话题</h3>
        </div>
        {hot.length === 0 ? (
          <p className="text-[13px] text-ink-3 py-4 text-center">暂无热榜</p>
        ) : (
          <ol className="space-y-1">
            {hot.map((p, i) => (
              <li key={p.id}>
                <Link
                  to={`/post/${p.id}`}
                  className="flex items-start gap-2.5 px-2 py-2 -mx-2 rounded-lg hover:bg-black/[0.03] transition-colors"
                >
                  <span
                    className={cnRank(i)}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-ink leading-snug line-clamp-2">{p.title}</p>
                    <p className="text-[12px] text-ink-3 mt-1">{formatCount(p.view_count)} 浏览</p>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* 站务公告（仅展示 3 条有效公告，可跳转查看全部） */}
      <section className="bg-surface rounded-xl border border-line/60 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-ink">📢 站务公告</h3>
          {announcementBoard && (
            <Link
              to={`/board/${announcementBoard.id}`}
              className="text-[12px] font-medium text-brand hover:text-brand-strong transition-colors"
            >
              查看全部 →
            </Link>
          )}
        </div>
        {announcements.length === 0 ? (
          <p className="text-[13px] text-ink-3 py-4 text-center">暂无公告</p>
        ) : (
          <ul className="space-y-1">
            {announcements.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/post/${p.id}`}
                  className="block px-2 py-1.5 -mx-2 rounded-lg hover:bg-black/[0.03] transition-colors"
                >
                  <p className="text-[13px] text-ink leading-snug line-clamp-2">{p.title}</p>
                  <p className="text-[12px] text-ink-3 mt-0.5">{formatTime(p.created_at)}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  )
}

function cnRank(i: number): string {
  if (i === 0) return 'w-5 h-5 shrink-0 rounded bg-hot/10 text-hot text-[12px] font-bold flex items-center justify-center'
  if (i === 1) return 'w-5 h-5 shrink-0 rounded bg-orange-50 text-orange-500 text-[12px] font-bold flex items-center justify-center'
  if (i === 2) return 'w-5 h-5 shrink-0 rounded bg-amber-50 text-amber-500 text-[12px] font-bold flex items-center justify-center'
  return 'w-5 h-5 shrink-0 rounded bg-black/[0.04] text-ink-3 text-[12px] font-medium flex items-center justify-center'
}
