import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useNotificationStore } from '../../store/notification'
import './index.scss'

export type TabKey = 'home' | 'board' | 'compose' | 'notifications' | 'profile'

interface TabItem {
  key: TabKey
  label: string
  icon: string // 占位字符，正式以线性图标集替换
  path: string
  isFab?: boolean
}

const TABS: TabItem[] = [
  { key: 'home', label: '首页', icon: '⌂', path: '/pages/home/index' },
  { key: 'board', label: '板块', icon: '▤', path: '/pages/board/index' },
  { key: 'compose', label: '发帖', icon: '+', path: '/pages/compose/index', isFab: true },
  { key: 'notifications', label: '通知', icon: '⌁', path: '/pages/notifications/index' },
  { key: 'profile', label: '我的', icon: '◉', path: '/pages/profile/index' }
]

interface TabBarProps {
  active: TabKey
}

// 自定义底部导航（中央凸起发帖 FAB，UI 规范 4.6）
export default function TabBar({ active }: TabBarProps) {
  const unread = useNotificationStore((s) => s.unread)

  const go = (t: TabItem) => {
    if (t.isFab) {
      Taro.navigateTo({ url: t.path })
      return
    }
    if (t.key === active) return
    Taro.redirectTo({ url: t.path })
  }

  return (
    <View className='luo-tabbar'>
      {TABS.map((t) => {
        if (t.isFab) {
          return (
            <View key={t.key} className='luo-tab-item luo-tab-fab' onClick={() => go(t)}>
              <View className='luo-fab'>+</View>
              <Text className='luo-tab-label'>{t.label}</Text>
            </View>
          )
        }
        return (
          <View
            key={t.key}
            className={`luo-tab-item ${t.key === active ? 'on' : ''}`}
            onClick={() => go(t)}
          >
            <Text className='luo-tab-icon'>{t.icon}</Text>
            {t.key === 'notifications' && unread > 0 && <View className='luo-tab-dot' />}
            <Text className='luo-tab-label'>{t.label}</Text>
          </View>
        )
      })}
    </View>
  )
}
