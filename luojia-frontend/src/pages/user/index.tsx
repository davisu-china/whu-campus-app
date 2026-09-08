import { View, Text, Image } from '@tarojs/components'
import Taro, { useLoad, useRouter } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import VerifiedBadge from '../../components/VerifiedBadge'
import PostCard from '../../components/PostCard'
import EmptyState from '../../components/EmptyState'
import { getUser, getUserPosts } from '../../api/user'
import { usePaginatedList } from '../../hooks/usePaginatedList'
import type { Post, User } from '../../api/types'

export default function UserPage() {
  const router = useRouter()
  const userId = router.params.id || ''
  const [user, setUser] = useState<User | null>(null)

  const { list, refresh } = usePaginatedList<Post>((page) =>
    getUserPosts(userId, page).then((d) => ({ list: d.list, hasMore: d.has_more }))
  )

  useLoad(() => {
    if (userId) getUser(userId).then(setUser).catch(() => {})
  })

  useEffect(() => {
    if (userId) refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  return (
    <View className='luo-page luo-page-pad'>
      <View className='user-card'>
        <Image className='user-avatar' src={user?.avatar_url || ''} mode='aspectFill' />
        <View className='user-info'>
          <View className='user-name-row'>
            <Text className='user-name'>{user?.nickname || '…'}</Text>
            {user?.is_verified && <VerifiedBadge />}
          </View>
          <Text className='user-sub'>{[user?.college, user?.grade].filter(Boolean).join(' · ')}</Text>
          {user?.bio && <Text className='user-bio'>{user.bio}</Text>}
        </View>
      </View>

      <Text className='luo-section-title'>Ta 的帖子</Text>
      {list.length === 0 ? (
        <EmptyState title='还没有帖子' />
      ) : (
        list.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            onPress={() => Taro.navigateTo({ url: `/pages/post-detail/index?id=${p.id}` })}
          />
        ))
      )}
    </View>
  )
}
