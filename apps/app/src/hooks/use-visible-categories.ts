import { useMemo } from 'react'
import { useCategoryStore } from '@whu/shared'

// App 侧隐藏的分类（站务：官方公告/规则，不在板块列表与发帖选择器中展示）。
const HIDDEN_CATEGORY_NAMES = ['站务']

/**
 * 板块列表与发帖选择器可见的分类（过滤掉站务等运营分类）。
 * 注意：selector 只取原始引用，filter 在 useMemo 内做，避免 zustand 引用抖动。
 */
export function useVisibleCategories() {
  const all = useCategoryStore((s) => s.categories)
  return useMemo(() => all.filter((c) => !HIDDEN_CATEGORY_NAMES.includes(c.name)), [all])
}
