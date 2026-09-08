import { request } from './request'
import type { LoginResult, User } from './types'

export function sendEmailCode(email: string) {
  return request<{ ok: boolean }>({
    url: '/api/v1/auth/email/send-code',
    method: 'POST',
    data: { email },
    auth: false
  })
}

export function loginByCode(email: string, code: string) {
  return request<LoginResult>({
    url: '/api/v1/auth/email/login',
    method: 'POST',
    data: { email, code },
    auth: false
  })
}

export function getMe() {
  return request<User>({ url: '/api/v1/users/me' })
}

export function updateMe(data: Partial<Pick<User, 'nickname' | 'avatar_url' | 'college' | 'grade' | 'bio' | 'student_no'>>) {
  return request<User>({ url: '/api/v1/users/me', method: 'PUT', data })
}
