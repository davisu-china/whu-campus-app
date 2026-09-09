import type { ApiResp } from './types'
import { getTokenStore } from './tokenStore'
import { toast } from '../store/toast'

// API 基址：Web 生产同源部署留空；App 端连接远程服务器需在启动时 setApiBase() 注入完整域名。
let apiBase = ''
export function setApiBase(base: string) {
  apiBase = base.replace(/\/+$/, '')
}
export function getApiBase() {
  return apiBase
}

// 业务错误码（与后端 pkg/xerr 对齐）
export const CODE = {
  OK: 0,
  TOKEN_EXPIRED: 20002,
  UNAUTHORIZED: 20001,
  FORBIDDEN: 20006,
  NOT_VERIFIED: 20008,
  BANNED: 20007,
  NOT_FOUND: 10002,
  RATE_LIMITED: 10004
} as const

export class ApiError extends Error {
  code: number
  constructor(code: number, message: string) {
    super(message)
    this.code = code
  }
}

// 未授权处理器（由 auth store 注册，避免 request → store 循环依赖）
type UnauthorizedHandler = () => void
let onUnauthorized: UnauthorizedHandler | null = null
export function setUnauthorizedHandler(h: UnauthorizedHandler) {
  onUnauthorized = h
}

let refreshing: Promise<string> | null = null

async function doRefresh(): Promise<string> {
  const store = getTokenStore()
  const refresh_token = store.getRefresh()
  if (!refresh_token) throw new ApiError(CODE.UNAUTHORIZED, '未登录')
  const resp = await fetch(`${apiBase}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token })
  })
  const body = (await resp.json()) as ApiResp<{ access_token: string; refresh_token?: string }>
  if (body.code !== CODE.OK) throw new ApiError(body.code, body.message)
  store.setAccess(body.data.access_token)
  if (body.data.refresh_token) store.setRefresh(body.data.refresh_token)
  return body.data.access_token
}

function refreshAccess(): Promise<string> {
  if (!refreshing) {
    refreshing = doRefresh().finally(() => {
      refreshing = null
    })
  }
  return refreshing
}

interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: any
  auth?: boolean
  silent?: boolean
}

export async function request<T>(opt: RequestOptions): Promise<T> {
  const { url, method = 'GET', data, auth = true, silent = false } = opt
  const header: Record<string, string> = {}

  if (auth) {
    const access = getTokenStore().getAccess()
    if (access) header.Authorization = `Bearer ${access}`
  }

  const doCall = async () => {
    let finalUrl = `${apiBase}${url}`
    if (method === 'GET' && data) {
      const qs = Object.entries(data)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
      if (qs) finalUrl += (url.includes('?') ? '&' : '?') + qs
    }
    const resp = await fetch(finalUrl, {
      method,
      headers: { 'Content-Type': 'application/json', ...header },
      body: method === 'GET' ? undefined : JSON.stringify(data ?? {})
    })
    return resp.json() as Promise<ApiResp<T>>
  }

  let body = await doCall()

  // 未授权/过期 → 有 refresh 则刷新后重放一次
  if (body.code === CODE.TOKEN_EXPIRED || body.code === CODE.UNAUTHORIZED) {
    if (getTokenStore().getRefresh()) {
      try {
        const access = await refreshAccess()
        header.Authorization = `Bearer ${access}`
        body = await doCall()
      } catch (e) {
        getTokenStore().clear()
        onUnauthorized?.()
        throw e
      }
    }
  }

  if (body.code === CODE.OK) return body.data

  if (!silent) {
    toast(body.message || '请求失败')
  }
  throw new ApiError(body.code, body.message)
}
