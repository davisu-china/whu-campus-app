import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useLoad, usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { useState } from 'react'
import SearchBar from '../../components/SearchBar'
import NoticeBar from '../../components/NoticeBar'
import PostCard from '../../components/PostCard'
import TabBar from '../../components/TabBar'
import EmptyState from '../../components/EmptyState'
import { getCategories } from '../../api/board'
import { getHomeFeed } from '../../api/content'
import { usePaginatedList } from '../../hooks/usePaginatedList'
import { useNotificationStore } from '../../store/notification'
import type { Category, Post } from '../../api/types'
import './index.scss'

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([])
  const [activeCat, setActiveCat] = useState(0)

  const { list, refresh, loadMore, hasMore, onReachBottom } = usePaginatedList<Post>((page) =>
    getHomeFeed(page).then((d) => ({ list: d.list, hasMore: d.has_more }))
  )

  useLoad(() => {
    getCategories().then(setCategories).catch(() => {})
    refresh()
    useNotificationStore.getState().fetchUnread()
  })

  usePullDownRefresh(() => {
    refresh().finally(() => Taro.stopPullDownRefresh())
  })
  useReachBottom(onReachBottom)

  const goPost = (id: string) => Taro.navigateTo({ url: `/pages/post-detail/index?id=${id}` })
  const goSearch = () => Taro.navigateTo({ url: '/pages/search/index' })
  const goNotifications = () => Taro.navigateTo({ url: '/pages/notifications/index' })

  return (
    <View className='luo-page'>
      <View className='home-head luo-page-pad'>
        <View className='home-top'>
          <Text className='luo-serif home-wordmark'>珞珈BBS</Text>
          <View className='home-bell' onClick={goNotifications}>
            <Text className='home-bell-icon'>⌁</Text>
            <View className='home-bell-dot' />
          </View>
        </View>
        <SearchBar readonly onFocus={goSearch} />
      </View>

      <View className='home-body'>
        <ScrollView scrollX className='home-cats'>
          <View className='home-cats-inner'>
            {categories.map((c, i) => (
              <View
                key={c.id}
                className={`home-cat ${i === activeCat ? 'on' : ''}`}
                onClick={() => setActiveCat(i)}
              >
                {c.name}
              </View>
            ))}
          </View>
        </ScrollView>

        <View className='luo-page-pad'>
          <NoticeBar>站务公告：社区公约已更新，发帖前请阅读</NoticeBar>

          <Text className='luo-section-title'>精选</Text>
          {list.length === 0 ? (
            <EmptyState title='还没有内容' desc='去发布第一条帖子吧' />
          ) : (
            list.map((p) => <PostCard key={p.id} post={p} onPress={() => goPost(p.id)} />)
          )}

          {hasMore && (
            <View className='home-loadmore' onClick={loadMore}>
              加载更多
            </View>
          )}
        </View>
      </View>

      <TabBar active='home' />
    </View>
  )
}
