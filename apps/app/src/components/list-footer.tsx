import { ActivityIndicator, Text, View } from 'react-native'
import { colors } from '@/constants/theme'

// 分页列表尾部：加载中 / 没有更多
export function ListFooter({ loading, hasMore }: { loading: boolean; hasMore: boolean }) {
  if (loading) {
    return (
      <View style={{ paddingVertical: 20, alignItems: 'center' }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    )
  }
  if (!hasMore) {
    return (
      <Text style={{ textAlign: 'center', color: colors.ink3, fontSize: 12, paddingVertical: 20 }}>没有更多了</Text>
    )
  }
  return <View style={{ height: 20 }} />
}
