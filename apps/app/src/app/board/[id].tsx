import { useEffect, useState } from 'react'
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams } from 'expo-router'
import { SORT_OPTIONS, getBoard, getBoardHotTags, getBoardPosts, usePaginatedList } from '@whu/shared'
import type { Board, HotTag, SortType } from '@whu/shared'
import { ScreenHeader } from '@/components/screen-header'
import { PostCard } from '@/components/post-card'
import { ListFooter } from '@/components/list-footer'
import { EmptyState } from '@/components/ui/empty-state'
import { colors } from '@/constants/theme'

export default function BoardScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>()
  const [board, setBoard] = useState<Board | null>(null)
  const [hotTags, setHotTags] = useState<HotTag[]>([])
  const [sort, setSort] = useState<SortType>('comprehensive')
  const [tagId, setTagId] = useState('')

  const { list, loading, refreshing, hasMore, refresh, loadMore } = usePaginatedList((page) =>
    getBoardPosts(id, { page, page_size: 20, sort, tag_id: tagId || undefined }).then((r) => ({
      list: r.list,
      hasMore: r.has_more
    }))
  )

  useEffect(() => {
    getBoard(id)
      .then(setBoard)
      .catch(() => setBoard(null))
  }, [id])

  useEffect(() => {
    getBoardHotTags(id, 12)
      .then((x) => setHotTags(Array.isArray(x) ? x : []))
      .catch(() => setHotTags([]))
  }, [id])

  useEffect(() => {
    refresh()
  }, [id, sort, tagId, refresh])

  const header = (
    <View style={styles.headerBox}>
      {board?.description ? <Text style={styles.desc}>{board.description}</Text> : null}

      <View style={styles.sortRow}>
        {SORT_OPTIONS.map((s) => (
          <Pressable
            key={s.key}
            onPress={() => setSort(s.key)}
            style={[styles.sortBtn, sort === s.key && styles.sortBtnActive]}
          >
            <Text style={[styles.sortText, sort === s.key && styles.sortTextActive]}>{s.label}</Text>
          </Pressable>
        ))}
      </View>

      {hotTags.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagsRow}>
          <Pressable
            onPress={() => setTagId('')}
            style={[styles.tagBtn, tagId === '' && styles.tagBtnActive]}
          >
            <Text style={[styles.tagText, tagId === '' && styles.tagTextActive]}>全部</Text>
          </Pressable>
          {hotTags.map((t) => (
            <Pressable
              key={t.tag_id}
              onPress={() => setTagId(t.tag_id)}
              style={[styles.tagBtn, tagId === t.tag_id && styles.tagBtnActive]}
            >
              <Text style={[styles.tagText, tagId === t.tag_id && styles.tagTextActive]}>
                {t.name} <Text style={styles.tagCount}>{t.post_count}</Text>
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  )

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title={board?.name || '板块'} />
      <FlatList
        data={list}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={header}
        renderItem={({ item }) => <PostCard post={item} />}
        contentContainerStyle={styles.list}
        refreshing={refreshing}
        onRefresh={refresh}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={<ListFooter loading={loading} hasMore={hasMore} />}
        ListEmptyComponent={
          !loading ? <EmptyState title="该板块暂无帖子" desc="换个标签或排序试试，或来发第一帖" /> : null
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg
  },
  headerBox: {
    paddingBottom: 4
  },
  desc: {
    fontSize: 13,
    color: colors.ink3,
    paddingHorizontal: 4,
    paddingBottom: 8
  },
  sortRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: 4,
    marginBottom: 10
  },
  sortBtn: {
    flex: 1,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8
  },
  sortBtnActive: {
    backgroundColor: colors.brand
  },
  sortText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.ink2
  },
  sortTextActive: {
    color: '#fff'
  },
  tagsRow: {
    paddingBottom: 10,
    gap: 8
  },
  tagBtn: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    justifyContent: 'center'
  },
  tagBtnActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand
  },
  tagText: {
    fontSize: 13,
    color: colors.ink2
  },
  tagTextActive: {
    color: '#fff'
  },
  tagCount: {
    fontSize: 11,
    opacity: 0.7
  },
  list: {
    paddingHorizontal: 12,
    paddingBottom: 24
  }
})
