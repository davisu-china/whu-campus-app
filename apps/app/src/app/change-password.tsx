import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { changePassword, getMe, toast, useAuthStore } from '@whu/shared'
import { ScreenHeader } from '@/components/screen-header'
import { colors } from '@/constants/theme'

const MIN_LEN = 8

export default function ChangePasswordScreen() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  const hasPassword = !!user?.has_password
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (saving) return
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
      // 刷新用户资料，让 has_password 立即生效（菜单文案 / 下次进本页的表单）
      try {
        setUser(await getMe())
      } catch {
        // 拉取失败不阻塞返回，下次启动 restore 会刷新
      }
      router.back()
    } catch {
      // request 层已 toast
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title={hasPassword ? '修改密码' : '设置密码'} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {hasPassword ? (
            <TextInput
              style={styles.input}
              placeholder="原密码"
              placeholderTextColor={colors.ink3}
              secureTextEntry
              autoCapitalize="none"
              value={oldPassword}
              onChangeText={setOldPassword}
            />
          ) : (
            <Text style={styles.hint}>
              你还没有设置过密码，设置后即可用「邮箱 + 密码」登录。
            </Text>
          )}

          <TextInput
            style={styles.input}
            placeholder={`新密码（至少 ${MIN_LEN} 位）`}
            placeholderTextColor={colors.ink3}
            secureTextEntry
            autoCapitalize="none"
            value={newPassword}
            onChangeText={setNewPassword}
          />
          <TextInput
            style={styles.input}
            placeholder="确认新密码"
            placeholderTextColor={colors.ink3}
            secureTextEntry
            autoCapitalize="none"
            value={confirm}
            onChangeText={setConfirm}
          />

          <Pressable
            style={[styles.btn, saving && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={saving}
          >
            <Text style={styles.btnText}>{saving ? '提交中…' : hasPassword ? '修改密码' : '设置密码'}</Text>
          </Pressable>

          <Text style={styles.note}>
            密码经加密后存储，我们无法查看你的原密码；忘记密码可在登录页用邮箱验证码重置。
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg
  },
  flex: {
    flex: 1
  },
  body: {
    padding: 16
  },
  hint: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.ink2,
    marginBottom: 4
  },
  input: {
    marginTop: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.ink
  },
  btn: {
    marginTop: 24,
    backgroundColor: colors.brand,
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
  },
  note: {
    marginTop: 16,
    fontSize: 12,
    lineHeight: 18,
    color: colors.ink3
  }
})
