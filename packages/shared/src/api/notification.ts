import { request } from './request'
import type { NotificationItem, PageResult } from './types'

export function getNotifications(page: number) {
  return request<PageResult<NotificationItem>>({
    url: '/api/v1/notifications',
    data: { page }
  })
}

export function getUnreadCount() {
  return request<{ unread_count: number }>({ url: '/api/v1/notifications/unread-count' })
}

export function markRead(ids?: string[]) {
  return request<{ ok: boolean }>({
    url: '/api/v1/notifications/read',
    method: 'POST',
    data: { ids }
  })
}

export function markReadOne(id: string) {
  return request<{ ok: boolean }>({
    url: `/api/v1/notifications/${id}/read`,
    method: 'POST'
  })
}
