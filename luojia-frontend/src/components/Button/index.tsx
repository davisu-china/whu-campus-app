import { View } from '@tarojs/components'
import type { ReactNode } from 'react'
import './index.scss'

export interface ButtonProps {
  children: ReactNode
  type?: 'primary' | 'secondary' | 'ghost' | 'danger'
  disabled?: boolean
  onClick?: () => void
  className?: string
}

export default function Button({
  children,
  type = 'primary',
  disabled = false,
  onClick,
  className = ''
}: ButtonProps) {
  const cls = `luo-btn luo-btn-${type} ${disabled ? 'is-disabled' : ''} ${className}`.trim()
  return (
    <View className={cls} onClick={disabled ? undefined : onClick}>
      {children}
    </View>
  )
}
