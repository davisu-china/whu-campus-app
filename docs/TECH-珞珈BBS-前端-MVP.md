# 珞珈BBS 前端技术方案（MVP）

| 项目 | 内容 |
| --- | --- |
| 文档版本 | v0.1 |
| 更新日期 | 2026-09-08 |
| 关联文档 | 《PRD-珞珈BBS-MVP》《TECH-珞珈BBS-后端-MVP》《UI-珞珈BBS-设计规范》 |
| 架构形态 | 一套代码、双端编译（微信小程序 + H5） |
| 技术栈 | Taro 4 + React 18 + TypeScript + Zustand + SCSS |
| 文档范围 | 前端工程结构、状态、鉴权、核心模块、双端差异、构建部署 |

---

## 1. 概述

### 1.1 目标

本文档定义珞珈BBS 前端 MVP 的技术方案，覆盖 PRD 中 P0/P1 功能的端侧实现设计，指导开发落地。核心约束：

- **双端对齐**：一套代码编译到微信小程序与 H5，两端共享业务逻辑、组件与设计 token（呼应 PRD「身份一致」与 UI 规范的「同一份 token 驱动两端」）。
- **对齐后端契约**：严格按《TECH-珞珈BBS-后端-MVP》的 REST 接口（`/api/v1`、`{code,message,data}` 统一响应、JWT、MinIO 预签名上传）实现。
- **对齐设计规范**：所有颜色/字体/间距/圆角/阴影一律引用设计 token，禁止写死色值；明暗双主题同等支持。

### 1.2 非目标

- 后台管理系统前端（运营后台单独规划，不在本文档）。
- 富文本编辑器（MVP 帖子/回复仅纯文本 + 图片，见后端 1.2）。
- 实时推送（MVP 通知用轮询拉取，微信订阅消息/WebSocket 记为后续演进）。
- 复杂数据可视化、积分/等级/商城等（PRD 已明确不做）。

---

## 2. 技术选型

### 2.1 选型表

| 组件 | 选型 | 版本 | 说明 |
| --- | --- | --- | --- |
| 跨端框架 | Taro | 4.x | 一套 React 代码编译到微信小程序 + H5，是「双端对齐」的底座 |
| UI 框架 | React | 18 | 函数组件 + Hooks |
| 语言 | TypeScript | 5.x | 类型安全，前后端共享 DTO 语义 |
| 状态管理 | Zustand | 5.x | 轻量、无样板，客户端状态（鉴权/主题/列表） |
| 样式 | SCSS + CSS 变量 | — | 设计 token 单源 + 运行时主题切换 |
| 请求 | Taro.request 封装 | — | 统一响应/拦截/刷新/错误 |
| 表单/校验 | 自研轻量封装 | — | 发帖、登录表单校验（少量字段，不引重型库） |
| 图片预览 | Taro.previewImage | — | 九宫格点击放大 |
| 构建 | Taro CLI + Webpack 5 | — | `taro build --type weapp/h5` |

> 说明：MVP 不引重型状态/数据缓存库（如 Redux、TanStack Query），用 Zustand + 轻量分页 Hook 覆盖全部需求；当服务端状态复杂度（缓存失效、乐观更新、去重请求）成为瓶颈时再评估 TanStack Query（记为演进项）。

### 2.2 跨端框架决策（为什么 Taro）

PRD 明确「两端功能对齐、身份一致、同一套账户数据」，UI 规范明确「同一份设计 token 驱动两端」。Taro 提供：

1. **代码共享最大化**：页面、组件、API 层、状态、token 一次编写，双端复用。
2. **逻辑单源**：鉴权、分页、图片上传、匿名脱敏等核心逻辑只写一遍，避免双端行为漂移。
3. **样式单源**：SCSS + CSS 变量在 H5 与 WXSS 两端生效，暗色主题一套 token。

代价是放弃部分「端原生极值体验」，但 MVP 阶段「对齐 > 极致」，符合产品当前优先级。

---

## 3. 总体架构

### 3.1 同构架构（一套代码，两端编译）

