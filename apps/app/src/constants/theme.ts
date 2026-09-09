// 设计 token（对齐 luojia-web 的 CSS 变量，浅色主题）
export const colors = {
  bg: '#f7f8fa',
  surface: '#ffffff',
  brand: '#1f8a5b',
  brandStrong: '#166b45',
  brandSoft: '#e8f4ee',
  ink: '#0f172a',
  ink2: '#475569',
  ink3: '#94a3b8',
  line: '#e2e8f0',
  hot: '#e11d48'
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32
} as const

// 卡片投影（弱化阴影）
export const cardShadow = {
  shadowColor: '#0f172a',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 3,
  elevation: 1
} as const
