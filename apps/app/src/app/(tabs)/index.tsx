import { useEffect } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { getHomeFeed, usePaginatedList } from '@whu/shared'
import { PostCard } from '@/components/post-card'
import { ListFooter } from '@/components/list-footer'
import { EmptyState } from '@/components/ui/empty-state'
import { colors } from '@/constants/theme'

export default function HomeScreen() {
  const router = useRouter()
  const { list, loading, refreshing, hasMore, refresh, loadMore } = usePaginatedList((page) =>
    getHomeFeed(page, 20).then((r) => ({ list: r.list, hasMore: r.has_more }))
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>在武大</Text>
          <Pressable style={styles.composeBtn} onPress={() => router.push('/compose')}>
            <Text style={styles.composeBtnText}>＋ 发帖</Text>
          </Pressable>
        </View>
        <Pressable style={styles.searchBar} onPress={() => router.push('/search')}>
          <Ionicons name="search" size={18} color={colors.ink3} />
          <Text style={styles.searchPlaceholder}>搜索帖子</Text>
        </Pressable>
      </View>

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
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              title="暂无内容"
              desc="成为第一个发帖的人，分享你的校园生活"
              action={
                <Pressable style={styles.emptyBtn} onPress={() => router.push('/compose')}>
                  <Text style={styles.emptyBtnText}>立即发帖</Text>
                </Pressable>
              }
            />
          ) : null
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: colors.bg
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.ink
  },
  searchBar: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    paddingHorizontal: 14,
    gap: 8
  },
  searchPlaceholder: {
    fontSize: 14,
    color: colors.ink3
  },
  composeBtn: {
    backgroundColor: colors.brand,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 7
  },
  composeBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600'
  },
  list: {
    paddingHorizontal: 12,
    paddingBottom: 24
  },
  emptyBtn: {
    backgroundColor: colors.brand,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 10
  },
  emptyBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600'
  }
})