```
                    ┌───────────────────────────────────────────┐
                    │              src/（唯一代码库）              │
                    │  pages / components / api / store / hooks  │
                    │  styles/tokens（设计 token 单源）            │
                    └───────────────────┬───────────────────────┘
                                        │  Taro CLI
                 ┌──────────────────────┴───────────────────────┐
                 ▼                                              ▼
        taro build --type weapp                      taro build --type h5
                 │                                              │
        ┌────────▼─────────┐                       ┌────────────▼────────┐
        │  微信小程序        │                       │   Web 静态站（H5）    │
        │  (WXML/WXSS/JS)   │                       │  (HTML/CSS/JS)       │
        └────────┬─────────┘                       └────────────┬────────┘
                 │                                              │
                 └───────────────┬──────────────────────────────┘
                                 ▼
                       后端 REST API /api/v1（两端同一套）
```

### 3.2 分层职责

| 层 | 职责 | 约束 |
| --- | --- | --- |
| pages | 页面装配、路由、页面生命周期 | 不直接调 API，不写请求细节 |
| components | 纯展示组件，输入 props 输出 UI | 不含业务请求（受控组件优先） |
| api | 请求封装、接口定义、DTO 类型 | 唯一网络出口 |
| store | 客户端全局状态（鉴权、主题、未读数） | 不含接口缓存细节（分页走 Hook） |
| hooks | 跨页面复用逻辑（分页、鉴权守卫） | 复用优先 |
| styles | 设计 token、主题、mixins | 全项目唯一视觉出口 |

---

## 4. 工程目录结构

```
luojia-frontend/
├── src/
│   ├── app.ts                    # Taro App 生命周期（初始化主题、鉴权恢复）
│   ├── app.config.ts             # 全局配置：pages、window、tabBar、darkmode
│   ├── app.scss                  # 全局样式（引入 token/reset）
│   ├── index.html                # H5 模板
│   ├── styles/
│   │   ├── tokens.scss           # 设计 token（SCSS 变量，单源）
│   │   ├── theme.scss            # CSS 变量 + 明暗主题（:root / page / [data-theme]）
│   │   └── mixins.scss           # 通用 mixin（卡片/按钮/文本省略）
│   ├── components/               # 内部组件库（对齐 UI 规范第 4 章）
│   │   ├── Button/  Tag/  VerifiedBadge/  PostCard/  ImageGrid/
│   │   ├── SearchBar/  SortTabs/  EmptyState/  NoticeBar/
│   │   └── TabBar/               # 自定义底部导航（含中央发帖 FAB）
│   ├── pages/
│   │   ├── home/                 # 首页（广场）
│   │   ├── board/                # 板块列表
│   │   ├── post-detail/          # 帖子详情（楼层）
│   │   ├── compose/              # 发帖
│   │   ├── search/               # 搜索
│   │   ├── notifications/        # 通知
│   │   ├── profile/              # 我的
│   │   ├── user/                 # 他人主页
│   │   └── login/                # 登录
│   ├── api/
│   │   ├── request.ts            # 请求核心：拦截、鉴权、刷新、错误、统一响应
│   │   ├── auth.ts  content.ts  board.ts  user.ts
│   │   ├── search.ts  notification.ts  upload.ts
│   │   └── types.ts              # DTO 类型（对齐后端响应）
│   ├── store/
│   │   ├── auth.ts               # 登录态、用户资料、认证标记
│   │   ├── app.ts                # 主题、tab 状态、全局 UI
│   │   └── notification.ts       # 未读数
│   ├── hooks/
│   │   ├── usePaginatedList.ts   # 通用分页（上拉加载 + 下拉刷新）
│   │   └── useAuth.ts            # 登录守卫、认证态
│   ├── constants/
│   │   └── enums.ts              # 板块/标签/排序/帖子状态 枚举
│   ├── theme/
│   │   └── index.ts              # token 的 TS 常量导出（供 JS 侧动态样式）
│   └── utils/
│       ├── format.ts             # 时间/数字格式化
│       └── mention.ts            # @提及解析
├── config/
│   ├── index.ts  dev.ts  prod.ts # Taro 编译配置（env 注入 API base）
├── project.config.json           # 微信开发者工具配置
└── package.json
```

