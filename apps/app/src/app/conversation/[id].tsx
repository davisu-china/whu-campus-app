import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { formatTime, getMessages, sendMessage, useAuthStore, useMessageStore } from '@whu/shared'
import type { Message } from '@whu/shared'
import { ScreenHeader } from '@/components/screen-header'
import { Avatar } from '@/components/ui/avatar'
import { colors } from '@/constants/theme'

export default function ConversationScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ id: string; to?: string; name?: string; avatar?: string }>()
  const meId = useAuthStore((s) => s.user?.id) || ''
  const meName = useAuthStore((s) => s.user?.nickname) || '我'
  const meAvatar = useAuthStore((s) => s.user?.avatar_url) || ''
  const fetchUnread = useMessageStore((s) => s.fetchUnread)

  const convId = Array.isArray(params.id) ? params.id[0] : params.id
  const toUserId = (Array.isArray(params.to) ? params.to[0] : params.to) || ''
  const peerName = (Array.isArray(params.name) ? params.name[0] : params.name) || '私信'
  const peerAvatar = (Array.isArray(params.avatar) ? params.avatar[0] : params.avatar) || ''
  const isNew = !convId || convId === 'new'

  const [messages, setMessages] = useState<Message[]>([]) // 正序：旧 → 新
  const [loading, setLoading] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<FlatList<Message>>(null)

  const load = useCallback(async () => {
    if (isNew || !convId) return
    setLoading(true)
    try {
      const r = await getMessages(convId, 1)
      // 后端倒序（新→旧），反转成正序展示
      setMessages(r.list.slice().reverse())
    } catch {
      // request 层已 toast
    } finally {
      setLoading(false)
    }
  }, [convId, isNew])

  useEffect(() => {
    if (!isNew) {
      load()
      fetchUnread() // 打开会话即已读，刷新角标
    }
  }, [isNew, load, fetchUnread])

  // 5s 轮询新消息（对方发来的消息实时刷新）
  useEffect(() => {
    if (isNew || !convId) return
    const timer = setInterval(async () => {
      try {
        const r = await getMessages(convId, 1)
        const latest = r.list.slice().reverse() // 后端倒序→正序
        setMessages((prev) => {
          const hasNew =
            latest.length !== prev.length ||
            (latest.length > 0 &&
              prev.length > 0 &&
              latest[latest.length - 1].id !== prev[prev.length - 1].id)
          return hasNew ? latest : prev
        })
        fetchUnread()
      } catch {
        // 忽略单次失败
      }
    }, 5000)
    return () => clearInterval(timer)
  }, [convId, isNew, fetchUnread])

  async function send() {
    const content = input.trim()
    if (!content || sending || !toUserId) return
    setSending(true)
    try {
      const res = await sendMessage(toUserId, content)
      setInput('')
      setMessages((prev) => [...prev, res.message])
      if (isNew) {
        router.replace(`/conversation/${res.conversation_id}?to=${toUserId}&name=${encodeURIComponent(peerName)}&avatar=${encodeURIComponent(peerAvatar)}`)
      }
      fetchUnread()
    } catch {
      // request 层已 toast
    } finally {
      setSending(false)
    }
  }

  function renderItem({ item }: { item: Message }) {
    const mine = item.sender_id === meId
    return (
      <View style={[styles.msgRow, mine ? styles.msgRowMine : styles.msgRowPeer]}>
        {mine ? (
          <Avatar name={meName} src={meAvatar} size={36} />
        ) : (
          <Avatar name={peerName} src={peerAvatar} size={36} />
        )}
        <View style={[styles.msgCol, mine && styles.msgColMine]}>
          <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubblePeer]}>
            <Text style={[styles.msgText, mine && styles.msgTextMine]}>{item.content}</Text>
          </View>
          <Text style={styles.msgTime}>{formatTime(item.created_at)}</Text>
        </View>
      </View>
    )
  }

  const empty = (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyText}>{isNew ? `给 ${peerName} 发第一条私信吧` : '暂无消息'}</Text>
    </View>
  )

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title={peerName} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={!loading ? empty : null}
          ListFooterComponent={loading ? <ActivityIndicator color={colors.brand} style={{ margin: 12 }} /> : null}
        />
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="发送私信…"
            placeholderTextColor={colors.ink3}
            multiline
            maxLength={2000}
          />
          <Pressable
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
            onPress={send}
            disabled={!input.trim() || sending}
          >
            <Text style={styles.sendText}>{sending ? '发送中' : '发送'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg
  },
  list: {
    padding: 16,
    paddingBottom: 24,
    flexGrow: 1
  },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14
  },
  msgRowMine: {
    flexDirection: 'row-reverse'
  },
  msgRowPeer: {
    flexDirection: 'row'
  },
  msgCol: {
    maxWidth: '72%',
    marginHorizontal: 8,
    alignItems: 'flex-start'
  },
  msgColMine: {
    alignItems: 'flex-end'
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  bubbleMine: {
    backgroundColor: colors.brand,
    borderBottomRightRadius: 4
  },
  bubblePeer: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line
  },
  msgText: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.ink
  },
  msgTextMine: {
    color: '#fff'
  },
  msgTime: {
    marginTop: 4,
    fontSize: 11,
    color: colors.ink3
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 120
  },
  emptyText: {
    fontSize: 14,
    color: colors.ink3
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line
  },
  input: {
    flex: 1,
    maxHeight: 120,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 15,
    color: colors.ink
  },
  sendBtn: {
    marginLeft: 10,
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sendBtnDisabled: {
    opacity: 0.5
  },
  sendText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600'
  }
})
