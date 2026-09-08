# 珞珈BBS 前端技术方案（MVP）

| 项目 | 内容 |
| --- | --- |
| 文档版本 | v0.1 |
| 更新日期 | 2026-09-09 |
| 关联文档 | 《PRD-珞珈BBS-MVP》《TECH-珞珈BBS-后端-MVP》《UI-珞珈BBS-设计规范》 |
| 架构形态 | Web 先行（React SPA，桌面 + 移动响应式），小程序后期另起 |
| 技术栈 | React 18 + TypeScript + Vite + Tailwind CSS + Zustand |
| 文档范围 | 前端工程结构、状态、鉴权、核心模块、响应式、构建部署 |

---

## 1. 概述

### 1.1 目标

本文档定义珞珈BBS 前端 MVP 的技术方案，覆盖 PRD 中 P0/P1 功能的端侧实现设计，指导开发落地。核心约束：

- **Web 先行、响应式**：MVP 先交付 Web（`luojia-web`），一套代码在桌面（>768px 侧边栏布局）与移动（单列布局）间响应式适配，共享业务逻辑、组件与设计 token；小程序后期复用同一后端接口另起，不在本文档。
- **对齐后端契约**：严格按《TECH-珞珈BBS-后端-MVP》的 REST 接口（`/api/v1`、`{code,message,data}` 统一响应、JWT、MinIO 预签名上传）实现。
- **对齐设计规范**：所有颜色/字体/间距/圆角/阴影一律引用设计 token，禁止写死色值；明暗双主题同等支持。

### 1.2 非目标

- 后台管理系统前端（运营后台单独规划，不在本文档）。
- 富文本编辑器（MVP 帖子/回复仅纯文本 + 图片，见后端 1.2）。
- 实时推送（MVP 通知用轮询拉取，WebSocket/SSE 记为后续演进）。
- 复杂数据可视化、积分/等级/商城等（PRD 已明确不做）。

---

## 2. 技术选型

### 2.1 选型表

| 组件 | 选型 | 版本 | 说明 |
| --- | --- | --- | --- |
| 构建 | Vite | 5.x | 开发热更 + 生产打包，`@vitejs/plugin-react` |
| UI 框架 | React | 18 | 函数组件 + Hooks |
| 路由 | react-router-dom | 6.x | SPA 路由，`createBrowserRouter` |
| 语言 | TypeScript | 5.x | 类型安全，前后端共享 DTO 语义 |
| 状态管理 | Zustand | 4.x | 轻量、无样板，客户端状态（鉴权/主题/列表） |
| 样式 | Tailwind CSS + CSS 变量 | 3.x | 设计 token 单源 + 运行时主题切换 |
| 请求 | 原生 `fetch` 封装 | — | 统一响应/拦截/刷新/错误 |
| 表单/校验 | 自研轻量封装 | — | 发帖、登录表单校验（少量字段，不引重型库） |
| 图片预览 | 浏览器原生 / 轻量 lightbox | — | 九宫格点击放大 |
| 构建脚本 | `npm run build` | — | `tsc -b && vite build` |

> 说明：MVP 不引重型状态/数据缓存库（如 Redux、TanStack Query），用 Zustand + 轻量分页 Hook 覆盖全部需求；当服务端状态复杂度（缓存失效、乐观更新、去重请求）成为瓶颈时再评估 TanStack Query（记为演进项）。

### 2.2 技术形态决策（Web 先行，小程序后期）

PRD 关注「同一套账户数据、同一份设计 token」，产品形态为 Web + 小程序。MVP 阶段**先交付 Web（`luojia-web`）**，小程序顺延：

1. **交付聚焦**：一套 React SPA 覆盖桌面 + 移动浏览器，快速上线。
2. **逻辑单源**：鉴权、分页、图片上传、匿名脱敏等核心逻辑只写一遍，行为一致。
3. **样式单源**：Tailwind 工具类 + CSS 变量一套 token，暗色主题用一个 `.dark` 类切换。
4. **接口就绪**：后端 REST `/api/v1` 与预签名上传契约保持端中立，小程序后期直接复用。

小程序延后到 Web 稳定后再另起工程接入（复用同一后端接口），不在本 MVP 文档展开。

---

## 3. 总体架构

### 3.1 SPA 架构

