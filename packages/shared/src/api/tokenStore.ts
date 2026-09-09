// 令牌存储抽象：Web 用 localStorage，App 用 expo-secure-store。
// 各端在应用启动时调用 setTokenStore() 注入自己的实现。
export interface TokenStore {
  getAccess(): string
  getRefresh(): string
  setAccess(t: string): void
  setRefresh(t: string): void
  clear(): void
}

// 默认内存实现：未注入时可用（不持久化），避免应用启动早期崩溃。
const memoryStore: TokenStore = {
  getAccess: () => '',
  getRefresh: () => '',
  setAccess: () => {},
  setRefresh: () => {},
  clear: () => {}
}

let store: TokenStore = memoryStore

export function setTokenStore(s: TokenStore) {
  store = s
}

export function getTokenStore(): TokenStore {
  return store
}
