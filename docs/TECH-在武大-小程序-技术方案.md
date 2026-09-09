# 在武大 · 微信小程序 技术方案

| 项目 | 内容 |
| --- | --- |
| 文档版本 | v0.1 |
| 更新日期 | 2026-09-09 |
| 关联文档 | 《PRD-珞珈BBS-MVP》《TECH-珞珈BBS-后端-MVP》《TECH-珞珈BBS-前端-MVP》《UI-珞珈BBS-设计规范》 |
| 产品名 | 在武大（原珞珈BBS） |
| 文档范围 | 原生微信小程序版本的技术选型、架构、后端改造、功能对齐、工程化与发布 |

---

## 0. 背景与目标

「在武大」已有可上线的 **Web 版**（React + Vite + TS + Tailwind + Zustand）与 **Go 后端**（Gin/GORM/PostgreSQL/Redis/MinIO，分层 handler → service → repository → model）。

本次新开一个小程序仓库，目标是：

1. **原生微信小程序**，UI 要有「高级感」（沿用在武大已有的设计语言，不重起炉灶）。
2. **功能基本与 Web 版对齐**：社区核心（帖子/回复三层/发帖/搜索/互动）+ 通知私信 + 校园服务。
3. **复用现有后端**，仅新增「微信登录 + 绑定武大邮箱」认证链路，不改动既有内容/互动/校园服务接口。

---

## 1. 总体技术选型

| 维度 | 选型 | 理由 |
| --- | --- | --- |
| 小程序框架 | **原生微信小程序 + TypeScript** | 性能与微信能力最全（Skyline 渲染、订阅消息、分享、自定义 TabBar 等），无跨端编译层损耗；设计规范本身按 WXSS 变量 + theme 类名写就 |
| 状态管理 | **mobx-miniprogram + mobx-miniprogram-bindings** | 微信官方推荐，observable 心智接近团队熟悉的 Zustand/React；类型友好 |
| 样式 | **WXSS + CSS 变量（设计 token）** | 与设计规范一致：`app.wxss` 定义 `page{}` 的 token，暗色用 `theme-dark` 类覆盖变量；组件内一律 `var(--token)`，不写死色值 |
| 请求层 | **自研 `wx.request` Promise 封装** | 对齐 Web 的 `request.ts`：baseURL、Bearer 注入、统一错误 toast、401 刷新 |
| 渲染引擎 | **WebView 优先，Skyline 渐进增强** | P0 用稳定 WebView 上线；P4 评估 Skyline（glass effect / worklet 动画）提升动效上限 |
| 构建/发布 | **npm + miniprogram-ci** | 本地开发者工具调试；CI 用 `miniprogram-ci` 上传/预览/生成体验码 |
| UI 组件 | **全自研组件库** | 设计规范已把组件定得很细，自研可控性最高、最能还原「高级感」 |

> 选型说明：团队 Web 端是 React 栈，但本次明确选原生小程序。原因是「高级感」依赖丝滑动效、玻璃拟态、自定义 TabBar 等微信原生能力，原生是最稳的实现路径；且「在武大」只做微信小程序，无需 Taro/uni-app 的跨端红利。

---

## 2. 架构设计

### 2.1 分层

```
页面 pages        —— 只做组装与交互
组件 components    —— 自研 UI 组件（对应设计规范第 4 节）
API api            —— 请求封装 + 各模块接口（对齐 Web src/api）
状态 store         —— mobx store（auth / category / notification / message / app）
工具 utils         —— format、cn（class 合并）、时间等
样式 styles        —— tokens.wxss（设计 token）、theme（暗色）
静态 assets        —— 图标（线性 SVG 转 base64）、空状态插画
```

### 2.2 目录结构（新仓库 `whu-campus-weapp`）