```
                 ┌───────────────────────────────────────────┐
                 │              src/（唯一代码库）              │
                 │  pages / components / api / store / hooks  │
                 │  index.css（设计 token 单源）               │
                 └───────────────────┬───────────────────────┘
                                     │  Vite（dev server / build）
                                     ▼
                          ┌────────────────────────┐
                          │  Web 静态站（SPA）       │
                          │  (HTML/CSS/JS, dist/)   │
                          └────────────┬───────────┘
                                       │  /api（同源，nginx 反代）
                                       ▼
                             后端 REST API /api/v1
```

### 3.2 分层职责

| 层 | 职责 | 约束 |
| --- | --- | --- |
| pages | 页面装配、路由、页面生命周期 | 不直接调 API，不写请求细节 |
| components | 纯展示组件，输入 props 输出 UI | 不含业务请求（受控组件优先） |
| api | 请求封装、接口定义、DTO 类型 | 唯一网络出口 |
| store | 客户端全局状态（鉴权、主题、未读数） | 不含接口缓存细节（分页走 Hook） |
| hooks | 跨页面复用逻辑（分页、鉴权守卫） | 复用优先 |
| utils | 通用工具（cn、格式化、@提及解析） | 无副作用 |
| index.css | 设计 token、主题、Tailwind 指令 | 全项目唯一视觉出口 |

---

## 4. 工程目录结构

```
luojia-web/
├── index.html                  # 入口 HTML（挂载点 + 字体/资源）
├── vite.config.ts              # Vite 配置（端口 5173、/api 代理到后端）
├── tailwind.config.js          # Tailwind：darkMode='class'、color 映射 CSS 变量
├── postcss.config.js           # PostCSS（Tailwind + autoprefixer）
├── tsconfig.json / tsconfig.node.json
├── src/
│   ├── main.tsx                # 入口：挂载 <App/>，引入 index.css
│   ├── App.tsx                 # 路由表（createBrowserRouter）
│   ├── index.css               # Tailwind 指令 + 设计 token（CSS 变量）+ 明暗主题
│   ├── layouts/
│   │   └── AppLayout.tsx       # 主布局（Header + 侧边栏 + 主区 + Toast）
│   ├── pages/
│   │   ├── Home.tsx            # 首页（广场）
│   │   ├── Campus.tsx          # 校园服务（课表/成绩/图书馆/校车/一卡通/云打印入口）
│   │   ├── Board.tsx           # 板块列表
│   │   ├── PostDetail.tsx      # 帖子详情（楼层）
│   │   ├── Compose.tsx         # 发帖 / 编辑
│   │   ├── Search.tsx          # 搜索
│   │   ├── Notifications.tsx   # 通知
│   │   ├── Profile.tsx         # 我的
│   │   ├── User.tsx            # 他人主页
│   │   ├── Login.tsx / Register.tsx / ForgotPassword.tsx
│   ├── components/
│   │   ├── layout/             # Header、BoardSidebar、RightSidebar、Toast
│   │   ├── ui/                 # Avatar、Badge、Button、EmptyState、Spinner、Tag
│   │   ├── AuthShell.tsx  BoardSelect.tsx  DictSelect.tsx
│   │   ├── EditProfileModal.tsx  LoadMore.tsx  PostCard.tsx  ProfileCard.tsx
│   ├── api/
│   │   ├── request.ts          # 请求核心：拦截、鉴权、刷新、错误、统一响应
│   │   ├── auth.ts  content.ts  board.ts  user.ts
│   │   ├── search.ts  notification.ts  upload.ts
│   │   └── types.ts            # DTO 类型（对齐后端响应）
│   ├── store/
│   │   ├── auth.ts             # 登录态、用户资料、认证标记
│   │   ├── app.ts              # 主题（system/light/dark）
│   │   ├── category.ts         # 分类/板块树
│   │   ├── notification.ts     # 未读数
│   │   └── toast.ts            # 全局提示
│   ├── hooks/
│   │   ├── usePaginatedList.ts # 通用分页（加载更多 + 刷新）
│   │   └── useAuth.ts          # 登录守卫、认证态
│   ├── constants/
│   │   └── enums.ts            # 板块/标签/排序/帖子状态 枚举
│   └── utils/
│       ├── cn.ts               # 类名合并
│       ├── format.ts           # 时间/数字格式化
│       └── mention.ts          # @提及解析
└── package.json                # scripts: dev / build / preview
```

---

## 5. 设计 token 与主题

### 5.1 单源 token（CSS 变量 + Tailwind 映射）

