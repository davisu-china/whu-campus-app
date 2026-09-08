import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { searchPosts } from '../api/search'
import type { Post } from '../api/types'
import { PostCard } from '../components/PostCard'
import { BoardSelect } from '../components/BoardSelect'
import { Spinner } from '../components/ui/Spinner'
import { EmptyState } from '../components/ui/EmptyState'

function buildParams(q: string, boardId: string): Record<string, string> {
  const next: Record<string, string> = {}
  if (q.trim()) next.q = q.trim()
  if (boardId) next.board_id = boardId
  return next
}

export default function Search() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  const boardId = params.get('board_id') || ''
  const [kw, setKw] = useState(q)
  const [list, setList] = useState<Post[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    setKw(q)
    if (!q.trim()) {
      setList([])
      setSearched(false)
      return
    }
    setLoading(true)
    setSearched(true)
    searchPosts(q, { page: 1, board_id: boardId || undefined })
      .then((r) => setList(r.list))
      .catch(() => setList([]))
      .finally(() => setLoading(false))
  }, [q, boardId])

  function submit() {
    setParams(buildParams(kw, boardId))
  }

  function onBoardChange(id: string) {
    setParams(buildParams(q, id))
  }

  return (
    <div>
      <div className="flex gap-2 mb-5">
        <BoardSelect value={boardId} onChange={onBoardChange} />
        <input
          value={kw}
          onChange={(e) => setKw(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="搜索帖子…"
          className="flex-1 h-11 rounded-xl border border-line bg-surface px-4 text-sm text-ink placeholder:text-ink-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-all"
        />
        <button
          onClick={submit}
          className="h-11 px-6 rounded-xl bg-brand text-white text-sm font-medium hover:bg-brand-strong transition-colors"
        >
          搜索
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner className="text-brand" />
        </div>
      ) : !searched ? (
        <EmptyState title="搜索你想了解的内容" desc="支持帖子标题与内容关键词，可按板块过滤" />
      ) : list.length === 0 ? (
        <EmptyState title={`未找到与「${q}」相关的内容`} desc="换个关键词或板块试试" />
      ) : (
        <div className="space-y-3">
          <p className="text-[13px] text-ink-3">共 {list.length} 条结果</p>
          {list.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </div>
  )
}
