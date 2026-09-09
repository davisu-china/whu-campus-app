import { useCallback, useEffect, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { bindCas, getCasStatus, toast, unbindCas, useAuthStore } from '@whu/shared'
import type { CampusStatus } from '@whu/shared'
import { EmptyState } from '@/components/ui/empty-state'
import { colors } from '@/constants/theme'

interface Feature {
  icon: string
  name: string
  desc: string
  href?: '/library-plan'
  available?: boolean
}

const FEATURES: Feature[] = [
  { icon: '📚', name: '课表', desc: '查看本周课程安排，切换周次与学期' },
  { icon: '📊', name: '成绩查询', desc: '查询各学年学期成绩与学分' },
  { icon: '🎯', name: '绩点计算', desc: '按武大算法计算 GPA' },
  { icon: '🪑', name: '图书馆座位', desc: '预约自习座位、自动签到', href: '/library-plan', available: true },
  { icon: '🚌', name: '校车查询', desc: '校车线路与实时位置' },
  { icon: '💳', name: '校园一卡通', desc: '余额查询与消费流水' },
  { icon: '🖨️', name: '云打印', desc: '图书馆云端打印，上传即印' }
]

export default function ServicesScreen() {
  const router = useRouter()
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

  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Text style={styles.title}>校园服务</Text>
        <View style={styles.center}>
          <EmptyState
            title="登录后使用校园服务"
            desc="绑定武大统一身份认证后，即可使用课表、图书馆等校园服务"
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
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>校园服务</Text>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.subtitle}>武大校园生活一站式服务，绑定统一身份认证后即可使用，各服务持续接入中</Text>

        <CasStatusBar status={status} onOpen={() => setCasOpen(true)} />

        <Text style={styles.sectionTitle}>全部服务</Text>
        <View style={styles.grid}>
          {FEATURES.map((f) => (
            <Pressable
              key={f.name}
              style={styles.card}
              onPress={() => {
                if (f.href) router.push(f.href)
              }}
              disabled={!f.href}
            >
              <View style={styles.cardTop}>
                <View style={styles.iconBox}>
                  <Text style={styles.icon}>{f.icon}</Text>
                </View>
                <Text style={[styles.badge, f.available ? styles.badgeOn : styles.badgeOff]}>
                  {f.available ? '已接入' : '即将上线'}
                </Text>
              </View>
              <Text style={styles.cardName}>{f.name}</Text>
              <Text style={styles.cardDesc}>{f.desc}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {casOpen ? <CasModal status={status} onClose={() => setCasOpen(false)} onChanged={loadStatus} /> : null}
    </SafeAreaView>
  )
}

// 紧凑的认证状态条。
function CasStatusBar({ status, onOpen }: { status: CampusStatus | null; onOpen: () => void }) {
  const bound = status?.cas.bound ?? false
  return (
    <View style={styles.statusBar}>
      <View style={styles.statusIconBox}>
        <Text style={styles.statusIcon}>🔐</Text>
      </View>
      <View style={styles.statusBody}>
        <Text style={styles.statusTitle}>武大统一认证</Text>
        <Text style={styles.statusDesc} numberOfLines={1}>
          {status === null
            ? '加载中…'
            : bound
              ? `已绑定学号 ${status.cas.username}`
              : '绑定后即可使用课表、成绩、图书馆等服务'}
        </Text>
      </View>
      <Pressable onPress={onOpen} hitSlop={8}>
        <Text style={[styles.statusBtn, bound ? styles.statusBtnGhost : styles.statusBtnPrimary]}>
          {bound ? '管理' : '去绑定'}
        </Text>
      </Pressable>
    </View>
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

  async function onBind() {
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
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>武大统一认证</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={styles.modalClose}>×</Text>
            </Pressable>
          </View>
          <Text style={styles.modalSub}>绑定后即可使用课表、成绩、图书馆等校园服务</Text>

          {status === null ? (
            <Text style={styles.modalLoading}>加载中…</Text>
          ) : bound ? (
            <View>
              <View style={styles.boundBox}>
                <Text style={styles.boundText}>
                  已绑定学号 <Text style={styles.boundUser}>{status.cas.username}</Text>
                </Text>
                <Text style={styles.boundHint}>凭统一认证会话访问各服务，密码不会在服务器保存</Text>
              </View>
              <Pressable
                style={[styles.btn, styles.btnGhost]}
                onPress={onUnbind}
                disabled={submitting}
              >
                <Text style={styles.btnGhostText}>{submitting ? '解绑中…' : '解绑'}</Text>
              </Pressable>
            </View>
          ) : (
            <View>
              <Text style={styles.label}>学号</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="如 2021301234567"
                placeholderTextColor={colors.ink3}
                autoCapitalize="none"
              />
              <Text style={styles.label}>统一身份认证密码</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="信息门户 / 教务系统登录密码"
                placeholderTextColor={colors.ink3}
                secureTextEntry
              />
              <Text style={styles.privacy}>密码仅用于本次登录武大统一认证换取会话，服务器不存储、不记录，请放心使用。</Text>
              <Pressable style={[styles.btn, styles.btnPrimary]} onPress={onBind} disabled={submitting}>
                <Text style={styles.btnPrimaryText}>{submitting ? '绑定中…' : '绑定'}</Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.ink,
    paddingHorizontal: 16,
    paddingVertical: 12
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
  subtitle: {
    fontSize: 13,
    color: colors.ink3,
    lineHeight: 19,
    marginBottom: 16
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20
  },
  statusIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center'
  },
  statusIcon: {
    fontSize: 18
  },
  statusBody: {
    flex: 1,
    marginLeft: 12
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink
  },
  statusDesc: {
    marginTop: 2,
    fontSize: 12,
    color: colors.ink3
  },
  statusBtn: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: 'hidden'
  },
  statusBtnPrimary: {
    color: '#fff',
    backgroundColor: colors.brand
  },
  statusBtnGhost: {
    color: colors.ink2,
    backgroundColor: 'rgba(15,23,42,0.05)'
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
    marginBottom: 12
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  card: {
    width: '48.3%',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: 14,
    marginBottom: 12
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center'
  },
  icon: {
    fontSize: 20
  },
  badge: {
    fontSize: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden'
  },
  badgeOn: {
    color: colors.brandStrong,
    backgroundColor: colors.brandSoft
  },
  badgeOff: {
    color: colors.ink3,
    backgroundColor: 'rgba(15,23,42,0.05)'
  },
  cardName: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink
  },
  cardDesc: {
    marginTop: 4,
    fontSize: 12,
    color: colors.ink2,
    lineHeight: 17
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20
  },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink
  },
  modalClose: {
    fontSize: 24,
    lineHeight: 24,
    color: colors.ink3
  },
  modalSub: {
    marginTop: 4,
    fontSize: 13,
    color: colors.ink3,
    marginBottom: 16
  },
  modalLoading: {
    fontSize: 14,
    color: colors.ink3,
    paddingVertical: 20,
    textAlign: 'center'
  },
  boundBox: {
    backgroundColor: 'rgba(15,23,42,0.03)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16
  },
  boundText: {
    fontSize: 14,
    color: colors.ink2
  },
  boundUser: {
    fontWeight: '600',
    color: colors.ink
  },
  boundHint: {
    marginTop: 4,
    fontSize: 12,
    color: colors.ink3
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.ink2,
    marginBottom: 8,
    marginTop: 4
  },
  input: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.ink,
    marginBottom: 12
  },
  privacy: {
    fontSize: 12,
    color: colors.ink3,
    lineHeight: 17,
    marginBottom: 16
  },
  btn: {
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnPrimary: {
    backgroundColor: colors.brand
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600'
  },
  btnGhost: {
    backgroundColor: 'rgba(15,23,42,0.05)'
  },
  btnGhostText: {
    color: colors.ink2,
    fontSize: 15,
    fontWeight: '600'
  }
})
