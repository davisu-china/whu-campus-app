import { View, Text, Input } from '@tarojs/components'
import Taro, { useLoad, useRouter } from '@tarojs/taro'
import { useState } from 'react'
import VerifiedBadge from '../../components/VerifiedBadge'
import ImageGrid from '../../components/ImageGrid'
import EmptyState from '../../components/EmptyState'
import { getPost, getReplies, createReply, toggleLikePost, toggleFavorite, report, deletePost } from '../../api/content'
import { useAuth } from '../../hooks/useAuth'
import { parseMentions } from '../../utils/mention'
import { formatTime } from '../../utils/format'
import type { Post, Reply } from '../../api/types'
import './index.scss'

function Floor({ reply }: { reply: Reply }) {
  const tokens = parseMentions(reply.content)
  return (
    <View className='floor'>
      <View className='floor-head'>
        <Text className='floor-no'>#{reply.floor_no}</Text>
        <Text className='floor-author'>{reply.is_anonymous ? '匿名' : reply.author?.nickname}</Text>
        {!reply.is_anonymous && reply.author?.is_verified && <VerifiedBadge />}
        <Text className='floor-time'>{formatTime(reply.created_at)}</Text>
      </View>
      <Text className='floor-content'>
        {tokens.map((t, i) =>
          t.type === 'mention' ? (
            <Text key={i} className='floor-mention'>
              {t.value}
            </Text>
          ) : (
            <Text key={i}>{t.value}</Text>
          )
        )}
      </Text>
      {reply.children && reply.children.length > 0 && (
        <View className='floor-children'>
          {reply.children.map((c) => (
            <Floor key={c.id} reply={c} />
          ))}
        </View>
      )}
    </View>
  )
}

export default function PostDetail() {
  const router = useRouter()
  const postId = router.params.id || ''

  const [post, setPost] = useState<Post | null>(null)
  const [replies, setReplies] = useState<Reply[]>([])
  const [liked, setLiked] = useState(false)
  const [replyText, setReplyText] = useState('')
  const { ensureLogin, user } = useAuth()

  const loadReplies = async () => {
    try {
      setReplies(await getReplies(postId))
    } catch {}
  }

  useLoad(() => {
    getPost(postId).then(setPost).catch(() => {})
    loadReplies()
  })

  const like = async () => {
    if (!ensureLogin()) return
    const next = !liked
    setLiked(next)
    try {
      await toggleLikePost(postId)
    } catch {
      setLiked(!next)
    }
  }

  const favorite = async () => {
    if (!ensureLogin()) return
    try {
      await toggleFavorite(postId)
      Taro.showToast({ title: '已收藏', icon: 'none' })
    } catch {}
  }

  const reportPost = async () => {
    if (!ensureLogin()) return
    try {
      await report('post', postId, '用户举报')
      Taro.showToast({ title: '已举报，感谢反馈', icon: 'none' })
    } catch {}
  }

  const sendReply = async () => {
    if (!replyText.trim()) return
    if (!ensureLogin()) return
    try {
      await createReply(postId, replyText.trim())
      setReplyText('')
      loadReplies()
    } catch {}
  }

  const isAuthor = !!user && !!post?.author_id && user.id === post.author_id

  const editPost = () => {
    Taro.navigateTo({ url: `/pages/compose/index?id=${postId}` })
  }

  const removePost = () => {
    Taro.showModal({
      title: '删除帖子',
      content: '删除后不可恢复，确定删除吗？',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await deletePost(postId)
          Taro.showToast({ title: '已删除', icon: 'none' })
          setTimeout(() => Taro.navigateBack(), 600)
        } catch {}
      }
    })
  }

  if (!post) {
    return (
      <View className='luo-page'>
        <EmptyState title='加载中…' />
      </View>
    )
  }

  return (
    <View className='luo-page'>
      <View className='pd-body luo-page-pad'>
        <Text className='luo-serif pd-title'>{post.title}</Text>
        <View className='pd-meta'>
          <Text className='pd-author'>{post.is_anonymous ? '匿名' : post.author?.nickname}</Text>
          {!post.is_anonymous && post.author?.is_verified && <VerifiedBadge />}
          <Text className='pd-time'>· {formatTime(post.created_at)}</Text>
        </View>
        <Text className='pd-content'>{post.content}</Text>
        {post.images && post.images.length > 0 && <ImageGrid images={post.images.map((i) => i.url)} />}

        <View className='pd-actions'>
          <View className={`pd-action ${liked ? 'liked' : ''}`} onClick={like}>
            ♥ {post.like_count}
          </View>
          <View className='pd-action' onClick={favorite}>
            ☆ 收藏
          </View>
          <View className='pd-action' onClick={reportPost}>
            ⚑ 举报
          </View>
        </View>

        {isAuthor && (
          <View className='pd-actions'>
            <View className='pd-action' onClick={editPost}>
              ✎ 编辑
            </View>
            <View className='pd-action pd-action-danger' onClick={removePost}>
              🗑 删除
            </View>
          </View>
        )}

        <Text className='luo-section-title'>回复 {post.reply_count}</Text>
        {replies.map((r) => (
          <Floor key={r.id} reply={r} />
        ))}
      </View>

      <View className='pd-replybar'>
        <Input
          className='pd-reply-input'
          placeholder='写下你的回复…'
          value={replyText}
          onInput={(e) => setReplyText(e.detail.value)}
        />
        <View className='pd-reply-send' onClick={sendReply}>
          发送
        </View>
      </View>
    </View>
  )
}
