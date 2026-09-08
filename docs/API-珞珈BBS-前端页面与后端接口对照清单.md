# 珞珈BBS · 前端页面 ↔ 后端接口对照清单

> 版本：MVP · 对齐基线 2026-09-08
> 用途：前端页面 / API 模块 / 后端路由 三向对照，作为前后端联调的单一事实来源（SSOT）。
> 状态：✅ 已对齐 · ⚠️ 需关注 · ❌ 待补齐

---

## 0. 全局契约

### 0.1 响应信封（envelope）

所有接口返回统一结构，`code = 0` 表示成功：

```json
{ "code": 0, "message": "ok", "data": { } }
```

- 前端 `src/api/request.ts` 依据 `code` 判定成功/失败，非 0 时抛错并走统一 toast。
- 后端 `pkg/response` 统一产出该结构（`OK` / `OKPage` / `Fail`）。

### 0.2 错误码对照

| code | 含义 | 前端处理 |
|------|------|----------|
| 0 | 成功 | — |
| 10001 | 参数错误 | 通用 toast |
| 10002 | 资源不存在 | `CODE.NOT_FOUND` |
| 10003 | 冲突（重复操作） | 通用 toast |
| 10004 | 触发限流 | `CODE.RATE_LIMITED` |
| 10999 | 系统繁忙 | 通用 toast |
| 20001 | 未登录/登录过期 | `CODE.UNAUTHORIZED` → 清 token、跳登录 |
| 20002 | token 过期 | `CODE.TOKEN_EXPIRED` → 尝试 refresh，失败跳登录 |
| 20003 | 邮箱域名无效（非武大） | 登录页提示 |
| 20004 | 验证码错误 | 登录页提示 |
| 20005 | 验证码过期 | 登录页提示 |
| 20006 | 无权访问 | `CODE.FORBIDDEN` |
| 20007 | 用户被封禁 | `CODE.BANNED` |
| 20008 | 需学生认证 | `CODE.NOT_VERIFIED` → 引导认证 |
| 30001 | 板块不存在 | 页面兜底 |
| 30002 | 标签非法 | 发帖校验提示 |
| 30003 | 必选标签缺失 | 发帖校验提示 |
| 40001 | 帖子不存在 | 页面兜底 |
| 40002 | 帖子不可见 | 页面兜底 |
| 40003 | 回复不存在 | 页面兜底 |
| 40004 | 命中敏感词 | 内容提示 |
| 50001 | 已点赞 | 幂等，忽略 |
| 60001 | 非作者 | 禁止编辑/删除 |
| 60002 | 无权限 | `FORBIDDEN` |
| 90001–90003 | 内部/存储错误 | 通用 toast |

> 前端 `request.ts` 的 `CODE` 常量仅覆盖需要特殊跳转/处理的码（0/10002/10004/20001/20002/20006/20007/20008），其余走默认 toast。

### 0.3 分页规范

后端统一返回 `Page`，`has_more` 为本次新增的累加字段：

```json
{ "list": [], "total": 0, "page": 1, "page_size": 20, "has_more": false }
```

- 前端 `PageResult<T>` 声明 `{ list, has_more, page }`（`total` / `page_size` 未用，不阻塞）。
- 计算规则（后端 `response.OKPage`）：`has_more = int64(page * page_size) < total`。

### 0.4 命名约定

- JSON 统一 **snake_case**（与后端 Go `json` tag 一致），前端 DTO 不做转换。
- ⚠️ 唯一例外：**搜索接口**用 `board` / `tag` 而非 `board_id` / `tag_id`（见 §2.7），历史命名，前端已适配，后续可统一。

---

## 1. 前端 API 模块总览

| 模块 | 文件 | 说明 |
|------|------|------|
| auth | `src/api/auth.ts` | 邮箱验证码登录 / 本人资料 |
| board | `src/api/board.ts` | 分类、板块、板块标签、板块帖子 |
| content | `src/api/content.ts` | 帖子、回复、互动、举报 |
| search | `src/api/search.ts` | 全文搜索、字典搜索 |
| upload | `src/api/upload.ts` | 预签名直传（双协议） |
| user | `src/api/user.ts` | 他人主页、我的内容 |
| notification | `src/api/notification.ts` | 通知列表 / 未读 / 已读 |

