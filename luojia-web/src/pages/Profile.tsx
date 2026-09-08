import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getMyFavorites, getMyPosts, getMyReplies } from '../api/user'
import { useAuthStore } from '../store/auth'
import { usePaginatedList } from '../hooks/usePaginatedList'
import { ProfileCard } from '../components/ProfileCard'
import { EditProfileModal } from '../components/EditProfileModal'
import { PostCard } from '../components/PostCard'
import { LoadMore } from '../components/LoadMore'
import { EmptyState } from '../components/ui/EmptyState'
import { Avatar } from '../components/ui/Avatar'
import { Button } from '../components/ui/Button'
import { formatTime } from '../utils/format'
import { cn } from '../utils/cn'

const TABS = [
  { key: 'posts', label: '我的帖子' },
  { key: 'favorites', label: '我的收藏' },
  { key: 'replies', label: '我的回复' }
]

export default function Profile() {
  const user = useAuthStore((s) => s.user)
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState(false)
  const tab = params.get('tab') || 'posts'

  if (!isLoggedIn || !user) {
    return (
      <EmptyState
        title="请先登录"
        action={
          <Link to="/login">
            <Button>去登录</Button>
          </Link>
        }
      />
    )
  }

  return (
    <div>
      <ProfileCard user={user} onEdit={() => setEditing(true)} />

      {editing && <EditProfileModal user={user} onClose={() => setEditing(false)} />}

      <div className="flex gap-1 bg-surface rounded-lg p-1 border border-line/60 mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setParams(t.key === 'posts' ? {} : { tab: t.key })}
            className={cn(
              'px-4 h-9 rounded-md text-sm font-medium transition-colors',
              tab === t.key ? 'bg-brand text-white' : 'text-ink-2 hover:text-ink'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'posts' && <MyPosts key="posts" />}
      {tab === 'favorites' && <MyFavorites key="fav" />}
      {tab === 'replies' && <MyReplies key="rep" />}
    </div>
  )
}

function MyPosts() {
  const { list, loading, hasMore, refresh, loadMore } = usePaginatedList((page) =>
    getMyPosts(page).then((r) => ({ list: r.list, hasMore: r.has_more }))
  )
  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <div>
      {list.length === 0 && !loading ? (
        <EmptyState title="还没有发过帖子" />
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

function MyFavorites() {
  const { list, loading, hasMore, refresh, loadMore } = usePaginatedList((page) =>
    getMyFavorites(page).then((r) => ({ list: r.list, hasMore: r.has_more }))
  )
  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <div>
      {list.length === 0 && !loading ? (
        <EmptyState title="还没有收藏" desc="看到好内容记得收藏" />
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

function MyReplies() {
  const { list, loading, hasMore, refresh, loadMore } = usePaginatedList((page) =>
    getMyReplies(page).then((r) => ({ list: r.list, hasMore: r.has_more }))
  )
  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <div>
      {list.length === 0 && !loading ? (
        <EmptyState title="还没有回复" />
      ) : (
        <div className="bg-surface rounded-xl border border-line/60 divide-y divide-line/50 overflow-hidden">
          {list.map((r) => (
            <div key={r.id} className="flex items-start gap-3 px-5 py-4">
              <Avatar name={r.author?.nickname || '?'} src={r.author?.avatar_url} size={32} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap break-words">{r.content}</p>
                <p className="mt-1.5 text-[12px] text-ink-3">
                  {formatTime(r.created_at)}
                  {r.post_id && (
                    <Link to={`/post/${r.post_id}`} className="ml-2 text-brand hover:underline">
                      查看原帖 →
                    </Link>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
      <LoadMore loading={loading} hasMore={hasMore} onLoadMore={loadMore} />
    </div>
  )
}
