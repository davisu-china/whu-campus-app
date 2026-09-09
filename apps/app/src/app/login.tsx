import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { sendEmailCode, toast, useAuthStore } from '@whu/shared'

export default function LoginScreen() {
  const router = useRouter()
  const loginByCode = useAuthStore((s) => s.loginByCode)
  const login = useAuthStore((s) => s.login)
  const ssoLogin = useAuthStore((s) => s.ssoLogin)
  const loggingIn = useAuthStore((s) => s.loggingIn)

  const [mode, setMode] = useState<'code' | 'password' | 'sso'>('code')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [studentNo, setStudentNo] = useState('')
  const [ssoPassword, setSsoPassword] = useState('')
  const [sending, setSending] = useState(false)

  const handleSendCode = async () => {
    if (!email || sending) return
    setSending(true)
    try {
      await sendEmailCode(email, 'login')
      toast('验证码已发送')
    } catch {
      // request 层已 toast
    } finally {
      setSending(false)
    }
  }

  const handleSubmit = async () => {
    try {
      if (mode === 'code') {
        if (!email || !code) return
        await loginByCode(email, code)
      } else if (mode === 'password') {
        if (!email || !password) return
        await login(email, password)
      } else {
        if (!studentNo || !ssoPassword) return
        await ssoLogin(studentNo.trim(), ssoPassword)
      }
      router.replace('/')
    } catch {
      // request 层已 toast
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.title}>在武大</Text>
        <Text style={styles.subtitle}>武大学子的校园社区</Text>

        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, mode === 'code' && styles.tabActive]}
            onPress={() => setMode('code')}
          >
            <Text style={[styles.tabText, mode === 'code' && styles.tabTextActive]}>验证码登录</Text>
          </Pressable>
          <Pressable
            style={[styles.tab, mode === 'password' && styles.tabActive]}
            onPress={() => setMode('password')}
          >
            <Text style={[styles.tabText, mode === 'password' && styles.tabTextActive]}>密码登录</Text>
          </Pressable>
          <Pressable
            style={[styles.tab, mode === 'sso' && styles.tabActive]}
            onPress={() => setMode('sso')}
          >
            <Text style={[styles.tabText, mode === 'sso' && styles.tabTextActive]}>统一登录</Text>
          </Pressable>
        </View>

        {mode === 'sso' ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="学号 / 工号"
              placeholderTextColor="#97a09a"
              autoCapitalize="none"
              value={studentNo}
              onChangeText={setStudentNo}
            />
            <TextInput
              style={styles.input}
              placeholder="统一认证密码"
              placeholderTextColor="#97a09a"
              secureTextEntry
              value={ssoPassword}
              onChangeText={setSsoPassword}
            />
            <Text style={styles.hint}>
              密码仅用于本次身份校验，服务器只保存登录会话，不会留存密码。
            </Text>
          </>
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder="武大邮箱"
              placeholderTextColor="#97a09a"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />

            {mode === 'code' ? (
              <View style={styles.codeRow}>
                <TextInput
                  style={[styles.input, styles.codeInput]}
                  placeholder="验证码"
                  placeholderTextColor="#97a09a"
                  keyboardType="number-pad"
                  value={code}
                  onChangeText={setCode}
                />
                <Pressable style={styles.sendBtn} onPress={handleSendCode}>
                  <Text style={styles.sendBtnText}>{sending ? '发送中…' : '发送验证码'}</Text>
                </Pressable>
              </View>
            ) : (
              <TextInput
                style={styles.input}
                placeholder="密码"
                placeholderTextColor="#97a09a"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            )}
          </>
        )}

        <Pressable
          style={[styles.btn, loggingIn && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={loggingIn}
        >
          <Text style={styles.btnText}>{loggingIn ? '登录中…' : '登录'}</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f8f6f1'
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center'
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#18201b',
    textAlign: 'center'
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#66726b',
    textAlign: 'center'
  },
  tabs: {
    flexDirection: 'row',
    marginTop: 32,
    backgroundColor: '#f2efe8',
    borderRadius: 12,
    padding: 4
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8
  },
  tabActive: {
    backgroundColor: '#fff'
  },
  tabText: {
    fontSize: 13,
    color: '#66726b'
  },
  tabTextActive: {
    color: '#1f6b51',
    fontWeight: '600'
  },
  input: {
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e7e2d8',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#18201b'
  },
  hint: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 18,
    color: '#8a938d'
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  codeInput: {
    flex: 1
  },
  sendBtn: {
    marginTop: 16,
    marginLeft: 12,
    backgroundColor: '#eef6f1',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16
  },
  sendBtnText: {
    color: '#1f6b51',
    fontSize: 14,
    fontWeight: '600'
  },
  btn: {
    marginTop: 24,
    backgroundColor: '#2c8063',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center'
  },
  btnDisabled: {
    opacity: 0.6
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  }
})
