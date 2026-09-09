import { create } from 'zustand'
import { getMessageUnreadCount } from '../api/messages'

interface MessageState {
  unread: number
  fetchUnread: () => Promise<void>
  setUnread: (n: number) => void
}

export const useMessageStore = create<MessageState>((set) => ({
  unread: 0,

  async fetchUnread() {
    try {
      const { unread_count } = await getMessageUnreadCount()
      set({ unread: unread_count })
    } catch {
      // 未登录或请求失败：静默
    }
  },

  setUnread(n) {
    set({ unread: n })
  }
}))
