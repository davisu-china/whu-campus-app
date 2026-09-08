import { View } from '@tarojs/components'
import './index.scss'

export interface SortOption {
  key: string
  label: string
}

interface SortTabsProps {
  options: SortOption[]
  value: string
  onChange: (key: string) => void
}

export default function SortTabs({ options, value, onChange }: SortTabsProps) {
  return (
    <View className='luo-sorttabs'>
      {options.map((o) => (
        <View
          key={o.key}
          className={`luo-sorttab ${o.key === value ? 'on' : ''}`}
          onClick={() => onChange(o.key)}
        >
          {o.label}
        </View>
      ))}
    </View>
  )
}
