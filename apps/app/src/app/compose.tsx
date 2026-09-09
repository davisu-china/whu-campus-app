import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { createPost, getBoardTags, getPost, toast, updatePost, useCategoryStore } from '@whu/shared'
import type { Tag } from '@whu/shared'
import { useAuth } from '@/hooks/use-auth'
import { useVisibleCategories } from '@/hooks/use-visible-categories'
import { BoardSelect } from '@/components/board-select'
import { ScreenHeader } from '@/components/screen-header'
import { pickAndUploadImages } from '@/lib/upload'
import { colors } from '@/constants/theme'

interface LocalImage {
  key: string // object_key
  uri: string // 预览 uri（本地 file:// 或远程 url）
}

export default function ComposeScreen() {
  const router = useRouter()
  const { ensureVerified } = useAuth()
  const categories = useVisibleCategories()
  const loadCategories = useCategoryStore((s) => s.load)

  const { edit } = useLocalSearchParams<{ edit?: string }>()
  const editId = (Array.isArray(edit) ? edit[0] : edit) || ''
  const isEdit = !!editId

  const [boardId, setBoardId] = useState('')
  const [boardName, setBoardName] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [availableTags, setAvailableTags] = useState<Tag[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [customTags, setCustomTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [images, setImages] = useState<LocalImage[]>([])
  const [anonymous, setAnonymous] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  // 编辑模式：加载原帖预填（板块不可改，标题/正文/匿名/标签/图片均可改）
  useEffect(() => {
    if (!editId) return
    getPost(editId)
      .then((p) => {
        setBoardId(p.board_id)
        setBoardName(p.board_name || '')
        setTitle(p.title)
        setContent(p.content)
        setAnonymous(p.is_anonymous)
        setSelectedTags(p.tags?.map((t) => t.id) || [])
        setImages((p.images || []).map((im) => ({ key: im.object_key, uri: im.url })))
      })
      .catch(() => toast('帖子加载失败'))
  }, [editId])

  const firstBoard = useMemo(() => categories[0]?.boards[0] ?? null, [categories])
  useEffect(() => {
    if (!boardId && firstBoard && !isEdit) {
      setBoardId(firstBoard.id)
    }
  }, [firstBoard, boardId, isEdit])

  useEffect(() => {
    if (!boardId) {
      setAvailableTags([])
      return
    }
    getBoardTags(boardId)
      .then(setAvailableTags)
      .catch(() => setAvailableTags([]))
  }, [boardId])

  function onBoardChange(id: string) {
    setBoardId(id)
    setSelectedTags([])
  }

  function toggleTag(id: string) {
    setSelectedTags((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]))
  }

  function addCustomTag() {
    const name = tagInput.trim()
    if (!name) return
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

  async function addImages() {
    setUploading(true)
    try {
      const picked = await pickAndUploadImages()
      setImages((prev) => [...prev, ...picked].slice(0, 9))
    } catch {
      toast('图片上传失败，请重试')
    } finally {
      setUploading(false)
    }
  }

  function removeImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx))
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
      const objectKeys = images.map((i) => i.key)
      const post = isEdit
        ? await updatePost(editId, {
            title: title.trim(),
            content: content.trim(),
            is_anonymous: anonymous,
            tag_ids: selectedTags,
            tag_names: customTags,
            object_keys: objectKeys
          })
        : await createPost({
            board_id: boardId,
            title: title.trim(),
            content: content.trim(),
            tag_ids: selectedTags,
            tag_names: customTags,
            is_anonymous: anonymous,
            object_keys: objectKeys
          })
      toast(isEdit ? '已保存' : '发布成功')
      router.replace(`/post/${post.id}`)
    } catch {
      // request 层已 toast
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        title={isEdit ? '编辑帖子' : '发布帖子'}
        right={
          <Pressable onPress={submit} disabled={submitting} hitSlop={8}>
            <Text style={[styles.submitText, submitting && styles.disabled]}>
              {isEdit ? (submitting ? '保存中…' : '保存') : submitting ? '发布中…' : '发布'}
            </Text>
          </Pressable>
        }
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>选择板块</Text>
          {isEdit ? (
            <View style={[styles.boardSelect, styles.boardSelectDisabled]}>
              <Text style={styles.boardSelectText}>{boardName || '板块'}</Text>
            </View>
          ) : (
            <BoardSelect value={boardId} onChange={onBoardChange} allowAll={false} placeholder="选择板块" fullWidth />
          )}

          <Text style={styles.label}>标题</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            maxLength={80}
            placeholder="一句话说清主题（最多 80 字）"
            placeholderTextColor={colors.ink3}
          />

          <Text style={styles.label}>正文</Text>
          <TextInput
            style={[styles.input, styles.contentInput]}
            value={content}
            onChangeText={setContent}
            multiline
            placeholder="详细描述你的问题、经验或想法…"
            placeholderTextColor={colors.ink3}
            textAlignVertical="top"
          />

          <Text style={styles.label}>标签（最多 5 个）</Text>
          {availableTags.length > 0 ? (
            <View style={styles.tags}>
              {availableTags.map((t) => {
                const active = selectedTags.includes(t.id)
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => toggleTag(t.id)}
                    style={[styles.tagChip, active && styles.tagChipActive]}
                  >
                    <Text style={[styles.tagChipText, active && styles.tagChipTextActive]}>
                      {t.name}
                      {t.is_required ? '*' : ''}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          ) : null}

          <View style={styles.customTags}>
            {customTags.map((name) => (
              <View key={name} style={styles.customTag}>
                <Text style={styles.customTagText}>{name}</Text>
                <Pressable onPress={() => setCustomTags((prev) => prev.filter((x) => x !== name))} hitSlop={8}>
                  <Text style={styles.customTagClose}>×</Text>
                </Pressable>
              </View>
            ))}
          </View>
          <View style={styles.customTagInputRow}>
            <TextInput
              style={[styles.input, styles.customTagInput]}
              value={tagInput}
              onChangeText={setTagInput}
              maxLength={16}
              placeholder="输入新标签"
              placeholderTextColor={colors.ink3}
              onSubmitEditing={addCustomTag}
              returnKeyType="done"
            />
            <Pressable style={styles.addTagBtn} onPress={addCustomTag}>
              <Text style={styles.addTagBtnText}>+ 添加</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>图片（最多 9 张）</Text>
          <View style={styles.imagesGrid}>
            {images.map((img, i) => (
              <View key={`${img.key}-${i}`} style={styles.imageItem}>
                <Image source={{ uri: img.uri }} style={styles.imageThumb} contentFit="cover" transition={120} />
                <Pressable style={styles.imageRemove} onPress={() => removeImage(i)} hitSlop={6}>
                  <Text style={styles.imageRemoveText}>×</Text>
                </Pressable>
              </View>
            ))}
            {images.length < 9 ? (
              <Pressable style={styles.imageAdd} onPress={addImages} disabled={uploading}>
                {uploading ? (
                  <ActivityIndicator color={colors.brand} />
                ) : (
                  <Text style={styles.imageAddPlus}>＋</Text>
                )}
              </Pressable>
            ) : null}
          </View>

          <Pressable style={styles.anonRow} onPress={() => setAnonymous((v) => !v)}>
            <View style={[styles.checkbox, anonymous && styles.checkboxOn]}>
              {anonymous ? <Text style={styles.checkmark}>✓</Text> : null}
            </View>
            <Text style={styles.anonText}>匿名发布（帖子将不显示你的昵称）</Text>
          </Pressable>
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
  submitText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.brand
  },
  disabled: {
    opacity: 0.5
  },
  body: {
    padding: 16,
    paddingBottom: 40
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.ink2,
    marginBottom: 8,
    marginTop: 16
  },
  boardSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 14
  },
  boardSelectDisabled: {
    backgroundColor: 'rgba(15,23,42,0.04)'
  },
  boardSelectText: {
    fontSize: 15,
    color: colors.ink
  },
  boardSelectPlaceholder: {
    fontSize: 15,
    color: colors.ink3
  },
  chevron: {
    fontSize: 20,
    color: colors.ink3
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink
  },
  contentInput: {
    minHeight: 160
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  tagChip: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    justifyContent: 'center'
  },
  tagChipActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand
  },
  tagChipText: {
    fontSize: 13,
    color: colors.ink2
  },
  tagChipTextActive: {
    color: '#fff'
  },
  customTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12
  },
  customTag: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: 'rgba(31,138,91,0.3)'
  },
  customTagText: {
    fontSize: 13,
    color: colors.brand
  },
  customTagClose: {
    marginLeft: 6,
    fontSize: 16,
    color: colors.brand,
    opacity: 0.7
  },
  customTagInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12
  },
  customTagInput: {
    flex: 1
  },
  addTagBtn: {
    marginLeft: 10,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center'
  },
  addTagBtnText: {
    fontSize: 13,
    color: colors.ink2
  },
  imagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  imageItem: {
    width: 84,
    height: 84,
    borderRadius: 10,
    overflow: 'hidden'
  },
  imageThumb: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(15,23,42,0.04)'
  },
  imageRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(15,23,42,0.6)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  imageRemoveText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 16
  },
  imageAdd: {
    width: 84,
    height: 84,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface
  },
  imageAddPlus: {
    fontSize: 28,
    color: colors.ink3
  },
  anonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8
  },
  checkboxOn: {
    backgroundColor: colors.brand,
    borderColor: colors.brand
  },
  checkmark: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700'
  },
  anonText: {
    fontSize: 14,
    color: colors.ink2
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.4)',
    justifyContent: 'flex-end'
  },
  modalSheet: {
    maxHeight: '70%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
    paddingVertical: 16
  },
  modalCat: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink3,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 6
  },
  modalBoard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12
  },
  modalBoardText: {
    fontSize: 15,
    color: colors.ink
  },
  modalBoardActive: {
    color: colors.brand,
    fontWeight: '600'
  },
  modalCheck: {
    color: colors.brand,
    fontSize: 16,
    fontWeight: '700'
  }
})
