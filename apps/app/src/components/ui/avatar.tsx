import { useState } from 'react'
import { Text, View } from 'react-native'
import { Image } from 'expo-image'

const palette = ['#1F8A5B', '#4F46E5', '#D97706', '#0E7490', '#BE185D', '#4338CA']

function hashColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return palette[h % palette.length]
}

// 首字母占位头像；有 src 时用图片，加载失败回退到首字母。
export function Avatar({ name = '?', src, size = 36 }: { name?: string; src?: string; size?: number }) {
  const [err, setErr] = useState(false)
  const showImg = !!src && !err
  const initial = (name.trim().charAt(0) || '?').toUpperCase()

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        backgroundColor: hashColor(name),
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {showImg ? (
        <Image
          source={{ uri: src }}
          style={{ width: size, height: size }}
          contentFit="cover"
          transition={80}
          onError={() => setErr(true)}
        />
      ) : (
        <Text style={{ color: '#fff', fontSize: Math.round(size * 0.42), fontWeight: '600' }}>{initial}</Text>
      )}
    </View>
  )
}
