import { View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import SearchBar from '../../components/SearchBar'
import PostCard from '../../components/PostCard'
import EmptyState from '../../components/EmptyState'
import { searchPosts } from '../../api/search'
import type { Post } from '../../api/types'

export default function Search() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Post[]>([])
  const [searched, setSearched] = useState(false)

  const doSearch = async () => {
    if (!q.trim()) return
    try {
      const d = await searchPosts(q.trim(), { page: 1 })
      setResults(d.list)
      setSearched(true)
    } catch {}
  }

  return (
    <View className='luo-page luo-page-pad'>
      <SearchBar value={q} onChange={setQ} onSearch={doSearch} />
      <View style={{ height: '24rpx' }} />
      {searched && results.length === 0 ? (
        <EmptyState title='没有找到相关内容' desc='换个关键词试试' />
      ) : (
        results.map((p) => (
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
