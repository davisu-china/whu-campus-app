import { create } from 'zustand'

interface ToastState {
  message: string
  show: (msg: string) => void
  clear: () => void
}

export const useToastStore = create<ToastState>((set) => ({
  message: '',
  show: (msg) => set({ message: msg }),
  clear: () => set({ message: '' })
}))

// 供 request 层 / hooks 使用的命令式入口
export function toast(msg: string) {
  useToastStore.getState().show(msg)
}
