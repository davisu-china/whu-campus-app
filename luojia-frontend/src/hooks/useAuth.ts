import { useCallback } from 'react'
import Taro from '@tarojs/taro'
import { useAuthStore } from '../store/auth'

/**
 * 登录守卫：ensureLogin（需登录）、ensureVerified（需武大认证）
 * 返回 false 表示已拦截并跳转/提示，调用方应中止当前动作
 */
export function useAuth() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const user = useAuthStore((s) => s.user)

  const ensureLogin = useCallback((): boolean => {
    if (isLoggedIn) return true
    Taro.navigateTo({ url: '/pages/login/index' })
    return false
  }, [isLoggedIn])

  const ensureVerified = useCallback((): boolean => {
    if (isLoggedIn && user?.is_verified) return true
    if (!isLoggedIn) {
      Taro.navigateTo({ url: '/pages/login/index' })
    } else {
      Taro.showToast({ title: '发帖需武大邮箱认证', icon: 'none' })
    }
    return false
  }, [isLoggedIn, user])

  return { isLoggedIn, user, ensureLogin, ensureVerified }
}
