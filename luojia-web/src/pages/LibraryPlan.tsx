import { FormEvent, ReactNode, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createBookingPlan,
  deleteBookingPlan,
  getLibraryBuildings,
  getLibraryRooms,
  getLibrarySeats,
  listBookingPlans
} from '../api/campus'
import type { BookingPlan, LibraryBuilding, LibraryRoom, Seat } from '../api/types'
import { useAuthStore } from '../store/auth'
import { toast } from '../store/toast'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Spinner } from '../components/ui/Spinner'
import { inputCls } from '../components/AuthShell'

const PLAN_STATUS: Record<number, { label: string; cls: string }> = {
  0: { label: '待执行', cls: 'bg-brand-soft text-brand-strong' },
  1: { label: '已成功', cls: 'bg-brand-soft text-brand-strong' },
  2: { label: '已失败', cls: 'bg-black/[0.04] text-hot' },
  3: { label: '已取消', cls: 'bg-black/[0.04] text-ink-3' }
}

function pad(n: number): string {
  return `${n}`.padStart(2, '0')
}

function defaultDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function defaultBookAt(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T07:59`
}

// datetime-local 本地值 → RFC3339（无毫秒、Z 结尾）
function toRFC3339(local: string): string {
  const d = new Date(local)
  if (isNaN(d.getTime())) return local
  return d.toISOString().slice(0, 19) + 'Z'
}

function formatBookAt(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function LibraryPlan() {
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
      <EmptyState
        title="请先登录"
        desc="登录后可创建图书馆自动预约计划"
        action={
          <Link to="/login">
            <Button>去登录</Button>
          </Link>
        }
      />
    )
  }

  return (
    <div>
      <Link to="/campus" className="text-[13px] text-ink-3 hover:text-ink">
        ← 校园服务
      </Link>
      <h1 className="text-lg font-bold text-ink mb-1">图书馆自动预约</h1>
      <p className="text-[13px] text-ink-3 mb-5">
        创建计划后，系统会在设定时刻自动为你预约座位，成功或失败都以站内通知告知
      </p>

      <PlanForm onCreated={refresh} />

      <h2 className="text-[15px] font-semibold text-ink mt-8 mb-3">我的预约计划</h2>
      {plans === null ? (
        <div className="flex items-center gap-2 text-sm text-ink-3 py-6">
          <Spinner className="w-4 h-4" /> 加载中…
        </div>
      ) : plans.length === 0 ? (
        <EmptyState title="暂无预约计划" desc="创建计划后，系统将在设定时间自动为你预约座位" />
      ) : (
        <div className="space-y-3">
          {plans.map((p) => (
            <PlanCard key={p.id} plan={p} onDeleted={refresh} />
          ))}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink-2 mb-1.5">{label}</label>
      {children}
    </div>
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
  const [bookAt, setBookAt] = useState(defaultBookAt())

  const [loadingSeats, setLoadingSeats] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // 楼栋
  useEffect(() => {
    getLibraryBuildings()
      .then(setBuildings)
      .catch(() => {})
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!building || !room || !seat || !date || !startTime || !endTime || !bookAt) {
      toast('请完整填写预约信息')
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
        book_at: toRFC3339(bookAt)
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
    <form onSubmit={onSubmit} className="bg-surface rounded-xl border border-line/60 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <span className="w-8 h-8 rounded-lg bg-brand-soft flex items-center justify-center text-base">🪑</span>
        <h2 className="font-semibold text-ink">新建预约计划</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="预约日期">
          <input type="date" value={date} min={defaultDate()} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </Field>
        <Field label="楼栋">
          <select value={building} onChange={(e) => setBuilding(e.target.value)} className={inputCls}>
            <option value="">请选择楼栋</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="房间">
          <select value={room} onChange={(e) => setRoom(e.target.value)} className={inputCls} disabled={!building}>
            <option value="">请选择房间</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="座位">
          <div className="relative">
            <select value={seat} onChange={(e) => setSeat(e.target.value)} className={inputCls} disabled={!room}>
              <option value="">请选择座位</option>
              {seats.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.has_power ? '（电源）' : ''}
                </option>
              ))}
            </select>
            {loadingSeats && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                <Spinner className="w-4 h-4 text-ink-3" />
              </span>
            )}
          </div>
        </Field>
        <Field label="开始时间">
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
        </Field>
        <Field label="结束时间">
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} />
        </Field>
        <Field label="触发预约时刻">
          <input type="datetime-local" value={bookAt} onChange={(e) => setBookAt(e.target.value)} className={inputCls} />
        </Field>
      </div>

      <p className="text-[12px] text-ink-3 leading-snug">
        到达「触发预约时刻」后，系统将自动完成验证码识别并提交预约，结果以站内通知告知你。
      </p>

      <Button type="submit" loading={submitting}>
        创建计划
      </Button>
    </form>
  )
}

function PlanCard({ plan, onDeleted }: { plan: BookingPlan; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false)
  const st = PLAN_STATUS[plan.status] ?? PLAN_STATUS[0]

  async function onDelete() {
    if (!confirm('确定删除该自动预约计划？')) return
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

  return (
    <div className="bg-surface rounded-xl border border-line/60 p-4">
      <div className="flex items-center justify-between">
        <span className={`text-[12px] rounded-full px-2.5 py-0.5 ${st.cls}`}>{st.label}</span>
        <Button variant="ghost" size="sm" onClick={onDelete} loading={deleting}>
          删除
        </Button>
      </div>
      <p className="mt-3 font-medium text-ink">
        {plan.room_name || plan.room_id} · 座位 {plan.seat_name || plan.seat_id}
      </p>
      <p className="mt-1 text-[13px] text-ink-2">
        预约 {plan.date} {plan.start_time}-{plan.end_time}
      </p>
      <p className="mt-0.5 text-[12px] text-ink-3">触发时刻 {formatBookAt(plan.book_at)}</p>
      {plan.status === 2 && plan.last_result && (
        <p className="mt-2 text-[12px] text-hot leading-snug">最近结果：{plan.last_result}</p>
      )}
    </div>
  )
}
