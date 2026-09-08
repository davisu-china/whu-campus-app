import type { User } from '../api/types'
import { Avatar } from './ui/Avatar'
import { Button } from './ui/Button'

export function ProfileCard({ user, onEdit }: { user: User; onEdit?: () => void }) {
  const meta = [user.identity, user.degree, user.college, user.grade].filter(Boolean).join(' · ')
  return (
    <div className="bg-surface rounded-xl border border-line/60 p-6 flex items-start gap-4 mb-5">
      <Avatar name={user.nickname} src={user.avatar_url} size={64} />
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-bold text-ink flex items-center gap-2">
          {user.nickname}
          {user.is_verified && (
            <span className="text-brand text-[13px] font-medium bg-brand-soft px-1.5 py-0.5 rounded">✓ 已认证</span>
          )}
        </h1>
        <p className="mt-1 text-sm text-ink-3">{meta || '暂无身份/院系信息'}</p>
        {user.bio && <p className="mt-2 text-sm text-ink-2 leading-relaxed">{user.bio}</p>}
      </div>
      {onEdit && (
        <Button variant="secondary" size="sm" onClick={onEdit}>
          编辑资料
        </Button>
      )}
    </div>
  )
}
