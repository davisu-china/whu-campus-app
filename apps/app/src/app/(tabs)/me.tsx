import { useCallback } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { useAuthStore, useNotificationStore } from '@whu/shared'
import { Avatar } from '@/components/ui/avatar'
import { colors } from '@/constants/theme'

export default function MeScreen() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const logout = useAuthStore((s) => s.logout)
  const notifUnread = useNotificationStore((s) => s.unread)
  const fetchNotifUnread = useNotificationStore((s) => s.fetchUnread)

  useFocusEffect(
    useCallback(() => {
      if (isLoggedIn) fetchNotifUnread()
    }, [isLoggedIn, fetchNotifUnread])
  )

  if (!isLoggedIn || !user) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Text style={styles.title}>我的</Text>
        <View style={styles.center}>
          <Text style={styles.hint}>登录后查看个人主页</Text>
          <Pressable style={styles.primaryBtn} onPress={() => router.push('/login')}>
            <Text style={styles.primaryBtnText}>登录 / 注册</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>我的</Text>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.profile}>
          <Avatar name={user.nickname} src={user.avatar_url} size={64} />
          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.nickname}>{user.nickname}</Text>
              {user.is_verified ? <Text style={styles.verified}>✓ 已认证</Text> : <Text style={styles.unverified}>未认证</Text>}
            </View>
            <Text style={styles.meta}>
              {[user.college, user.grade, user.identity].filter(Boolean).join(' · ') || '武大学子'}
            </Text>
            {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
          </View>
        </View>

        <Pressable style={styles.menuRow} onPress={() => router.push('/notifications')}>
          <Text style={styles.menuIcon}>🔔</Text>
          <Text style={styles.menuLabel}>通知</Text>
          {notifUnread > 0 ? (
            <View style={styles.menuBadge}>
              <Text style={styles.menuBadgeText}>{notifUnread > 99 ? '99+' : notifUnread}</Text>
            </View>
          ) : null}
          <Text style={styles.menuChevron}>›</Text>
        </Pressable>

        <Pressable style={styles.menuRow} onPress={() => router.push('/my-posts')}>
          <Text style={styles.menuIcon}>📄</Text>
          <Text style={styles.menuLabel}>我的帖子</Text>
          <Text style={styles.menuChevron}>›</Text>
        </Pressable>

        <Pressable style={styles.menuRow} onPress={() => router.push('/my-favorites')}>
          <Text style={styles.menuIcon}>⭐</Text>
          <Text style={styles.menuLabel}>我的收藏</Text>
          <Text style={styles.menuChevron}>›</Text>
        </Pressable>

        <Pressable style={styles.menuRow} onPress={() => router.push('/change-password')}>
          <Text style={styles.menuIcon}>🔒</Text>
          <Text style={styles.menuLabel}>{user.has_password ? '修改密码' : '设置密码'}</Text>
          <Text style={styles.menuChevron}>›</Text>
        </Pressable>

        <Pressable style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>退出登录</Text>
        </Pressable>
      </ScrollView>
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
  body: {
    padding: 16
  },
  profile: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: 20
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
  unverified: {
    marginLeft: 8,
    fontSize: 12,
    color: colors.ink3
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
  menuRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    paddingHorizontal: 16,
    paddingVertical: 15
  },
  menuIcon: {
    fontSize: 18
  },
  menuLabel: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    color: colors.ink
  },
  menuBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: colors.hot,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8
  },
  menuBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600'
  },
  menuChevron: {
    fontSize: 20,
    color: colors.ink3
  },
  logoutBtn: {
    marginTop: 20,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    paddingVertical: 14,
    alignItems: 'center'
  },
  logoutText: {
    color: colors.hot,
    fontSize: 15,
    fontWeight: '600'
  }
})
