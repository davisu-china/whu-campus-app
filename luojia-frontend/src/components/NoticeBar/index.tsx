import { View, Text } from '@tarojs/components'
import type { ReactNode } from 'react'
import './index.scss'

interface NoticeBarProps {
  children: ReactNode
}

export default function NoticeBar({ children }: NoticeBarProps) {
  return (
    <View className='luo-notice'>
      <View className='luo-notice-dot' />
      <Text className='luo-notice-text'>{children}</Text>
    </View>
  )
}
