import { View, Text } from '@tarojs/components'
import Taro, { useLoad, usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import TabBar from '../../components/TabBar'
import EmptyState from '../../components/EmptyState'
import { getNotifications, markRead } from '../../api/notification'
import { usePaginatedList } from '../../hooks/usePaginatedList'
import { useNotificationStore } from '../../store/notification'
import { NOTIFICATION_TYPE_LABEL } from '../../constants/enums'
import { formatTime } from '../../utils/format'
import type { NotificationItem } from '../../api/types'
import './index.scss'

export default function Notifications() {
  const { list, refresh, loadMore, hasMore, onReachBottom } = usePaginatedList<NotificationItem>(
    (page) => getNotifications(page).then((d) => ({ list: d.list, hasMore: d.has_more }))
  )

  useLoad(() => {
    refresh()
    // 进入即标记已读、清红点
    markRead().catch(() => {})
    useNotificationStore.getState().setUnread(0)
  })

  usePullDownRefresh(() => {
    refresh().finally(() => Taro.stopPullDownRefresh())
  })
  useReachBottom(onReachBottom)

  return (
    <View className='luo-page'>
      <View className='luo-page-pad'>
        {list.length === 0 ? (
          <EmptyState title='暂无通知' />
        ) : (
          list.map((n) => (
            <View key={n.id} className={`notif ${!n.is_read ? 'unread' : ''}`}>
              <Text className='notif-type'>{NOTIFICATION_TYPE_LABEL[n.type] || n.type}</Text>
              <View className='notif-main'>
                <Text className='notif-title'>{n.title}</Text>
                <Text className='notif-content'>{n.content}</Text>
                <Text className='notif-time'>{formatTime(n.created_at)}</Text>
              </View>
            </View>
          ))
        )}
        {hasMore && (
          <View className='notif-loadmore' onClick={loadMore}>
            加载更多
          </View>
        )}
      </View>
      <TabBar active='notifications' />
    </View>
  )
}