---

## 5. 设计 token 与主题

### 5.1 单源 token

设计 token 是「高级感 + 双端一致」的落地载体。以**一个 SCSS 文件为唯一视觉源**，同时导出 TS 常量供 JS 侧（canvas、动态内联样式）使用。

```scss
// styles/tokens.scss —— 单源 token（值严格对齐 UI 规范附录）
$green-500: #2C8063;  $green-600: #1F6B51;  $green-700: #185440;
$pink-500:  #D44768;  $pink-600:  #B93454;
$gold-500:  #C29A5B;
$paper: #F8F6F1;  $surface: #FFFFFF;  $surface-2: #F2EFE8;
$line:  #E7E2D8;  $line-strong: #D8D2C4;
$ink-900: #18201B; $ink-700: #3B4640; $ink-500: #66726B; $ink-400: #97A09A;
$radius-sm: 8px; $radius-md: 12px; $radius-lg: 16px; $radius-xl: 24px;
$space-1: 4px; $space-2: 8px; $space-3: 12px; $space-4: 16px; $space-5: 24px;
```

```ts
// theme/index.ts —— 与 tokens.scss 同值，供 JS 侧使用
export const tokens = { green500: '#2C8063', /* ... */ }
```

> 双份（SCSS + TS）有值漂移风险，MVP 以「代码评审 + 统一 PR 模板」约束同步；后续可加一个 `token.json` 单源、用脚本生成 SCSS/TS（演进项）。

### 5.2 明暗主题

主题用 **CSS 变量**运行时切换，同一套变量名，两端各声明一次作用域：

- **H5**：`html[data-theme]` + `prefers-color-scheme`（默认跟随系统，手动可覆盖）。
- **小程序**：`page` 根选择器 + `app.config.ts` 开启 `darkmode: true`，跟随系统；手动覆盖在根节点加 `.theme-dark` 类。

```scss
// theme.scss —— 明暗 token 重新配比（值对齐 UI 规范 1.8 节）
:root {
  --paper:#F8F6F1; --surface:#FFFFFF; --surface-2:#F2EFE8; --line:#E7E2D8;
  --ink-900:#18201B; --ink-700:#3B4640; --ink-500:#66726B; --ink-400:#97A09A;
  --green-500:#2C8063; --green-600:#1F6B51; --green-700:#185440;
  --green-50:#EEF6F1; --green-100:#D8EBE0;
  --pink-500:#D44768; --pink-50:#FEF4F6; --pink-100:#FCE6EA;
  --gold-500:#C29A5B;
}
[data-theme="dark"], .theme-dark {
  --paper:#121614; --surface:#1A201C; --surface-2:#232B26; --line:#2E3832;
  --ink-900:#EAF0EC; --ink-700:#C4CDC7; --ink-500:#99A49D; --ink-400:#6E7A72;
  --green-500:#549E82; --green-600:#6BAE93; --green-700:#83BDA3;
  --green-50:#1E2A24; --green-100:#243129;
  --pink-500:#E5738B; --pink-50:#2A1E22; --pink-100:#332329;
  --gold-500:#D6B36E;
}
```

**规则**：组件内样式**只引用 `var(--token)` 或 `$token`，禁止出现裸色值**。全局样式层用 SCSS 变量，组件层优先 CSS 变量（可被主题覆盖）。

### 5.3 主题状态

```ts
// store/app.ts
type Theme = 'system' | 'light' | 'dark';
// system：跟随系统（默认）；light/dark：手动覆盖，持久化到 storage
```

小程序端「手动覆盖暗色」需额外处理 `Taro.setBackgroundColor` 与导航栏颜色；MVP 优先「跟随系统」，手动切换先在小程序放轻量入口（后续打磨）。

---

## 6. 状态管理

### 6.1 Store 划分（Zustand）

