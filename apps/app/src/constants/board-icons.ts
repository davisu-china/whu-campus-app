// 板块 slug → emoji 图标映射（与后端 internal/model/slugs.go 常量保持一致）。
const BOARD_ICONS: Record<string, string> = {
  'second-hand': '🛒',
  'lost-found': '🎒',
  'campus-help': '🤝',
  'campus-hot': '🔥',
  'course-review': '📚',
  postgraduate: '🎓',
  'study-abroad': '✈️',
  'contest-team': '🏆',
  academic: '🔬',
  recruit: '💼',
  'part-time': '💰',
  'job-exp': '📝',
  graduate: '🧭',
  dating: '💕',
  club: '🎪',
  'tree-hole': '🌳',
  announcement: '📢'
}

export function boardIcon(slug: string): string {
  return BOARD_ICONS[slug] || '📌'
}
