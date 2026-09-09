import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  createReply,
  deletePost,
  formatCount,
  formatTime,
  getPost,
  getReplies,
  getSubReplies,
  report,
  toast,
  toggleFavorite,
  toggleLikePost,
  toggleLikeReply,
  usePaginatedList
} from '@whu/shared'
import type { Post, Reply } from '@whu/shared'
import { useAuth } from '@/hooks/use-auth'
import { ScreenHeader } from '@/components/screen-header'
import { Avatar } from '@/components/ui/avatar'
import { Tag } from '@/components/ui/tag'
import { ListFooter } from '@/components/list-footer'
import { colors } from '@/constants/theme'

export default function PostDetailScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { user, ensureLogin } = useAuth()

  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [replyText, setReplyText] = useState('')
  const [replyTo, setReplyTo] = useState<Reply | null>(null)
  const [anonymous, setAnonymous] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [expandedFloors, setExpandedFloors] = useState<Set<string>>(new Set())
  const [subLoading, setSubLoading] = useState<Set<string>>(new Set())

  const {
    list: replies,
    loading: loadingReplies,
    refreshing,
    hasMore,
    refresh: refreshReplies,
    loadMore,
    setList: setReplies
  } = usePaginatedList((page) => getReplies(id, page).then((r) => ({ list: r.list, hasMore: r.has_more })))

  useEffect(() => {
    setLoading(true)
    setExpandedFloors(new Set())
    setSubLoading(new Set())
    getPost(id)
      .then(setPost)
      .catch(() => setPost(null))
      .finally(() => setLoading(false))
    refreshReplies()
  }, [id, refreshReplies])

  async function likePost() {
    if (!ensureLogin()) return
    const r = await toggleLikePost(id)
    setPost((p) => (p ? { ...p, liked: r.liked, like_count: Math.max(0, p.like_count + (r.liked ? 1 : -1)) } : p))
  }

  async function favPost() {
    if (!ensureLogin()) return
    const r = await toggleFavorite(id)
    setPost((p) => (p ? { ...p, favorited: r.favorited } : p))
  }

  async function submitReply() {
    const text = replyText.trim()
    if (!text || submitting) return
    if (!ensureLogin()) return
    setSubmitting(true)
    try {
      await createReply(id, text, { parent_id: replyTo?.id, reply_to_id: replyTo?.id, is_anonymous: anonymous })
      setReplyText('')
      setReplyTo(null)
      setAnonymous(false)
      setExpandedFloors(new Set())
      setSubLoading(new Set())
      refreshReplies()
      if (!replyTo) setPost((p) => (p ? { ...p, reply_count: p.reply_count + 1 } : p))
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleFloor(floor: Reply) {
    const fid = floor.id
    if (expandedFloors.has(fid)) {
      setExpandedFloors((prev) => {
        const next = new Set(prev)
        next.delete(fid)
        return next
      })
      return
    }
    if (floor.children && floor.children.length > 0) {
      setExpandedFloors((prev) => new Set(prev).add(fid))
      return
    }
    setSubLoading((prev) => new Set(prev).add(fid))
    try {
      const subs = await getSubReplies(id, floor.floor_no)
      setReplies((prev) => prev.map((f) => (f.id === fid ? { ...f, children: subs } : f)))
      setExpandedFloors((prev) => new Set(prev).add(fid))
    } catch {
      // request 层已 toast
    } finally {
      setSubLoading((prev) => {
        const next = new Set(prev)
        next.delete(fid)
        return next
      })
    }
  }

  function onLikeReply(rid: string) {
    if (!ensureLogin()) return
    toggleLikeReply(rid).then((res) => setReplies((prev) => mapReplyLike(prev, rid, res.liked)))
  }

  function reportPost() {
    if (!ensureLogin()) return
    Alert.alert('举报', '确定举报这篇帖子吗？', [
      { text: '取消', style: 'cancel' },
      { text: '举报', style: 'destructive', onPress: () => report('post', id, '用户举报').then(() => toast('举报已提交')) }
    ])
  }

  function handleDelete() {
    if (!ensureLogin()) return
    Alert.alert('删除帖子', '删除后不可恢复，确定删除？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePost(id)
            router.back()
          } catch {
            // request 层已 toast
          }
        }
      }
    ])
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader title="帖子详情" />
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.brand} size="large" />
        </View>
      </SafeAreaView>
    )
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader title="帖子详情" />
        <View style={styles.loadingBox}>
          <Text style={styles.missing}>帖子不存在或已删除</Text>
        </View>
      </SafeAreaView>
    )
  }

  const authorName = post.is_anonymous ? '匿名用户' : post.author?.nickname || '匿名用户'
  const isMine = post.is_mine || (!!user && post.author_id === user.id)

  const article = (
    <View style={styles.article}>
      <View style={styles.authorRow}>
        <Pressable
          style={styles.authorTap}
          onPress={() => {
            if (!post.is_anonymous && post.author_id) router.push(`/user/${post.author_id}`)
          }}
          disabled={post.is_anonymous || !post.author_id}
        >
          <Avatar name={authorName} src={post.author?.avatar_url} size={36} />
          <View style={styles.authorInfo}>
            <View style={styles.authorNameRow}>
              <Text style={styles.authorName}>{authorName}</Text>
              {!post.is_anonymous && post.author?.is_verified ? <Text style={styles.verified}>✓</Text> : null}
            </View>
            <Text style={styles.time}>{formatTime(post.created_at)}</Text>
          </View>
        </Pressable>
        {post.board_name ? (
          <View style={styles.boardChip}>
            <Text style={styles.boardChipText}>{post.board_name}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.title}>{post.title}</Text>

      {post.tags && post.tags.length > 0 ? (
        <View style={styles.tags}>
          {post.tags.map((t) => (
            <Tag key={t.id} color="brand">
              {t.name}
            </Tag>
          ))}
        </View>
      ) : null}

      {post.content ? <Text style={styles.content}>{post.content}</Text> : null}

      {post.images && post.images.length > 0 ? (
        <View style={styles.images}>
          {post.images.map((img, i) => (
            <Image key={i} source={{ uri: img.url }} style={styles.image} contentFit="cover" transition={150} />
          ))}
        </View>
      ) : null}

      <View style={styles.actionBar}>
        <Pressable style={styles.action} onPress={likePost}>
          <Text style={[styles.actionText, post.liked && styles.actionHot]}>{post.liked ? '❤️' : '🤍'} {formatCount(post.like_count)}</Text>
        </Pressable>
        <Pressable style={styles.action} onPress={favPost}>
          <Text style={[styles.actionText, post.favorited && styles.actionFav]}>{post.favorited ? '🔖' : '🔖'} 收藏</Text>
        </Pressable>
        <Pressable style={styles.action} onPress={reportPost}>
          <Text style={styles.actionText}>举报</Text>
        </Pressable>
        {isMine ? (
          <Pressable style={styles.action} onPress={() => router.push(`/compose?edit=${id}`)}>
            <Text style={styles.actionText}>编辑</Text>
          </Pressable>
        ) : null}
        {isMine ? (
          <Pressable style={styles.action} onPress={handleDelete}>
            <Text style={[styles.actionText, styles.actionDanger]}>删除</Text>
          </Pressable>
        ) : null}
        <Text style={styles.views}>{formatCount(post.view_count)} 浏览</Text>
      </View>
    </View>
  )

  const header = (
    <View>
      {article}
      <Text style={styles.replyHeader}>全部回复（{post.reply_count}）</Text>
      {replyTo ? (
        <View style={styles.replyToBar}>
          <Text style={styles.replyToText}>
            回复 <Text style={styles.replyToName}>@{replyTo.author?.nickname || '匿名用户'}</Text>
          </Text>
          <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
            <Text style={styles.replyToCancel}>取消</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  )

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="帖子详情" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          data={replies}
          keyExtractor={(r) => r.id}
          ListHeaderComponent={header}
          renderItem={({ item: r }) => (
            <ReplyItem
              r={r}
              depth={0}
              subCount={r.sub_count ?? 0}
              expanded={expandedFloors.has(r.id)}
              subLoading={subLoading.has(r.id)}
              onToggle={toggleFloor}
              onReply={(t) => setReplyTo(t)}
              onLike={onLikeReply}
            />
          )}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          refreshing={refreshing}
          onRefresh={refreshReplies}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={<ListFooter loading={loadingReplies} hasMore={hasMore} />}
          ListEmptyComponent={
            !loadingReplies && !refreshing ? <Text style={styles.noReply}>还没有回复，来抢沙发～</Text> : null
          }
        />

        {/* 底部回复输入 */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={replyText}
            onChangeText={setReplyText}
            placeholder="友善发言，理性讨论…"
            placeholderTextColor={colors.ink3}
            multiline
          />
          <Pressable style={styles.anonToggle} onPress={() => setAnonymous((v) => !v)}>
            <View style={[styles.checkbox, anonymous && styles.checkboxOn]}>
              {anonymous ? <Text style={styles.checkmark}>✓</Text> : null}
            </View>
            <Text style={styles.anonText}>匿名</Text>
          </Pressable>
          <Pressable
            style={[styles.sendBtn, submitting && styles.sendBtnDisabled]}
            onPress={submitReply}
            disabled={submitting}
          >
            <Text style={styles.sendBtnText}>{submitting ? '发送中…' : '发送'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function ReplyItem({
  r,
  depth = 0,
  subCount = 0,
  expanded = false,
  subLoading = false,
  onToggle,
  onReply,
  onLike
}: {
  r: Reply
  depth?: number
  subCount?: number
  expanded?: boolean
  subLoading?: boolean
  onToggle?: (r: Reply) => void
  onReply: (r: Reply) => void
  onLike: (rid: string) => void
}) {
  const router = useRouter()
  const name = r.is_anonymous ? '匿名用户' : r.author?.nickname || '匿名用户'
  const openProfile = () => {
    if (r.is_anonymous || !r.author_id) return
    router.push(`/user/${r.author_id}`)
  }
  const canReply = depth < 2
  const isFloor = depth === 0
  const showChildren = !!r.children?.length && (!isFloor || expanded)

  return (
    <View style={[styles.replyItem, !isFloor && styles.replyItemNested]}>
      <View style={styles.replyRow}>
        <Pressable onPress={openProfile} disabled={r.is_anonymous || !r.author_id}>
          <Avatar name={name} src={r.author?.avatar_url} size={isFloor ? 32 : 24} />
        </Pressable>
        <View style={styles.replyBody}>
          <View style={styles.replyNameRow}>
            <Pressable
              onPress={openProfile}
              disabled={r.is_anonymous || !r.author_id}
              hitSlop={4}
              style={styles.replyNameTap}
            >
              <Text style={styles.replyName}>{name}</Text>
              {!r.is_anonymous && r.author?.is_verified ? <Text style={styles.verified}>✓</Text> : null}
            </Pressable>
            <Text style={styles.replyMeta}>#{r.floor_no} 楼 · {formatTime(r.created_at)}</Text>
          </View>
          <Text style={styles.replyContent}>{r.content}</Text>
          <View style={styles.replyActions}>
            <Pressable onPress={() => onLike(r.id)} hitSlop={8}>
              <Text style={[styles.replyAction, r.liked && styles.actionHot]}>赞 {r.like_count}</Text>
            </Pressable>
            {canReply ? (
              <Pressable onPress={() => onReply(r)} hitSlop={8}>
                <Text style={styles.replyAction}>回复</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      {isFloor && subCount > 0 ? (
        <Pressable style={styles.expandBtn} onPress={() => onToggle?.(r)} hitSlop={8}>
          <Text style={styles.expandText}>
            {subLoading ? '加载中…' : expanded ? '收起' : `展开 ${subCount} 条回复`}
          </Text>
        </Pressable>
      ) : null}
      {showChildren && r.children ? (
        <View style={styles.childrenBox}>
          {r.children.map((c) => (
            <ReplyItem key={c.id} r={c} depth={depth + 1} onReply={onReply} onLike={onLike} />
          ))}
        </View>
      ) : null}
    </View>
  )
}

function mapReplyLike(list: Reply[], rid: string, liked: boolean): Reply[] {
  return list.map((r) => ({
    ...r,
    liked: r.id === rid ? liked : r.liked,
    like_count: r.id === rid ? Math.max(0, r.like_count + (liked ? 1 : -1)) : r.like_count,
    children: r.children ? mapReplyLike(r.children, rid, liked) : r.children
  }))
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  missing: {
    color: colors.ink3
  },
  list: {
    paddingBottom: 24
  },
  article: {
    backgroundColor: colors.surface,
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  authorTap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  authorInfo: {
    flex: 1,
    marginLeft: 10
  },
  authorNameRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  authorName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink
  },
  verified: {
    color: colors.brand,
    fontSize: 12,
    marginLeft: 4
  },
  time: {
    marginTop: 2,
    fontSize: 12,
    color: colors.ink3
  },
  boardChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.brandSoft
  },
  boardChipText: {
    fontSize: 13,
    color: colors.brand
  },
  title: {
    marginTop: 14,
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
    lineHeight: 30
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12
  },
  content: {
    marginTop: 14,
    fontSize: 15,
    color: colors.ink,
    lineHeight: 24
  },
  images: {
    marginTop: 12,
    gap: 8
  },
  image: {
    width: '100%',
    height: 220,
    borderRadius: 10,
    backgroundColor: 'rgba(15,23,42,0.04)'
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    gap: 6
  },
  action: {
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  actionText: {
    fontSize: 14,
    color: colors.ink2
  },
  actionHot: {
    color: colors.hot
  },
  actionFav: {
    color: '#d97706'
  },
  actionDanger: {
    color: colors.hot
  },
  views: {
    marginLeft: 'auto',
    fontSize: 13,
    color: colors.ink3
  },
  replyHeader: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4
  },
  replyToBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.brandSoft
  },
  replyToText: {
    fontSize: 13,
    color: colors.ink2
  },
  replyToName: {
    color: colors.brand,
    fontWeight: '600'
  },
  replyToCancel: {
    fontSize: 13,
    color: colors.ink3
  },
  noReply: {
    textAlign: 'center',
    color: colors.ink3,
    fontSize: 14,
    paddingVertical: 40
  },
  replyItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    backgroundColor: colors.surface
  },
  replyItemNested: {
    paddingHorizontal: 0,
    paddingVertical: 8,
    borderBottomWidth: 0,
    backgroundColor: 'transparent'
  },
  replyRow: {
    flexDirection: 'row'
  },
  replyBody: {
    flex: 1,
    marginLeft: 10
  },
  replyNameRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  replyNameTap: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  replyName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink
  },
  replyMeta: {
    marginLeft: 8,
    fontSize: 12,
    color: colors.ink3
  },
  replyContent: {
    marginTop: 6,
    fontSize: 14,
    color: colors.ink,
    lineHeight: 21
  },
  replyActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8
  },
  replyAction: {
    fontSize: 12,
    color: colors.ink3
  },
  expandBtn: {
    marginTop: 8,
    marginLeft: 42
  },
  expandText: {
    fontSize: 12,
    color: colors.brand
  },
  childrenBox: {
    marginTop: 8,
    marginLeft: 12,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: colors.line
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line
  },
  input: {
    flex: 1,
    minHeight: 38,
    maxHeight: 100,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.ink
  },
  anonToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4
  },
  checkboxOn: {
    backgroundColor: colors.brand,
    borderColor: colors.brand
  },
  checkmark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700'
  },
  anonText: {
    fontSize: 12,
    color: colors.ink2
  },
  sendBtn: {
    backgroundColor: colors.brand,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  sendBtnDisabled: {
    opacity: 0.6
  },
  sendBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600'
  }
})