| Store | 状态 | 说明 |
| --- | --- | --- |
| `auth` | `token`、`user`（昵称/头像/认证标记）、`isLoggedIn` | 登录态全局唯一 |
| `app` | `theme`、`tabActive` | 主题与全局 UI |
| `notification` | `unreadCount` | 未读数（tab 红点） |

### 6.2 服务端数据策略

帖子列表、回复等**服务端数据不落全局 store**，由页面级 `usePaginatedList` Hook 管理（分页、刷新、追加），避免全局缓存失效的复杂度。轻量交互（点赞、收藏）做**乐观更新**：本地立即翻转 UI，请求失败回滚 + toast。

```ts
// hooks/usePaginatedList.ts —— 通用分页
function usePaginatedList<T>(fetcher: (page: number) => Promise<{list:T[]; hasMore:boolean}>) {
  // 返回 { list, loading, refreshing, hasMore, loadMore, refresh, onReachBottom }
}
```

---

## 7. API 层与鉴权

### 7.1 统一请求封装

对齐后端「统一响应 `{code:0, message, data}`」契约，封装 `request`：

```ts
// api/request.ts
async function request<T>(opt: {
  url: string; method?: 'GET'|'POST'|'PUT'|'DELETE'; data?: any; auth?: boolean;
}): Promise<T> {
  const resp = await Taro.request({ url: BASE + opt.url, ...attachAuth(opt) });
  const body = resp.data;                     // { code, message, data }
  if (body.code === 0) return body.data as T; // 成功：解包 data
  // 业务错误：按 code 映射提示
  if (body.code === TOKEN_EXPIRED) return retryWithRefresh(opt);
  throw new ApiError(body.code, body.message);
}
```

- **错误统一处理**：非 0 code → `Taro.showToast(message)`；网络异常/超时 → 统一「网络异常」提示。
- **错误码映射**：`pkg/xerr` 的 code 在前端维护一张 `code → 文案` 表（如未登录、未认证、被禁言、需审核等）。
- **鉴权注解**：`auth: true` 的请求自动附带 `Authorization: Bearer <access_token>`。

### 7.2 登录与令牌刷新

令牌策略（后端 7.1）：Access 2h + Refresh 14d。

- **存储**：`refresh_token` 持久化（`Taro.setStorageSync` / `localStorage`）；`access_token` 存内存（H5）或 storage（小程序），应用启动时用 `refresh_token` 调 `/auth/refresh` 换新。
- **刷新拦截**：请求遇 401/过期 → 用 `refresh_token` 调 `/auth/refresh` → 更新 token → 重放原请求一次；刷新失败 → 清空登录态 → 跳登录页。
- **并发刷新去重**：多个请求同时 401 时，只发一次 refresh，其余挂起等待。

```ts
// 登录流程（F-01）
sendEmailCode(email)      // POST /auth/email/send-code，前端 60s 倒计时
loginByCode(email, code)  // POST /auth/email/login → { access, refresh, user }
```

- **认证态**：`user.is_verified` 驱动「武大学生」鎏金徽标展示（F-04）。
- **登录守卫**：发帖/回复/点赞/收藏/交易板块互动前校验登录态与认证态，未登录引导登录，未认证提示「发帖需武大邮箱认证」。

---

## 8. 核心模块设计

### 8.1 登录与认证

| 步骤 | 前端动作 | 对应接口 |
| --- | --- | --- |
| 输入邮箱 | 校验 `@whu.edu.cn` 域（本地预校验 + 后端兜底） | — |
| 获取验证码 | 60s 倒计时按钮 | `POST /auth/email/send-code` |
| 提交登录 | 邮箱 + 验证码 | `POST /auth/email/login` |
| 登录成功 | 存 token，拉取 `/users/me`，跳首页 | `GET /users/me` |

- 未认证用户可浏览，但发帖/回复/交易互动触发认证引导（对齐 PRD 5.1）。
- 登录页视觉对齐 UI 规范 5.6：品牌字 + slogan + 邮箱/验证码 + 主按钮 + 社区公约提示。

### 8.2 首页（广场，F-05~F-08）

