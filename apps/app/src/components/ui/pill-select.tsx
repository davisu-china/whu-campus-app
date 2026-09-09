import { useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { colors } from '@/constants/theme'

export interface PillOption {
  key: string
  label: string
}

// 轻量筛选 pill + 底部弹层单选（搜索页的时间范围 / 排序）。
export function PillSelect({
  value,
  options,
  onChange,
  fallbackLabel = '全部',
  title,
  disabled = false
}: {
  value: string
  options: readonly PillOption[]
  onChange: (key: string) => void
  fallbackLabel?: string // value 未命中任何选项时的显示文案
  title?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const current = options.find((o) => o.key === value)
  const active = !!value && !!current

  return (
    <>
      <Pressable
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.pill, active && styles.pillActive, disabled && styles.pillDisabled]}
      >
        <Text style={[styles.pillText, active && styles.pillTextActive]} numberOfLines={1}>
          {current?.label || fallbackLabel}
        </Text>
        <Text style={[styles.chevron, active && styles.pillTextActive]}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{title || '请选择'}</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              {options.map((o) => (
                <Pressable
                  key={o.key || '__all'}
                  style={styles.option}
                  onPress={() => {
                    onChange(o.key)
                    setOpen(false)
                  }}
                >
                  <Text style={[styles.optionText, o.key === value && styles.optionActive]}>
                    {o.label}
                  </Text>
                  {o.key === value ? <Text style={styles.check}>✓</Text> : null}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 12
  },
  pillActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft
  },
  pillDisabled: {
    opacity: 0.45
  },
  pillText: {
    fontSize: 13,
    color: colors.ink2,
    flexShrink: 1
  },
  pillTextActive: {
    color: colors.brandStrong,
    fontWeight: '600'
  },
  chevron: {
    fontSize: 11,
    color: colors.ink3,
    marginLeft: 4
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
    paddingBottom: 24,
    maxHeight: '60%'
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
    paddingVertical: 16
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
  check: {
    color: colors.brand,
    fontSize: 16,
    fontWeight: '700'
  }
})
