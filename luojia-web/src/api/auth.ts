import { request } from './request'
import type { LoginResult, User } from './types'

export type CodeScene = 'register' | 'reset' | 'login'

export function sendEmailCode(email: string, scene: CodeScene = 'login') {
  return request<{ ok: boolean }>({
    url: '/api/v1/auth/email/send-code',
    method: 'POST',
    data: { email, scene },
    auth: false
  })
}

export function register(email: string, code: string, password: string) {
  return request<LoginResult>({
    url: '/api/v1/auth/register',
    method: 'POST',
    data: { email, code, password },
    auth: false
  })
}

export function login(email: string, password: string) {
  return request<LoginResult>({
    url: '/api/v1/auth/login',
    method: 'POST',
    data: { email, password },
    auth: false
  })
}

// 修改/设置密码（需登录态）。尚未设置过密码的账号 oldPassword 可传空。
export function changePassword(oldPassword: string, newPassword: string) {
  return request<{ ok: boolean }>({
    url: '/api/v1/auth/change-password',
    method: 'POST',
    data: { old_password: oldPassword, new_password: newPassword }
  })
}

export function resetPassword(email: string, code: string, password: string) {
  return request<{ ok: boolean }>({
    url: '/api/v1/auth/reset-password',
    method: 'POST',
    data: { email, code, password },
    auth: false
  })
}

export function getMe() {
  return request<User>({ url: '/api/v1/users/me' })
}

export function updateMe(
  data: Partial<Pick<User, 'nickname' | 'avatar_url' | 'college' | 'grade' | 'identity' | 'degree' | 'bio' | 'student_no'>>
) {
  return request<User>({ url: '/api/v1/users/me', method: 'PUT', data })
}
