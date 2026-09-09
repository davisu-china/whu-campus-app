// 排序选项
export const SORT_OPTIONS = [
  { key: 'comprehensive', label: '综合' },
  { key: 'latest', label: '最新' },
  { key: 'hot', label: '最热' },
  { key: 'featured', label: '精华' }
] as const

export type SortKey = (typeof SORT_OPTIONS)[number]['key']

// 搜索时间范围（对齐后端 time_range 参数；空串 = 不限）
export const TIME_RANGE_OPTIONS = [
  { key: '', label: '不限时间' },
  { key: 'day', label: '当天' },
  { key: '3d', label: '近三天' },
  { key: 'week', label: '一周内' },
  { key: 'month', label: '一个月内' },
  { key: 'year', label: '一年内' }
] as const

// 帖子状态（对齐后端 posts.status）
export const POST_STATUS = {
  DRAFT: 0,
  PENDING: 1,
  PUBLISHED: 2,
  REJECTED: 3,
  DELETED: 4
} as const

// 通知类型文案
export const NOTIFICATION_TYPE_LABEL: Record<string, string> = {
  reply: '回复',
  mention: '提及',
  like: '点赞',
  system: '系统'
}

// 五大分类（占位，实际以 /categories 接口为准）
export const CATEGORY_NAMES = ['校园生活', '学习成长', '职业发展', '社交娱乐', '站务']

// 站务公告板块 slug（左侧导航隐藏「站务」分类，右侧栏展示公告）
export const ANNOUNCEMENT_SLUG = 'announcement'
