import { Link, useNavigate } from 'react-router-dom'
import type { Post } from '../api/types'
import { cn } from '../utils/cn'
import { formatCount, formatTime } from '../utils/format'
import { Avatar } from './ui/Avatar'
import { Tag } from './ui/Tag'

interface PostCardProps {
  post: Post
  className?: string
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

export function PostCard({ post, className }: PostCardProps) {
  const navigate = useNavigate()
  const summary = stripHtml(post.content || '')
  const author = post.author
  const name = post.is_anonymous ? '匿名用户' : author?.nickname || '匿名用户'
  const cover = post.images?.[0]?.url

  return (
    <article
      onClick={() => navigate(`/post/${post.id}`)}
      className={cn(
        'group bg-surface rounded-xl p-5 border border-line/60',
        'hover:shadow-card hover:-translate-y-px transition-all cursor-pointer',
        className
      )}
    >
      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          {/* meta */}
          <div className="flex items-center gap-2 text-[13px] text-ink-3">
            {!post.is_anonymous && author?.id ? (
              <Link
                to={`/user/${author.id}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-2 hover:opacity-75 transition-opacity"
              >
                <Avatar name={name} src={author?.avatar_url} size={20} />
                <span className="font-medium text-ink-2">{name}</span>
                {author?.is_verified && <span className="text-brand text-xs">✓</span>}
              </Link>
            ) : (
              <>
                <Avatar name={name} src={author?.avatar_url} size={20} />
                <span className="font-medium text-ink-3">{name}</span>
              </>
            )}
            <span className="text-ink-3/70">·</span>
            <span>{formatTime(post.created_at)}</span>
            {post.is_featured && (
              <span className="ml-1 text-[11px] px-1.5 py-px rounded bg-amber-50 text-amber-600 font-medium">
                精华
              </span>
            )}
            {post.is_pinned && (
              <span className="text-[11px] px-1.5 py-px rounded bg-brand-soft text-brand font-medium">置顶</span>
            )}
            {post.board_name && (
              <span className="ml-auto shrink-0 text-brand bg-brand-soft px-2 py-0.5 rounded-md">
                {post.board_name}
              </span>
            )}
          </div>

          {/* title */}
          <h3 className="mt-2.5 text-[17px] font-semibold text-ink leading-snug line-clamp-2 group-hover:text-brand transition-colors">
            {post.title}
          </h3>

          {/* summary */}
          {summary && <p className="mt-1.5 text-sm text-ink-2 leading-relaxed line-clamp-2">{summary}</p>}

          {/* tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {post.tags.slice(0, 3).map((t) => (
                <Tag key={t.id} color="ink">
                  {t.name}
                </Tag>
              ))}
            </div>
          )}

          {/* actions */}
          <div className="flex items-center gap-4 mt-3.5 text-[13px] text-ink-3">
            <span className="inline-flex items-center gap-1">
              <IconEye /> {formatCount(post.view_count)}
            </span>
            <span className="inline-flex items-center gap-1">
              <IconReply /> {formatCount(post.reply_count)}
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-1',
                post.liked && 'text-hot'
              )}
            >
              <IconLike /> {formatCount(post.like_count)}
            </span>
          </div>
        </div>

        {/* cover */}
        {cover && (
          <img
            src={cover}
            alt=""
            loading="lazy"
            className="hidden sm:block w-28 h-[76px] rounded-lg object-cover shrink-0 bg-black/[0.04]"
          />
        )}
      </div>
    </article>
  )
}

function IconEye() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function IconReply() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3v-9a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v2Z" />
    </svg>
  )
}

function IconLike() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 10v11M2 11v9a1 1 0 0 0 1 1h3V9H4a2 2 0 0 0-2 2ZM7 9l3.6-6.1a2 2 0 0 1 3.5 1.6L13 8h5.5a2.5 2.5 0 0 1 2.4 3.2l-1.6 6A3 3 0 0 1 16.4 20H7" />
    </svg>
  )
}
