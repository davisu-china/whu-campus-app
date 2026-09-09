import { FormEvent, useEffect, useState } from 'react'
import { changePassword, getMe } from '../api/auth'
import { useAuthStore } from '../store/auth'
import { toast } from '../store/toast'
import { inputCls } from './AuthShell'
import { Button } from './ui/Button'

const MIN_LEN = 8

interface Props {
  // 是否已设置过密码：true 需校验原密码，false 即「设置密码」
  hasPassword: boolean
  onClose: () => void
}

export function ChangePasswordModal({ hasPassword, onClose }: Props) {
  const setUser = useAuthStore((s) => s.setUser)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  // 按 Esc 关闭
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (hasPassword && !oldPassword) {
      toast('请输入原密码')
      return
    }
    if (newPassword.length < MIN_LEN) {
      toast(`新密码至少 ${MIN_LEN} 位`)
      return
    }
    if (newPassword !== confirm) {
      toast('两次输入的新密码不一致')
      return
    }
    setSaving(true)
    try {
      await changePassword(hasPassword ? oldPassword : '', newPassword)
      toast(hasPassword ? '密码已修改' : '密码已设置')
      // 刷新用户资料，让 has_password 立即生效
      try {
        setUser(await getMe())
      } catch {
        // 拉取失败不阻塞关闭
      }
      onClose()
    } catch {
      // request 层已 toast
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-surface rounded-2xl border border-line/60 shadow-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-lg font-bold text-ink">{hasPassword ? '修改密码' : '设置密码'}</h2>
          <button
            onClick={onClose}
            className="text-ink-3 hover:text-ink transition-colors text-xl leading-none"
            aria-label="关闭"
          >
            ×
          </button>
        </div>
        <p className="text-[13px] text-ink-3 mb-5">
          {hasPassword
            ? '修改后请使用新密码登录'
            : '设置后即可用「邮箱 + 密码」登录，无需每次收验证码'}
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          {hasPassword && (
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1.5">原密码</label>
              <input
                type="password"
                autoComplete="current-password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="请输入原密码"
                className={inputCls}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1.5">新密码</label>
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={`至少 ${MIN_LEN} 位`}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1.5">确认新密码</label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="再次输入新密码"
              className={inputCls}
            />
          </div>

          <p className="text-[12px] text-ink-3">
            密码经加密后存储，我们无法查看你的原密码；忘记密码可在登录页用邮箱验证码重置。
          </p>

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
              取消
            </Button>
            <Button type="submit" loading={saving} className="flex-1">
              {hasPassword ? '修改密码' : '设置密码'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
