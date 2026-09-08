import { PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'
import { useAppStore } from './store/app'
import { useAuthStore } from './store/auth'
import './app.scss'

function App({ children }: PropsWithChildren<any>) {
  useLaunch(() => {
    // 初始化主题（跟随系统 / 手动覆盖）
    useAppStore.getState().initTheme()
    // 用持久化的 refresh token 静默恢复登录态
    useAuthStore.getState().restore()
  })

  return children
}

export default App
