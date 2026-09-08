import { View, Text, Image } from '@tarojs/components'
import Taro, { useReachBottom } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import VerifiedBadge from '../../components/VerifiedBadge'
import TabBar from '../../components/TabBar'
import Button from '../../components/Button'
import EmptyState from '../../components/EmptyState'
import PostCard from '../../components/PostCard'
import { useAuth } from '../../hooks/useAuth'
import { useAuthStore } from '../../store/auth'
import { useAppStore } from '../../store/app'
import { getMyPosts, getMyFavorites, getMyReplies } from '../../api/user'
import { usePaginatedList } from '../../hooks/usePaginatedList'
import { formatTime } from '../../utils/format'
import type { Post, Reply } from '../../api/types'
import './index.scss'

type Tab = 'posts' | 'favorites' | 'replies'
const TABS: { key: Tab; label: string }[] = [
  { key: 'posts', label: '帖子' },
  { key: 'favorites', label: '收藏' },
  { key: 'replies', label: '回复' }
]

export default function Profile() {
  const { user, isLoggedIn } = useAuth()
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)

  const [tab, setTab] = useState<Tab>('posts')

  const posts = usePaginatedList<Post>((page) =>
    getMyPosts(page).then((d) => ({ list: d.list, hasMore: d.has_more }))
  )
  const favorites = usePaginatedList<Post>((page) =>
    getMyFavorites(page).then((d) => ({ list: d.list, hasMore: d.has_more }))
  )
  const replies = usePaginatedList<Reply>((page) =>
    getMyReplies(page).then((d) => ({ list: d.list, hasMore: d.has_more }))
  )

  useEffect(() => {
    if (!isLoggedIn) return
    if (tab === 'posts') posts.refresh()
    else if (tab === 'favorites') favorites.refresh()
    else replies.refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, isLoggedIn])

  useReachBottom(() => {
    const cur = tab === 'posts' ? posts : tab === 'favorites' ? favorites : replies
    cur.onReachBottom()
  })

  const goLogin = () => Taro.navigateTo({ url: '/pages/login/index' })

  const logout = () => {
    Taro.showModal({
      title: '退出登录',
      content: '确定要退出吗？',
      success: (res) => {
        if (res.confirm) {
          useAuthStore.getState().logout()
          Taro.showToast({ title: '已退出', icon: 'none' })
        }
      }
    })
  }

  const activeList =
    tab === 'posts' ? posts : tab === 'favorites' ? favorites : replies

  return (
    <View className='luo-page luo-page-pad'>
      <View className='profile-card'>
        {isLoggedIn && user ? (
          <>
            <Image className='profile-avatar' src={user.avatar_url || ''} mode='aspectFill' />
            <View className='profile-info'>
              <View className='profile-name-row'>
                <Text className='profile-name'>{user.nickname}</Text>
                {user.is_verified && <VerifiedBadge />}
              </View>
              <Text className='profile-sub'>
                {[user.college, user.grade].filter(Boolean).join(' · ') || '武大学子'}
              </Text>
            </View>
          </>
        ) : (
          <View className='profile-login'>
            <Text className='profile-login-tip'>登录后发帖、回复、收藏</Text>
            <Button onClick={goLogin} className='profile-login-btn'>
              武大邮箱登录
            </Button>
          </View>
        )}
      </View>

      {isLoggedIn && (
        <>
          <View className='profile-tabs'>
            {TABS.map((t) => (
              <View
                key={t.key}
                className={`profile-tab ${t.key === tab ? 'on' : ''}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </View>
            ))}
          </View>

          {activeList.list.length === 0 ? (
            <EmptyState title='这里还是空的' />
          ) : tab === 'replies' ? (
            activeList.list.map((r) => (
              <View key={(r as Reply).id} className='profile-reply'>
                <Text className='profile-reply-content'>{(r as Reply).content}</Text>
                <Text className='profile-reply-time'>{formatTime((r as Reply).created_at)}</Text>
              </View>
            ))
          ) : (
            activeList.list.map((p) => (
              <PostCard
                key={(p as Post).id}
                post={p as Post}
                onPress={() => Taro.navigateTo({ url: `/pages/post-detail/index?id=${(p as Post).id}` })}
              />
            ))
          )}
        </>
      )}

      <View className='profile-entries'>
        <View className='profile-entry' onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          <Text className='profile-entry-label'>暗色模式</Text>
          <Text className='profile-entry-arrow'>{theme === 'dark' ? '开' : '关'}</Text>
        </View>
        <View className='profile-entry'>
          <Text className='profile-entry-label'>社区公约</Text>
          <Text className='profile-entry-arrow'>›</Text>
        </View>
        {isLoggedIn && (
          <View className='profile-entry' onClick={logout}>
            <Text className='profile-entry-label profile-logout'>退出登录</Text>
          </View>
        )}
      </View>

      <TabBar active='profile' />
    </View>
  )
}
