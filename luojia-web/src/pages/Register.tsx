import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { sendEmailCode } from '../api/auth'
import { useAuthStore } from '../store/auth'
import { toast } from '../store/toast'
import { Button } from '../components/ui/Button'
import { AuthShell, inputCls } from '../components/AuthShell'

export default function Register() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const register = useAuthStore((s) => s.register)
  const loggingIn = useAuthStore((s) => s.loggingIn)

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [sending, setSending] = useState(false)

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
      await sendEmailCode(email, 'register')
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
    try {
      await register(email.trim(), code, password)
      const redirect = params.get('redirect')
      navigate(redirect || '/', { replace: true })
    } catch {
      // request 层已 toast
    }
  }

  return (
    <AuthShell
      subtitle="武大邮箱注册 · 设置密码"
      footer={
        <>
          已有账号？<Link to="/login" className="text-brand hover:underline">登录</Link>
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
          <label className="block text-sm font-medium text-ink-2 mb-1.5">设置密码</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="至少 8 位"
            className={inputCls}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-2 mb-1.5">确认密码</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="再次输入密码"
            className={inputCls}
          />
        </div>

        <Button type="submit" block loading={loggingIn}>
          注册并登录
        </Button>

        <p className="text-[12px] text-ink-3 leading-relaxed">
          注册即代表同意社区公约。注册成功后自动登录，验证码 5 分钟内有效。
        </p>
      </form>
    </AuthShell>
  )
}
