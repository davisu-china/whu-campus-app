import { View, Text } from '@tarojs/components'
import Tag from '../Tag'
import VerifiedBadge from '../VerifiedBadge'
import ImageGrid from '../ImageGrid'
import { formatCount, formatTime } from '../../utils/format'
import type { Post } from '../../api/types'
import './index.scss'

interface PostCardProps {
  post: Post
  onPress?: () => void
}

// 帖子卡片（UI 规范 4.4）：状态徽标 + 标题 + 标签 + 图片 + 互动数据
export default function PostCard({ post, onPress }: PostCardProps) {
  return (
    <View className={`luo-post-card ${post.is_pinned ? 'is-pinned' : ''}`} onClick={onPress}>
      {post.tags && post.tags.length > 0 && (
        <View className='luo-post-tags'>
          {post.tags.slice(0, 3).map((t) => (
            <Tag key={t.id} variant='tag'>
              {t.name}
            </Tag>
          ))}
        </View>
      )}

      <View className='luo-post-title'>
        {post.is_pinned && <Text className='luo-badge-pin'>顶</Text>}
        {post.is_featured && <Text className='luo-badge-feat'>精</Text>}
        <Text className='luo-post-title-text'>{post.title}</Text>
      </View>

      {post.images && post.images.length > 0 && <ImageGrid images={post.images.map((i) => i.url)} preview />}

      <View className='luo-post-meta'>
        <Text className='luo-post-author'>
          {post.is_anonymous ? '匿名' : post.author?.nickname || '匿名'}
        </Text>
        {!post.is_anonymous && post.author?.is_verified && <VerifiedBadge />}
        <Text className='luo-post-time'>· {formatTime(post.created_at)}</Text>
        <Text className='luo-post-stats'>
          浏览 {formatCount(post.view_count)} · 回复 {post.reply_count} · 赞 {post.like_count}
        </Text>
      </View>
    </View>
  )
}
