import { useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useVisibleCategories } from '@/hooks/use-visible-categories'
import { colors } from '@/constants/theme'

interface BoardSelectProps {
  value: string // '' = 全部板块（当 allowAll）
  onChange: (id: string) => void
  allowAll?: boolean // 搜索用 true（全部板块），发帖用 false
  placeholder?: string
  fullWidth?: boolean
  compact?: boolean // 筛选条 pill 样式（搜索页与其他筛选并排）
}

// 板块选择（父子级联）：左列一级分类、右列对应板块，两列同时可见，切换分类无需返回。
export function BoardSelect({
  value,
  onChange,
  allowAll = true,
  placeholder = '请选择',
  fullWidth,
  compact
}: BoardSelectProps) {
  const categories = useVisibleCategories()
  const [open, setOpen] = useState(false)
  const [activeCatId, setActiveCatId] = useState('')

  const selected = useMemo(
    () => categories.flatMap((c) => c.boards).find((b) => b.id === value),
    [categories, value]
  )
  const activeCat = categories.find((c) => c.id === activeCatId) || categories[0]

  const label = selected ? selected.name : allowAll ? '全部板块' : placeholder
  const showPlaceholder = !selected && !allowAll

  function toggle() {
    if (open) {
      setOpen(false)
    } else {
      const cat = categories.find((c) => c.boards.some((b) => b.id === value))
      setActiveCatId(cat?.id || categories[0]?.id || '')
      setOpen(true)
    }
  }

  function pickBoard(id: string) {
    onChange(id)
    setOpen(false)
  }

  return (
    <>
      <Pressable
        style={[
          styles.trigger,
          compact ? styles.triggerPill : fullWidth ? styles.triggerFull : styles.triggerAuto,
          compact && value ? styles.triggerPillActive : null
        ]}
        onPress={toggle}
      >
        <Text
          style={[
            styles.triggerText,
            compact && styles.triggerTextPill,
            showPlaceholder && styles.triggerPlaceholder,
            compact && value ? styles.triggerTextActive : null
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        <Text style={[styles.triggerChevron, compact && styles.chevronPill]}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>选择板块</Text>
            <View style={styles.columns}>
              {/* 左列：一级分类 */}
              <ScrollView style={styles.leftCol} keyboardShouldPersistTaps="handled">
                {allowAll ? (
                  <Pressable
                    style={[styles.catRow, value === '' && styles.catRowActive]}
                    onPress={() => pickBoard('')}
                  >
                    <Text style={[styles.catText, value === '' && styles.catTextActive]} numberOfLines={1}>
                      全部板块
                    </Text>
                  </Pressable>
                ) : null}
                {categories.map((c) => (
                  <Pressable
                    key={c.id}
                    style={[styles.catRow, c.id === activeCat?.id && styles.catRowActive]}
                    onPress={() => setActiveCatId(c.id)}
                  >
                    <Text
                      style={[styles.catText, c.id === activeCat?.id && styles.catTextActive]}
                      numberOfLines={1}
                    >
                      {c.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* 右列：板块 */}
              <ScrollView style={styles.rightCol} keyboardShouldPersistTaps="handled">
                {activeCat ? (
                  activeCat.boards.length === 0 ? (
                    <Text style={styles.emptyBoard}>暂无板块</Text>
                  ) : (
                    activeCat.boards.map((b) => (
                      <Pressable key={b.id} style={styles.boardRow} onPress={() => pickBoard(b.id)}>
                        <Text
                          style={[styles.boardText, value === b.id && styles.boardTextActive]}
                          numberOfLines={1}
                        >
                          {b.name}
                        </Text>
                        {value === b.id ? <Text style={styles.check}>✓</Text> : null}
                      </Pressable>
                    ))
                  )
                ) : null}
              </ScrollView>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 14
  },
  triggerFull: {
    justifyContent: 'space-between'
  },
  triggerAuto: {
    alignSelf: 'flex-start',
    justifyContent: 'center'
  },
  triggerPill: {
    height: 32,
    borderRadius: 999,
    paddingHorizontal: 12
  },
  triggerPillActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft
  },
  triggerTextPill: {
    fontSize: 13,
    color: colors.ink2
  },
  triggerTextActive: {
    color: colors.brandStrong,
    fontWeight: '600'
  },
  chevronPill: {
    fontSize: 11,
    marginLeft: 4
  },
  triggerText: {
    fontSize: 15,
    color: colors.ink,
    flexShrink: 1
  },
  triggerPlaceholder: {
    color: colors.ink3
  },
  triggerChevron: {
    fontSize: 13,
    color: colors.ink3,
    marginLeft: 8
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.4)',
    justifyContent: 'flex-end'
  },
  sheet: {
    height: '62%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
    paddingVertical: 16
  },
  columns: {
    flex: 1,
    flexDirection: 'row'
  },
  leftCol: {
    flex: 1,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.line
  },
  rightCol: {
    flex: 1
  },
  catRow: {
    paddingHorizontal: 16,
    paddingVertical: 13
  },
  catRowActive: {
    backgroundColor: colors.brandSoft
  },
  catText: {
    fontSize: 14,
    color: colors.ink
  },
  catTextActive: {
    color: colors.brand,
    fontWeight: '600'
  },
  boardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13
  },
  boardText: {
    flex: 1,
    fontSize: 14,
    color: colors.ink
  },
  boardTextActive: {
    color: colors.brand,
    fontWeight: '600'
  },
  check: {
    color: colors.brand,
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8
  },
  emptyBoard: {
    padding: 16,
    fontSize: 13,
    color: colors.ink3
  }
})
