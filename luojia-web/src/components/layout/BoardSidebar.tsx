import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCategoryStore } from '../../store/category'
import { ANNOUNCEMENT_SLUG } from '../../constants/enums'
import { cn } from '../../utils/cn'
import { BoardIcon, CategoryIcon, HomeIcon } from './boardIcons'

export function BoardSidebar() {
  const { id: boardId } = useParams()
  const categories = useCategoryStore((s) => s.categories)
  const load = useCategoryStore((s) => s.load)
  const [open, setOpen] = useState<Set<string>>(new Set())

  // 站务公告已迁移至右侧栏，隐藏「站务」分类
  const visibleCategories = categories.filter((c) => !c.boards.some((b) => b.slug === ANNOUNCEMENT_SLUG))

  useEffect(() => {
    load()
  }, [load])

  // 进入某个板块页时，自动展开它所属的分类
  useEffect(() => {
    if (!boardId) return
    const cat = categories.find((c) => c.boards.some((b) => b.id === boardId))
    if (cat) setOpen((prev) => new Set(prev).add(cat.id))
  }, [boardId, categories])

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <aside className="sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
      <Link
        to="/"
        className={cn(
          'flex items-center gap-2 px-3 h-9 rounded-lg text-[14px] font-medium transition-colors mb-1',
          !boardId ? 'bg-brand-soft text-brand' : 'text-ink-2 hover:bg-black/[0.04]'
        )}
      >
        <HomeIcon className="w-[18px] h-[18px] shrink-0" />
        <span>首页</span>
      </Link>

      <div className="mt-1 flex flex-col gap-0.5">
        {visibleCategories.map((c) => {
          const isOpen = open.has(c.id)
          return (
            <div key={c.id}>
              <button
                onClick={() => toggle(c.id)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-lg text-[14px] font-medium transition-colors',
                  isOpen ? 'text-ink bg-black/[0.03]' : 'text-ink-2 hover:bg-black/[0.04] hover:text-ink'
                )}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <CategoryIcon name={c.name} className="w-[18px] h-[18px] shrink-0" />
                  <span className="truncate">{c.name}</span>
                </span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  className={cn('text-ink-3 transition-transform duration-200', isOpen && 'rotate-90')}
                >
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </button>

              {isOpen && (
                <div className="ml-2 pl-3 border-l border-line/60 flex flex-col gap-0.5 mt-0.5 mb-1">
                  {c.boards.map((b) => (
                    <Link
                      key={b.id}
                      to={`/board/${b.id}`}
                      className={cn(
                        'flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[13px] transition-colors',
                        boardId === b.id
                          ? 'bg-brand-soft text-brand font-medium'
                          : 'text-ink-2 hover:bg-black/[0.04] hover:text-ink'
                      )}
                    >
                      <BoardIcon slug={b.slug} className="w-4 h-4 shrink-0" />
                      <span className="truncate">{b.name}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </aside>
  )
}
