import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getBoard, getBoardPosts, getBoardTags } from '../api/board'
import type { Board as BoardT, SortType, Tag } from '../api/types'
import { usePaginatedList } from '../hooks/usePaginatedList'
import { PostCard } from '../components/PostCard'
import { LoadMore } from '../components/LoadMore'
import { EmptyState } from '../components/ui/EmptyState'
import { cn } from '../utils/cn'
import { SORT_OPTIONS } from '../constants/enums'

export default function Board() {
  const { id = '' } = useParams()
  const [board, setBoard] = useState<BoardT | null>(null)
  const [tags, setTags] = useState<Tag[]>([])
  const [sort, setSort] = useState<SortType>('comprehensive')
  const [tagId, setTagId] = useState('')

  const { list, loading, hasMore, refresh, loadMore } = usePaginatedList((page) =>
    getBoardPosts(id, { page, page_size: 20, sort, tag_id: tagId || undefined }).then((r) => ({
      list: r.list,
      hasMore: r.has_more
    }))
  )

  useEffect(() => {
    getBoard(id)
      .then(setBoard)
      .catch(() => setBoard(null))
  }, [id])

  useEffect(() => {
    getBoardTags(id)
      .then(setTags)
      .catch(() => setTags([]))
  }, [id])

  useEffect(() => {
    refresh()
  }, [id, sort, tagId, refresh])

  return (
    <div>
      {/* 板块头 */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-ink">{board?.name || '板块'}</h1>
        {board?.description && <p className="mt-1 text-sm text-ink-3">{board.description}</p>}
      </div>

      {/* sort + tag */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-1 bg-surface rounded-lg p-1 border border-line/60">
          {SORT_OPTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={cn(
                'px-3 h-8 rounded-md text-[13px] font-medium transition-colors',
                sort === s.key ? 'bg-brand text-white' : 'text-ink-2 hover:text-ink'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        {tags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setTagId('')}
              className={cn(
                'px-3 h-8 rounded-full text-[13px] border transition-colors',
                tagId === ''
                  ? 'bg-brand text-white border-brand'
                  : 'bg-surface text-ink-2 border-line/60 hover:border-brand/40'
              )}
            >
              全部
            </button>
            {tags.map((t) => (
              <button
                key={t.id}
                onClick={() => setTagId(t.id)}
                className={cn(
                  'px-3 h-8 rounded-full text-[13px] border transition-colors',
                  tagId === t.id
                    ? 'bg-brand text-white border-brand'
                    : 'bg-surface text-ink-2 border-line/60 hover:border-brand/40'
                )}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {list.length === 0 && !loading ? (
        <EmptyState title="该板块暂无帖子" desc="换个标签或排序试试，或来发第一帖" />
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
