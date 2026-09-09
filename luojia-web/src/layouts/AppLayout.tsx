import { Outlet, useLocation } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { BoardSidebar } from '../components/layout/BoardSidebar'
import { RightSidebar } from '../components/layout/RightSidebar'
import { Toast } from '../components/layout/Toast'

// 仅在首页 / 板块帖子列表 / 帖子详情 展示左右两侧栏
function shouldShowSidebars(pathname: string): boolean {
  if (pathname === '/') return true
  return pathname.startsWith('/board/') || pathname.startsWith('/post/')
}

export default function AppLayout() {
  const { pathname } = useLocation()
  const showSidebars = shouldShowSidebars(pathname)

  return (
    <div className="min-h-screen bg-bg text-ink">
      <Header />
      <div className="max-w-7xl mx-auto flex gap-6 px-4 lg:px-6 py-6">
        {showSidebars && (
          <div className="hidden lg:block w-48 shrink-0">
            <BoardSidebar />
          </div>
        )}
        <main className="flex-1 min-w-0">
          <div className={showSidebars ? undefined : 'max-w-3xl mx-auto'}>
            <Outlet />
          </div>
        </main>
        {showSidebars && (
          <div className="hidden xl:block w-[300px] shrink-0">
            <RightSidebar />
          </div>
        )}
      </div>
      <Toast />
    </div>
  )
}
