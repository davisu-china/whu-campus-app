import { useState } from 'react'
import { cn } from '../../utils/cn'

interface AvatarProps {
  name?: string
  src?: string
  size?: number
  className?: string
  onClick?: () => void
}

// 首字母占位头像；颜色按名字哈希取稳定色
const palette = ['#1F8A5B', '#4F46E5', '#D97706', '#0E7490', '#BE185D', '#4338CA']

function hashColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return palette[h % palette.length]
}

export function Avatar({ name = '?', src, size = 40, className, onClick }: AvatarProps) {
  const [err, setErr] = useState(false)
  const showImg = src && !err
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) }

  return (
    <div
      onClick={onClick}
      style={style}
      className={cn(
        'relative inline-flex items-center justify-center rounded-full overflow-hidden shrink-0',
        'font-medium text-white select-none',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {showImg ? (
        <img src={src} alt={name} onError={() => setErr(true)} className="w-full h-full object-cover" />
      ) : (
        <span style={{ background: hashColor(name) }} className="w-full h-full flex items-center justify-center">
          {initial}
        </span>
      )}
    </div>
  )
}
