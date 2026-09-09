import { useCallback } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import {
  formatTime,
  getConversations,
  useAuthStore,
  useMessageStore,
  usePaginatedList
} from '@whu/shared'
import type { ConversationItem } from '@whu/shared'
import { Avatar } from '@/components/ui/avatar'
import { ListFooter } from '@/components/list-footer'
import { EmptyState } from '@/components/ui/empty-state'
import { colors } from '@/constants/theme'

export default function MessagesScreen() {
  const router = useRouter()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const fetchUnread = useMessageStore((s) => s.fetchUnread)

  const { list, loading, refreshing, hasMore, refresh, loadMore } = usePaginatedList((page) =>
    getConversations(page).then((r) => ({ list: r.list, hasMore: r.has_more }))
  )

  useFocusEffect(
    useCallback(() => {
      if (isLoggedIn) {
        refresh()
        fetchUnread()
      }
    }, [isLoggedIn, refresh, fetchUnread])
  )

  function open(c: ConversationItem) {
    const to = c.other_user?.id || ''
    const name = c.other_user?.nickname || '私信'
    const avatar = c.other_user?.avatar_url || ''
    router.push(`/conversation/${c.id}?to=${to}&name=${encodeURIComponent(name)}&avatar=${encodeURIComponent(avatar)}`)
  }

  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Text style={styles.title}>私信</Text>
        <View style={styles.center}>
          <EmptyState
            title="登录后查看私信"
            action={
              <Pressable style={styles.loginBtn} onPress={() => router.push('/login')}>
                <Text style={styles.loginBtnText}>去登录</Text>
              </Pressable>
            }
          />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>私信</Text>
      <FlatList
        data={list}
        keyExtractor={(c) => c.id}
        renderItem={({ item: c }) => (
          <Pressable style={styles.row} onPress={() => open(c)}>
            <Avatar name={c.other_user?.nickname || '?'} src={c.other_user?.avatar_url} size={48} />
            <View style={styles.body}>
              <View style={styles.topLine}>
                <Text style={styles.name} numberOfLines={1}>
                  {c.other_user?.nickname || '用户'}
                </Text>
                <Text style={styles.time}>{formatTime(c.last_message_at)}</Text>
              </View>
              <View style={styles.bottomLine}>
                <Text style={styles.preview} numberOfLines={1}>
                  {c.last_message}
                </Text>
                {c.unread_count > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{c.unread_count > 99 ? '99+' : c.unread_count}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </Pressable>
        )}
        contentContainerStyle={styles.list}
        refreshing={refreshing}
        onRefresh={refresh}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={<ListFooter loading={loading} hasMore={hasMore} />}
        ListEmptyComponent={!loading ? <EmptyState title="暂无私信" desc="从他人主页发起私聊" /> : null}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.ink,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  center: {
    flex: 1,
    justifyContent: 'center'
  },
  list: {
    paddingBottom: 24
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line
  },
  body: {
    flex: 1,
    marginLeft: 12
  },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink
  },
  time: {
    marginLeft: 8,
    fontSize: 12,
    color: colors.ink3
  },
  bottomLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4
  },
  preview: {
    flex: 1,
    fontSize: 13,
    color: colors.ink2
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: colors.hot,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600'
  },
  loginBtn: {
    backgroundColor: colors.brand,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 10
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600'
  }
})
