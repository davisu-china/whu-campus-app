import { create } from 'zustand'
import {
  getMe,
  login as loginApi,
  loginByCode as loginByCodeApi,
  register as registerApi,
  ssoLogin as ssoLoginApi
} from '../api/auth'
import { setUnauthorizedHandler } from '../api/request'
import { getTokenStore } from '../api/tokenStore'
import type { User } from '../api/types'

interface AuthState {
  user: User | null
  isLoggedIn: boolean
  loggingIn: boolean
  login: (email: string, password: string) => Promise<void>
  loginByCode: (email: string, code: string) => Promise<void>
  ssoLogin: (username: string, password: string) => Promise<void>
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
      const store = getTokenStore()
      store.setAccess(r.access_token)
      store.setRefresh(r.refresh_token)
      set({ user: r.user, isLoggedIn: true })
    } finally {
      set({ loggingIn: false })
    }
  },

  async loginByCode(email, code) {
    set({ loggingIn: true })
    try {
      const r = await loginByCodeApi(email, code)
      const store = getTokenStore()
      store.setAccess(r.access_token)
      store.setRefresh(r.refresh_token)
      set({ user: r.user, isLoggedIn: true })
    } finally {
      set({ loggingIn: false })
    }
  },

  async ssoLogin(username, password) {
    set({ loggingIn: true })
    try {
      const r = await ssoLoginApi(username, password)
      const store = getTokenStore()
      store.setAccess(r.access_token)
      store.setRefresh(r.refresh_token)
      set({ user: r.user, isLoggedIn: true })
    } finally {
      set({ loggingIn: false })
    }
  },

  async register(email, code, password) {
    set({ loggingIn: true })
    try {
      const r = await registerApi(email, code, password)
      const store = getTokenStore()
      store.setAccess(r.access_token)
      store.setRefresh(r.refresh_token)
      set({ user: r.user, isLoggedIn: true })
    } finally {
      set({ loggingIn: false })
    }
  },

  // 应用启动时用 refresh token 静默恢复（getMe 遇 401 会走刷新拦截）
  async restore() {
    if (!getTokenStore().getRefresh()) return
    try {
      const me = await getMe()
      set({ user: me, isLoggedIn: true })
    } catch {
      getTokenStore().clear()
      set({ user: null, isLoggedIn: false })
    }
  },

  logout() {
    getTokenStore().clear()
    set({ user: null, isLoggedIn: false })
  },

  setUser(u) {
    set({ user: u, isLoggedIn: !!u })
  }
}))

// 请求层刷新失败时，触发登出
setUnauthorizedHandler(() => useAuthStore.getState().logout())
