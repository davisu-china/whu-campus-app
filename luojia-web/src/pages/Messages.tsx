import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getConversations, getMessages, sendMessage } from '../api/messages'
import { getUser } from '../api/user'
import type { ConversationItem, Message, User } from '../api/types'
import { useAuthStore } from '../store/auth'
import { useMessageStore } from '../store/message'
import { usePaginatedList } from '../hooks/usePaginatedList'
import { Avatar } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Spinner } from '../components/ui/Spinner'
import { formatTime } from '../utils/format'
import { cn } from '../utils/cn'

export default function Messages() {
  const user = useAuthStore((s) => s.user)
  const fetchMsgUnread = useMessageStore((s) => s.fetchUnread)
  const [params] = useSearchParams()
  const toUserId = params.get('to') || ''

  const [activeConvId, setActiveConvId] = useState('')
  const [toUser, setToUser] = useState<User | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // 会话列表
  const { list: convs, loading, hasMore, refresh, loadMore } = usePaginatedList((page) =>
    getConversations(page).then((r) => ({ list: r.list, hasMore: r.has_more }))
  )

  const activeConv: ConversationItem | null = convs.find((c) => c.id === activeConvId) || null

  useEffect(() => {
    refresh()
  }, [refresh])

  // ?to= 目标用户（发起新私信）
  useEffect(() => {
    if (!toUserId || toUserId === user?.id) {
      setToUser(null)
      return
    }
    getUser(toUserId).then(setToUser).catch(() => setToUser(null))
  }, [toUserId, user?.id])

  async function loadMessages(convId: string) {
    try {
      const r = await getMessages(convId, 1)
      setMessages([...r.list].reverse()) // 后端倒序返回 → 反转成正序
      fetchMsgUnread()
    } catch {
      // 静默
    }
  }

  // 打开会话即加载，之后每 5s 轮询
  useEffect(() => {
    if (!activeConvId) return
    loadMessages(activeConvId)
    const timer = setInterval(() => loadMessages(activeConvId), 5000)
    return () => clearInterval(timer)
  }, [activeConvId])

  // 新消息自动滚到底部
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  async function handleSend() {
    const content = draft.trim()
    if (!content || sending) return
    const targetId = activeConv?.other_user?.id || toUserId
    if (!targetId) return
    setSending(true)
    try {
      const r = await sendMessage(targetId, content)
      setDraft('')
      setActiveConvId(r.conversation_id)
      await loadMessages(r.conversation_id)
      refresh()
    } finally {
      setSending(false)
    }
  }

  if (!user) {
    return (
      <EmptyState
        title="请先登录"
        action={
          <Link to="/login">
            <Button>去登录</Button>
          </Link>
        }
      />
    )
  }

  const openChat = !!activeConvId || !!toUser
  const chatName = activeConv?.other_user?.nickname || toUser?.nickname || '私信'
  const chatAvatar = activeConv?.other_user?.avatar_url || toUser?.avatar_url || ''

  return (
    <div className="flex h-[calc(100vh-7rem)] rounded-xl border border-line/60 bg-surface overflow-hidden">
      {/* 左栏：会话列表 */}
      <div className={cn('w-full md:w-80 md:flex flex-col border-r border-line/60 shrink-0', openChat ? 'hidden md:flex' : 'flex')}>
        <div className="px-4 py-3 border-b border-line/60">
          <h1 className="text-base font-bold text-ink">私信</h1>
        </div>
        <div className="flex-1 overflow-y-auto">
          {convs.length === 0 && !loading ? (
            <p className="text-center text-ink-3 text-sm py-12">暂无会话</p>
          ) : (
            convs.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveConvId(c.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-black/[0.04]',
                  c.id === activeConvId && 'bg-brand-soft/50'
                )}
              >
                <Avatar name={c.other_user?.nickname} src={c.other_user?.avatar_url} size={40} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-ink truncate">{c.other_user?.nickname || '用户'}</span>
                    <span className="text-[11px] text-ink-3 shrink-0">{formatTime(c.last_message_at)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-[13px] text-ink-3 truncate">{c.last_message || '…'}</span>
                    {c.unread_count > 0 && <Badge count={c.unread_count} />}
                  </div>
                </div>
              </button>
            ))
          )}
          {loading && (
            <div className="flex justify-center py-8">
              <Spinner className="text-brand" />
            </div>
          )}
          {hasMore && !loading && (
            <button onClick={loadMore} className="w-full py-2 text-[13px] text-ink-3 hover:text-brand">
              加载更多
            </button>
          )}
        </div>
      </div>

      {/* 右栏：聊天窗 / 发起框 / 空态 */}
      <div className={cn('flex-1 flex-col min-w-0', openChat ? 'flex' : 'hidden md:flex')}>
        {openChat ? (
          <>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-line/60">
              <button
                className="md:hidden text-ink-3 hover:text-ink -ml-1 px-1"
                onClick={() => setActiveConvId('')}
                aria-label="返回"
              >
                ←
              </button>
              <Avatar name={chatName} src={chatAvatar} size={34} />
              <span className="text-sm font-medium text-ink truncate">{chatName}</span>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
              {messages.length === 0 ? (
                <p className="text-center text-ink-3 text-sm py-12">打个招呼开始聊天吧</p>
              ) : (
                messages.map((m) => {
                  const mine = m.sender_id === user.id
                  return (
                    <div key={m.id} className={cn('flex items-end gap-2', mine ? 'justify-end' : 'justify-start')}>
                      {!mine && <Avatar name={chatName} src={chatAvatar} size={28} />}
                      <div
                        className={cn(
                          'max-w-[72%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words',
                          mine ? 'bg-brand text-white' : 'bg-black/[0.05] text-ink'
                        )}
                      >
                        {m.content}
                      </div>
                      {mine && <Avatar name={user.nickname} src={user.avatar_url} size={28} />}
                    </div>
                  )
                })
              )}
            </div>

            <div className="border-t border-line/60 p-3 flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="输入消息，回车发送…"
                className="flex-1 h-10 rounded-lg border border-line bg-bg px-3 text-sm text-ink placeholder:text-ink-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-all"
              />
              <Button onClick={handleSend} loading={sending}>
                发送
              </Button>
            </div>
          </>
        ) : (
          <EmptyState title="选择一个会话开始聊天" desc="或在他人主页点击「私信」发起对话" />
        )}
      </div>
    </div>
  )
}