---

## 2. 页面 → 接口 对照

### 2.1 登录页 `pages/login`

| 前端函数 | 方法 & 路由 | 入参 | 出参 | 状态 |
|----------|-------------|------|------|------|
| `sendEmailCode` | POST `/api/v1/auth/email/send-code` | `{ email }` | `{ ok }` | ✅ |
| `loginByCode` | POST `/api/v1/auth/email/login` | `{ email, code }` | `LoginResult{ access_token, refresh_token, user }` | ✅ |

### 2.2 首页 `pages/home`

| 前端函数 | 方法 & 路由 | 入参 | 出参 | 状态 |
|----------|-------------|------|------|------|
| `getHomeFeed` | GET `/api/v1/home/feed` | `{ page, page_size }` | `PageResult<Post>` | ✅ |
| `getHomeHot` | GET `/api/v1/home/hot` | `{ limit }`（可选） | `Post[]` | ✅ |

### 2.3 板块页 `pages/board`

| 前端函数 | 方法 & 路由 | 入参 | 出参 | 状态 |
|----------|-------------|------|------|------|
| `getCategories` | GET `/api/v1/categories` | — | `Category[]` | ✅ |
| `getBoard` | GET `/api/v1/boards/:id` | — | `Board` | ✅ |
| `getBoardTags` | GET `/api/v1/boards/:id/tags` | — | `Tag[]` | ✅ |
| `getBoardPosts` | GET `/api/v1/boards/:id/posts` | `{ page, sort, tag_id }` | `PageResult<Post>` | ✅ |

> `sort` 取值 `comprehensive`（综合，默认）/ `latest` / `hot` / `featured`；后端 `BoardPosts` 默认值同为 `comprehensive`。
> `tag_id`（非 `tag`）已对齐。

### 2.4 帖子详情 `pages/post-detail`

| 前端函数 | 方法 & 路由 | 入参 | 出参 | 状态 |
|----------|-------------|------|------|------|
| `getPost` | GET `/api/v1/posts/:id` | — | `Post` | ✅ |
| `getReplies` | GET `/api/v1/posts/:id/replies` | — | `Reply[]`（全量树） | ✅ |
| `createReply` | POST `/api/v1/posts/:id/replies` | `{ content, parent_id?, reply_to_id?, is_anonymous? }` | `Reply` | ⚠️ 见 2.4.1 |
| `toggleLikePost` | POST `/api/v1/posts/:id/like` | — | `{ liked }` | ✅ |
| `toggleFavorite` | POST `/api/v1/posts/:id/favorite` | — | `{ favorited }` | ✅ |
| `report` | POST `/api/v1/reports` | `{ target_type, target_id, reason }` | `{ ok }` | ✅ |

> **2.4.1 ⚠️** 回复为**全量楼中楼树**（非分页），前端已改为一次性加载（`getReplies` 返回 `Reply[]`），不再走 `usePaginatedList`。
> **⚠️ 待补齐**：后端 `CreateReplyInput` 当前仅绑定 `{ content, is_anonymous, parent_id }`，**未接收 `reply_to_id`**。前端已传 `reply_to_id`（用于 @楼层显示），后端静默忽略，功能无阻塞但「回复对象」未落库。若需展示「回复 @某人」需在后端补字段。

### 2.5 发帖页 `pages/compose`

| 前端函数 | 方法 & 路由 | 入参 | 出参 | 状态 |
|----------|-------------|------|------|------|
| `createPost` | POST `/api/v1/posts` | `{ board_id, title, content, tag_ids?, is_anonymous?, fields?, object_keys? }` | `Post` | ✅ |
| `getPresign` | POST `/api/v1/upload/presign` | `{ client, filename, content_type }` | `PresignResult` | ⚠️ 见 2.5.1 |
| `searchDict` | GET `/api/v1/dict/search` | `{ type, q }` | `DictItem[]` | ✅ |

