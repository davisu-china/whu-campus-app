import { useEffect } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  NOTIFICATION_TYPE_LABEL,
  formatTime,
  getNotifications,
  markReadOne,
  useAuthStore,
  useNotificationStore,
  usePaginatedList
} from '@whu/shared'
import type { NotificationItem } from '@whu/shared'
import { ScreenHeader } from '@/components/screen-header'
import { ListFooter } from '@/components/list-footer'
import { EmptyState } from '@/components/ui/empty-state'
import { colors } from '@/constants/theme'

const TYPE_ICON: Record<string, string> = { reply: '💬', mention: '@', like: '👍', system: '📢' }

export default function NotificationsScreen() {
  const router = useRouter()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const unread = useNotificationStore((s) => s.unread)
  const setUnread = useNotificationStore((s) => s.setUnread)

  const { list, setList, loading, refreshing, hasMore, refresh, loadMore } = usePaginatedList((page) =>
    getNotifications(page).then((r) => ({ list: r.list, hasMore: r.has_more }))
  )

  useEffect(() => {
    if (isLoggedIn) refresh()
  }, [isLoggedIn, refresh])

  function handleRead(n: NotificationItem) {
    if (n.is_read) return
    setList((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)))
    setUnread(Math.max(0, unread - 1))
    markReadOne(n.id).catch(() => {})
  }

  function open(n: NotificationItem) {
    handleRead(n)
    if (n.related_id) router.push(`/post/${n.related_id}`)
  }

  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="通知" />
        <View style={styles.center}>
          <EmptyState
            title="登录后查看通知"
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
      <ScreenHeader title="通知" />
      <FlatList
        data={list}
        keyExtractor={(n) => n.id}
        renderItem={({ item: n }) => (
          <Pressable style={[styles.row, !n.is_read && styles.rowUnread]} onPress={() => open(n)}>
            <View style={styles.iconBox}>
              <Text style={styles.icon}>{TYPE_ICON[n.type] || '·'}</Text>
            </View>
            <View style={styles.body}>
              <Text style={styles.line1}>
                <Text style={styles.type}>{NOTIFICATION_TYPE_LABEL[n.type] || n.type}</Text>
                {n.title ? <Text style={styles.title2}> · {n.title}</Text> : null}
              </Text>
              {n.content ? (
                <Text style={styles.content} numberOfLines={2}>
                  {n.content}
                </Text>
              ) : null}
              <Text style={styles.time}>{formatTime(n.created_at)}</Text>
            </View>
            {!n.is_read ? <View style={styles.dot} /> : null}
          </Pressable>
        )}
        contentContainerStyle={styles.list}
        refreshing={refreshing}
        onRefresh={refresh}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={<ListFooter loading={loading} hasMore={hasMore} />}
        ListEmptyComponent={!loading ? <EmptyState title="暂无通知" desc="有新的回复、点赞时会在这里提醒你" /> : null}
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
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line
  },
  rowUnread: {
    backgroundColor: 'rgba(232,244,238,0.5)'
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(15,23,42,0.04)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  icon: {
    fontSize: 18
  },
  body: {
    flex: 1,
    marginLeft: 10
  },
  line1: {
    fontSize: 14,
    color: colors.ink
  },
  type: {
    fontWeight: '600'
  },
  title2: {
    color: colors.ink2
  },
  content: {
    marginTop: 3,
    fontSize: 13,
    color: colors.ink2
  },
  time: {
    marginTop: 4,
    fontSize: 12,
    color: colors.ink3
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.hot,
    marginTop: 6
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
