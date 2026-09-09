import { useCallback } from 'react'
import { useRouter } from 'expo-router'
import { toast, useAuthStore } from '@whu/shared'

/**
 * 登录守卫：ensureLogin（需登录）、ensureVerified（需武大认证）。
 * 返回 false 表示已拦截并跳转/提示，调用方应中止当前动作。
 */
export function useAuth() {
  const router = useRouter()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const user = useAuthStore((s) => s.user)

  const ensureLogin = useCallback((): boolean => {
    if (isLoggedIn) return true
    router.push('/login')
    return false
  }, [isLoggedIn, router])

  const ensureVerified = useCallback((): boolean => {
    if (isLoggedIn && user?.is_verified) return true
    if (!isLoggedIn) {
      router.push('/login')
    } else {
      toast('发帖需武大邮箱认证')
    }
    return false
  }, [isLoggedIn, user, router])

  return { isLoggedIn, user, ensureLogin, ensureVerified }
}
