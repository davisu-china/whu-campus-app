import { useState } from 'react'
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors } from '@/constants/theme'

export interface PickerOption {
  id: string
  label: string
  meta?: string // 右侧辅助信息，如「电源」
}

// 底部弹层单选器：字段行 + 弹层列表。
export function PickerField({
  label,
  value,
  placeholder = '请选择',
  options,
  onSelect,
  disabled = false,
  loading = false
}: {
  label: string
  value: string | null
  placeholder?: string
  options: PickerOption[]
  onSelect: (id: string) => void
  disabled?: boolean
  loading?: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={[styles.field, disabled && styles.fieldDisabled]}
        onPress={() => !disabled && setOpen(true)}
      >
        <Text style={value ? styles.value : styles.placeholder}>{value || placeholder}</Text>
        {loading ? (
          <ActivityIndicator size="small" color={colors.ink3} />
        ) : (
          <Text style={styles.chevron}>›</Text>
        )}
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(o) => o.id}
              style={styles.list}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.option}
                  onPress={() => {
                    onSelect(item.id)
                    setOpen(false)
                  }}
                >
                  <Text style={[styles.optionText, item.id === value && styles.optionActive]}>
                    {item.label}
                  </Text>
                  {item.meta ? <Text style={styles.optionMeta}>{item.meta}</Text> : null}
                  {item.id === value ? <Text style={styles.check}>✓</Text> : null}
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 16
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.ink2,
    marginBottom: 8
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 14
  },
  fieldDisabled: {
    opacity: 0.5
  },
  value: {
    fontSize: 15,
    color: colors.ink
  },
  placeholder: {
    fontSize: 15,
    color: colors.ink3
  },
  chevron: {
    fontSize: 20,
    color: colors.ink3
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.4)',
    justifyContent: 'flex-end'
  },
  sheet: {
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
  list: {
    maxHeight: 400
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    color: colors.ink
  },
  optionActive: {
    color: colors.brand,
    fontWeight: '600'
  },
  optionMeta: {
    fontSize: 12,
    color: colors.ink3,
    marginRight: 8
  },
  check: {
    color: colors.brand,
    fontSize: 16,
    fontWeight: '700'
  }
})
