import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { colors } from '@/constants/theme'

type TagColor = 'brand' | 'ink' | 'hot'

const colorMap: Record<TagColor, { fg: string; bg: string }> = {
  brand: { fg: colors.brand, bg: colors.brandSoft },
  ink: { fg: colors.ink2, bg: 'rgba(15,23,42,0.05)' },
  hot: { fg: colors.hot, bg: '#fff1f2' }
}

export function Tag({ children, color = 'ink' }: { children: ReactNode; color?: TagColor }) {
  const c = colorMap[color]
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: c.bg }}>
      <Text style={{ fontSize: 12, lineHeight: 20, color: c.fg }}>{children}</Text>
    </View>
  )
}
