import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { formatCount, formatTime } from '@whu/shared'
import type { Post } from '@whu/shared'
import { Avatar } from './ui/avatar'
import { Tag } from './ui/tag'
import { stripHtml } from '@/utils/html'
import { cardShadow, colors } from '@/constants/theme'

export function PostCard({ post }: { post: Post }) {
  const router = useRouter()
  const summary = stripHtml(post.content || '')
  const name = post.is_anonymous ? '匿名用户' : post.author?.nickname || '匿名用户'
  const cover = post.images?.[0]?.url

  return (
    <Pressable style={styles.card} onPress={() => router.push(`/post/${post.id}`)}>
      {/* meta */}
      <View style={styles.metaRow}>
        <Pressable
          style={styles.authorWrap}
          onPress={() => {
            if (!post.is_anonymous && post.author_id) router.push(`/user/${post.author_id}`)
          }}
          disabled={post.is_anonymous || !post.author_id}
          hitSlop={4}
        >
          <Avatar name={name} src={post.author?.avatar_url} size={20} />
          <Text style={styles.author} numberOfLines={1}>
            {name}
          </Text>
          {!post.is_anonymous && post.author?.is_verified ? <Text style={styles.verified}>✓</Text> : null}
        </Pressable>
        <Text style={styles.dot}>·</Text>
        <Text style={styles.time}>{formatTime(post.created_at)}</Text>
        {post.is_pinned ? (
          <View style={[styles.chip, styles.chipPinned]}>
            <Text style={styles.chipPinnedText}>置顶</Text>
          </View>
        ) : null}
        {post.is_featured ? (
          <View style={[styles.chip, styles.chipFeatured]}>
            <Text style={styles.chipFeaturedText}>精华</Text>
          </View>
        ) : null}
        {post.board_name ? (
          <View style={styles.boardChip}>
            <Text style={styles.boardChipText}>{post.board_name}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {post.title}
      </Text>
      {summary ? (
        <Text style={styles.summary} numberOfLines={2}>
          {summary}
        </Text>
      ) : null}

      {post.tags && post.tags.length > 0 ? (
        <View style={styles.tags}>
          {post.tags.slice(0, 3).map((t) => (
            <Tag key={t.id} color="ink">
              {t.name}
            </Tag>
          ))}
        </View>
      ) : null}

      {cover ? (
        <Image source={{ uri: cover }} style={styles.cover} contentFit="cover" transition={120} />
      ) : null}

      <View style={styles.actions}>
        <Text style={styles.action}>👁 {formatCount(post.view_count)}</Text>
        <Text style={styles.action}>💬 {formatCount(post.reply_count)}</Text>
        <Text style={[styles.action, post.liked && styles.liked]}>👍 {formatCount(post.like_count)}</Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: 16,
    marginBottom: 10,
    ...cardShadow
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  authorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1
  },
  author: {
    marginLeft: 6,
    fontSize: 13,
    color: colors.ink2,
    fontWeight: '500',
    maxWidth: 140
  },
  verified: {
    color: colors.brand,
    fontSize: 12,
    marginLeft: 2
  },
  dot: {
    color: colors.ink3,
    marginHorizontal: 6
  },
  time: {
    fontSize: 13,
    color: colors.ink3
  },
  chip: {
    marginLeft: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4
  },
  chipPinned: {
    backgroundColor: colors.brandSoft
  },
  chipPinnedText: {
    fontSize: 11,
    color: colors.brand,
    fontWeight: '500'
  },
  chipFeatured: {
    backgroundColor: '#fef3c7'
  },
  chipFeaturedText: {
    fontSize: 11,
    color: '#d97706',
    fontWeight: '500'
  },
  boardChip: {
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.brandSoft
  },
  boardChipText: {
    fontSize: 12,
    color: colors.brand
  },
  title: {
    marginTop: 10,
    fontSize: 17,
    fontWeight: '600',
    color: colors.ink,
    lineHeight: 24
  },
  summary: {
    marginTop: 6,
    fontSize: 14,
    color: colors.ink2,
    lineHeight: 21
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10
  },
  cover: {
    marginTop: 10,
    width: '100%',
    height: 180,
    borderRadius: 8,
    backgroundColor: 'rgba(15,23,42,0.04)'
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12
  },
  action: {
    fontSize: 13,
    color: colors.ink3
  },
  liked: {
    color: colors.hot
  }
})
