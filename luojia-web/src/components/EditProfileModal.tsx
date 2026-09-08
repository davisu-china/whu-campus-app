import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react'
import { updateMe } from '../api/auth'
import { uploadAvatar } from '../api/upload'
import type { User } from '../api/types'
import { useAuthStore } from '../store/auth'
import { toast } from '../store/toast'
import { inputCls } from './AuthShell'
import { DictSelect } from './DictSelect'
import { Avatar } from './ui/Avatar'
import { Button } from './ui/Button'

interface Props {
  user: User
  onClose: () => void
}

const IDENTITY_OPTIONS = ['学生', '教职工', '其他']
const DEGREE_OPTIONS = ['本科', '硕士', '博士', '其他']

export function EditProfileModal({ user, onClose }: Props) {
  const setUser = useAuthStore((s) => s.setUser)
  const [form, setForm] = useState({
    nickname: user.nickname || '',
    college: user.college || '',
    grade: user.grade || '',
    identity: user.identity || '',
    degree: user.degree || '',
    bio: user.bio || ''
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function onPickAvatar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast('请选择图片文件')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast('头像大小不能超过 5MB')
      return
    }
    setUploading(true)
    try {
      const url = await uploadAvatar(file)
      if (!url) {
        toast('上传失败，请重试')
        return
      }
      const updated = await updateMe({ avatar_url: url })
      setUser(updated)
      toast('头像已更新')
    } catch {
      // request 层已 toast
    } finally {
      setUploading(false)
    }
  }

  // 按 Esc 关闭
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const nickname = form.nickname.trim()
    if (!nickname) {
      toast('昵称不能为空')
      return
    }
    if (nickname.length > 32) {
      toast('昵称最长 32 字')
      return
    }
    if (form.bio.trim().length > 200) {
      toast('个人简介最长 200 字')
      return
    }
    setSaving(true)
    try {
      const updated = await updateMe({
        nickname,
        college: form.college.trim(),
        grade: form.grade.trim(),
        identity: form.identity,
        degree: form.degree,
        bio: form.bio.trim()
      })
      setUser(updated)
      toast('资料已保存')
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
        className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-surface rounded-2xl border border-line/60 shadow-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-lg font-bold text-ink">编辑资料</h2>
          <button
            onClick={onClose}
            className="text-ink-3 hover:text-ink transition-colors text-xl leading-none"
            aria-label="关闭"
          >
            ×
          </button>
        </div>
        <p className="text-[13px] text-ink-3 mb-5">完善个人信息，方便同学了解你</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="flex flex-col items-center pb-1">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="relative rounded-full group"
              aria-label="更换头像"
            >
              <Avatar name={user.nickname} src={user.avatar_url} size={80} />
              <span
                className={`absolute inset-0 rounded-full bg-black/45 text-white text-[12px] font-medium flex items-center justify-center transition-opacity ${
                  uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
              >
                {uploading ? '上传中…' : '更换头像'}
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={onPickAvatar}
            />
            <p className="text-[12px] text-ink-3 mt-2">点击更换头像（jpg/png/webp/gif，≤5MB）</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1.5">昵称</label>
            <input
              value={form.nickname}
              onChange={(e) => set('nickname', e.target.value)}
              maxLength={32}
              placeholder="你的昵称"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1.5">院系</label>
            <DictSelect
              type="college"
              value={form.college}
              onChange={(v) => set('college', v)}
              placeholder="输入并选择院系"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1.5">年级</label>
            <input
              value={form.grade}
              onChange={(e) => set('grade', e.target.value)}
              placeholder="如：2024级"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1.5">身份</label>
              <select
                value={form.identity}
                onChange={(e) => set('identity', e.target.value)}
                className={inputCls + ' cursor-pointer'}
              >
                <option value="" disabled>请选择</option>
                {IDENTITY_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1.5">学历层次</label>
              <select
                value={form.degree}
                onChange={(e) => set('degree', e.target.value)}
                className={inputCls + ' cursor-pointer'}
              >
                <option value="" disabled>请选择</option>
                {DEGREE_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1.5">个人简介</label>
            <textarea
              value={form.bio}
              onChange={(e) => set('bio', e.target.value)}
              maxLength={200}
              rows={3}
              placeholder="介绍一下自己"
              className={inputCls + ' h-auto py-2.5 resize-none'}
            />
            <p className="text-[12px] text-ink-3 mt-1">{form.bio.length}/200</p>
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
              取消
            </Button>
            <Button type="submit" loading={saving} className="flex-1">
              保存
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
