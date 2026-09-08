import { View, Input } from '@tarojs/components'
import './index.scss'

interface SearchBarProps {
  value?: string
  placeholder?: string
  readonly?: boolean
  onChange?: (v: string) => void
  onSearch?: () => void
  onFocus?: () => void
}

export default function SearchBar({
  value,
  placeholder = '搜索帖子标题与正文',
  readonly = false,
  onChange,
  onSearch,
  onFocus
}: SearchBarProps) {
  return (
    <View className='luo-search'>
      <View className='luo-search-icon' />
      <Input
        className='luo-search-input'
        value={value}
        placeholder={placeholder}
        placeholderClass='luo-search-ph'
        confirmType='search'
        disabled={readonly}
        onInput={(e) => onChange?.(e.detail.value)}
        onConfirm={() => onSearch?.()}
        onFocus={() => onFocus?.()}
      />
    </View>
  )
}
