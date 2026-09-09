import * as SecureStore from 'expo-secure-store'
import type { TokenStore } from '@whu/shared'

const ACCESS_KEY = 'whu_access_token'
const REFRESH_KEY = 'whu_refresh_token'

// SecureStore 同步 API 在 iOS/Android 可用（Android 上读取不存在的 key 会抛异常，故 try-catch）。
// 说明：令牌走加密存储，不落 AsyncStorage；后续可迁移到异步 API 以消除 Android 同步读取告警。
function safeGet(key: string): string {
  try {
    return SecureStore.getItem(key) ?? ''
  } catch {
    return ''
  }
}

export const secureStoreTokenStore: TokenStore = {
  getAccess: () => safeGet(ACCESS_KEY),
  getRefresh: () => safeGet(REFRESH_KEY),
  setAccess: (t) => {
    SecureStore.setItem(ACCESS_KEY, t)
  },
  setRefresh: (t) => {
    SecureStore.setItem(REFRESH_KEY, t)
  },
  clear: () => {
    // 同步 API 无 deleteItem，改用异步删除（fire-and-forget）；清除后令牌不再被读取，无需等待。
    SecureStore.deleteItemAsync(ACCESS_KEY).catch(() => {})
    SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => {})
  }
}
