import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { colors } from '@/constants/theme'

export function EmptyState({
  title = '暂无内容',
  desc,
  action
}: {
  title?: string
  desc?: string
  action?: ReactNode
}) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 24 }}>
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 16,
          backgroundColor: 'rgba(15,23,42,0.03)',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16
        }}
      >
        <Text style={{ color: colors.ink3, fontSize: 20 }}>✦</Text>
      </View>
      <Text style={{ color: colors.ink2, fontWeight: '500' }}>{title}</Text>
      {desc ? (
        <Text style={{ marginTop: 4, color: colors.ink3, fontSize: 13, textAlign: 'center' }}>{desc}</Text>
      ) : null}
      {action ? <View style={{ marginTop: 20 }}>{action}</View> : null}
    </View>
  )
}
