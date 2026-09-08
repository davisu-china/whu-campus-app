import Taro from '@tarojs/taro'
import { request } from './request'
import type { PresignResult } from './types'

const IS_MINIAPP = process.env.TARO_ENV === 'weapp'

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
      client: IS_MINIAPP ? 'miniapp' : 'web',
      filename,
      content_type: contentType
    }
  })
}

// 直传文件（双协议），返回 object_key
export async function uploadFile(filePath: string): Promise<string> {
  const name = filePath.split('/').pop() || 'image.jpg'
  const ext = name.split('.').pop()?.toLowerCase() || 'jpg'
  const contentType = extToContentType(ext)

  const presign = await getPresign(name, contentType)

  if (presign.protocol === 'post' && presign.url && presign.fields) {
    // 微信小程序：multipart POST（PostPolicy 表单）
    await Taro.uploadFile({
      url: presign.url,
      filePath,
      name: 'file',
      formData: presign.fields
    })
  } else if (presign.protocol === 'put' && presign.upload_url) {
    // H5：fetch PUT raw body
    if (process.env.TARO_ENV === 'h5') {
      const blob = await (await fetch(filePath)).blob()
      await fetch(presign.upload_url, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': contentType }
      })
    }
  }

  return presign.object_key
}
