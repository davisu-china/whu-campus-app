import { request } from './request'
import type { PresignResult } from './types'

// 仅保留预签名（纯 request）。直传逻辑由各端自行实现：
// Web 用 File 对象，App 用 expo-image-picker 的 uri 转 Blob 后 fetch PUT。
export function getPresign(filename: string, contentType: string) {
  return request<PresignResult>({
    url: '/api/v1/upload/presign',
    method: 'POST',
    data: {
      client: 'web',
      filename,
      content_type: contentType
    }
  })
}

// 头像预签名（purpose=avatar，走 avatars 桶）
export function getAvatarPresign(filename: string, contentType: string) {
  return request<PresignResult>({
    url: '/api/v1/upload/presign',
    method: 'POST',
    data: {
      client: 'web',
      purpose: 'avatar',
      filename,
      content_type: contentType
    }
  })
}