```
whu-campus-weapp/
├── miniprogram/
│   ├── app.ts / app.json / app.wxss
│   ├── app.d.ts
│   ├── pages/
│   │   ├── home/            # 首页（广场）
│   │   ├── boards/          # 板块列表 / 板块详情
│   │   ├── compose/         # 发帖
│   │   ├── post/            # 帖子详情（楼层 + 楼中楼）
│   │   ├── search/          # 搜索
│   │   ├── notifications/   # 通知
│   │   ├── messages/        # 私信
│   │   ├── me/              # 我的（个人中心）
│   │   ├── user/            # 用户主页
│   │   ├── campus/          # 校园服务（课表/成绩/图书馆…）
│   │   └── login/           # 登录 / 绑定邮箱
│   ├── components/
│   │   ├── ui/              # 基础组件
│   │   ├── post-card/       # 帖子卡片
│   │   ├── floor/           # 楼层（回复）
│   │   ├── board-cascader/  # 板块级联选择
│   │   ├── dict-select/     # 词典搜索补全
│   │   └── ...
│   ├── custom-tab-bar/      # 自定义底部导航（中央凸起发帖）
│   ├── api/                 # request.ts + auth/content/... 
│   ├── store/               # mobx stores
│   ├── utils/               # format / cn
│   └── styles/              # tokens.wxss / theme.wxss
├── typings/                 # 全局 TS 声明
├── project.config.json
├── package.json
├── tsconfig.json
└── .gitignore
```

### 2.3 复用策略（从 Web 迁移）

| 可复用 | 迁移方式 |
| --- | --- |
| 类型定义 `src/api/types.ts` | 基本原样迁移（`Post/Reply/User/Tag/Conversation…`），字段一致 |
| API 契约（URL/参数/响应） | 对齐 `src/api/*.ts`，只把底层从 axios 换成 wx.request |
| 状态结构 `src/store/*` | auth/notification/message 的字段与逻辑对照迁移到 mobx |
| 工具函数 `src/utils/format.ts` | `formatCount/formatTime` 等纯函数直接迁移 |
| 设计 token | 从 `UI-设计规范.md` 的 token 表落地为 `tokens.wxss` |

**不复用**：React 组件与 JSX 结构（改为 WXML/WXSS 重写，但语义一一对应，便于对照开发）。

---

## 3. 后端改造（账户体系统一 + 微信登录）

### 3.0 账户体系统一设计（小程序 ↔ Web 一套账户）

**目标**：同一人在小程序（微信登录）和 Web（武大邮箱登录）拿到的是**同一个 `user.id`**，帖子/收藏/私信/通知/互动全部天然互通。

**账户模型**：账户主体 = `User`（唯一 `user.id`），登录凭证 = 多种可绑定的标识，都挂到同一个账户上。

```
         ┌─────────────────┐
         │      User        │   ← 账户主体（唯一 user.id）
         │  nickname/头像/   │
         │  学院/认证/role   │
         └────────┬────────┘
                  │ 绑定（一个账户可绑多个凭证）
   ┌──────────────┼───────────────┐
   ▼              ▼               ▼
 Email(武大邮箱)  WechatOpenID    Phone(预留)
   Web登录        小程序登录        —
```

**实现路径（选方案 A：最小改动）**：
- **方案 A（本次采用）**：维持 Email/OpenID 都在 `User` 表上，只加「绑定 + 合并」逻辑，改动集中在 `auth` 层，不动内容/互动接口。
- 方案 B（长期备选）：抽 `AuthIdentity` 凭证表（provider + identifier + user_id），`User` 只留账户主体，扩展性最好但重构量大，本次不做。

**统一 JWT**：两端都走 `auth.TokenManager.GeneratePair(user.ID, user.Role)`，同一密钥签发，token 跨端语义一致；数据外键全部挂 `user.id`，天然互通。

**⚠️ 必改的坑**：`User.Email` 现为非指针 `string` + `uniqueIndex`。PostgreSQL 唯一索引把空串 `''` 当普通值——微信自动建号 Email 留空时，**第二个微信用户会撞唯一索引**。须把 `Email string` 改为 `Email *string`（NULL 允许多个），并检查所有 `user.Email` 读写点。

### 3.1 现状确认

- 武大邮箱验证码登录 = 认证：`@whu.edu.cn` 域校验通过 → `IsVerified=true`（`service/auth.go` 的 `Register`/`LoginByCode`）。
- JWT 签发：`auth.TokenManager.GeneratePair(user.ID, user.Role)`。
- 发帖等敏感操作已由 `middleware.RequireVerified()` 门控（`router.go:148`）。

