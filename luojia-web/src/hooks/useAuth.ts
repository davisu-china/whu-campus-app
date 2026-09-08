import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { toast } from '../store/toast'

/**
 * 登录守卫：ensureLogin（需登录）、ensureVerified（需武大认证）
 * 返回 false 表示已拦截并跳转/提示，调用方应中止当前动作
 */
export function useAuth() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  const ensureLogin = useCallback((): boolean => {
    if (isLoggedIn) return true
    navigate('/login')
    return false
  }, [isLoggedIn, navigate])

  const ensureVerified = useCallback((): boolean => {
    if (isLoggedIn && user?.is_verified) return true
    if (!isLoggedIn) {
      navigate('/login')
    } else {
      toast('发帖需武大邮箱认证')
    }
    return false
  }, [isLoggedIn, user, navigate])

  return { isLoggedIn, user, ensureLogin, ensureVerified }
}
