import { request } from './request'
import type { PageResult, Post, PostField, Reply } from './types'

export interface CreatePostInput {
  board_id: string
  title: string
  content: string
  tag_ids?: string[]
  is_anonymous?: boolean
  fields?: PostField[]
  object_keys?: string[]
}

export function getHomeFeed(page: number, pageSize = 20) {
  return request<PageResult<Post>>({
    url: '/api/v1/home/feed',
    data: { page, page_size: pageSize },
    auth: false
  })
}

export function getHomeHot() {
  return request<Post[]>({ url: '/api/v1/home/hot', auth: false })
}

export function getPost(id: string) {
  return request<Post>({ url: `/api/v1/posts/${id}`, auth: false })
}

export function createPost(input: CreatePostInput) {
  return request<Post>({ url: '/api/v1/posts', method: 'POST', data: input })
}

export interface UpdatePostInput {
  title: string
  content: string
  tag_ids?: string[]
  is_anonymous?: boolean
  fields?: PostField[]
  object_keys?: string[]
}

export function updatePost(id: string, input: UpdatePostInput) {
  return request<Post>({ url: `/api/v1/posts/${id}`, method: 'PUT', data: input })
}

export function deletePost(id: string) {
  return request<{ ok: boolean }>({ url: `/api/v1/posts/${id}`, method: 'DELETE' })
}

export function getReplies(postId: string) {
  return request<Reply[]>({ url: `/api/v1/posts/${postId}/replies`, auth: false })
}

export function createReply(
  postId: string,
  content: string,
  opts: { parent_id?: string; reply_to_id?: string; is_anonymous?: boolean } = {}
) {
  return request<Reply>({
    url: `/api/v1/posts/${postId}/replies`,
    method: 'POST',
    data: { content, ...opts }
  })
}

export function toggleFavorite(postId: string) {
  return request<{ favorited: boolean }>({
    url: `/api/v1/posts/${postId}/favorite`,
    method: 'POST'
  })
}

export function toggleLikePost(postId: string) {
  return request<{ liked: boolean }>({
    url: `/api/v1/posts/${postId}/like`,
    method: 'POST'
  })
}

export function toggleLikeReply(replyId: string) {
  return request<{ liked: boolean }>({
    url: `/api/v1/replies/${replyId}/like`,
    method: 'POST'
  })
}

export function report(targetType: 'post' | 'reply', targetId: string, reason: string) {
  return request<{ ok: boolean }>({
    url: '/api/v1/reports',
    method: 'POST',
    data: { target_type: targetType, target_id: targetId, reason }
  })
}
