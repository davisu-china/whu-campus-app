import { useEffect } from 'react'
import { Text } from 'react-native'
import type { ColorValue } from 'react-native'
import { Tabs } from 'expo-router'
import { useAuthStore, useMessageStore, useNotificationStore } from '@whu/shared'
import { colors } from '@/constants/theme'

function TabIcon({ emoji, color }: { emoji: string; color: ColorValue }) {
  return <Text style={{ fontSize: 20, color }}>{emoji}</Text>
}

export default function TabsLayout() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const msgUnread = useMessageStore((s) => s.unread)

  useEffect(() => {
    if (!isLoggedIn) return
    const fetch = () => {
      useNotificationStore.getState().fetchUnread()
      useMessageStore.getState().fetchUnread()
    }
    fetch()
    const timer = setInterval(fetch, 5000) // 5s 轮询未读，驱动私信/通知角标
    return () => clearInterval(timer)
  }, [isLoggedIn])

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.ink3,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line }
      }}
    >
      <Tabs.Screen name="index" options={{ title: '首页', tabBarIcon: ({ color }) => <TabIcon emoji="🏠" color={color} /> }} />
      <Tabs.Screen name="boards" options={{ title: '板块', tabBarIcon: ({ color }) => <TabIcon emoji="📚" color={color} /> }} />
      <Tabs.Screen name="services" options={{ title: '服务', tabBarIcon: ({ color }) => <TabIcon emoji="🏫" color={color} /> }} />
      <Tabs.Screen
        name="messages"
        options={{
          title: '私信',
          tabBarBadge: msgUnread > 0 ? msgUnread : undefined,
          tabBarIcon: ({ color }) => <TabIcon emoji="💬" color={color} />
        }}
      />
      <Tabs.Screen name="me" options={{ title: '我的', tabBarIcon: ({ color }) => <TabIcon emoji="👤" color={color} /> }} />
    </Tabs>
  )
}