### 3.2 新增接口

**① 微信登录 `POST /api/v1/auth/wechat/login`**（公开，限流）

```
入参：{ code: string, nickname?: string, avatar_url?: string }
出参：{ access_token, refresh_token, user, is_verified: bool }
```

流程：
1. 后端用 `code` 调微信 `code2Session`（appid + secret）取 `openid`（+ `session_key`）。
2. 按 `openid` 查 `users`：
   - **已绑定** → 直接签发 JWT（`issuePair`）。
   - **未绑定** → 自动建号：`User{ WechatOpenID: openid, Nickname: nickname || "微信用户", IsVerified: false }`，签发 JWT。前端据 `is_verified=false` 引导绑定武大邮箱。
3. `session_key` 暂存（Redis，TTL），为将来「获取手机号/解密敏感数据」预留。

**② 绑定武大邮箱 `POST /api/v1/auth/wechat/bind-email`**（需登录 `reqAuth`）

```
入参：{ email: string, code: string }   // code 为邮箱验证码（复用 send-code，scene 新增或复用 register）
出参：{ user }
```

流程：
1. 校验武大邮箱域 + 验证码（复用 `EmailVerifier`）。
2. 若该邮箱**未被注册** → 直接绑定到当前用户：`Email=email, IsVerified=true`。
3. 若该邮箱**已被另一账号注册**（web 端注册过）→ **账号合并**：
   - 当前微信临时号刚注册、通常无内容，把 `WechatOpenID` 关联到已存在的邮箱账号，删除临时号；若临时号已有帖子/收藏/私信等，走迁移（列为 P1 后置项，MVP 先做「无内容直接合并，有内容则提示先用邮箱登录后到设置里绑定微信」）。

### 3.3 数据模型改动

- `User.Email`：`string` → `*string`（允许 NULL，微信自动建号时 Email 为空不撞唯一索引）。
- `User.WechatOpenID` 已有，无需加字段。
- 新增索引无需改动（`uniqueIndex` 已在 model 上）。
- 配置新增：`wechat.appid` / `wechat.secret`（存 `configs/config.yaml`，**不提交**）。

### 3.4 改动文件清单

| 文件 | 改动 |
| --- | --- |
| `internal/model/user.go` | `Email` 改 `*string`（可空）；`WechatOpenID` 已预留 |
| `internal/service/auth.go` | 新增 `WechatLogin`、`BindEmail`（+ 账号合并） |
| `internal/handler/auth.go` | 新增两个 handler |
| `internal/router/router.go` | 注册两个路由 + 限流 |
| `pkg/xerr/xerr.go` | 新增错误码（微信 code 无效、openid 绑定冲突等） |
| `internal/config/config.go` | 新增 `Wechat` 配置段 |
| `internal/auth/` | 新增 `WechatClient`（code2Session 封装） |

---

## 4. 功能对齐清单（Web → 小程序）

> 优先级：**P0** 社区核心（必须首发）｜**P1** 互动完善 + 通知私信｜**P2** 校园服务。

| Web 页面/能力 | 小程序落地 | 优先级 |
| --- | --- | --- |
| 首页 feed + 热门 | tab「首页」：品牌头 + 搜索 + 分类入口 + 精选流 + 热门榜 | P0 |
| 板块（分类 → 板块 → 列表） | tab「板块」+ 板块详情（排序 Tab / 标签筛选 chips） | P0 |
| 帖子详情（楼层 + 楼中楼懒加载） | `post` 页，楼层 + 「展开 N 条回复」懒加载（对齐 `sub_count` + `/sub-replies`） | P0 |
| 发帖（板块/标签/图片/匿名/词典补全） | tab 中央凸起 FAB → `compose` 页（图片九宫格、`BoardCascader`、`DictSelect`） | P0 |
| 搜索（关键词 + 板块过滤） | `search` 页（顶部搜索栏 + 板块选择） | P0 |
| 个人中心（我的帖子/回复/收藏、编辑资料） | tab「我的」 | P0 |
| 用户主页 | `user` 页（点击头像/昵称进入，含「私信」入口） | P0 |
| 登录 / 注册 / 忘记密码 | 微信一键登录 + 绑定武大邮箱（忘记密码/改绑进「我的-设置」） | P0 |
| 点赞 / 收藏 / 举报 | 帖子与回复的点赞（粉激活回弹）、收藏、举报 | P0 |
| 通知（未读角标、列表、已读） | tab「通知」+ 角标 | P1 |
| 私信（会话列表 + 聊天窗） | `messages` 页（单栏：会话列表 → 聊天窗） | P1 |
| 匿名发布/回复 | 发帖/回复的匿名开关 | P1 |
| 校园服务：课表/成绩/绩点/一卡通/校车 | `campus` 页（CAS 绑定后只读数据代理） | P2 |
| 校园服务：图书馆座位 + 自动预约计划 | `campus` 页子页 | P2 |
| 校园服务：云打印 / 体育场馆 | `campus` 页子页 | P2 |
| 运营后台（审核/封禁/标签管理） | **小程序不做**，沿用 Web/后端 | — |

