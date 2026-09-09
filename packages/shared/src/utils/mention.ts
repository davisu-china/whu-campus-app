// @提及解析（MVP 文本级）：将正文中的 @昵称 解析为可点片段
export interface MentionToken {
  type: 'text' | 'mention'
  value: string
}

export function parseMentions(text: string): MentionToken[] {
  const tokens: MentionToken[] = []
  const re = /(@[一-龥A-Za-z0-9_-]{1,20})/g
  let last = 0
  let m: RegExpExecArray | null

  while ((m = re.exec(text))) {
    if (m.index > last) {
      tokens.push({ type: 'text', value: text.slice(last, m.index) })
    }
    tokens.push({ type: 'mention', value: m[1] })
    last = m.index + m[1].length
  }
  if (last < text.length) {
    tokens.push({ type: 'text', value: text.slice(last) })
  }
  return tokens
}
