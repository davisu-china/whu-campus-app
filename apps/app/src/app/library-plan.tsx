import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  createBookingPlan,
  deleteBookingPlan,
  getLibraryBuildings,
  getLibraryRooms,
  getLibrarySeats,
  listBookingPlans,
  toast,
  useAuthStore
} from '@whu/shared'
import type { BookingPlan, LibraryBuilding, LibraryRoom, Seat } from '@whu/shared'
import { ScreenHeader } from '@/components/screen-header'
import { EmptyState } from '@/components/ui/empty-state'
import { PickerField } from '@/components/ui/picker'
import type { PickerOption } from '@/components/ui/picker'
import { colors } from '@/constants/theme'
import { dateOptions, defaultDate, formatBookAt, timeOptions, toRFC3339 } from '@/utils/datetime'

const PLAN_STATUS: Record<number, { label: string; color: string }> = {
  0: { label: '待执行', color: colors.brand },
  1: { label: '已成功', color: colors.brand },
  2: { label: '已失败', color: colors.hot },
  3: { label: '已取消', color: colors.ink3 }
}

export default function LibraryPlanScreen() {
  const router = useRouter()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const [plans, setPlans] = useState<BookingPlan[] | null>(null)

  const refresh = useCallback(async () => {
    try {
      setPlans(await listBookingPlans())
    } catch {
      // request 层已 toast
    }
  }, [])

  useEffect(() => {
    if (isLoggedIn) refresh()
  }, [isLoggedIn, refresh])

  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader title="图书馆自动预约" />
        <View style={styles.center}>
          <EmptyState
            title="登录后创建预约计划"
            desc="创建计划后，系统将在设定时间自动为你预约座位"
            action={
              <Pressable style={styles.loginBtn} onPress={() => router.push('/login')}>
                <Text style={styles.loginBtnText}>去登录</Text>
              </Pressable>
            }
          />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="图书馆自动预约" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.hint}>创建计划后，系统会在设定时刻自动为你预约座位，结果以站内通知告知</Text>

        <PlanForm onCreated={refresh} />

        <Text style={styles.sectionTitle}>我的预约计划</Text>
        {plans === null ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.brand} />
          </View>
        ) : plans.length === 0 ? (
          <EmptyState title="暂无预约计划" desc="创建计划后，系统将在设定时间自动为你预约座位" />
        ) : (
          <View>
            {plans.map((p) => (
              <PlanCard key={p.id} plan={p} onDeleted={refresh} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function PlanForm({ onCreated }: { onCreated: () => void }) {
  const [buildings, setBuildings] = useState<LibraryBuilding[]>([])
  const [rooms, setRooms] = useState<LibraryRoom[]>([])
  const [seats, setSeats] = useState<Seat[]>([])

  const [building, setBuilding] = useState('')
  const [room, setRoom] = useState('')
  const [seat, setSeat] = useState('')
  const [date, setDate] = useState(defaultDate())
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('22:00')
  const [bookAtTime, setBookAtTime] = useState('07:59')

  const [loadingSeats, setLoadingSeats] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const dates = dateOptions(7)
  const times = timeOptions(7, 22)

  useEffect(() => {
    getLibraryBuildings()
      .then(setBuildings)
      .catch(() => setBuildings([]))
  }, [])

  // 房间（依赖楼栋）
  useEffect(() => {
    setRoom('')
    setSeats([])
    setSeat('')
    if (!building) {
      setRooms([])
      return
    }
    getLibraryRooms(building)
      .then(setRooms)
      .catch(() => setRooms([]))
  }, [building])

  // 座位（依赖房间 + 日期）
  useEffect(() => {
    setSeat('')
    if (!room || !date) {
      setSeats([])
      return
    }
    setLoadingSeats(true)
    getLibrarySeats(room, date)
      .then(setSeats)
      .catch(() => setSeats([]))
      .finally(() => setLoadingSeats(false))
  }, [room, date])

  const buildingOptions: PickerOption[] = buildings.map((b) => ({ id: b.id, label: b.name }))
  const roomOptions: PickerOption[] = rooms.map((r) => ({ id: r.id, label: r.name }))
  const seatOptions: PickerOption[] = seats.map((s) => ({
    id: s.id,
    label: s.name,
    meta: s.has_power ? '电源' : undefined
  }))

  const buildingLabel = buildings.find((b) => b.id === building)?.name ?? null
  const roomLabel = rooms.find((r) => r.id === room)?.name ?? null
  const seatLabel = seats.find((s) => s.id === seat)?.name ?? null

  async function onSubmit() {
    if (!building || !room || !seat || !date || !startTime || !endTime || !bookAtTime) {
      toast('请完整填写预约信息')
      return
    }
    if (startTime >= endTime) {
      toast('结束时间需晚于开始时间')
      return
    }
    if (!/^\d{2}:\d{2}$/.test(bookAtTime)) {
      toast('触发时刻格式应为 HH:mm')
      return
    }
    const roomName = rooms.find((r) => r.id === room)?.name ?? ''
    const seatName = seats.find((s) => s.id === seat)?.name ?? ''
    setSubmitting(true)
    try {
      await createBookingPlan({
        room_id: room,
        seat_id: seat,
        room_name: roomName,
        seat_name: seatName,
        date,
        start_time: startTime,
        end_time: endTime,
        book_at: toRFC3339(date, bookAtTime)
      })
      toast('自动预约计划已创建')
      onCreated()
    } catch {
      // request 层已 toast
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View style={styles.formCard}>
      <View style={styles.formHead}>
        <Text style={styles.formIcon}>🪑</Text>
        <Text style={styles.formTitle}>新建预约计划</Text>
      </View>

      <Text style={styles.label}>预约日期</Text>
      <Chips options={dates} value={date} onSelect={setDate} />

      <PickerField label="楼栋" value={buildingLabel} options={buildingOptions} onSelect={setBuilding} />
      <PickerField label="房间" value={roomLabel} options={roomOptions} onSelect={setRoom} disabled={!building} />
      <PickerField
        label="座位"
        value={seatLabel}
        options={seatOptions}
        onSelect={setSeat}
        disabled={!room}
        loading={loadingSeats}
      />

      <Text style={styles.label}>开始时间</Text>
      <Chips options={times.map((t) => ({ value: t, label: t }))} value={startTime} onSelect={setStartTime} />

      <Text style={styles.label}>结束时间</Text>
      <Chips options={times.map((t) => ({ value: t, label: t }))} value={endTime} onSelect={setEndTime} />

      <Text style={styles.label}>触发预约时刻（当天 HH:mm）</Text>
      <TextInput
        style={styles.timeInput}
        value={bookAtTime}
        onChangeText={setBookAtTime}
        placeholder="如 07:59"
        placeholderTextColor={colors.ink3}
        keyboardType="numbers-and-punctuation"
        maxLength={5}
      />

      <Text style={styles.formHint}>到达触发时刻后，系统将自动完成验证码识别并提交预约，结果以站内通知告知。</Text>

      <Pressable style={[styles.submitBtn, submitting && styles.disabled]} onPress={onSubmit} disabled={submitting}>
        <Text style={styles.submitText}>{submitting ? '创建中…' : '创建计划'}</Text>
      </Pressable>
    </View>
  )
}

function Chips({
  options,
  value,
  onSelect
}: {
  options: { value: string; label: string }[]
  value: string
  onSelect: (v: string) => void
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <Pressable
            key={o.value}
            onPress={() => onSelect(o.value)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

function PlanCard({ plan, onDeleted }: { plan: BookingPlan; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false)
  const st = PLAN_STATUS[plan.status] ?? PLAN_STATUS[0]

  function onDelete() {
    Alert.alert('删除预约计划', '确定删除该自动预约计划？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true)
          try {
            await deleteBookingPlan(plan.id)
            toast('已删除')
            onDeleted()
          } catch {
            // request 层已 toast
          } finally {
            setDeleting(false)
          }
        }
      }
    ])
  }

  return (
    <View style={styles.planCard}>
      <View style={styles.planHead}>
        <Text style={[styles.planStatus, { color: st.color }]}>{st.label}</Text>
        <Pressable onPress={onDelete} disabled={deleting} hitSlop={8}>
          <Text style={styles.planDelete}>{deleting ? '删除中…' : '删除'}</Text>
        </Pressable>
      </View>
      <Text style={styles.planTitle}>
        {plan.room_name || plan.room_id} · 座位 {plan.seat_name || plan.seat_id}
      </Text>
      <Text style={styles.planMeta}>
        预约 {plan.date} {plan.start_time}-{plan.end_time}
      </Text>
      <Text style={styles.planMeta2}>触发时刻 {formatBookAt(plan.book_at)}</Text>
      {plan.status === 2 && plan.last_result ? (
        <Text style={styles.planError}>最近结果：{plan.last_result}</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg
  },
  center: {
    flex: 1,
    justifyContent: 'center'
  },
  loginBtn: {
    backgroundColor: colors.brand,
    borderRadius: 999,
    paddingHorizontal: 32,
    paddingVertical: 12
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600'
  },
  body: {
    padding: 16,
    paddingBottom: 40
  },
  hint: {
    fontSize: 13,
    color: colors.ink3,
    lineHeight: 19,
    marginBottom: 12
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: 16,
    marginBottom: 24
  },
  formHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4
  },
  formIcon: {
    fontSize: 16
  },
  formTitle: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.ink2,
    marginBottom: 8,
    marginTop: 16
  },
  chipsRow: {
    gap: 8
  },
  chip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    justifyContent: 'center'
  },
  chipActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand
  },
  chipText: {
    fontSize: 13,
    color: colors.ink2
  },
  chipTextActive: {
    color: '#fff'
  },
  timeInput: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.ink
  },
  formHint: {
    marginTop: 14,
    fontSize: 12,
    color: colors.ink3,
    lineHeight: 17
  },
  submitBtn: {
    marginTop: 16,
    height: 46,
    borderRadius: 10,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center'
  },
  disabled: {
    opacity: 0.5
  },
  submitText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600'
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
    marginBottom: 12
  },
  loadingBox: {
    paddingVertical: 28,
    alignItems: 'center'
  },
  planCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: 16,
    marginBottom: 12
  },
  planHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  planStatus: {
    fontSize: 12,
    fontWeight: '600'
  },
  planDelete: {
    fontSize: 13,
    color: colors.ink3
  },
  planTitle: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink
  },
  planMeta: {
    marginTop: 6,
    fontSize: 13,
    color: colors.ink2
  },
  planMeta2: {
    marginTop: 2,
    fontSize: 12,
    color: colors.ink3
  },
  planError: {
    marginTop: 8,
    fontSize: 12,
    color: colors.hot,
    lineHeight: 17
  }
})
