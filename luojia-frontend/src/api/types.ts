// ============================================================
// API DTO 类型 —— 对齐后端响应
//
// 字段命名约定：JSON 统一 snake_case（与后端 Go `json` tag 及 DB 字段一致，
// 如 board_id / is_anonymous / page_size）。前端 DTO 直接采用 snake_case，
// 避免额外转换层。⚠️ 需与后端确认 json tag 命名一致（对齐项）。
// ============================================================

export interface ApiResp<T = any> {
  code: number
  message: string
  data: T
}

export interface User {
  id: string
  nickname: string
  avatar_url: string
  is_verified: boolean
  student_no?: string
  college?: string
  grade?: string
  bio?: string
}

export interface Board {
  id: string
  name: string
  slug: string
  description: string
  field_mode: 0 | 1 // 0 预置标签 / 1 结构化字段
}

export interface Category {
  id: string
  name: string
  boards: Board[]
}

export interface Tag {
  id: string
  name: string
  is_required: boolean
}

export interface PostField {
  field_key: string
  dict_item_id?: string
  raw_value?: string
}

export interface ImageRef {
  object_key: string
  url: string
}

export interface Post {
  id: string
  board_id: string
  title: string
  content: string
  is_anonymous: boolean
  is_pinned: boolean
  is_featured: boolean
  view_count: number
  reply_count: number
  like_count: number
  status?: number // 0 草稿 / 1 待审核 / 2 已发布 / 3 已驳回 / 4 已删除
  created_at: string
  board_name?: string
  author_id?: string
  author?: User | null
  tags?: Tag[]
  fields?: PostField[]
  images?: ImageRef[]
  liked?: boolean
  favorited?: boolean
}

export interface Reply {
  id: string
  post_id?: string
  floor_no: number
  parent_id?: string | null
  reply_to_id?: string | null
  author_id?: string
  author?: User | null
  content: string
  is_anonymous: boolean
  like_count: number
  created_at: string
  liked?: boolean
  children?: Reply[]
}

export interface NotificationItem {
  id: string
  type: 'reply' | 'mention' | 'like' | 'system'
  title: string
  content: string
  is_read: boolean
  created_at: string
}

export interface PageResult<T> {
  list: T[]
  has_more: boolean
  page: number
}

export interface LoginResult {
  access_token: string
  refresh_token: string
  user: User
}

export interface PresignResult {
  protocol: 'put' | 'post'
  upload_url?: string
  url?: string
  fields?: Record<string, string>
  object_key: string
}

export type SortType = 'comprehensive' | 'latest' | 'hot' | 'featured'
