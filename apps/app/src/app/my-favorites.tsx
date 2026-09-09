import { useCallback } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { getMyFavorites, useAuthStore, usePaginatedList } from '@whu/shared'
import { ScreenHeader } from '@/components/screen-header'
import { PostCard } from '@/components/post-card'
import { ListFooter } from '@/components/list-footer'
import { EmptyState } from '@/components/ui/empty-state'
import { colors } from '@/constants/theme'

export default function MyFavoritesScreen() {
  const router = useRouter()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)

  const { list, loading, refreshing, hasMore, refresh, loadMore } = usePaginatedList((page) =>
    getMyFavorites(page).then((r) => ({ list: r.list, hasMore: r.has_more }))
  )

  useFocusEffect(
    useCallback(() => {
      if (isLoggedIn) refresh()
    }, [isLoggedIn, refresh])
  )

  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader title="我的收藏" />
        <View style={styles.center}>
          <Text style={styles.hint}>登录后查看你收藏的帖子</Text>
          <Pressable style={styles.primaryBtn} onPress={() => router.push('/login')}>
            <Text style={styles.primaryBtnText}>登录 / 注册</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="我的收藏" />
      <FlatList
        data={list}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PostCard post={item} />}
        contentContainerStyle={styles.list}
        refreshing={refreshing}
        onRefresh={refresh}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={<ListFooter loading={loading} hasMore={hasMore} />}
        ListEmptyComponent={!loading ? <EmptyState title="你还没有收藏过帖子" desc="看到好帖，点收藏就能在这里找到" /> : null}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  hint: {
    fontSize: 15,
    color: colors.ink2
  },
  primaryBtn: {
    marginTop: 20,
    backgroundColor: colors.brand,
    borderRadius: 999,
    paddingHorizontal: 32,
    paddingVertical: 12
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600'
  },
  list: {
    paddingHorizontal: 12,
    paddingBottom: 24
  }
})