结构（对齐 UI 规范 5.1）：品牌字 + 搜索栏 + 通知铃铛 → 5 大分类入口 → 官方公告位 → 精选流 → 热门讨论。

- 数据聚合：`GET /home/feed`（精选流）+ `GET /home/hot`（热门）+ `GET /categories`（分类入口）。
- 精选流用 `usePaginatedList` 分页；分类入口横向滚动；公告位固定顶部。
- 首页不做信息瀑布，卡片留白与层级严格按 UI 规范 4.4。

### 8.3 板块列表（F-09~F-12）

- 数据：`GET /boards/{id}`（板块详情）+ `GET /boards/{id}/posts?sort=&tag=&page=&page_size=`。
- **排序 Tab**（综合/最新/最热/精华）与**标签筛选 chips** 作为请求参数切换，切换即重置分页。
- 列表渲染三层：置顶（细线标识）→ 精华（金标）→ 普通（对齐 UI 规范 4.4）。
- 帖子卡片：标题 + 标签 chips + 摘要 + 作者（含认证徽标）+ 互动数据。

### 8.4 发帖（F-13~F-16）

**表单**：标题 + 正文 + 选板块 + 选标签/填结构化字段 + 多图 + 匿名开关。

**两条板块形态分支**（对齐 PRD 4.3）：
- **预置标签板块**：拉 `GET /boards/{id}/tags` 渲染 chips；必选标签（如二手市场 `出/求/租`）单选必填，可选标签多选。
- **结构化字段板块**（课程评价/竞赛组队）：`GET /dict/search?type=&q=` 做搜索补全下拉；课程评价需「课程名+老师」必填。

**图片直传（F-14，MinIO 预签名）——双端差异点**：

```
选图(Taro.chooseMedia) → 逐张 POST /upload/presign → { upload_url, object_key }
    ├─ H5：fetch PUT upload_url（raw body）直传 MinIO
    └─ 小程序：Taro.uploadFile 仅支持 POST multipart，
        需后端在 /upload/presign 同时返回「预签名 POST policy 表单」，
        或用 FileSystemManager.readFile + request PUT 兜底
→ 提交发帖时带上 object_key 列表 → POST /posts
```

> ⚠️ 小程序端直传 PUT 是已知差异点，需与后端对齐：建议 `/upload/presign` 返回双协议（Web 用 PUT URL，小程序用 POST policy），否则小程序端退化为经后端中转上传。

**匿名（F-15）**：树洞/课程评价默认开启匿名，前端仅提交 `is_anonymous`，脱敏由后端完成。

**审核态（F-32）**：提交后依后端返回的 `status` 提示——`published` 直接展示；`pending` 弹 toast「内容已提交，审核通过后展示」（对齐 UI 规范 4.8）；作者可在「我的帖子」看到自己的 `pending/rejected`。

**草稿箱（F-16，P2）**：正文变更 500ms 防抖写本地 storage，进入发帖页恢复。

### 8.5 帖子详情与楼层（F-17~F-20）

- 数据：`GET /posts/{id}`（详情）+ `GET /posts/{id}/replies`（楼层，分页）。
- 楼层渲染（对齐 UI 规范 5.3）：楼层号 + 作者（认证徽标）+ 内容；楼中楼按 `parent_id` 缩进挂在父楼层下。
- **@提及**：回复输入栏提供「@」按钮插入 `@昵称 `；内容渲染时用 `utils/mention.ts` 解析 `@昵称` 为可点文本（MVP 无用户搜索接口，提及为文本级，后端解析生成 mention 通知）。
- **匿名回复**：`is_anonymous` 楼层作者显示「匿名」且不带认证徽标（后端已脱敏，前端按字段渲染即可）。
- 互动：点赞（乐观更新 + 樱花粉激活态）、收藏、举报（`POST /reports`）。

### 8.6 搜索（F-21）

- `GET /search?q=&board=&tag=` + 按板块/标签/时间过滤。
- 搜索页：搜索栏 + 过滤条 + 结果列表（复用 PostCard）；空态用宋体标题空状态组件（UI 规范 4.7）。
- 词典搜索补全（发帖场景）复用 `GET /dict/search`，500ms 防抖。

