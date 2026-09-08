import { create } from 'zustand'
import { getMe, login as loginApi, register as registerApi } from '../api/auth'
import { setUnauthorizedHandler, tokenStore } from '../api/request'
import type { User } from '../api/types'

interface AuthState {
  user: User | null
  isLoggedIn: boolean
  loggingIn: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, code: string, password: string) => Promise<void>
  restore: () => Promise<void>
  logout: () => void
  setUser: (u: User | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoggedIn: false,
  loggingIn: false,

  async login(email, password) {
    set({ loggingIn: true })
    try {
      const r = await loginApi(email, password)
      tokenStore.setAccess(r.access_token)
      tokenStore.setRefresh(r.refresh_token)
      set({ user: r.user, isLoggedIn: true })
    } finally {
      set({ loggingIn: false })
    }
  },

  async register(email, code, password) {
    set({ loggingIn: true })
    try {
      const r = await registerApi(email, code, password)
      tokenStore.setAccess(r.access_token)
      tokenStore.setRefresh(r.refresh_token)
      set({ user: r.user, isLoggedIn: true })
    } finally {
      set({ loggingIn: false })
    }
  },

  // 应用启动时用 refresh token 静默恢复（getMe 遇 401 会走刷新拦截）
  async restore() {
    if (!tokenStore.getRefresh()) return
    try {
      const me = await getMe()
      set({ user: me, isLoggedIn: true })
    } catch {
      tokenStore.clear()
      set({ user: null, isLoggedIn: false })
    }
  },

  logout() {
    tokenStore.clear()
    set({ user: null, isLoggedIn: false })
  },

  setUser(u) {
    set({ user: u, isLoggedIn: !!u })
  }
}))

// 请求层刷新失败时，触发登出
setUnauthorizedHandler(() => useAuthStore.getState().logout())
