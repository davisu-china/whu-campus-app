// 日期/时间辅助（对齐 luojia-web LibraryPlan 页的格式化逻辑）

const WEEK = ['日', '一', '二', '三', '四', '五', '六']

function pad(n: number): string {
  return `${n}`.padStart(2, '0')
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// 预约日期默认 = 明天（yyyy-MM-dd）
export function defaultDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return fmtDate(d)
}

export interface DateOption {
  value: string // yyyy-MM-dd
  label: string
}

// 从明天开始的 n 天日期选项
export function dateOptions(n: number): DateOption[] {
  const out: DateOption[] = []
  const today = new Date()
  for (let i = 1; i <= n; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i)
    const label =
      i === 1
        ? `明天 ${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
        : `${pad(d.getMonth() + 1)}-${pad(d.getDate())} 周${WEEK[d.getDay()]}`
    out.push({ value: fmtDate(d), label })
  }
  return out
}

// 整点时间选项，如 07:00 … 22:00
export function timeOptions(from = 7, to = 22): string[] {
  const out: string[] = []
  for (let h = from; h <= to; h++) out.push(`${pad(h)}:00`)
  return out
}

// 本地 date + time → RFC3339（无毫秒、Z 结尾）
export function toRFC3339(date: string, time: string): string {
  const d = new Date(`${date}T${time}`)
  if (isNaN(d.getTime())) return `${date}T${time}:00Z`
  return d.toISOString().slice(0, 19) + 'Z'
}

// RFC3339 → "yyyy-MM-dd HH:mm"（本地时区展示）
export function formatBookAt(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
