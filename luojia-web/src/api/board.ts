import { request } from './request'
import type { Board, Category, HotTag, PageResult, Post, SortType, Tag } from './types'

export function getCategories() {
  return request<Category[]>({ url: '/api/v1/categories', auth: false })
}

export function getBoard(id: string) {
  return request<Board>({ url: `/api/v1/boards/${id}`, auth: false })
}

export function getBoardTags(id: string) {
  return request<Tag[]>({ url: `/api/v1/boards/${id}/tags`, auth: false })
}

export function getBoardHotTags(id: string, limit = 8) {
  return request<HotTag[]>({ url: `/api/v1/boards/${id}/hot-tags`, data: { limit }, auth: false })
}

export interface PostQuery {
  page: number
  page_size?: number
  sort?: SortType
  tag_id?: string
}

export function getBoardPosts(id: string, q: PostQuery) {
  return request<PageResult<Post>>({
    url: `/api/v1/boards/${id}/posts`,
    data: q,
    auth: false
  })
}
