import { View, Text, Input, Textarea, Picker, Image, Switch } from '@tarojs/components'
import Taro, { useLoad, useRouter } from '@tarojs/taro'
import { useState } from 'react'
import Button from '../../components/Button'
import Tag from '../../components/Tag'
import { getCategories, getBoard, getBoardTags } from '../../api/board'
import { createPost, updatePost, getPost } from '../../api/content'
import { uploadFile } from '../../api/upload'
import { useAuth } from '../../hooks/useAuth'
import type { Board, Tag as TagType } from '../../api/types'
import './index.scss'

export default function Compose() {
  const router = useRouter()
  const editId = router.params.id || ''
  const isEdit = !!editId

  const { ensureVerified } = useAuth()

  const [boards, setBoards] = useState<Board[]>([])
  const [boardNames, setBoardNames] = useState<string[]>([])
  const [boardIndex, setBoardIndex] = useState(-1)
  const [board, setBoard] = useState<Board | null>(null)
  const [tags, setTags] = useState<TagType[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [objectKeys, setObjectKeys] = useState<string[]>([])
  const [anonymous, setAnonymous] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useLoad(() => {
    if (isEdit) {
      loadForEdit()
    } else {
      getCategories()
        .then((cats) => {
          const all = cats.flatMap((c) => c.boards)
          setBoards(all)
          setBoardNames(all.map((b) => b.name))
        })
        .catch(() => {})
    }
  })

  const loadForEdit = async () => {
    try {
      const post = await getPost(editId)
      setTitle(post.title)
      setContent(post.content)
      setAnonymous(post.is_anonymous)
      setSelectedTags((post.tags || []).map((t) => t.id))
      // 板块不可改，仅加载板块及标签用于展示/编辑标签
      const b = await getBoard(post.board_id)
      setBoard(b)
      if (b.field_mode === 0) {
        getBoardTags(b.id).then(setTags).catch(() => {})
      }
    } catch {
      Taro.showToast({ title: '帖子加载失败', icon: 'none' })
      setTimeout(() => Taro.navigateBack(), 600)
    }
  }

  const selectBoard = async (i: number) => {
    const b = boards[i]
    setBoardIndex(i)
    setBoard(b)
    setTags([])
    setSelectedTags([])
    if (b && b.field_mode === 0) {
      getBoardTags(b.id).then(setTags).catch(() => {})
    }
  }

  const toggleTag = (id: string) => {
    setSelectedTags((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const chooseImages = async () => {
    const res = await Taro.chooseMedia({ count: 9 - images.length, mediaType: ['image'] })
    const paths = res.tempFiles.map((f) => f.tempFilePath)
    const keys: string[] = []
    for (const p of paths) {
      try {
        keys.push(await uploadFile(p))
      } catch {
        Taro.showToast({ title: '图片上传失败', icon: 'none' })
        return
      }
    }
    setImages((prev) => [...prev, ...paths])
    setObjectKeys((prev) => [...prev, ...keys])
  }

  const submit = async () => {
    if (!ensureVerified()) return
    if (!title.trim() || !content.trim()) {
      Taro.showToast({ title: '请填写标题和正文', icon: 'none' })
      return
    }
    if (!isEdit && !board) {
      Taro.showToast({ title: '请选择板块', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      if (isEdit) {
        await updatePost(editId, {
          title: title.trim(),
          content: content.trim(),
          tag_ids: selectedTags,
          is_anonymous: anonymous
        })
        Taro.showToast({ title: '已保存', icon: 'success' })
      } else {
        const post = await createPost({
          board_id: board!.id,
          title: title.trim(),
          content: content.trim(),
          tag_ids: selectedTags,
          is_anonymous: anonymous,
          object_keys: objectKeys
        })
        if (post.status === 2) {
          Taro.showToast({ title: '发布成功', icon: 'success' })
        } else {
          Taro.showToast({ title: '内容已提交，审核通过后展示', icon: 'none' })
        }
      }
      setTimeout(() => Taro.navigateBack(), 800)
    } catch {
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className='luo-page luo-page-pad compose'>
      {isEdit ? (
        <View className='compose-field'>
          <Text className='compose-label'>板块</Text>
          <Text className='compose-picker-value'>{board?.name || '—'}</Text>
        </View>
      ) : (
        <Picker mode='selector' range={boardNames} onChange={(e) => selectBoard(Number(e.detail.value))}>
          <View className='compose-field'>
            <Text className='compose-label'>板块</Text>
            <Text className='compose-picker-value'>{boardIndex >= 0 ? boardNames[boardIndex] : '选择板块'}</Text>
          </View>
        </Picker>
      )}

      {board && board.field_mode === 0 && tags.length > 0 && (
        <View className='compose-tags'>
          {tags.map((t) => (
            <Tag
              key={t.id}
              variant={selectedTags.includes(t.id) ? 'strong' : 'tag'}
              onClick={() => toggleTag(t.id)}
            >
              {t.name}
              {t.is_required ? ' *' : ''}
            </Tag>
          ))}
        </View>
      )}

      <View className='compose-field'>
        <Text className='compose-label'>标题</Text>
        <Input
          className='compose-title-input'
          placeholder='一句话说明内容'
          value={title}
          onInput={(e) => setTitle(e.detail.value)}
          maxlength={120}
        />
      </View>

      <View className='compose-field'>
        <Text className='compose-label'>正文</Text>
        <Textarea
          className='compose-content-input'
          placeholder='写下你想说的话…'
          value={content}
          onInput={(e) => setContent(e.detail.value)}
        />
      </View>

      {!isEdit && (
        <View className='compose-images'>
          {images.map((img, i) => (
            <Image key={i} className='compose-image' src={img} mode='aspectFill' />
          ))}
          {images.length < 9 && (
            <View className='compose-image-add' onClick={chooseImages}>
              ＋
            </View>
          )}
        </View>
      )}

      <View className='compose-anon'>
        <Text className='compose-label'>匿名发布</Text>
        <Switch checked={anonymous} onChange={(e) => setAnonymous(e.detail.value)} color='#2C8063' />
      </View>

      <Button onClick={submit} disabled={submitting} className='compose-submit'>
        {submitting ? '发布中…' : isEdit ? '保存' : '发布'}
      </Button>
    </View>
  )
}
