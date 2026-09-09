import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { getUser, getUserPosts, useAuthStore, usePaginatedList } from '@whu/shared'
import type { User } from '@whu/shared'
import { ScreenHeader } from '@/components/screen-header'
import { PostCard } from '@/components/post-card'
import { ListFooter } from '@/components/list-footer'
import { EmptyState } from '@/components/ui/empty-state'
import { Avatar } from '@/components/ui/avatar'
import { colors } from '@/constants/theme'

export default function UserScreen() {
  const router = useRouter()
  const { id = '' } = useLocalSearchParams<{ id: string }>()
  const meId = useAuthStore((s) => s.user?.id) || ''
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const [user, setUser] = useState<User | null>(null)
  const [loadingUser, setLoadingUser] = useState(true)

  const { list, loading, refreshing, hasMore, refresh, loadMore } = usePaginatedList((page) =>
    getUserPosts(id, page).then((r) => ({ list: r.list, hasMore: r.has_more }))
  )

  useEffect(() => {
    setLoadingUser(true)
    getUser(id)
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoadingUser(false))
  }, [id])

  useEffect(() => {
    refresh()
  }, [id, refresh])

  if (loadingUser) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader title="用户主页" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} size="large" />
        </View>
      </SafeAreaView>
    )
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader title="用户主页" />
        <View style={styles.center}>
          <EmptyState title="用户不存在" />
        </View>
      </SafeAreaView>
    )
  }

  const meta = [user.identity, user.degree, user.college, user.grade].filter(Boolean).join(' · ')
  const canDM = isLoggedIn && !!meId && meId !== user.id

  const header = (
    <View>
      <View style={styles.profile}>
        <Avatar name={user.nickname} src={user.avatar_url} size={64} />
        <View style={styles.profileInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.nickname}>{user.nickname}</Text>
            {user.is_verified ? <Text style={styles.verified}>✓ 已认证</Text> : null}
          </View>
          <Text style={styles.meta}>{meta || '暂无身份/院系信息'}</Text>
          {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
          {canDM ? (
            <Pressable
              style={styles.dmBtn}
              onPress={() => router.push(`/conversation/new?to=${user.id}&name=${encodeURIComponent(user.nickname)}&avatar=${encodeURIComponent(user.avatar_url || '')}`)}
            >
              <Text style={styles.dmBtnText}>发私信</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <Text style={styles.sectionTitle}>TA 的帖子</Text>
    </View>
  )

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title={user.nickname} />
      <FlatList
        data={list}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={header}
        renderItem={({ item }) => <PostCard post={item} />}
        contentContainerStyle={styles.list}
        refreshing={refreshing}
        onRefresh={refresh}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={<ListFooter loading={loading} hasMore={hasMore} />}
        ListEmptyComponent={!loading ? <EmptyState title="TA 还没有发过帖子" /> : null}
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
  list: {
    paddingHorizontal: 12,
    paddingBottom: 24
  },
  profile: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: 20,
    marginTop: 12,
    marginBottom: 16
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center'
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  nickname: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.ink
  },
  verified: {
    marginLeft: 8,
    fontSize: 12,
    color: colors.brand,
    fontWeight: '600'
  },
  meta: {
    marginTop: 6,
    fontSize: 13,
    color: colors.ink2
  },
  bio: {
    marginTop: 8,
    fontSize: 13,
    color: colors.ink2,
    lineHeight: 19
  },
  dmBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: colors.brand,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 8
  },
  dmBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600'
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
    marginBottom: 12
  }
})
