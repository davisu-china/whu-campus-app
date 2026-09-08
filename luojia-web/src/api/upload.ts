import { request } from './request'
import type { PresignResult } from './types'

function extToContentType(ext: string): string {
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp'
  }
  return map[ext] || 'image/jpeg'
}

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

// Web 端直传（PUT raw body），返回 object_key
export async function uploadImage(file: File): Promise<string> {
  const name = file.name || 'image.jpg'
  const ext = name.split('.').pop()?.toLowerCase() || 'jpg'
  const contentType = file.type || extToContentType(ext)

  const presign = await getPresign(name, contentType)

  if (presign.protocol === 'put' && presign.upload_url) {
    await fetch(presign.upload_url, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': contentType }
    })
  }

  return presign.object_key
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

// 头像直传（PUT），返回公开访问 URL
export async function uploadAvatar(file: File): Promise<string> {
  const name = file.name || 'avatar.jpg'
  const ext = name.split('.').pop()?.toLowerCase() || 'jpg'
  const contentType = file.type || extToContentType(ext)

  const presign = await getAvatarPresign(name, contentType)

  if (presign.protocol === 'put' && presign.upload_url) {
    await fetch(presign.upload_url, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': contentType }
    })
  }

  return presign.public_url || ''
}
