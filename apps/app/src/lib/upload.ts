// 图片上传：expo-file-system 的 File 直传（presign PUT）。
// 后端 presign 协议为 'put'，需以原始字节 PUT 到 upload_url，Content-Type 须与签名一致。
import { File, UploadType } from 'expo-file-system'
import { getPresign } from '@whu/shared'

const EXT_TO_TYPE: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp'
}

function extToContentType(ext: string): string {
  return EXT_TO_TYPE[ext] || 'image/jpeg'
}

export interface UploadedImage {
  key: string // object_key（提交帖子时用）
  uri: string // 本地预览 uri
}

// 从系统相册选多张图片并逐个直传，返回 object_key + 本地预览 uri。
// 任一张上传失败即抛错，由调用方 toast 提示。
export async function pickAndUploadImages(): Promise<UploadedImage[]> {
  const res = await File.pickFileAsync({ mimeTypes: 'image/*', multipleFiles: true })
  if (res.canceled) return []
  if (res.result.length === 0) return []

  const out: UploadedImage[] = []
  for (const file of res.result) {
    const name = file.name || `image_${Date.now()}.jpg`
    const ext = name.split('.').pop()?.toLowerCase() || 'jpg'
    const contentType = extToContentType(ext)

    const presign = await getPresign(name, contentType)
    if (presign.protocol === 'put' && presign.upload_url) {
      const up = await file.upload(presign.upload_url, {
        httpMethod: 'PUT',
        uploadType: UploadType.BINARY_CONTENT,
        headers: { 'Content-Type': contentType }
      })
      if (up.status < 200 || up.status >= 300) {
        throw new Error(`上传失败（${up.status}）`)
      }
    }
    out.push({ key: presign.object_key, uri: file.uri })
  }
  return out
}
