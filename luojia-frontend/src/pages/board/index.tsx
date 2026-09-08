import { View, Text } from '@tarojs/components'
import Taro, { useLoad, usePullDownRefresh, useReachBottom, useRouter } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import PostCard from '../../components/PostCard'
import Tag from '../../components/Tag'
import SortTabs from '../../components/SortTabs'
import TabBar from '../../components/TabBar'
import EmptyState from '../../components/EmptyState'
import { getBoard, getBoardPosts, getBoardTags, getCategories } from '../../api/board'
import { usePaginatedList } from '../../hooks/usePaginatedList'
import { SORT_OPTIONS } from '../../constants/enums'
import type { Category, Post, SortType, Tag as TagType } from '../../api/types'
import './index.scss'

export default function Board() {
  const router = useRouter()
  const boardId = router.params.id || ''

  const [categories, setCategories] = useState<Category[]>([])
  const [sort, setSort] = useState<SortType>('comprehensive')
  const [tags, setTags] = useState<TagType[]>([])
  const [tagFilter, setTagFilter] = useState('')

  const { list, refresh, loadMore, hasMore, onReachBottom } = usePaginatedList<Post>((page) =>
    getBoardPosts(boardId, { page, sort, tag_id: tagFilter || undefined }).then((d) => ({
      list: d.list,
      hasMore: d.has_more
    }))
  )

  useLoad(() => {
    if (boardId) {
      getBoard(boardId).then((b) => Taro.setNavigationBarTitle({ title: b.name })).catch(() => {})
      getBoardTags(boardId).then(setTags).catch(() => {})
    } else {
      getCategories().then(setCategories).catch(() => {})
    }
  })

  useEffect(() => {
    if (boardId) refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, tagFilter, boardId])

  usePullDownRefresh(() => {
    if (boardId) refresh().finally(() => Taro.stopPullDownRefresh())
  })
  useReachBottom(onReachBottom)

  const goPost = (id: string) => Taro.navigateTo({ url: `/pages/post-detail/index?id=${id}` })

  // 板块目录（无 boardId 时，作为「板块」Tab 首页）
  if (!boardId) {
    return (
      <View className='luo-page luo-page-pad'>
        <Text className='luo-section-title'>板块</Text>
        {categories.map((c) => (
          <View key={c.id} className='board-group'>
            <Text className='board-group-name'>{c.name}</Text>
            <View className='board-grid'>
              {c.boards.map((b) => (
                <View
                  key={b.id}
                  className='board-item'
                  onClick={() => Taro.navigateTo({ url: `/pages/board/index?id=${b.id}` })}
                >
                  <Text className='board-item-name'>{b.name}</Text>
                  <Text className='board-item-desc'>{b.description}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
        <TabBar active='board' />
      </View>
    )
  }

  // 帖子列表
  return (
    <View className='luo-page'>
      <View className='board-head luo-page-pad'>
        <SortTabs
          options={[...SORT_OPTIONS]}
          value={sort}
          onChange={(k) => setSort(k as SortType)}
        />
        {tags.length > 0 && (
          <View className='board-tags'>
            {tags.map((t) => (
              <Tag
                key={t.id}
                variant={tagFilter === t.id ? 'filter-on' : 'filter'}
                onClick={() => setTagFilter(tagFilter === t.id ? '' : t.id)}
              >
                {t.name}
              </Tag>
            ))}
          </View>
        )}
      </View>

      <View className='board-list luo-page-pad'>
        {list.length === 0 ? (
          <EmptyState title='还没有帖子' />
        ) : (
          list.map((p) => <PostCard key={p.id} post={p} onPress={() => goPost(p.id)} />)
        )}
        {hasMore && (
          <View className='board-loadmore' onClick={loadMore}>
            加载更多
          </View>
        )}
      </View>

      <TabBar active='board' />
    </View>
  )
}