设计 token 是「高级感 + 双主题一致」的落地载体。以 **`src/index.css` 的 CSS 变量为唯一视觉源**，Tailwind `config` 将 `color` 映射到这些变量，组件里只写 `bg-surface` / `text-ink` / `border-line` 等语义类。

```css
/* src/index.css —— 单源 token（值对齐 UI 规范） */
:root {
  --bg: #f7f8fa;          --surface: #ffffff;
  --brand: #1f8a5b;       --brand-strong: #166b45;  --brand-soft: #e8f4ee;
  --ink: #0f172a;         --ink-2: #475569;          --ink-3: #94a3b8;
  --line: #e2e8f0;        --hot: #e11d48;
}
```

```js
// tailwind.config.js —— color 引用 CSS 变量，语义化命名
colors: {
  bg: 'var(--bg)', surface: 'var(--surface)',
  brand: { DEFAULT: 'var(--brand)', strong: 'var(--brand-strong)', soft: 'var(--brand-soft)' },
  ink: { DEFAULT: 'var(--ink)', 2: 'var(--ink-2)', 3: 'var(--ink-3)' },
  line: 'var(--line)', hot: 'var(--hot)'
}
```

**规则**：组件内样式**只引用语义 token 类（`text-ink`、`bg-brand-soft`、`border-line` 等），禁止出现裸色值**；所有颜色/间距/圆角/阴影走 Tailwind 主题扩展。

### 5.2 明暗主题

主题用 **`.dark` 类**运行时切换，同一套变量名在 `.dark` 作用域下重新配比：

- 默认跟随系统（`prefers-color-scheme: dark`），用户可在「设置」手动覆盖为 light/dark。
- 手动/系统暗色统一落到 `<html class="dark">`，CSS 变量随之切换，无需组件感知主题。

```css
/* src/index.css —— 暗色 token 重新配比（值对齐 UI 规范） */
.dark {
  --bg: #0f1215;          --surface: #181c21;
  --brand: #34a57c;       --brand-strong: #4bbe8e;   --brand-soft: #1e2a24;
  --ink: #e5eaf0;         --ink-2: #a6b0bc;           --ink-3: #6b7684;
  --line: #262c34;        --hot: #f43f5e;
}
```

Tailwind `darkMode: 'class'`，故 `dark:` 前缀类也随 `.dark` 生效，与 CSS 变量双通道一致。

### 5.3 主题状态

```ts
// store/app.ts
type Theme = 'system' | 'light' | 'dark';
// system：跟随系统（默认）；light/dark：手动覆盖，持久化到 localStorage('luo_theme')
// applyThemeClass()：计算暗色 → document.documentElement.classList.toggle('dark', dark)
```

---

## 6. 状态管理

### 6.1 Store 划分（Zustand）

| Store | 状态 | 说明 |
| --- | --- | --- |
| `auth` | `token`、`user`（昵称/头像/认证标记）、`isLoggedIn` | 登录态全局唯一 |
| `app` | `theme` | 主题（system/light/dark） |
| `category` | `categories` | 分类/板块树（首页分类入口、发帖选板块） |
| `notification` | `unreadCount` | 未读数（导航红点） |
| `toast` | 提示消息队列 | 全局 toast 弹出 |

### 6.2 服务端数据策略

帖子列表、回复等**服务端数据不落全局 store**，由页面级 `usePaginatedList` Hook 管理（分页、刷新、追加），避免全局缓存失效的复杂度。轻量交互（点赞、收藏）做**乐观更新**：本地立即翻转 UI，请求失败回滚 + toast。

```ts
// hooks/usePaginatedList.ts —— 通用分页
function usePaginatedList<T>(fetcher: (page: number) => Promise<{list:T[]; hasMore:boolean}>) {
  // 返回 { list, loading, refreshing, hasMore, loadMore, refresh }
}
```

---

## 7. API 层与鉴权

### 7.1 统一请求封装

对齐后端「统一响应 `{code:0, message, data}`」契约，封装 `request`（原生 `fetch`，不引 axios）：

```ts
// api/request.ts
async function request<T>(opt: {
  url: string; method?: 'GET'|'POST'|'PUT'|'DELETE'; data?: any; auth?: boolean; silent?: boolean;
}): Promise<T> {
  const resp = await fetch(BASE + opt.url, { ...attachAuth(opt), body: JSON.stringify(opt.data) });
  const body = await resp.json();             // { code, message, data }
  if (body.code === 0) return body.data as T; // 成功：解包 data
  // 业务错误：按 code 映射提示
  if (body.code === TOKEN_EXPIRED) return retryWithRefresh(opt);
  throw new ApiError(body.code, body.message);
}
```

