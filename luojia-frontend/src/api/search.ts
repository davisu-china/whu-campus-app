import { request } from './request'
import type { PageResult, Post } from './types'

export function searchPosts(q: string, opts: { board_id?: string; tag_id?: string; page?: number } = {}) {
  return request<PageResult<Post>>({
    url: '/api/v1/search',
    data: { q, ...opts },
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
