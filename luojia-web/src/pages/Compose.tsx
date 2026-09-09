import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getBoardTags } from '../api/board'
import { createPost, getPost, updatePost } from '../api/content'
import { uploadImage } from '../api/upload'
import type { Tag } from '../api/types'
import { useCategoryStore } from '../store/category'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { BoardSelect } from '../components/BoardSelect'
import { toast } from '../store/toast'
import { cn } from '../utils/cn'

export default function Compose() {
  const navigate = useNavigate()
  const { ensureVerified } = useAuth()
  const categories = useCategoryStore((s) => s.categories)
  const loadCategories = useCategoryStore((s) => s.load)

  const [boardId, setBoardId] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [availableTags, setAvailableTags] = useState<Tag[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [customTags, setCustomTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [images, setImages] = useState<{ key: string; url: string }[]>([])
  const [anonymous, setAnonymous] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [params] = useSearchParams()
  const editId = params.get('edit') || ''
  const isEdit = !!editId
  const [editBoardName, setEditBoardName] = useState('')

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  // 默认选中第一个板块
  const firstBoardId = useMemo(() => categories[0]?.boards[0]?.id || '', [categories])
  useEffect(() => {
    if (!boardId && firstBoardId && !isEdit) setBoardId(firstBoardId)
  }, [firstBoardId, boardId, isEdit])

  // 板块变化 → 加载标签
  useEffect(() => {
    if (!boardId) {
      setAvailableTags([])
      return
    }
    getBoardTags(boardId)
      .then(setAvailableTags)
      .catch(() => setAvailableTags([]))
  }, [boardId])

  // 手动切换板块 → 重置已选标签
  function onBoardChange(id: string) {
    setBoardId(id)
    setSelectedTags([])
  }

  // 编辑模式：加载原帖并预填（板块不可改，标题/正文/匿名/标签/图片均可改）
  useEffect(() => {
    if (!editId) return
    getPost(editId)
      .then((p) => {
        setBoardId(p.board_id)
        setEditBoardName(p.board_name || '')
        setTitle(p.title)
        setContent(p.content)
        setAnonymous(p.is_anonymous)
        setSelectedTags(p.tags?.map((t) => t.id) || [])
        setImages((p.images || []).map((im) => ({ key: im.object_key, url: im.url })))
      })
      .catch(() => toast('帖子加载失败'))
  }, [editId])

  async function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploading(true)
    try {
      for (const f of files) {
        const key = await uploadImage(f)
        setImages((prev) => [...prev, { key, url: URL.createObjectURL(f) }])
      }
    } catch {
      toast('图片上传失败，请重试')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  function toggleTag(id: string) {
    setSelectedTags((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]))
  }

  function addCustomTag() {
    const name = tagInput.trim()
    if (!name) return
    // 已存在预置标签 → 直接选中该预置标签，避免重复
    const existing = availableTags.find((t) => t.name === name)
    if (existing) {
      setSelectedTags((prev) => (prev.includes(existing.id) ? prev : [...prev, existing.id]))
      setTagInput('')
      return
    }
    if (customTags.some((t) => t.toLowerCase() === name.toLowerCase())) {
      setTagInput('')
      return
    }
    if (selectedTags.length + customTags.length >= 5) {
      toast('标签最多 5 个')
      return
    }
    setCustomTags((prev) => [...prev, name])
    setTagInput('')
  }

  async function submit() {
    if (!ensureVerified()) return
    if (!boardId) {
      toast('请选择板块')
      return
    }
    if (!title.trim()) {
      toast('请填写标题')
      return
    }
    if (!content.trim()) {
      toast('请填写正文')
      return
    }
    setSubmitting(true)
    try {
      if (isEdit) {
        const post = await updatePost(editId, {
          title: title.trim(),
          content: content.trim(),
          is_anonymous: anonymous,
          tag_ids: selectedTags,
          tag_names: customTags,
          object_keys: images.map((i) => i.key)
        })
        toast('已保存')
        navigate(`/post/${post.id}`, { replace: true })
      } else {
        const post = await createPost({
          board_id: boardId,
          title: title.trim(),
          content: content.trim(),
          tag_ids: selectedTags,
          tag_names: customTags,
          is_anonymous: anonymous,
          object_keys: images.map((i) => i.key)
        })
        toast('发布成功')
        navigate(`/post/${post.id}`, { replace: true })
      }
    } catch {
      // request 层已 toast
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-ink mb-5">{isEdit ? '编辑帖子' : '发布帖子'}</h1>

      <div className="bg-surface rounded-xl border border-line/60 p-6 space-y-5">
        {/* 板块 */}
        <div>
          <label className="block text-sm font-medium text-ink-2 mb-1.5">选择板块</label>
          {isEdit ? (
            <div className="h-11 flex items-center px-3 rounded-lg border border-line bg-black/[0.03] text-sm text-ink-2">
              {editBoardName || '板块'}
            </div>
          ) : (
            <BoardSelect value={boardId} onChange={onBoardChange} allowAll={false} placeholder="选择板块" fullWidth />
          )}
        </div>

        {/* 标题 */}
        <div>
          <label className="block text-sm font-medium text-ink-2 mb-1.5">标题</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder="一句话说清主题（最多 80 字）"
            className="w-full h-11 rounded-lg border border-line bg-bg px-3 text-sm text-ink placeholder:text-ink-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-all"
          />
        </div>

        {/* 正文 */}
        <div>
          <label className="block text-sm font-medium text-ink-2 mb-1.5">正文</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={10}
            placeholder="详细描述你的问题、经验或想法…"
            className="w-full resize-y rounded-lg border border-line bg-bg p-3 text-sm text-ink placeholder:text-ink-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-all leading-relaxed"
          />
        </div>

        {/* 标签 */}
        <div>
          <label className="block text-sm font-medium text-ink-2 mb-2">标签（可多选，最多 5 个）</label>
          {availableTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {availableTags.map((t) => {
                const active = selectedTags.includes(t.id)
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleTag(t.id)}
                    className={cn(
                      'px-3 h-8 rounded-full text-[13px] border transition-colors',
                      active
                        ? 'bg-brand text-white border-brand'
                        : 'bg-bg text-ink-2 border-line hover:border-brand/40'
                    )}
                  >
                    {t.name}
                    {t.is_required && <span className="ml-0.5 text-[11px] opacity-80">*</span>}
                  </button>
                )
              })}
            </div>
          )}

          {/* 自定义标签：即时创建 */}
          <div className="flex flex-wrap gap-2 items-center">
            {customTags.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-1 px-3 h-8 rounded-full text-[13px] bg-brand/10 text-brand border border-brand/30"
              >
                {name}
                <button
                  onClick={() => setCustomTags((prev) => prev.filter((x) => x !== name))}
                  className="text-brand/70 hover:text-brand leading-none"
                >
                  ×
                </button>
              </span>
            ))}
            <div className="flex items-center gap-2">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addCustomTag()
                  }
                }}
                maxLength={16}
                placeholder="输入新标签"
                className="h-8 rounded-full border border-line bg-bg px-3 text-[13px] text-ink placeholder:text-ink-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-all"
              />
              <button
                type="button"
                onClick={addCustomTag}
                className="px-3 h-8 rounded-full text-[13px] border border-dashed border-line text-ink-2 hover:border-brand hover:text-brand transition-colors"
              >
                + 添加
              </button>
            </div>
          </div>
        </div>

        {/* 图片 */}
        <div>
          <label className="block text-sm font-medium text-ink-2 mb-2">图片（最多 9 张）</label>
          <div className="flex flex-wrap gap-3">
            {images.map((img, i) => (
              <div key={img.key} className="relative w-24 h-24 rounded-lg overflow-hidden bg-black/[0.04]">
                <img src={img.url} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs leading-none flex items-center justify-center hover:bg-black/80"
                >
                  ×
                </button>
              </div>
            ))}

            {images.length < 9 && (
              <label className="w-24 h-24 rounded-lg border-2 border-dashed border-line flex flex-col items-center justify-center text-ink-3 cursor-pointer hover:border-brand hover:text-brand transition-colors">
                {uploading ? (
                  <Spinner className="w-5 h-5 text-brand" />
                ) : (
                  <>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    <span className="mt-1 text-[12px]">上传</span>
                  </>
                )}
                <input type="file" accept="image/*" multiple hidden onChange={onFiles} />
              </label>
            )}
          </div>
        </div>

        {/* 匿名 */}
        <label className="flex items-center gap-2 text-sm text-ink-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
            className="w-4 h-4 accent-brand"
          />
          匿名发布（帖子将不显示你的昵称）
        </label>

        <div className="pt-2 flex items-center gap-3">
          <Button onClick={submit} loading={submitting} size="lg">
            发布
          </Button>
          <Button variant="ghost" size="lg" onClick={() => navigate(-1)}>
            取消
          </Button>
        </div>
      </div>
    </div>
  )
}