- **BASE**：生产同源部署（`bbs.jianjiange.site` 同时服务前端与 `/api`），`BASE` 留空；本地开发经 Vite `/api` 代理到后端。可用 `VITE_API_BASE` 覆盖。
- **错误统一处理**：非 0 code → `toast(message)`（`store/toast.ts`）；网络异常/超时 → 统一「网络异常」提示。
- **错误码映射**：`pkg/xerr` 的 code 在前端维护一张 `CODE` 常量 + 文案表（如未登录、未认证、被禁言、需审核等）。
- **鉴权注解**：`auth: true`（默认）的请求自动附带 `Authorization: Bearer <access_token>`。

### 7.2 登录与令牌刷新

令牌策略（后端 7.1）：Access 2h + Refresh 14d。

- **存储**：`refresh_token` 与 `access_token` 均存 `localStorage`（`luo_access_token` / `luo_refresh_token`）；应用启动时用 `refresh_token` 调 `/auth/refresh` 换新。
- **刷新拦截**：请求遇 401/过期 → 用 `refresh_token` 调 `/auth/refresh` → 更新 token → 重放原请求一次；刷新失败 → 清空登录态 → 跳登录页。
- **并发刷新去重**：多个请求同时 401 时，只发一次 refresh（模块级 `refreshing` Promise），其余挂起等待。

```ts
// 登录流程（F-01）
sendEmailCode(email)      // POST /auth/email/send-code，前端 60s 倒计时
loginByCode(email, code)  // POST /auth/email/login → { access, refresh, user }
```

- **认证态**：`user.is_verified` 驱动「武大学生」徽标展示（F-04）。
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

- 数据：`GET /boards/{id}`（板块详情）+ `GET /boards/{id}/posts?sort=&tag_id=&page=&page_size=`。
- **排序 Tab**（综合/最新/最热/精华）与**标签筛选 chips** 作为请求参数切换，切换即重置分页。
- 列表渲染三层：置顶（细线标识）→ 精华（金标）→ 普通（对齐 UI 规范 4.4）。
- 帖子卡片：标题 + 标签 chips + 摘要 + 作者（含认证徽标）+ 互动数据。

### 8.4 发帖（F-13~F-16）

**表单**：标题 + 正文 + 选板块 + 选标签/填结构化字段 + 多图 + 匿名开关。

**两条板块形态分支**（对齐 PRD 4.3）：
- **预置标签板块**：拉 `GET /boards/{id}/tags` 渲染 chips；必选标签（如二手市场 `出/求/租`）单选必填，可选标签多选。
- **结构化字段板块**（课程评价/竞赛组队）：`GET /dict/search?type=&q=` 做搜索补全下拉；课程评价需「课程名+老师」必填。

**图片直传（F-14，MinIO 预签名）**：

```
选图(<input type=file>/拖拽) → 逐张 POST /upload/presign → { upload_url, object_key }
    └─ fetch PUT upload_url（raw body）直传 MinIO
→ 提交发帖时带上 object_key 列表 → POST /posts
```

- 选图用浏览器原生 `<input type="file" accept="image/*" multiple>`，支持拖拽；上传前本地预览（`URL.createObjectURL`）。

**匿名（F-15）**：树洞/课程评价默认开启匿名，前端仅提交 `is_anonymous`，脱敏由后端完成。

**审核态（F-32）**：提交后依后端返回的 `status` 提示——`published` 直接展示；`pending` 弹 toast「内容已提交，审核通过后展示」（对齐 UI 规范 4.8）；作者可在「我的帖子」看到自己的 `pending/rejected`。

**草稿箱（F-16，P2）**：正文变更 500ms 防抖写 `localStorage`，进入发帖页恢复。

### 8.5 帖子详情与楼层（F-17~F-20）

- 数据：`GET /posts/{id}`（详情）+ `GET /posts/{id}/replies`（楼层全量树）。
- 楼层渲染（对齐 UI 规范 5.3）：楼层号 + 作者（认证徽标）+ 内容；楼中楼按 `parent_id` 缩进挂在父楼层下。
- **@提及**：回复输入栏提供「@」按钮插入 `@昵称 `；内容渲染时用 `utils/mention.ts` 解析 `@昵称` 为可点文本（MVP 无用户搜索接口，提及为文本级，后端解析生成 mention 通知）。
- **匿名回复**：`is_anonymous` 楼层作者显示「匿名」且不带认证徽标（后端已脱敏，前端按字段渲染即可）。
- 互动：点赞（乐观更新 + 高亮激活态）、收藏、举报（`POST /reports`）。

