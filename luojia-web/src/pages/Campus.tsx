import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { bindCas, getCasStatus, unbindCas } from '../api/campus'
import type { CampusStatus } from '../api/types'
import { useAuthStore } from '../store/auth'
import { toast } from '../store/toast'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Spinner } from '../components/ui/Spinner'
import { inputCls } from '../components/AuthShell'

interface Feature {
  icon: string
  name: string
  desc: string
  href?: string
  available?: boolean
}

const FEATURES: Feature[] = [
  { icon: '📚', name: '课表', desc: '查看本周课程安排，支持切换周次与学期' },
  { icon: '📊', name: '成绩查询', desc: '查询各学年学期成绩与学分' },
  { icon: '🎯', name: '绩点计算', desc: '按武大算法计算绩点 GPA' },
  { icon: '🪑', name: '图书馆座位', desc: '预约图书馆自习座位、签到与取消', href: '/campus/library-plan', available: true },
  { icon: '🚌', name: '校车查询', desc: '校车线路与实时位置' },
  { icon: '💳', name: '校园一卡通', desc: '余额查询与消费流水' },
  { icon: '🖨️', name: '云打印', desc: '图书馆云端打印，上传即印' }
]

export default function Campus() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const [status, setStatus] = useState<CampusStatus | null>(null)
  const [casOpen, setCasOpen] = useState(false)

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await getCasStatus())
    } catch {
      // request 层已 toast
    }
  }, [])

  useEffect(() => {
    if (isLoggedIn) loadStatus()
  }, [isLoggedIn, loadStatus])

  return (
    <div>
      <h1 className="text-lg font-bold text-ink mb-1">校园服务</h1>
      <p className="text-[13px] text-ink-3 mb-5">
        武大校园生活一站式服务，绑定统一身份认证后即可使用，各服务持续接入中
      </p>

      {isLoggedIn ? (
        <>
          <CasStatusBar status={status} onOpen={() => setCasOpen(true)} />
          <FeatureGrid />
          {casOpen && <CasModal status={status} onClose={() => setCasOpen(false)} onChanged={loadStatus} />}
        </>
      ) : (
        <EmptyState
          title="请先登录"
          desc="登录后绑定武大统一身份认证，即可使用课表、成绩、图书馆等校园服务"
          action={
            <Link to="/login">
              <Button>去登录</Button>
            </Link>
          }
        />
      )}
    </div>
  )
}

// 紧凑的认证状态条，替代原来占满整行的绑定卡片。
function CasStatusBar({ status, onOpen }: { status: CampusStatus | null; onOpen: () => void }) {
  const bound = status?.cas.bound ?? false
  return (
    <div className="flex items-center justify-between gap-3 bg-surface rounded-xl border border-line/60 px-4 py-3 mb-6">
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-9 h-9 rounded-lg bg-brand-soft flex items-center justify-center text-base shrink-0">🔐</span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">武大统一认证</p>
          <p className="text-[12px] text-ink-3 truncate">
            {status === null
              ? '加载中…'
              : bound
                ? `已绑定学号 ${status.cas.username}`
                : '绑定后即可使用课表、成绩、图书馆等服务'}
          </p>
        </div>
      </div>
      <Button variant={bound ? 'ghost' : 'primary'} size="sm" onClick={onOpen} className="shrink-0">
        {bound ? '管理' : '去绑定'}
      </Button>
    </div>
  )
}

// 绑定/解绑统一认证的弹窗。
function CasModal({
  status,
  onClose,
  onChanged
}: {
  status: CampusStatus | null
  onClose: () => void
  onChanged: () => Promise<void>
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const bound = status?.cas.bound ?? false

  // 按 Esc 关闭
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function onBind(e: FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password) {
      toast('请输入学号与密码')
      return
    }
    setSubmitting(true)
    try {
      await bindCas(username.trim(), password)
      toast('统一认证绑定成功')
      setUsername('')
      setPassword('')
      await onChanged()
    } catch {
      // request 层已 toast
    } finally {
      setSubmitting(false)
    }
  }

  async function onUnbind() {
    setSubmitting(true)
    try {
      await unbindCas()
      toast('已解绑统一认证')
      await onChanged()
    } catch {
      // request 层已 toast
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-surface rounded-2xl border border-line/60 shadow-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-lg font-bold text-ink">武大统一认证</h2>
          <button onClick={onClose} className="text-ink-3 hover:text-ink transition-colors text-xl leading-none" aria-label="关闭">
            ×
          </button>
        </div>
        <p className="text-[13px] text-ink-3 mb-5">绑定后即可使用课表、成绩、图书馆等校园服务</p>

        {status === null ? (
          <div className="flex items-center gap-2 text-sm text-ink-3 py-6">
            <Spinner className="w-4 h-4" /> 加载中…
          </div>
        ) : bound ? (
          <div className="space-y-4">
            <div className="bg-black/[0.02] rounded-lg px-4 py-3">
              <p className="text-sm text-ink-2">
                已绑定学号 <span className="font-medium text-ink">{status.cas.username}</span>
              </p>
              <p className="text-[12px] text-ink-3 mt-0.5">凭统一认证会话访问各服务，密码不会在服务器保存</p>
            </div>
            <Button variant="ghost" block onClick={onUnbind} loading={submitting}>
              解绑
            </Button>
          </div>
        ) : (
          <form onSubmit={onBind} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1.5">学号</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="如 2021301234567"
                autoComplete="username"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1.5">统一身份认证密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="信息门户 / 教务系统登录密码"
                autoComplete="current-password"
                className={inputCls}
              />
            </div>
            <p className="text-[12px] text-ink-3 leading-snug">
              密码仅用于本次登录武大统一认证换取会话，服务器不存储、不记录，请放心使用。
            </p>
            <Button type="submit" block loading={submitting}>
              绑定
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}

function FeatureGrid() {
  return (
    <div>
      <h2 className="text-[15px] font-semibold text-ink mb-3">全部服务</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FEATURES.map((f) => {
          const body = (
            <>
              <div className="flex items-start justify-between">
                <span className="w-11 h-11 rounded-xl bg-brand-soft flex items-center justify-center text-xl">
                  {f.icon}
                </span>
                {f.available ? (
                  <span className="text-[11px] text-brand-strong bg-brand-soft rounded-full px-2 py-0.5">已接入</span>
                ) : (
                  <span className="text-[11px] text-ink-3 bg-black/[0.04] rounded-full px-2 py-0.5">即将上线</span>
                )}
              </div>
              <p className="mt-3 font-medium text-ink">{f.name}</p>
              <p className="mt-1 text-[13px] text-ink-2 leading-snug">{f.desc}</p>
            </>
          )
          const cls =
            'group bg-surface rounded-xl border border-line/60 p-5 hover:border-brand/30 hover:shadow-card transition-all'
          return f.href ? (
            <Link key={f.name} to={f.href} className={`${cls} block`}>
              {body}
            </Link>
          ) : (
            <div key={f.name} className={cls}>
              {body}
            </div>
          )
        })}
      </div>
    </div>
  )
}
