import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { setTokenStore, setApiBase, useAuthStore } from '@whu/shared'
import { secureStoreTokenStore } from '@/lib/tokenStore'
import { API_BASE } from '@/lib/config'
import { ToastHost } from '@/components/toast-host'

// 注入环境依赖（必须在任何请求前，模块加载时执行一次）
setTokenStore(secureStoreTokenStore)
setApiBase(API_BASE)

export default function RootLayout() {
  useEffect(() => {
    // 静默恢复登录态（有 refresh token 则拉取用户信息）
    useAuthStore.getState().restore()
  }, [])

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <ToastHost />
    </>
  )
}
