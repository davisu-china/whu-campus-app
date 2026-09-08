import { useEffect } from 'react'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { useAppStore } from './store/app'
import { useAuthStore } from './store/auth'
import { useNotificationStore } from './store/notification'
import { useMessageStore } from './store/message'
import AppLayout from './layouts/AppLayout'
import Home from './pages/Home'
import Campus from './pages/Campus'
import LibraryPlan from './pages/LibraryPlan'
import Board from './pages/Board'
import PostDetail from './pages/PostDetail'
import Compose from './pages/Compose'
import Search from './pages/Search'
import Notifications from './pages/Notifications'
import Messages from './pages/Messages'
import Profile from './pages/Profile'
import User from './pages/User'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  { path: '/forgot-password', element: <ForgotPassword /> },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'campus', element: <Campus /> },
      { path: 'campus/library-plan', element: <LibraryPlan /> },
      { path: 'board/:id', element: <Board /> },
      { path: 'post/:id', element: <PostDetail /> },
      { path: 'compose', element: <Compose /> },
      { path: 'search', element: <Search /> },
      { path: 'notifications', element: <Notifications /> },
      { path: 'messages', element: <Messages /> },
      { path: 'profile', element: <Profile /> },
      { path: 'user/:id', element: <User /> }
    ]
  }
])

export default function App() {
  const initTheme = useAppStore((s) => s.initTheme)
  const restore = useAuthStore((s) => s.restore)
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const fetchUnread = useNotificationStore((s) => s.fetchUnread)
  const fetchMsgUnread = useMessageStore((s) => s.fetchUnread)

  useEffect(() => {
    initTheme()
    restore()
  }, [initTheme, restore])

  // 登录态变化时刷新未读，并每 25s 轮询一次（通知 + 私信）
  useEffect(() => {
    if (!isLoggedIn) return
    fetchUnread()
    fetchMsgUnread()
    const timer = setInterval(() => {
      fetchUnread()
      fetchMsgUnread()
    }, 25000)
    return () => clearInterval(timer)
  }, [isLoggedIn, fetchUnread, fetchMsgUnread])

  return <RouterProvider router={router} />
}