### 8.6 搜索（F-21）

- `GET /search?q=&board_id=&tag_id=` + 按板块/标签/时间过滤。
- 搜索页：搜索栏 + 过滤条 + 结果列表（复用 PostCard）；空态用空状态组件（UI 规范 4.7）。
- 词典搜索补全（发帖场景）复用 `GET /dict/search`，500ms 防抖。

### 8.7 个人中心与通知（F-23~F-26、F-30~F-31）

- 个人主页：`GET /users/{id}` + 「我的帖子/收藏/回复」三个入口（`GET /users/me/posts` 等）。
- 通知：`GET /notifications`（列表）+ `GET /notifications/unread-count`（导航红点）；进入后 `POST /notifications/read` 标记已读。
- MVP 通知为**轮询**：页面聚焦 + 定时（如 30s）拉未读数；实时推送记为演进项。

---

## 9. 关键难点与方案

| 难点 | 方案 |
| --- | --- |
| 图片直传 | 后端 `/upload/presign` 返回 PUT 预签名 URL，前端 `fetch` 直传 MinIO，见 8.4 |
| 匿名脱敏 | 后端已脱敏（返回「匿名」、无 author_id），前端仅按 `is_verified` 条件渲染徽标、不自行补全作者 |
| 长列表性能 | 帖子/楼层分页 + `usePaginatedList`；图片懒加载；超长列表预留虚拟列表（演进项） |
| 明暗主题一致性 | CSS 变量单源 + 组件禁止裸色值；`.dark` 类 + `darkMode:'class'`（5.2） |
| @提及 | 文本级解析渲染，后端解析生成通知；用户搜索补全记为演进项 |
| 响应式适配 | Tailwind `sm/md/lg` 断点 + 布局组件（桌面侧边栏 / 移动单列），核心逻辑不分支 |

---

## 10. 响应式适配

一套代码覆盖桌面与移动浏览器，差异集中在「布局适配层」：

| 维度 | 桌面（≥768px） | 移动（<768px） |
| --- | --- | --- |
| 导航 | 顶部 Header + 左侧板块侧边栏 | 顶部 Header（导航折叠） |
| 布局 | 三栏（侧边栏 + 主区 + 右侧栏） | 单列 |
| 图片选择 | `<input type=file>` / 拖拽 | `<input type=file>`（系统相册） |
| 触控目标 | ≥ 40px | ≥ 44px |
| 暗色 | `.dark` 类 + 手动切换 | 同上 |
| 分享 | URL 分享、可被搜索引擎检索 | URL 分享 |

> 差异仅停留在**布局与交互适配层**，页面逻辑、组件、token 完全共享。

---

## 11. 构建与部署

- **构建**：`npm run build` = `tsc -b && vite build`，产物 `dist/`（静态站，带 hash 的 JS/CSS）。
- **环境配置**：生产 API 走 `VITE_API_BASE`（H5 同源 `https://bbs.jianjiange.site`，默认留空走同源 `/api`）；本地开发走 Vite `/api` 代理。
- **部署**：`dist/` 静态文件 → Nginx；SPA 路由需 `try_files ... /index.html` history fallback（见部署拓扑）。
- **CI**：`lint + tsc` 作为质量门禁（ESLint + Prettier + husky）。

---

## 12. 后续演进（非 MVP）

| 方向 | 说明 |
| --- | --- |
| 服务端状态缓存 | 引入 TanStack Query，统一缓存失效、乐观更新、请求去重 |
| 实时通知 | WebSocket/SSE 替换轮询 |
| 长列表虚拟化 | 帖子/楼层虚拟滚动，降低 DOM 压力 |
| 用户提及补全 | 引入用户搜索接口，@ 触发展开候选项 |
| token 管理 | 单一 token 源生成（CSS 变量 + TS 常量同步） |
| 图片处理 | 上传前压缩、缩略图、渐进加载 |

---

*本方案为珞珈BBS 前端 MVP 设计，聚焦「Web 先行（React SPA），小程序后期」的工程结构、鉴权链路与核心模块落地，与后端契约及 UI 规范严格对齐。*
