import { request } from './request'
import type { PageResult, Post, Reply, User } from './types'

export function getUser(id: string) {
  return request<User>({ url: `/api/v1/users/${id}`, auth: false })
}

export function getMyPosts(page: number) {
  return request<PageResult<Post>>({ url: '/api/v1/users/me/posts', data: { page } })
}

export function getUserPosts(id: string, page: number) {
  return request<PageResult<Post>>({ url: `/api/v1/users/${id}/posts`, data: { page } })
}

export function getMyFavorites(page: number) {
  return request<PageResult<Post>>({ url: '/api/v1/users/me/favorites', data: { page } })
}

export function getMyReplies(page: number) {
  return request<PageResult<Reply>>({ url: '/api/v1/users/me/replies', data: { page } })
}
