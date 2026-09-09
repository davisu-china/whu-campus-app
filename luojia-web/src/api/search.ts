import { request } from './request'
import type { PageResult, Post } from './types'

export interface SearchOpts {
  board_id?: string
  tag_id?: string
  time_range?: string // day / 3d / week / month / year
  sort?: string // comprehensive / latest / hot / featured
  has_image?: boolean
  page?: number
}

export function searchPosts(q: string, opts: SearchOpts = {}) {
  return request<PageResult<Post>>({
    url: '/api/v1/search',
    data: { q, ...opts },
    auth: false
  })
}

// 搜索热词榜（服务端统计，两平台共用）
export function getHotSearches(limit = 10) {
  return request<string[]>({
    url: '/api/v1/search/hot',
    data: { limit },
    auth: false
  })
}

export interface DictItem {
  id: string
  name: string
}

export function searchDict(type: 'college' | 'course' | 'teacher' | 'contest', q: string) {
  return request<DictItem[]>({
    url: '/api/v1/dict/search',
    data: { type, q },
    auth: false
  })
}
