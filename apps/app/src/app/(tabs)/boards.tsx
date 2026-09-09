import { useEffect } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useCategoryStore } from '@whu/shared'
import type { Board } from '@whu/shared'
import { useVisibleCategories } from '@/hooks/use-visible-categories'
import { EmptyState } from '@/components/ui/empty-state'
import { boardIcon } from '@/constants/board-icons'
import { cardShadow, colors } from '@/constants/theme'

function BoardRow({ board, onPress }: { board: Board; onPress: () => void }) {
  return (
    <Pressable style={styles.boardRow} onPress={onPress}>
      <View style={styles.boardIcon}>
        <Text style={styles.boardIconText}>{boardIcon(board.slug)}</Text>
      </View>
      <View style={styles.boardInfo}>
        <Text style={styles.boardName}>{board.name}</Text>
        {board.description ? (
          <Text style={styles.boardDesc} numberOfLines={1}>
            {board.description}
          </Text>
        ) : null}
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  )
}

export default function BoardsScreen() {
  const router = useRouter()
  const categories = useVisibleCategories()
  const loaded = useCategoryStore((s) => s.loaded)
  const load = useCategoryStore((s) => s.load)

  useEffect(() => {
    load()
  }, [load])

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>板块</Text>
      <FlatList
        data={categories}
        keyExtractor={(c) => c.id}
        renderItem={({ item: c }) => (
          <View style={styles.section}>
            <Text style={styles.catHeader}>{c.name}</Text>
            {c.boards.map((b) => (
              <BoardRow key={b.id} board={b} onPress={() => router.push(`/board/${b.id}`)} />
            ))}
          </View>
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={loaded ? <EmptyState title="暂无板块" /> : null}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.ink,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  list: {
    paddingHorizontal: 12,
    paddingBottom: 24
  },
  section: {
    marginBottom: 4
  },
  catHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink3,
    paddingHorizontal: 4,
    paddingTop: 12,
    paddingBottom: 8
  },
  boardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: 12,
    marginBottom: 8,
    ...cardShadow
  },
  boardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center'
  },
  boardIconText: {
    fontSize: 20
  },
  boardInfo: {
    flex: 1,
    marginLeft: 12
  },
  boardName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink
  },
  boardDesc: {
    marginTop: 2,
    fontSize: 13,
    color: colors.ink3
  },
  chevron: {
    fontSize: 22,
    color: colors.ink3,
    marginLeft: 8
  }
})