> **2.5.1 ⚠️** 后端 `PresignUpload` 仅绑定 `{ filename, client }`，**未读取 `content_type`**。前端已发送，后端忽略，无阻塞；若需按类型校验可在后端补读。
> 上传为**双协议**：`client=miniapp` 走 `protocol=post`（`url + fields`，配合 `Taro.uploadFile` POST 表单）；`client=web` 走 `protocol=put`（`upload_url`，`fetch` PUT raw body）。

### 2.6 搜索页 `pages/search`

| 前端函数 | 方法 & 路由 | 入参 | 出参 | 状态 |
|----------|-------------|------|------|------|
| `searchPosts` | GET `/api/v1/search` | `{ q, board?, tag?, page? }` | `PageResult<Post>` | ✅ |
| `searchDict` | GET `/api/v1/dict/search` | `{ type, q }` | `DictItem[]` | ✅ |

> ⚠️ 搜索过滤参数为 `board` / `tag`（非 `board_id` / `tag_id`），与后端 `Search` 处理器一致；命名与其它接口不统一，建议后续统一为 `board_id` / `tag_id`。

### 2.7 通知页 `pages/notifications`

| 前端函数 | 方法 & 路由 | 入参 | 出参 | 状态 |
|----------|-------------|------|------|------|
| `getNotifications` | GET `/api/v1/notifications` | `{ page }` | `PageResult<NotificationItem>` | ✅ |
| `getUnreadCount` | GET `/api/v1/notifications/unread-count` | — | `{ unread_count }` | ✅ |
| `markRead` | POST `/api/v1/notifications/read` | `{ ids? }` | `{ ok }` | ✅ |

> `getUnreadCount` 返回键名 `unread_count` 已对齐；`store/notification.ts` 读取 `unread_count`。
> ⚠️ 单条已读后端另有 `POST /notifications/:id/read`，前端当前用 `ids` 批量接口，可二选一。

### 2.8 我的 `pages/profile`

| 前端函数 | 方法 & 路由 | 入参 | 出参 | 状态 |
|----------|-------------|------|------|------|
| `getMe` | GET `/api/v1/users/me` | — | `User` | ✅ |
| `updateMe` | PUT `/api/v1/users/me` | `{ nickname?, avatar_url?, college?, grade?, bio?, student_no? }` | `User` | ✅ |
| `getMyPosts` | GET `/api/v1/users/me/posts` | `{ page }` | `PageResult<Post>` | ✅ |
| `getMyFavorites` | GET `/api/v1/users/me/favorites` | `{ page }` | `PageResult<Post>` | ✅ |
| `getMyReplies` | GET `/api/v1/users/me/replies` | `{ page }` | `PageResult<Reply>` | ✅ |

### 2.9 他人主页 `pages/user`

| 前端函数 | 方法 & 路由 | 入参 | 出参 | 状态 |
|----------|-------------|------|------|------|
| `getUser` | GET `/api/v1/users/:id` | — | `User` | ✅ |
| `getUserPosts` | GET `/api/v1/users/:id/posts` | `{ page }` | `PageResult<Post>` | ✅ |

> `GET /users/:id/posts` 为本轮**新增后端路由**（复用 `MyPosts` 查询），已实现并在前端 `user.ts` 接入。

---

## 3. 核心 DTO 字段对齐（snake_case）

| 前端类型 | 关键字段 | 后端来源 | 状态 |
|----------|----------|----------|------|
| `User` | `id, nickname, avatar_url, is_verified, student_no?, college?, grade?, bio?` | `model.User` | ✅（本轮补 `student_no`） |
| `Board` | `id, name, slug, description, field_mode` | `model.Board` | ✅ |
| `Post` | `id, board_id, title, content, is_anonymous, is_pinned, is_featured, view_count, reply_count, like_count, status?, created_at` + `board_name?, author?, tags?, fields?, images?, liked?, favorited?` | `PostView` | ✅ |
| `PostField` | `field_key, dict_item_id?, raw_value?` | `model.PostField` | ✅ |
| `ImageRef` | `object_key, url` | `service.ImageRef` | ✅（本轮新增，图片公开 URL 由后端 `PublicURL` 解析） |
| `Reply` | `id, floor_no, parent_id?, reply_to_id?, author?, content, is_anonymous, like_count, created_at, children?` | `ReplyView` | ✅ |
| `PageResult` | `list, has_more, page` | `response.Page` | ✅（后端含 `total/page_size` 富余字段） |

