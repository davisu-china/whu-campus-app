import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { colors } from '@/constants/theme'

// 推入式页面（board/post/compose）的顶栏：返回键 + 标题 + 右侧操作。
export function ScreenHeader({ title, right }: { title: string; right?: ReactNode }) {
  const router = useRouter()
  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => router.back()} hitSlop={12} style={styles.side}>
        <Text style={styles.back}>‹</Text>
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line
  },
  side: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  back: {
    fontSize: 30,
    lineHeight: 32,
    color: colors.ink,
    fontWeight: '300'
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: colors.ink
  },
  right: {
    alignItems: 'flex-end'
  }
})
