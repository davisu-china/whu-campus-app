import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { resetPassword, sendEmailCode } from '../api/auth'
import { toast } from '../store/toast'
import { Button } from '../components/ui/Button'
import { AuthShell, inputCls } from '../components/AuthShell'

export default function ForgotPassword() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [sending, setSending] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  async function send() {
    if (!/^[^\s@]+@whu\.edu\.cn$/.test(email)) {
      toast('请使用武大邮箱（@whu.edu.cn）')
      return
    }
    setSending(true)
    try {
      await sendEmailCode(email, 'reset')
      toast('验证码已发送，请查收邮箱')
      setCountdown(60)
    } catch {
      // request 层已 toast
    } finally {
      setSending(false)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email || !code) {
      toast('请填写邮箱与验证码')
      return
    }
    if (password.length < 8) {
      toast('密码至少 8 位')
      return
    }
    if (password !== confirm) {
      toast('两次输入的密码不一致')
      return
    }
    setSubmitting(true)
    try {
      await resetPassword(email.trim(), code, password)
      toast('密码已重置，请重新登录')
      navigate('/login', { replace: true })
    } catch {
      // request 层已 toast
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      subtitle="找回密码"
      footer={
        <>
          想起密码了？<Link to="/login" className="text-brand hover:underline">返回登录</Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink-2 mb-1.5">武大邮箱</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="学号@whu.edu.cn"
            className={inputCls}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-2 mb-1.5">邮箱验证码</label>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="6 位验证码"
              maxLength={6}
              className={inputCls + ' flex-1'}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={send}
              loading={sending}
              disabled={countdown > 0}
              className="w-28 shrink-0"
            >
              {countdown > 0 ? `${countdown}s` : '发送验证码'}
            </Button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-2 mb-1.5">新密码</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="至少 8 位"
            className={inputCls}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-2 mb-1.5">确认新密码</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="再次输入新密码"
            className={inputCls}
          />
        </div>

        <Button type="submit" block loading={submitting}>
          重置密码
        </Button>
      </form>
    </AuthShell>
  )
}
