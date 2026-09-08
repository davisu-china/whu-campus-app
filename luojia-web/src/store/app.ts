import { create } from 'zustand'

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
    const saved = (localStorage.getItem(THEME_KEY) as Theme) || 'system'
    set({ theme: saved })
    get().applyThemeClass()
  },

  setTheme(t) {
    localStorage.setItem(THEME_KEY, t)
    set({ theme: t })
    get().applyThemeClass()
  },

  // Web 端用 <html class="dark"> 覆盖暗色；system 跟随 prefers-color-scheme
  applyThemeClass() {
    const t = get().theme
    const el = document.documentElement
    const dark =
      t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    el.classList.toggle('dark', dark)
  }
}))
