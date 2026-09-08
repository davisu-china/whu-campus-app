import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getNotifications, markReadOne } from '../api/notification'
import type { NotificationItem } from '../api/types'
import { usePaginatedList } from '../hooks/usePaginatedList'
import { useNotificationStore } from '../store/notification'
import { LoadMore } from '../components/LoadMore'
import { EmptyState } from '../components/ui/EmptyState'
import { NOTIFICATION_TYPE_LABEL } from '../constants/enums'
import { formatTime } from '../utils/format'
import { cn } from '../utils/cn'

const TYPE_ICON: Record<string, string> = {
  reply: '💬',
  mention: '@',
  like: '👍',
  system: '📢'
}

export default function Notifications() {
  const unread = useNotificationStore((s) => s.unread)
  const setUnread = useNotificationStore((s) => s.setUnread)

  const { list, setList, loading, hasMore, refresh, loadMore } = usePaginatedList((page) =>
    getNotifications(page).then((r) => ({ list: r.list, hasMore: r.has_more }))
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  // 点击单条即标记已读，未读红点随之消失
  function handleRead(n: NotificationItem) {
    if (n.is_read) return
    setList((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)))
    setUnread(Math.max(0, unread - 1))
    markReadOne(n.id).catch(() => {})
  }

  return (
    <div>
      <h1 className="text-lg font-bold text-ink mb-4">通知</h1>

      {list.length === 0 && !loading ? (
        <EmptyState title="暂无通知" desc="有新的回复、点赞时会在这里提醒你" />
      ) : (
        <div className="bg-surface rounded-xl border border-line/60 divide-y divide-line/50 overflow-hidden">
          {list.map((n) => {
            const inner = (
              <>
                <span className="w-9 h-9 rounded-lg bg-black/[0.04] flex items-center justify-center text-lg shrink-0">
                  {TYPE_ICON[n.type] || '·'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink leading-snug">
                    <span className="font-medium">{NOTIFICATION_TYPE_LABEL[n.type] || n.type}</span>
                    {n.title && <span className="text-ink-2"> · {n.title}</span>}
                  </p>
                  {n.content && <p className="mt-1 text-[13px] text-ink-2 line-clamp-2">{n.content}</p>}
                  <p className="mt-1 text-[12px] text-ink-3">{formatTime(n.created_at)}</p>
                </div>
                {!n.is_read && <span className="w-2 h-2 rounded-full bg-hot shrink-0 mt-1.5" />}
              </>
            )

            // 有关联帖子（回复/@提及）的通知可点击跳转；system 等无帖子通知不可点。
            if (n.related_id) {
              return (
                <Link
                  key={n.id}
                  to={`/post/${n.related_id}`}
                  onClick={() => handleRead(n)}
                  className={cn(
                    'flex items-start gap-3 px-5 py-4 hover:bg-black/[0.03] transition-colors',
                    !n.is_read && 'bg-brand-soft/40'
                  )}
                >
                  {inner}
                </Link>
              )
            }
            return (
              <div
                key={n.id}
                onClick={() => handleRead(n)}
                className={cn('flex items-start gap-3 px-5 py-4', !n.is_read && 'bg-brand-soft/40')}
              >
                {inner}
              </div>
            )
          })}
        </div>
      )}

      <LoadMore loading={loading} hasMore={hasMore} onLoadMore={loadMore} />
    </div>
  )
}
