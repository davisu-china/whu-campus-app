import { create } from 'zustand'
import { getCategories } from '../api/board'
import type { Category } from '../api/types'

interface CategoryState {
  categories: Category[]
  loaded: boolean
  load: () => Promise<void>
}

// 分类/板块缓存（Header 与左侧栏共享，避免重复请求）
export const useCategoryStore = create<CategoryState>((set, get) => ({
  categories: [],
  loaded: false,

  async load() {
    if (get().loaded) return
    try {
      const categories = await getCategories()
      set({ categories, loaded: true })
    } catch {
      // 静默：后端不可用时保持空态
    }
  }
}))
