import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getUser, getUserPosts } from '../api/user'
import type { User as UserT } from '../api/types'
import { useAuthStore } from '../store/auth'
import { usePaginatedList } from '../hooks/usePaginatedList'
import { ProfileCard } from '../components/ProfileCard'
import { PostCard } from '../components/PostCard'
import { LoadMore } from '../components/LoadMore'
import { EmptyState } from '../components/ui/EmptyState'
import { Spinner } from '../components/ui/Spinner'
import { Button } from '../components/ui/Button'

export default function User() {
  const navigate = useNavigate()
  const { id = '' } = useParams()
  const me = useAuthStore((s) => s.user)
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const [user, setUser] = useState<UserT | null>(null)
  const [loadingUser, setLoadingUser] = useState(true)

  const { list, loading, hasMore, refresh, loadMore } = usePaginatedList((page) =>
    getUserPosts(id, page).then((r) => ({ list: r.list, hasMore: r.has_more }))
  )

  useEffect(() => {
    setLoadingUser(true)
    getUser(id)
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoadingUser(false))
  }, [id])

  useEffect(() => {
    refresh()
  }, [id, refresh])

  if (loadingUser) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="text-brand" />
      </div>
    )
  }

  if (!user) {
    return <EmptyState title="用户不存在" />
  }

  return (
    <div>
      <ProfileCard user={user} />

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-ink">TA 的帖子</h2>
        {isLoggedIn && me && me.id !== id && (
          <Button size="sm" onClick={() => navigate(`/messages?to=${id}`)}>
            私信
          </Button>
        )}
      </div>

      {list.length === 0 && !loading ? (
        <EmptyState title="TA 还没有发过帖子" />
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
