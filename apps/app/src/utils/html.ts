// 去掉 HTML 标签，压缩空白 —— 用于帖子正文生成卡片摘要
export function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}
