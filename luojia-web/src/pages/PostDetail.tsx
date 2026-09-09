import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  createReply,
  deletePost,
  getPost,
  getReplies,
  getSubReplies,
  report,
  toggleFavorite,
  toggleLikePost,
  toggleLikeReply
} from '../api/content'
import type { Post, Reply } from '../api/types'
import { useAuth } from '../hooks/useAuth'
import { usePaginatedList } from '../hooks/usePaginatedList'
import { Avatar } from '../components/ui/Avatar'
import { Button } from '../components/ui/Button'
import { Tag } from '../components/ui/Tag'
import { Spinner } from '../components/ui/Spinner'
import { LoadMore } from '../components/LoadMore'
import { formatCount, formatTime } from '../utils/format'
import { cn } from '../utils/cn'

export default function PostDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { isLoggedIn, user, ensureLogin } = useAuth()

  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [replyText, setReplyText] = useState('')
  const [replyTo, setReplyTo] = useState<Reply | null>(null)
  const [anonymous, setAnonymous] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [expandedFloors, setExpandedFloors] = useState<Set<string>>(new Set())
  const [subLoading, setSubLoading] = useState<Set<string>>(new Set())

  const {
    list: replies,
    loading: loadingReplies,
    refreshing: refreshingReplies,
    hasMore,
    refresh: refreshReplies,
    loadMore,
    setList: setReplies
  } = usePaginatedList((page) =>
    getReplies(id, page).then((r) => ({ list: r.list, hasMore: r.has_more }))
  )

  useEffect(() => {
    setLoading(true)
    setExpandedFloors(new Set())
    setSubLoading(new Set())
    getPost(id)
      .then(setPost)
      .catch(() => setPost(null))
      .finally(() => setLoading(false))
    refreshReplies()
  }, [id, refreshReplies])

  async function likePost() {
    if (!ensureLogin()) return
    const r = await toggleLikePost(id)
    setPost((p) => (p ? { ...p, liked: r.liked, like_count: Math.max(0, p.like_count + (r.liked ? 1 : -1)) } : p))
  }

  async function favPost() {
    if (!ensureLogin()) return
    const r = await toggleFavorite(id)
    setPost((p) => (p ? { ...p, favorited: r.favorited } : p))
  }

  function reportPost() {
    if (!ensureLogin()) return
    const reason = window.prompt('请填写举报原因：')
    if (!reason) return
    report('post', id, reason).then(() => alert('举报已提交，感谢反馈'))
  }

  async function handleDelete() {
    if (!window.confirm('确认删除这篇帖子？删除后不可恢复。')) return
    setDeleting(true)
    try {
      await deletePost(id)
      navigate('/')
    } catch {
      // request 层已 toast
    } finally {
      setDeleting(false)
    }
  }

  async function submitReply() {
    const text = replyText.trim()
    if (!text || submitting) return
    if (!ensureLogin()) return
    setSubmitting(true)
    try {
      await createReply(id, text, {
        parent_id: replyTo?.id,
        reply_to_id: replyTo?.id,
        is_anonymous: anonymous
      })
      setReplyText('')
      setReplyTo(null)
      setAnonymous(false)
      setExpandedFloors(new Set())
      setSubLoading(new Set())
      refreshReplies()
      if (!replyTo) {
        setPost((p) => (p ? { ...p, reply_count: p.reply_count + 1 } : p))
      }
    } finally {
      setSubmitting(false)
    }
  }

  // 展开/收起某楼层的楼中楼：首次展开时懒加载，之后驻留本地直接切换。
  async function toggleFloor(floor: Reply) {
    const fid = floor.id
    if (expandedFloors.has(fid)) {
      setExpandedFloors((prev) => {
        const next = new Set(prev)
        next.delete(fid)
        return next
      })
      return
    }
    if (floor.children && floor.children.length > 0) {
      setExpandedFloors((prev) => new Set(prev).add(fid))
      return
    }
    setSubLoading((prev) => new Set(prev).add(fid))
    try {
      const subs = await getSubReplies(id, floor.floor_no)
      setReplies((prev) => prev.map((f) => (f.id === fid ? { ...f, children: subs } : f)))
      setExpandedFloors((prev) => new Set(prev).add(fid))
    } catch {
      // request 层已 toast，保持收起
    } finally {
      setSubLoading((prev) => {
        const next = new Set(prev)
        next.delete(fid)
        return next
      })
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="text-brand" />
      </div>
    )
  }

  if (!post) {
    return (
      <div className="text-center py-24 text-ink-3">
        帖子不存在或已删除
        <div className="mt-4">
          <Button variant="secondary" onClick={() => navigate(-1)}>
            返回
          </Button>
        </div>
      </div>
    )
  }

  const authorName = post.is_anonymous ? '匿名用户' : post.author?.nickname || '匿名用户'
  const isMine = post.is_mine || (!!user && post.author_id === user.id)

  return (
    <div>
      {/* 帖子卡片 */}
      <article className="bg-surface rounded-xl border border-line/60 p-6">
        <div className="flex items-center gap-3 text-[13px] text-ink-3">
          {!post.is_anonymous && post.author?.id ? (
            <Link to={`/user/${post.author.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <Avatar name={authorName} src={post.author?.avatar_url} size={36} />
              <div>
                <p className="text-sm font-medium text-ink">
                  {authorName}
                  {post.author?.is_verified && <span className="ml-1 text-brand">✓</span>}
                </p>
                <p className="text-[12px] text-ink-3">{formatTime(post.created_at)}</p>
              </div>
            </Link>
          ) : (
            <>
              <Avatar name={authorName} src={post.author?.avatar_url} size={36} />
              <div>
                <p className="text-sm font-medium text-ink-3">{authorName}</p>
                <p className="text-[12px] text-ink-3">{formatTime(post.created_at)}</p>
              </div>
            </>
          )}
          {post.board_name && (
            <span className="ml-auto text-brand bg-brand-soft px-2.5 py-1 rounded-md text-[13px]">
              {post.board_name}
            </span>
          )}
        </div>

        <h1 className="mt-4 text-[22px] font-bold text-ink leading-snug">{post.title}</h1>

        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {post.tags.map((t) => (
              <Tag key={t.id} color="brand">
                {t.name}
              </Tag>
            ))}
          </div>
        )}

        {post.content && (
          <div className="mt-4 text-[15px] text-ink leading-relaxed whitespace-pre-wrap break-words">
            {post.content}
          </div>
        )}

        {post.images && post.images.length > 0 && (
          <div className={cn('mt-4 grid gap-2', post.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
            {post.images.map((img, i) => (
              <img
                key={i}
                src={img.url}
                alt=""
                loading="lazy"
                className="rounded-lg object-cover w-full max-h-[400px] bg-black/[0.04]"
              />
            ))}
          </div>
        )}

        {/* 互动栏 */}
        <div className="mt-5 pt-4 border-t border-line/60 flex items-center gap-2">
          <button
            onClick={likePost}
            className={cn(
              'inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm transition-colors',
              post.liked ? 'bg-rose-50 text-hot' : 'text-ink-2 hover:bg-black/[0.04]'
            )}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={post.liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
              <path d="M7 10v11M2 11v9a1 1 0 0 0 1 1h3V9H4a2 2 0 0 0-2 2ZM7 9l3.6-6.1a2 2 0 0 1 3.5 1.6L13 8h5.5a2.5 2.5 0 0 1 2.4 3.2l-1.6 6A3 3 0 0 1 16.4 20H7" />
            </svg>
            点赞 {formatCount(post.like_count)}
          </button>

          <button
            onClick={favPost}
            className={cn(
              'inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm transition-colors',
              post.favorited ? 'bg-amber-50 text-amber-600' : 'text-ink-2 hover:bg-black/[0.04]'
            )}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={post.favorited ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
              <path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16Z" />
            </svg>
            收藏
          </button>

          {isMine && (
            <>
              <button
                onClick={() => navigate(`/compose?edit=${post.id}`)}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm text-ink-2 hover:bg-black/[0.04] transition-colors"
              >
                编辑
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm text-hot hover:bg-rose-50 transition-colors disabled:opacity-50"
              >
                {deleting ? '删除中…' : '删除'}
              </button>
            </>
          )}

          <button onClick={reportPost} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm text-ink-2 hover:bg-black/[0.04] transition-colors">
            举报
          </button>

          <span className="ml-auto text-[13px] text-ink-3">{formatCount(post.view_count)} 浏览</span>
        </div>
      </article>

      {/* 回复区 */}
      <div className="mt-4 bg-surface rounded-xl border border-line/60 p-6">
        <h2 className="text-base font-semibold text-ink mb-2">全部回复（{post.reply_count}）</h2>

        {replies.length === 0 && !loadingReplies && !refreshingReplies ? (
          <p className="text-center text-ink-3 text-sm py-10">还没有回复，来抢沙发～</p>
        ) : (
          <>
            <div className="divide-y divide-line/50">
              {replies.map((r) => (
                <ReplyItem
                  key={r.id}
                  r={r}
                  top
                  subCount={r.sub_count ?? 0}
                  expanded={expandedFloors.has(r.id)}
                  subLoading={subLoading.has(r.id)}
                  onToggle={toggleFloor}
                  onReply={(target) => setReplyTo(target)}
                  onLike={(rid) => {
                    if (!ensureLogin()) return
                    toggleLikeReply(rid).then((res) => setReplies((prev) => mapReplyLike(prev, rid, res.liked)))
                  }}
                />
              ))}
            </div>
            <LoadMore loading={loadingReplies} hasMore={hasMore} onLoadMore={loadMore} />
          </>
        )}

        {/* 回复输入 */}
        <div className="mt-6">
          {replyTo && (
            <div className="flex items-center gap-2 mb-2 text-[13px]">
              <span className="text-ink-3">
                回复 <span className="text-brand font-medium">@{replyTo.author?.nickname || '匿名用户'}</span>：
              </span>
              <button onClick={() => setReplyTo(null)} className="text-ink-3 hover:text-ink">
                取消
              </button>
            </div>
          )}
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={isLoggedIn ? '友善发言，理性讨论…' : '登录后参与回复'}
            rows={3}
            className="w-full resize-none rounded-lg border border-line bg-bg p-3 text-sm text-ink placeholder:text-ink-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-all"
          />
          <div className="mt-2 flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-[13px] text-ink-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
                className="accent-brand"
              />
              匿名回复
            </label>
            <Button size="sm" onClick={submitReply} loading={submitting} className="ml-auto">
              发表回复
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ReplyItem({
  r,
  top,
  depth = 0,
  subCount = 0,
  expanded = false,
  subLoading = false,
  onToggle,
  onReply,
  onLike
}: {
  r: Reply
  top?: boolean
  depth?: number
  subCount?: number
  expanded?: boolean
  subLoading?: boolean
  onToggle?: (r: Reply) => void
  onReply: (r: Reply) => void
  onLike: (rid: string) => void
}) {
  const name = r.is_anonymous ? '匿名用户' : r.author?.nickname || '匿名用户'
  // 三层封顶：第三层（楼中楼的回复）不再开放回复入口
  const canReply = depth < 2
  const isFloor = depth === 0
  // 楼层下的楼中楼懒加载：默认收起，展开时按需拉取（children 已加载后驻留内存）
  const showChildren = !!r.children?.length && (!isFloor || expanded)
  return (
    <div className={cn('py-4', top && 'first:pt-0')}>
      <div className="flex gap-3">
        {!r.is_anonymous && r.author?.id ? (
          <Link to={`/user/${r.author.id}`} className="shrink-0">
            <Avatar name={name} src={r.author?.avatar_url} size={32} />
          </Link>
        ) : (
          <Avatar name={name} src={r.author?.avatar_url} size={32} />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[13px]">
            {!r.is_anonymous && r.author?.id ? (
              <Link to={`/user/${r.author.id}`} className="font-medium text-ink hover:text-brand transition-colors">
                {name}
              </Link>
            ) : (
              <span className="font-medium text-ink-3">{name}</span>
            )}
            {r.author?.is_verified && <span className="text-brand">✓</span>}
            <span className="text-ink-3 text-[12px]">#{r.floor_no} 楼 · {formatTime(r.created_at)}</span>
          </div>
          <p className="mt-1.5 text-sm text-ink leading-relaxed whitespace-pre-wrap break-words">{r.content}</p>
          <div className="mt-2 flex items-center gap-4 text-[12px] text-ink-3">
            <button
              onClick={() => onLike(r.id)}
              className={cn('hover:text-hot transition-colors', r.liked && 'text-hot')}
            >
              赞 {r.like_count}
            </button>
            {canReply && (
              <button onClick={() => onReply(r)} className="hover:text-ink transition-colors">
                回复
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 楼层下的楼中楼：懒加载，展开时按需拉取 */}
      {isFloor && subCount > 0 && (
        <button
          onClick={() => onToggle?.(r)}
          className="mt-2 ml-11 text-[12px] text-brand hover:text-brand/80 transition-colors"
        >
          {subLoading ? '加载中…' : expanded ? '收起' : `展开 ${subCount} 条回复`}
        </button>
      )}
      {showChildren && r.children && (
        <div className="ml-11 mt-3 pl-4 border-l-2 border-line/60 space-y-3">
          {r.children.map((c) => (
            <ReplyItem key={c.id} r={c} depth={depth + 1} onReply={onReply} onLike={onLike} />
          ))}
        </div>
      )}
    </div>
  )
}

// 递归更新某条回复的点赞状态（点赞后本地就地更新，避免整页刷新跳回第一页）。
function mapReplyLike(list: Reply[], rid: string, liked: boolean): Reply[] {
  return list.map((r) => ({
    ...r,
    liked: r.id === rid ? liked : r.liked,
    like_count: r.id === rid ? Math.max(0, r.like_count + (liked ? 1 : -1)) : r.like_count,
    children: r.children ? mapReplyLike(r.children, rid, liked) : r.children
  }))
}