---

## 4. 本轮对齐修复记录

**后端（`backend/`）**
- `pkg/response/response.go`：`Page` 新增 `has_more`，`OKPage` 自动计算。
- `internal/config/config.go`：`MinIOConfig` 新增 `PublicBaseURL`。
- `internal/storage/minio.go`：新增 `PresignPost`（PostPolicy 表单）与 `PublicURL`。
- `internal/service/views.go`：图片 `Images` 由 `[]model.Attachment` 改为 `[]ImageRef{ObjectKey, URL}`。
- `internal/service/content.go`：`PresignUploadResult` 支持 `protocol/upload_url/url/fields/object_key/expires_in` 双协议；`buildPostViewDetail` 图片改为 `ImageRef`。
- `internal/handler/content.go`：`PresignUpload` 绑定 `{filename, client}`；新增 `UserPosts`。
- `internal/router/router.go`：新增 `GET /users/:id/posts`。
- `internal/service/content.go`：`CreateReplyInput` 新增 `reply_to_id`，回复落库时 `ReplyToID` 优先取显式 @ 对象（校验同帖），通知对象改为被 @ 楼层作者。
- `internal/handler/content.go`：搜索过滤参数 `board`/`tag` 统一为 `board_id`/`tag_id`。

**前端（`luojia-frontend/`）**
- `api/request.ts`：`CODE` 错误码改为真实后端码（0/10002/10004/20001/20002/20006/20007/20008）。
- `constants/enums.ts`：排序 key `default` → `comprehensive`。
- `api/types.ts`：新增 `PostField/ImageRef`；`SortType` 四值；`Post`/`Reply` 字段扩充；`User` 补 `student_no`。
- `api/board.ts`：`PostQuery.tag` → `tag_id`。
- `api/content.ts`：`getReplies` 返回 `Reply[]`（不分页）；移除本地重复 `PostField`。
- `api/notification.ts` / `store/notification.ts`：读取 `unread_count`。
- `components/PostCard`：tags 用 `t.id/t.name`，图片用 `i.url`。
- `pages/board`：`sort` 默认 `comprehensive`、`tag_id` 入参。
- `pages/post-detail`：回复改为全量加载 + `images.map(i => i.url)`，移除分页逻辑；作者可见「编辑 / 删除」入口。
- `pages/compose`：支持编辑模式（`?id=` 预填标题/正文/标签，板块与图片锁定）。
- `api/content.ts`：新增 `updatePost` / `deletePost` / `UpdatePostInput`。
- `api/search.ts`：`searchPosts` 过滤参数统一为 `board_id`/`tag_id`。
- `api/notification.ts`：新增 `markReadOne`（单条已读）。
- `api/request.ts`：清理过时注释（错误码已对齐，非占位码）。

---

## 5. 遗留项 / 待办

| # | 事项 | 影响 | 建议 |
|---|------|------|------|
| 1 | ~~后端 `CreateReplyInput` 缺 `reply_to_id`~~ | ✅ 已修复（见 §4） | 后端已补字段并落库 |
| 2 | 后端 `PresignUpload` 未读 `content_type` | 无阻塞，忽略即可 | 需要校验时补读 |
| 3 | ~~搜索接口 `board`/`tag` 命名不统一~~ | ✅ 已统一为 `board_id`/`tag_id`（见 §4） | 后端 handler + 前端 search.ts 同步改 |
| 4 | `PublicBaseURL` 部署配置 | ✅ API 域名已定 `bbs.jianjiange.site`；MinIO 公网域名待申请 | 申请后填 `MINIO_PUBLIC_BASE_URL` |
| 5 | ~~前端未接编辑/删除~~ | ✅ 已接入（见 §4） | 编辑复用发帖页、作者可见删除 |
| 6 | ~~前端未接单条已读~~ | ✅ 已补 `markReadOne`（见 §4） | 进页全量已读仍为主流程 |

---

## 6. 验证结论

- 后端 `go build ./...` ✅ 通过。
- 前端 `npm run type-check`（`tsc --noEmit`）✅ 通过（0 error）。
