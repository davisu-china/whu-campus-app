import { useEffect, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  SORT_OPTIONS,
  TIME_RANGE_OPTIONS,
  searchPosts,
  useCategoryStore,
  usePaginatedList
} from '@whu/shared'
import { BoardSelect } from '@/components/board-select'
import { PillSelect } from '@/components/ui/pill-select'
import { PostCard } from '@/components/post-card'
import { ListFooter } from '@/components/list-footer'
import { EmptyState } from '@/components/ui/empty-state'
import { useSearchHistory } from '@/hooks/use-search-history'
import { colors } from '@/constants/theme'

export default function SearchScreen() {
  const router = useRouter()
  const [kw, setKw] = useState('')
  const [q, setQ] = useState('')
  const [boardId, setBoardId] = useState('')
  const [timeRange, setTimeRange] = useState('')
  const [sort, setSort] = useState('')
  const [hasImage, setHasImage] = useState(false)
  const [total, setTotal] = useState(0)
  const loadCategories = useCategoryStore((s) => s.load)
  const { history, add, clear } = useSearchHistory()

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  // 关键词 / 板块 / 时间 / 带图 任一存在即算一次检索（全站按时间或带图浏览同样合法）
  const hasQuery = !!q.trim() || !!boardId || !!timeRange || hasImage

  const { list, setList, loading, refreshing, hasMore, refresh, loadMore } = usePaginatedList((page) =>
    searchPosts(q, {
      board_id: boardId || undefined,
      time_range: timeRange || undefined,
      sort: sort || undefined,
      has_image: hasImage || undefined,
      page
    }).then((r) => {
      setTotal(r.total ?? r.list.length)
      return { list: r.list, hasMore: r.has_more }
    })
  )

  useEffect(() => {
    if (q.trim() || boardId || timeRange || hasImage) {
      refresh() // 条件变化 → 重置到第一页
    } else {
      setList([]) // 无检索条件 → 清空旧结果
      setTotal(0)
    }
  }, [q, boardId, timeRange, sort, hasImage, refresh, setList])

  // 提交检索：非空关键词记入本地历史
  function runSearch(term: string) {
    const t = term.trim()
    if (t) add(t)
    setQ(t)
    setKw(term)
  }

  function submit() {
    runSearch(kw)
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* 顶栏：返回 + 搜索输入框 + 搜索 */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <TextInput
          style={styles.input}
          value={kw}
          onChangeText={setKw}
          placeholder="搜索帖子标题或内容…"
          placeholderTextColor={colors.ink3}
          returnKeyType="search"
          onSubmitEditing={submit}
          autoFocus
        />
        <Pressable style={styles.searchBtn} onPress={submit} hitSlop={8}>
          <Text style={styles.searchBtnText}>搜索</Text>
        </Pressable>
      </View>

      {/* 筛选条：板块 / 时间 / 排序 / 带图，任一条件即可单独发起检索 */}
      <View style={styles.filterRow}>
        <BoardSelect compact value={boardId} onChange={setBoardId} allowAll />
        <PillSelect
          title="时间范围"
          value={timeRange}
          options={TIME_RANGE_OPTIONS}
          onChange={setTimeRange}
        />
        <PillSelect
          title="排序方式"
          value={sort}
          options={SORT_OPTIONS}
          onChange={setSort}
          fallbackLabel="综合"
        />
        <Pressable
          onPress={() => setHasImage((v) => !v)}
          style={[styles.chip, hasImage && styles.chipActive]}
        >
          <Text style={[styles.chipText, hasImage && styles.chipTextActive]}>带图</Text>
        </Pressable>
      </View>

      {hasQuery && !refreshing ? <Text style={styles.count}>共 {total} 条结果</Text> : null}

      <FlatList
        data={list}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PostCard post={item} />}
        contentContainerStyle={styles.list}
        refreshing={refreshing}
        onRefresh={refresh}
        onEndReached={() => {
          if (hasQuery) loadMore()
        }}
        onEndReachedThreshold={0.3}
        keyboardShouldPersistTaps="handled"
        ListFooterComponent={<ListFooter loading={loading} hasMore={hasMore} />}
        ListEmptyComponent={
          !loading ? (
            !hasQuery ? (
              history.length === 0 ? (
                <EmptyState title="搜索你想了解的内容" desc="支持帖子标题与内容关键词，可按板块、时间过滤" />
              ) : (
                <View style={styles.panels}>
                  <View style={styles.panel}>
                    <View style={styles.panelHead}>
                      <Text style={styles.panelTitle}>搜索历史</Text>
                      <Pressable onPress={clear} hitSlop={8}>
                        <Text style={styles.clear}>清空</Text>
                      </Pressable>
                    </View>
                    <View style={styles.chips}>
                      {history.map((term) => (
                        <Pressable key={term} style={styles.termChip} onPress={() => runSearch(term)}>
                          <Text style={styles.termChipText}>{term}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>
              )
            ) : (
              <EmptyState
                title={q.trim() ? `未找到与「${q}」相关的内容` : '没有符合筛选条件的内容'}
                desc="试试换个关键词、板块，或放宽时间范围"
              />
            )
          ) : null
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  backIcon: {
    fontSize: 30,
    lineHeight: 32,
    color: colors.ink,
    fontWeight: '300'
  },
  input: {
    flex: 1,
    height: 40,
    borderRadius: 999,
    backgroundColor: colors.bg,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.ink
  },
  searchBtn: {
    marginLeft: 8,
    paddingHorizontal: 8,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  searchBtnText: {
    color: colors.brand,
    fontSize: 15,
    fontWeight: '600'
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 4
  },
  chip: {
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    justifyContent: 'center'
  },
  chipActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft
  },
  chipText: {
    fontSize: 13,
    color: colors.ink2
  },
  chipTextActive: {
    color: colors.brandStrong,
    fontWeight: '600'
  },
  panels: {
    paddingTop: 8,
    gap: 28
  },
  panel: {
    gap: 12
  },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  panelTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink2
  },
  clear: {
    fontSize: 12,
    color: colors.ink3
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  termChip: {
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    justifyContent: 'center'
  },
  termChipText: {
    fontSize: 13,
    color: colors.ink2
  },
  count: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    fontSize: 12,
    color: colors.ink3
  },
  list: {
    paddingHorizontal: 12,
    paddingBottom: 24
  }
})
