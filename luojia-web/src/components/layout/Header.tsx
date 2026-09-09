import { FormEvent, useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { useNotificationStore } from '../../store/notification'
import { useMessageStore } from '../../store/message'
import { cn } from '../../utils/cn'
import { Avatar } from '../ui/Avatar'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { BoardSelect } from '../BoardSelect'

const navCls = ({ isActive }: { isActive: boolean }) =>
  cn(
    'px-3 h-9 inline-flex items-center rounded-lg text-[15px] transition-colors',
    isActive ? 'text-brand font-medium bg-brand-soft' : 'text-ink-2 hover:text-ink hover:bg-black/[0.04]'
  )

export function Header() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const logout = useAuthStore((s) => s.logout)
  const unread = useNotificationStore((s) => s.unread)
  const msgUnread = useMessageStore((s) => s.unread)
  const totalUnread = unread + msgUnread

  const [q, setQ] = useState('')
  const [searchBoard, setSearchBoard] = useState('')
  const [userOpen, setUserOpen] = useState(false)
  const userRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭下拉
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const kw = q.trim()
    const sp = new URLSearchParams()
    if (kw) sp.set('q', kw)
    if (searchBoard) sp.set('board_id', searchBoard)
    const qs = sp.toString()
    navigate(qs ? `/search?${qs}` : '/search')
  }

  return (
    <header className="sticky top-0 z-40 bg-surface border-b border-line">
      <div className="max-w-7xl mx-auto h-16 flex items-center gap-3 px-4 lg:px-6">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0 mr-1">
          <img src="/whu-logo.png?v=3" alt="武汉大学校徽" className="w-9 h-9 object-contain" />
          <span className="text-[17px] font-bold text-ink font-serif tracking-wide">在武大</span>
        </Link>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-1">
          <NavLink to="/" end className={navCls}>
            首页
          </NavLink>

          <NavLink to="/campus" className={navCls}>
            校园服务
          </NavLink>
        </nav>

        {/* Search */}
        <form onSubmit={onSubmit} className="flex-1 max-w-md mx-auto">
          <div className="flex items-center h-9 rounded-lg bg-black/[0.04] focus-within:bg-surface focus-within:ring-2 focus-within:ring-brand/20 transition-all">
            <BoardSelect compact value={searchBoard} onChange={setSearchBoard} />
            <span className="w-px h-4 bg-line/70" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索帖子…"
              className="flex-1 h-full px-3 bg-transparent text-sm text-ink placeholder:text-ink-3 outline-none"
            />
          </div>
        </form>

        {/* Right */}
        <div className="ml-auto flex items-center gap-2.5 shrink-0">
          <Button size="sm" onClick={() => navigate('/compose')} className="hidden sm:inline-flex">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            发帖
          </Button>

          {isLoggedIn && user ? (
            <div ref={userRef} className="relative">
              <button onClick={() => setUserOpen((v) => !v)} className="relative rounded-full ring-2 ring-transparent hover:ring-brand/30 transition">
                <Avatar name={user.nickname} src={user.avatar_url} size={34} />
                {totalUnread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5">
                    <Badge count={totalUnread} className="ring-2 ring-surface" />
                  </span>
                )}
              </button>

              {userOpen && (
                <div className="absolute right-0 top-12 w-48 bg-surface rounded-xl border border-line shadow-pop py-1.5">
                  <div className="px-4 py-2.5 border-b border-line/60">
                    <p className="text-sm font-medium text-ink truncate">{user.nickname}</p>
                    <p className="text-[12px] text-ink-3 truncate">{user.college || (user.is_verified ? '已认证' : '未认证')}</p>
                  </div>
                  <MenuItem to="/notifications" onClick={() => setUserOpen(false)} badge={unread}>
                    通知
                  </MenuItem>
                  <MenuItem to="/messages" onClick={() => setUserOpen(false)} badge={msgUnread}>
                    私信
                  </MenuItem>
                  <MenuItem to="/profile" onClick={() => setUserOpen(false)}>
                    我的主页
                  </MenuItem>
                  <MenuItem to="/profile?tab=favorites" onClick={() => setUserOpen(false)}>
                    我的收藏
                  </MenuItem>
                  <button
                    onClick={() => {
                      setUserOpen(false)
                      logout()
                      navigate('/')
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-ink-2 hover:bg-black/[0.04] transition-colors"
                  >
                    退出登录
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => navigate('/login')}>
              登录
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}

function MenuItem({ to, children, onClick, badge }: { to: string; children: React.ReactNode; onClick: () => void; badge?: number }) {
  return (
    <Link to={to} onClick={onClick} className="flex items-center justify-between px-4 py-2 text-sm text-ink-2 hover:bg-black/[0.04] transition-colors">
      <span>{children}</span>
      {badge != null && badge > 0 && <Badge count={badge} />}
    </Link>
  )
}
