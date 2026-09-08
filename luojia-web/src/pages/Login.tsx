import { FormEvent, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { toast } from '../store/toast'
import { Button } from '../components/ui/Button'
import { AuthShell, inputCls } from '../components/AuthShell'

export default function Login() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const login = useAuthStore((s) => s.login)
  const loggingIn = useAuthStore((s) => s.loggingIn)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email || !password) {
      toast('请填写邮箱与密码')
      return
    }
    try {
      await login(email.trim(), password)
      const redirect = params.get('redirect')
      navigate(redirect || '/', { replace: true })
    } catch {
      // request 层已 toast
    }
  }

  return (
    <AuthShell
      subtitle="武大邮箱密码登录"
      footer={
        <>
          没有账号？<Link to="/register" className="text-brand hover:underline">注册</Link>
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
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-ink-2">密码</label>
            <Link to="/forgot-password" className="text-[13px] text-brand hover:underline">
              忘记密码？
            </Link>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="请输入密码"
            className={inputCls}
          />
        </div>

        <Button type="submit" block loading={loggingIn}>
          登录
        </Button>
      </form>
    </AuthShell>
  )
}
