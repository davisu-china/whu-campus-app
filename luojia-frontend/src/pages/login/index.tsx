import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import Button from '../../components/Button'
import { sendEmailCode } from '../../api/auth'
import { useAuthStore } from '../../store/auth'
import './index.scss'

const WHU_EMAIL = /^[A-Za-z0-9._%+-]+@whu\.edu\.cn$/

export default function Login() {
  const login = useAuthStore((s) => s.login)
  const loggingIn = useAuthStore((s) => s.loggingIn)

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [countdown, setCountdown] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])

  const sendCode = async () => {
    if (!WHU_EMAIL.test(email)) {
      Taro.showToast({ title: '请输入武大邮箱 @whu.edu.cn', icon: 'none' })
      return
    }
    try {
      await sendEmailCode(email)
      Taro.showToast({ title: '验证码已发送', icon: 'none' })
      setCountdown(60)
      timerRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            if (timerRef.current) clearInterval(timerRef.current)
            return 0
          }
          return c - 1
        })
      }, 1000)
    } catch {}
  }

  const submit = async () => {
    if (!email || !code) {
      Taro.showToast({ title: '请填写邮箱和验证码', icon: 'none' })
      return
    }
    try {
      await login(email, code)
      Taro.showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 600)
    } catch {}
  }

  return (
    <View className='luo-page login'>
      <View className='login-hero'>
        <Text className='luo-serif login-wordmark'>珞珈BBS</Text>
        <Text className='login-slogan'>在武大，一个属于你的校园社区</Text>
      </View>

      <View className='login-form'>
        <View className='login-field'>
          <Input
            className='login-input'
            placeholder='武大邮箱（@whu.edu.cn）'
            value={email}
            onInput={(e) => setEmail(e.detail.value)}
          />
        </View>
        <View className='login-field login-code-row'>
          <Input
            className='login-input'
            placeholder='验证码'
            value={code}
            onInput={(e) => setCode(e.detail.value)}
          />
          <View
            className={`login-code-btn ${countdown > 0 ? 'disabled' : ''}`}
            onClick={countdown > 0 ? undefined : sendCode}
          >
            {countdown > 0 ? `${countdown}s` : '获取验证码'}
          </View>
        </View>
        <Button onClick={submit} disabled={loggingIn} className='login-submit'>
          {loggingIn ? '登录中…' : '登录'}
        </Button>
      </View>

      <Text className='login-agree'>登录即视为同意《社区公约》</Text>
    </View>
  )
}
