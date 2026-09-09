// ============================================================
// API DTO 类型 —— 对齐后端响应（snake_case，与后端 Go json tag 一致）
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
  identity?: string
  degree?: string
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
  is_user_created?: boolean
}

export interface HotTag {
  tag_id: string
  name: string
  post_count: number
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
  is_mine?: boolean
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
  sub_count?: number
  children?: Reply[]
}

export interface NotificationItem {
  id: string
  type: 'reply' | 'mention' | 'like' | 'system'
  title: string
  content: string
  related_id?: string
  is_read: boolean
  created_at: string
}

export interface ConversationItem {
  id: string
  other_user: User | null
  last_message: string
  last_message_at: string
  unread_count: number
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
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
  public_url?: string
}

export interface BindStatus {
  bound: boolean
  username?: string
}

export interface CampusStatus {
  cas: BindStatus
  edu: BindStatus
  lib: BindStatus
  bus: BindStatus
  card: BindStatus
  print: BindStatus
  gym: BindStatus
}

// 图书馆楼栋 / 房间 / 座位
export interface LibraryBuilding {
  id: string
  name: string
}

export interface LibraryRoom {
  id: string
  name: string
  building: string
}

export interface Seat {
  id: string
  room: string
  name: string // 座位号，如 "001"
  status: string
  has_power: boolean
}

// 图书馆定时自动预约计划
export interface BookingPlan {
  id: string
  user_id: string
  room_id: string
  seat_id: string
  room_name: string
  seat_name: string
  date: string // yyyy-MM-dd
  start_time: string // HH:mm
  end_time: string // HH:mm
  book_at: string // 触发预约时间（RFC3339）
  status: 0 | 1 | 2 | 3 // 0 待预约 / 1 成功 / 2 失败 / 3 取消
  last_result: string
  created_at: string
}

export type SortType = 'comprehensive' | 'latest' | 'hot' | 'featured'
