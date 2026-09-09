import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { searchPosts } from '../api/search'
import type { Post } from '../api/types'
import { usePaginatedList } from '../hooks/usePaginatedList'
import { useSearchHistory } from '../hooks/useSearchHistory'
import { PostCard } from '../components/PostCard'
import { BoardSelect } from '../components/BoardSelect'
import { PillSelect } from '../components/ui/PillSelect'
import { LoadMore } from '../components/LoadMore'
import { Spinner } from '../components/ui/Spinner'
import { EmptyState } from '../components/ui/EmptyState'
import { SORT_OPTIONS, TIME_RANGE_OPTIONS } from '../constants/enums'
import { cn } from '../utils/cn'

interface SearchState {
  q: string
  boardId: string
  timeRange: string
  sort: string
  hasImage: boolean
}

// 只把非默认值写进 URL，保持链接干净可分享
function buildParams(s: SearchState): Record<string, string> {
  const next: Record<string, string> = {}
  if (s.q.trim()) next.q = s.q.trim()
  if (s.boardId) next.board_id = s.boardId
  if (s.timeRange) next.time_range = s.timeRange
  if (s.sort) next.sort = s.sort
  if (s.hasImage) next.has_image = '1'
  return next
}

export default function Search() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  const boardId = params.get('board_id') || ''
  const timeRange = params.get('time_range') || ''
  const sort = params.get('sort') || ''
  const hasImage = params.get('has_image') === '1'
  const keyword = q.trim()

  const [kw, setKw] = useState(q)
  const [total, setTotal] = useState(0)
  const { history, add, clear } = useSearchHistory()

  // 关键词 / 板块 / 时间 / 带图 任一存在即算一次检索（全站按时间或带图浏览同样合法）
  const hasQuery = !!keyword || !!boardId || !!timeRange || hasImage

  const { list, loading, refreshing, hasMore, refresh, loadMore } = usePaginatedList<Post>((page) => {
    if (!hasQuery) {
      setTotal(0)
      return Promise.resolve({ list: [], hasMore: false })
    }
    return searchPosts(q, {
      page,
      board_id: boardId || undefined,
      time_range: timeRange || undefined,
      sort: sort || undefined,
      has_image: hasImage || undefined
    }).then((r) => {
      setTotal(r.total ?? r.list.length)
      return { list: r.list, hasMore: r.has_more }
    })
  })

  // 关键词/板块/筛选变化时重置到第一页重新搜索；带关键词的检索记入本地历史
  // （覆盖输入框提交、点热词/历史 chip、顶栏搜索跳转、直接打开分享链接）
  useEffect(() => {
    setKw(q)
    if (keyword) add(keyword)
    refresh()
  }, [q, boardId, timeRange, sort, hasImage, keyword, add, refresh])

  function apply(patch: Partial<SearchState>) {
    setParams(buildParams({ q, boardId, timeRange, sort, hasImage, ...patch }))
  }

  function runSearch(term: string) {
    apply({ q: term })
  }

  const chipCls =
    'inline-flex items-center h-8 rounded-full border border-line bg-surface px-3.5 text-[13px] text-ink-2 hover:border-brand/40 hover:text-brand-strong transition-colors'

  return (
    <div>
      {/* 搜索主控：输入框独占一行，视觉权重最高 */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch(kw)}
            placeholder="搜索帖子…"
            className="w-full h-11 rounded-xl border border-line bg-surface pl-10 pr-4 text-sm text-ink placeholder:text-ink-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-all"
          />
        </div>
        <button
          onClick={() => runSearch(kw)}
          className="h-11 px-6 rounded-xl bg-brand text-white text-sm font-medium hover:bg-brand-strong transition-colors shrink-0"
        >
          搜索
        </button>
      </div>

      {/* 轻量筛选条：板块/时间/排序降为次级，结果计数随筛选实时更新 */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <BoardSelect pill value={boardId} onChange={(id) => apply({ boardId: id })} />
        <PillSelect
          value={timeRange}
          options={TIME_RANGE_OPTIONS}
          onChange={(v) => apply({ timeRange: v })}
          title="按发布时间筛选"
        />
        <PillSelect
          value={sort}
          options={SORT_OPTIONS}
          fallbackLabel="综合"
          onChange={(v) => apply({ sort: v })}
          title="排序方式（选「精华」仅看精华帖）"
        />
        <button
          type="button"
          onClick={() => apply({ hasImage: !hasImage })}
          title="只看带图的帖子"
          className={cn(
            'inline-flex items-center gap-1 h-8 rounded-full border px-3 text-[13px] transition-colors shrink-0',
            hasImage
              ? 'border-brand/30 bg-brand-soft text-brand-strong'
              : 'border-line bg-surface text-ink-2 hover:border-brand/40'
          )}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="8.5" cy="9.5" r="1.5" />
            <path d="m21 15-5-5L5 20" />
          </svg>
          带图
        </button>
        {hasQuery && !refreshing && <span className="text-[13px] text-ink-3">共 {total} 条结果</span>}
      </div>

      {!hasQuery ? (
        history.length === 0 ? (
          <EmptyState title="搜索你想了解的内容" desc="支持帖子标题与内容关键词，可按板块、时间过滤" />
        ) : (
          <section>
            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="text-[13px] font-medium text-ink-2">搜索历史</h2>
              <button
                type="button"
                onClick={clear}
                className="text-[12px] text-ink-3 transition-colors hover:text-brand"
              >
                清空
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {history.map((term) => (
                <button key={term} type="button" className={chipCls} onClick={() => runSearch(term)}>
                  {term}
                </button>
              ))}
            </div>
          </section>
        )
      ) : refreshing ? (
        <div className="flex justify-center py-20">
          <Spinner className="text-brand" />
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          title={keyword ? `未找到与「${q}」相关的内容` : '没有符合筛选条件的内容'}
          desc="试试换个关键词、板块，或放宽时间范围"
        />
      ) : (
        <>
          <div className="space-y-3">
            {list.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
          <LoadMore loading={loading} hasMore={hasMore} onLoadMore={loadMore} />
        </>
      )}
    </div>
  )
}
