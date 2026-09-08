import { create } from 'zustand'
import Taro from '@tarojs/taro'

export type Theme = 'system' | 'light' | 'dark'

interface AppState {
  theme: Theme
  initTheme: () => void
  setTheme: (t: Theme) => void
  applyThemeClass: () => void
}

const THEME_KEY = 'luo_theme'

export const useAppStore = create<AppState>((set, get) => ({
  theme: 'system',

  initTheme() {
    const saved = (Taro.getStorageSync(THEME_KEY) as Theme) || 'system'
    set({ theme: saved })
    get().applyThemeClass()
  },

  setTheme(t) {
    Taro.setStorageSync(THEME_KEY, t)
    set({ theme: t })
    get().applyThemeClass()
  },

  // H5 用 html[data-theme] 手动覆盖；小程序依赖 theme.json 跟随系统
  applyThemeClass() {
    if (process.env.TARO_ENV !== 'h5') return
    const t = get().theme
    const el = document.documentElement
    if (t === 'dark') el.setAttribute('data-theme', 'dark')
    else if (t === 'light') el.setAttribute('data-theme', 'light')
    else el.removeAttribute('data-theme')
  }
}))
