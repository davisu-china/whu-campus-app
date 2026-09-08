import { View, Text } from '@tarojs/components'
import Button from '../Button'
import './index.scss'

interface EmptyStateProps {
  title: string
  desc?: string
  actionText?: string
  onAction?: () => void
}

export default function EmptyState({ title, desc, actionText, onAction }: EmptyStateProps) {
  return (
    <View className='luo-empty'>
      <View className='luo-empty-illus' />
      <Text className='luo-empty-title'>{title}</Text>
      {desc && <Text className='luo-empty-desc'>{desc}</Text>}
      {actionText && (
        <Button onClick={onAction} className='luo-empty-btn'>
          {actionText}
        </Button>
      )}
    </View>
  )
}
