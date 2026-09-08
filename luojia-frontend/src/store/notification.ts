import { create } from 'zustand'
import { getUnreadCount } from '../api/notification'

interface NotificationState {
  unread: number
  fetchUnread: () => Promise<void>
  setUnread: (n: number) => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unread: 0,

  async fetchUnread() {
    try {
      const { unread_count } = await getUnreadCount()
      set({ unread: unread_count })
    } catch {
      // 未登录或请求失败：静默
    }
  },

  setUnread(n) {
    set({ unread: n })
  }
}))