**Tab 结构（自定义 TabBar，5 项，中央凸起）**：首页（广场）· 板块 · **发帖（凸起 +）** · 通知 · 我的。校园服务从首页分类入口 / 「我的」进入，不占独立 Tab。

---

## 5. UI 高级感落地

沿用《UI-珞珈BBS-设计规范》，以下只列「小程序端如何还原」的关键点。

### 5.1 设计 token → WXSS

- `app.wxss`：`page { --brand:#2C8063; --accent:#D44768; --gold:#C29A5B; --paper:#F8F6F1; ... }`。
- 暗色：`page.theme-dark { --paper:#121614; --surface:#1A201C; ... }`，根节点按「系统主题 / 手动」切换 `theme-dark` 类。
- 组件一律 `var(--token)`，禁止写死色值（同规范 1.8）。

### 5.2 字体（品牌宋体）

- 正文：系统无衬线（`-apple-system, PingFang SC, ...`）。
- 品牌字「在武大」「珞珈BBS」：**内嵌极小字体子集**（仅十几个汉字，base64 的 woff2，约几 KB），用于空状态标题、品牌 Logo；iOS 兜底 `Songti SC`。不做整包字体（体积不可接受）。

### 5.3 自定义 TabBar（高级感核心）

- `app.json` 设 `tabBar.custom: true` + `custom-tab-bar/` 组件。
- 中央「发帖」为**全局唯一高饱和圆按钮**（`green-500` + 白「+」，微凸起 + 轻阴影），未选中项 `ink-500`、选中 `green-600`（同规范 4.6）。

### 5.4 动效与微交互（同规范第 6 节）

| 场景 | 实现 |
| --- | --- |
| 按钮按压 | CSS `transform: scale(.98)` + 阴影消失 |
| 点赞回弹 | 爱心 `scale(1.2)` 回弹 + 变粉（200ms 弹性缓动） |
| 列表加载 | 卡片淡入上移 8px |
| 骨架屏 | `surface-2` 色块 + 呼吸透明度动画 |

### 5.5 暗色模式

- 跟随系统 + 「我的-设置」手动切换，存本地。
- 全组件走 token，切换零额外成本。

### 5.6 Skyline（渐进增强，P4）

- 评估项：glass effect（玻璃拟态）、worklet 动画（下拉回弹更丝滑）。
- 门槛：基础库 ≥ 3.0、部分组件需适配。**不影响 P0 上线**，作为体验上限的进阶项。

---

## 6. 组件库规划（自研）

| 组件 | 对应规范 | 说明 |
| --- | --- | --- |
| `ui/button` | 4.1 | 主/次/幽灵/危险，按压态 |
| `ui/tag` / `ui/badge` | 4.2 / 4.3 | 板块标签、状态徽标、鎏金认证徽标 |
| `ui/avatar` | — | 头像（带认证角标） |
| `ui/empty-state` | 4.7 | 宋体标题 + 线性插画 |
| `ui/toast` | 4.8 | 成功/错误/中性 |
| `ui/skeleton` | 6 | 骨架屏 |
| `post-card` | 4.4 | 帖子卡片（置顶细线/精华金标/九宫格预览） |
| `floor` | 5.3 | 楼层（楼中楼缩进、懒加载） |
| `board-cascader` | 5.4 | 板块父子级联（两列同时可见） |
| `dict-select` | 5.4 | 词典搜索补全（课程/老师/学院） |
| `search-bar` | 4.5 | 胶囊搜索栏 |
| `image-grid` | — | 九宫格图片选择/预览 |
| `custom-tab-bar` | 4.6 | 底部导航 + 中央凸起 |

