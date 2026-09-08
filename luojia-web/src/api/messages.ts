import { request } from './request'
import type { ConversationItem, Message, PageResult } from './types'

export function getConversations(page: number) {
  return request<PageResult<ConversationItem>>({
    url: '/api/v1/messages/conversations',
    data: { page }
  })
}

export function getMessages(conversationId: string, page: number) {
  return request<PageResult<Message>>({
    url: `/api/v1/messages/conversations/${conversationId}/messages`,
    data: { page }
  })
}

export function sendMessage(toUserId: string, content: string) {
  return request<{ conversation_id: string; message: Message }>({
    url: '/api/v1/messages',
    method: 'POST',
    data: { to_user_id: toUserId, content }
  })
}

export function getUnreadCount() {
  return request<{ unread_count: number }>({ url: '/api/v1/messages/unread-count' })
}