### 8.7 个人中心与通知（F-23~F-26、F-30~F-31）

- 个人主页：`GET /users/{id}` + 「我的帖子/收藏/回复」三个入口（`GET /users/me/posts` 等）。
- 通知：`GET /notifications`（列表）+ `GET /notifications/unread-count`（tab 红点，`pink-500`）；进入后 `POST /notifications/read` 标记已读。
- MVP 通知为**轮询**：App 前台 + 定时（如 30s）拉未读数；实时推送记为演进项。

---

## 9. 关键难点与方案

| 难点 | 方案 |
| --- | --- |
| 图片直传（小程序 PUT 受限） | 后端 `/upload/presign` 返回双协议（PUT URL + POST policy），见 8.4 |
| 匿名脱敏 | 后端已脱敏（返回「匿名」、无 author_id），前端仅按 `is_verified` 条件渲染徽标、不自行补全作者 |
| 长列表性能 | 帖子/楼层分页 + `usePaginatedList`；图片懒加载；H5 长列表预留虚拟列表（演进项） |
| 明暗主题一致性 | CSS 变量单源 + 组件禁止裸色值；两端各声明作用域（5.2） |
| @提及 | 文本级解析渲染，后端解析生成通知；用户搜索补全记为演进项 |
| 双端差异 | 通过 `process.env.TARO_ENV` 做环境适配层（如上传方式、导航样式），核心逻辑不分支 |

---

## 10. 双端差异实现

两端共享 90% 代码，差异集中在「交互适配层」，用 `process.env.TARO_ENV` 条件处理：

| 维度 | 微信小程序 | H5 |
| --- | --- | --- |
| 导航 | 底部自定义 TabBar（含中央 FAB） | 顶部导航 / 宽度 >768 侧边栏 |
| 图片上传 | POST policy（见 8.4） | PUT 直传 |
| 图片选择 | `Taro.chooseMedia` | `<input type=file>` / 拖拽 |
| 暗色 | `darkmode: true` 跟随系统 | `data-theme` + 手动切换 |
| 触控目标 | ≥ 44px | ≥ 40px |
| 分享 | `onShareAppMessage`（帖子卡片） | URL 分享、SEO 可检索 |
| 内容侧重 | 图片驱动（卡片更图） | 长文驱动（正文更宽） |

> 差异仅停留在**适配层**，页面逻辑、组件、token 完全共享（呼应 PRD 第 7 节「双端对齐」）。

---

## 11. 构建与部署

- **双端构建**：`taro build --type weapp`（产物进微信开发者工具）、`taro build --type h5`（产物为静态站）。
- **环境配置**：`config/dev.ts`、`config/prod.ts` 注入 `API_BASE`、图片 CDN 域名等（`defineConstants`）。
- **H5 部署**：静态文件 → Nginx/CDN；SPA 路由需 history fallback。
- **小程序部署**：上传微信后台，提审；请求域名需在公众平台配置白名单（`api`、`MinIO/CDN`）。
- **CI**：两套构建 job 独立跑，`lint + tsc` 作为质量门禁（ESLint + Prettier + husky）。

---

## 12. 后续演进（非 MVP）

| 方向 | 说明 |
| --- | --- |
| 服务端状态缓存 | 引入 TanStack Query，统一缓存失效、乐观更新、请求去重 |
| 实时通知 | 微信订阅消息 / WebSocket/SSE 替换轮询 |
| 长列表虚拟化 | 帖子/楼层虚拟滚动，降低 DOM 压力 |
| 用户提及补全 | 引入用户搜索接口，@ 触发展开候选项 |
| token 单源生成 | `token.json` + 脚本生成 SCSS/TS，消除双份漂移 |
| 图片处理 | 上传前压缩、缩略图、渐进加载 |

---

*本方案为珞珈BBS 前端 MVP 设计，聚焦「一套代码双端编译」的工程结构、鉴权链路与核心模块落地，与后端契约及 UI 规范严格对齐。*
