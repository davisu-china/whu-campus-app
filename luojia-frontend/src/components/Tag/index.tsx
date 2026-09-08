import { View } from '@tarojs/components'
import type { ReactNode } from 'react'
import './index.scss'

export interface TagProps {
  children: ReactNode
  variant?: 'tag' | 'strong' | 'filter' | 'filter-on'
  onClick?: () => void
  className?: string
}

export default function Tag({ children, variant = 'tag', onClick, className = '' }: TagProps) {
  const cls = `luo-tag luo-tag-${variant} ${className}`.trim()
  return (
    <View className={cls} onClick={onClick}>
      {children}
    </View>
  )
}