---

## 7. 工程化与 CI/CD

### 7.1 开发环境

- 微信开发者工具 + 官方 TS 模板；`npm` 管理 `mobx-miniprogram` 等依赖（开发者工具「构建 npm」）。
- 环境区分：`appid` / API base 走 `miniprogram/env.ts`（dev 指向 `https://bbs.jianjiange.site` 或本地，prod 同）。

### 7.2 CI/CD（miniprogram-ci）

- 提交后跑 `tsc --noEmit` 类型检查（或 `miniprogram-ci` 的 lint）。
- 发布：`miniprogram-ci preview`（生成体验码）→ 人工验收 → `upload`（提审）→ 微信公众平台审核发布。
- 私钥与 appid 存 CI 环境变量，不入库。

### 7.3 后端部署（复用）

- 后端新增微信登录接口后，按既有拓扑部署（交叉编译 → scp → `mv` 换二进制 → `systemctl restart luojia-bbs`），AutoMigrate 无需新增表。
- 新增 `wechat.appid/secret` 配置写入 `configs/config.yaml`（不提交）。

---

## 8. 里程碑

| 阶段 | 内容 | 交付 |
| --- | --- | --- |
| **Phase 0 脚手架** | 仓库 + TS 模板 + token + 请求层 + mobx + 后端微信登录/绑定接口 | 能微信登录、请求打通 |
| **Phase 1 社区核心** | 首页/板块/帖子详情(楼层)/发帖/搜索/个人中心/用户主页 | 可浏览与发帖 |
| **Phase 2 互动完善** | 点赞收藏举报、通知、私信、匿名 | 完整社区闭环 |
| **Phase 3 校园服务** | 课表/成绩/绩点/一卡通/校车、图书馆、云打印、体育场馆 | 功能对齐 Web |
| **Phase 4 体验打磨** | 暗色、动效、性能、无障碍、Skyline 评估 | 高级感收尾 |

---

## 9. 风险与合规

| 风险 | 说明 | 应对 |
| --- | --- | --- |
| **类目/资质** | 社区/论坛类目需 ICP 备案，可能需增值电信业务许可 | 提前确认主体资质，必要时先用「校园服务」类目 + 社区功能内测 |
| **UGC 内容安全** | 小程序对 UGC 审核严格 | 复用后端敏感词过滤；上线前接入微信内容安全接口（msgSecCheck） |
| **隐私合规** | 收集邮箱、用户信息需《隐私保护指引》 | 微信登录不强制收集，邮箱仅认证时收集，填写隐私指引 |
| **字体体积** | 宋体整包太大 | 只内嵌品牌字子集 |
| **长列表性能** | 帖子/楼层长列表 | 分页 + 楼中楼懒加载（已对齐 Web），必要时 `scroll-view` 虚拟化 |
| **账号合并** | 微信临时号已有内容时合并复杂 | MVP 先「无内容合并，有内容引导邮箱登录」，迁移列为 P1 后置 |
| **基础库兼容** | 暗色/CSS 变量/Skyline 对低版本有限制 | 设置最低基础库版本，低版本优雅降级 |

---

## 10. 附：待办（写方案后立即动作）

1. 建新仓库 `whu-campus-weapp`（git init，不继承 web 仓库历史）。
2. 后端先行：`wechat.appid/secret` 申请 + 微信登录/绑定接口实现 + 部署。
3. 小程序脚手架 + 设计 token 落地 + 组件库首批（button/tag/post-card/tab-bar）。
4. 按 Phase 1 → 4 推进。

---

*本方案为小程序版本的工程基座，页面高保真与组件细节以《UI-珞珈BBS-设计规范》为准，接口契约以《API-珞珈BBS-前端页面与后端接口对照清单》为准。*
