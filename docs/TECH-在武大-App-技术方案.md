# TECH-在武大-App-技术方案

> 版本：v0.1（草案）
> 日期：2026-09-09
> 状态：待评审

## 一、背景与目标

「在武大」（原珞珈BBS）已有三端：

| 端 | 技术栈 | 状态 |
|---|---|---|
| 后端 | Go (Gin/GORM/PostgreSQL/Redis/MinIO) | 功能完整，已部署 |
| Web | Vite + React 18 + TS + Tailwind + Zustand | 功能完整 |
| 小程序 | 原生 TS + mobx-miniprogram | 因小程序申请门槛暂停 |

**目标**：放弃小程序路线，改做原生 App，**一套代码覆盖 iOS + Android 两端**，最大化复用现有 Web 逻辑层，降低开发与维护成本。

**已确认决策**：

1. 跨端框架：**React Native（Expo）**。
2. 分发策略：**内部分发优先**（安卓 APK 直接分发 + iOS TestFlight），后续再评估商店上架。

---

## 二、为什么是 React Native (Expo)

三条硬理由，均指向「复用」：

1. **后端零改动**：后端是纯 REST + JWT，客户端无关，任何端都能接同一套 `/api/v1`。
2. **现有 Web 逻辑层可直接复用**：`luojia-web/src/` 下的 `api/*`、`types.ts`、`store/*`、`utils/*`、`constants/*`、`hooks/*` 全部是纯逻辑、无 DOM 依赖，约 **60% 代码可复用**，只需重写 UI 层。
3. **团队零新语言成本**：继续写 TypeScript，无需转 Dart/Vue。

### 备选方案对照

| 维度 | React Native (Expo) ✅ | Flutter | uni-app (Vue) | Taro (React) |
|---|---|---|---|---|
| 语言 | TS（已有） | Dart（新学） | Vue（新学） | TS |
| 现有 Web 逻辑复用 | 高 | 无 | 低 | 中 |
| UI 一致性/性能 | 好 | 最佳 | 一般 | 一般 |
| 热更新 | expo-updates | 需自搭 | 有 | 有 |
| 云端构建 | EAS Build | 无 | HBuilderX | 无 |
| 学习成本 | 低 | 高 | 中 | 低 |

---

## 三、总体架构

```
┌─────────────────────────────────────────────────────┐
│                      后端（零改动）                      │
│   Go REST API /api/v1（JWT + MinIO presign）          │
└───────────────────────▲─────────────────────────────┘
                        │ HTTPS JSON
        ┌───────────────┼────────────────┐
        │               │                │
┌───────┴──────┐ ┌──────┴──────┐ ┌───────┴──────┐
│  Web (React) │ │ App (Expo)  │ │ 小程序(冻结)  │
│  luojia-web  │ │ apps/app    │ │ whu-campus-  │
└──────────────┘ └─────────────┘ │ weapp        │
        │               │        └──────────────┘
        └───────┬───────┘
        ┌───────▼──────────────────┐
        │ packages/shared（逻辑层） │
        │  api · types · store ·   │
        │  utils · constants · hooks│
        └──────────────────────────┘
```

要点：

- 后端不动；App 与 Web 共用同一套 API 契约（`packages/shared/src/api`）。
- 共享层是「纯逻辑」，不含任何 DOM / RN 专属依赖；`localStorage`、`fetch`、`toast` 等环境差异通过**注入/抽象**隔离（见 §六）。

---

## 四、代码组织（monorepo）

采用 pnpm workspace，仓库根新增 `pnpm-workspace.yaml`：

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'luojia-web'
```

```
whu-campus-app/
├── backend/                 # 现有 Go 后端（零改动）
├── packages/
│   └── shared/              # ★ 抽出逻辑层（web + app 共用）
│       ├── src/
│       │   ├── api/         # request + auth/board/content/user/
│       │   │                #   notification/search/upload/messages/campus
│       │   ├── types.ts
│       │   ├── store/       # auth/app/category/message/notification/toast
│       │   ├── utils/       # format / cn / mention
│       │   ├── constants/   # enums
│       │   └── hooks/       # usePaginatedList
│       ├── package.json     # name: @whu/shared
│       └── tsconfig.json
├── apps/
│   └── app/                 # ★ 新增 RN (Expo) App
│       ├── app/             # expo-router 文件路由（(tabs)/ post/[id]/ …）
│       ├── src/
│       │   ├── components/  # RN UI：PostCard/ProfileCard/Avatar/…
│       │   └── theme/       # 设计 token（沿用 UI-设计规范 色板）
│       ├── app.json
│       ├── eas.json         # EAS Build 配置
│       └── package.json     # 依赖 @whu/shared
├── luojia-web/              # 现有 Web（import 逐步改为 @whu/shared）
└── docs/
```

**渐进落地顺序**（避免一次性大重构）：

1. **Phase 0**：先把 Web 的逻辑层**原样拷贝**进 `packages/shared`，App 脚手架只依赖 `@whu/shared` 跑通登录闭环；Web 暂不迁移、继续独立运行。
2. **稳定后**：Web 的 `src/api` 等 import 逐步指向 `@whu/shared`，消除双份拷贝。
3. 小程序仓库 `whu-campus-weapp` 已删除（2026-09-09 决定暂停小程序、聚焦 App），备份留在 `scratch/`；不再参与 shared 迁移。

---

## 五、复用映射清单

| 现有文件（luojia-web/src/） | 复用方式 | 说明 |
|---|---|---|
| `api/request.ts` | **改** | tokenStore 换 SecureStore、BASE 换环境变量、toast 适配 |
| `api/auth.ts` | 复用 | 邮箱验证码/密码/注册/重置/refresh/getMe/updateMe 全有 |
| `api/board.ts` `content.ts` `user.ts` `notification.ts` `search.ts` `upload.ts` `messages.ts` `campus.ts` | 复用 | 纯 fetch 封装，零改 |
| `api/types.ts` | 复用 | 契约类型（含私信 Conversation/Message） |
| `store/auth.ts` `app.ts` `category.ts` `message.ts` `notification.ts` | 复用 | zustand，RN 原生支持 |
| `store/toast.ts` | **改** | Web 是渲染组件；RN 改用原生提示或自绘 Snackbar |
| `utils/format.ts` `mention.ts` | 复用 | 纯函数 |
| `utils/cn.ts` | 复用 | NativeWind 支持 clsx + tailwind-merge |
| `constants/enums.ts` | 复用 | 常量 |
| `hooks/usePaginatedList.ts` | 复用 | 纯 React hook，RN 可用 |
| `components/*` `pages/*` `layouts/*` | **重写** | RN 组件 |

---

## 六、共享层适配点（唯一的硬改造）

### 1. tokenStore 存储抽象（`api/request.ts`）

Web 用 `localStorage`，App 用 `expo-secure-store`（加密存储，令牌不宜明文落 AsyncStorage）。把 tokenStore 抽成可注入实现：

```ts
// packages/shared/src/api/tokenStore.ts
export interface TokenStore {
  getAccess(): string
  getRefresh(): string
  setAccess(t: string): void
  setRefresh(t: string): void
  clear(): void
}
```

- Web 注入：`localStorageTokenStore`。
- App 注入：`secureStoreTokenStore`（基于 `expo-secure-store`）。
- `request.ts` 引用注入的 tokenStore，不再 import `localStorage`。

### 2. BASE 地址

Web 用 `import.meta.env.VITE_API_BASE`；App 用 `process.env.EXPO_PUBLIC_API_BASE`。共享层统一读取一个由运行时注入的 `API_BASE` 常量。

### 3. toast 呈现

`store/toast.ts` 保留「存消息 + 自动消失」的状态逻辑；**渲染层**两端各自实现（Web 已有组件，App 用自绘 Snackbar 或 `Alert`）。

### 4. fetch 兼容性

RN 内置 `fetch` 满足 JSON 请求与 `PUT` 上传（presign 的 `client: 'web'` 协议）。仅需确认 `Content-Type` 与 `FormData`（上传图片时）用法一致。

---

## 七、关键技术选型

| 关注点 | 选型 | 理由 |
|---|---|---|
| 框架 | Expo（最新稳定版 SDK） | 工具链最省心，含 EAS、OTA |
| 路由 | expo-router | 文件式路由，接近 Next.js 心智 |
| 状态 | zustand | 与 Web 一致，直接复用 |
| 样式 | NativeWind | 延续 Tailwind 心智，复用 `cn.ts` 与设计 token |
| Token 存储 | expo-secure-store | 加密存储 JWT |
| 选图/上传 | expo-image-picker + presign `PUT` | 复用后端上传链路，零改动 |
| 动画/手势 | react-native-reanimated + gesture-handler（可选） | 需要复杂交互时再引入 |
| 构建 | EAS Build（云构建） | 无需本地配 Xcode/Android 环境 |
| 热更新 | expo-updates（OTA） | 内测期快速发版/修 bug，绕开 TestFlight 排队 |

---

## 八、登录 / 认证方案（App 端差异）

后端现有认证面：邮箱验证码（`/auth/email/send-code` + `/auth/email/login`）、密码（`/auth/register` + `/auth/login`）、重置密码、refresh、微信登录（`/auth/wechat/login`，**仅小程序 code**）。

**App 端方案**：

1. **MVP 用邮箱验证码登录**：后端零改动，直接复用 `api/auth.ts`。
2. **学生认证**：走武大统一身份认证 CAS 绑定（`/campus/cas/bind`），App 内嵌 WebView 完成统一认证，复用现有 CAS 接入方案。
3. **微信登录（后续可选）**：⚠️ 小程序 `code` 与 App 不同源——App 需接入**微信开放平台移动应用**（AppID 与小程序 AppID 不同），后端需新增 App 端 `code2access_token` 逻辑（或按 unionid 打通）。**暂缓**，内测阶段不依赖微信登录。

---

## 九、内部分发方案

### 安卓（APK 直接分发）

- EAS Build 产出 release APK（`eas build -p android --profile preview`）。
- 用**自有 keystore** 签名（EAS 可代管或本地生成），keystore 与密码**务必妥善保管**（丢失无法覆盖升级）。
- 分发渠道：官网/QQ 群/网盘/内测链接，用户侧直接安装。

### iOS（TestFlight）

- 需要 **Apple 开发者个人账号**（$99/年，必须）。
- EAS Build 托管 iOS 签名证书 + 描述文件（`eas credentials`）。
- 通过 TestFlight 内测：**单版本 10000 名额、90 天过期**，需定期续发新 build。
- 内测阶段不走上架审核，但建议准备好**隐私政策 URL**（涉及邮箱、学号、位置等个人信息）。

### 合规

- **内测阶段**：隐私政策（建议）、软著（可选）。
- **后续上架**：软著 + ICP 备案 + 各商店安全检测 + iOS 机构资质证明（校园类 App 常见要求）。

---

## 十、里程碑

| 阶段 | 内容 | 验收标准 |
|---|---|---|
| **Phase 0** 脚手架 + 复用层 | 建 monorepo、抽 `packages/shared`、App 脚手架（expo-router + NativeWind + zustand + SecureStore）、邮箱登录闭环 | App 内登录 → 看到用户资料与通知未读 |
| **Phase 1** 社区核心 | 首页 feed/hot、板块、帖子详情、发帖、搜索、通知、我的、他人主页、私信 | 对齐 Web 已有页面，逻辑复用 |
| **Phase 2** 校园服务 | CAS 绑定、课表/成绩/一卡通/校车/图书馆座位/云打印/体育馆 | 对齐后端校园服务接口 |
| **Phase 3** 内部分发 | 安卓签名 APK + iOS TestFlight；可选：推送、微信登录 | 学生可安装内测 |

---

## 十一、风险与注意事项

1. **微信登录身份不互通**：小程序 openid ≠ App openid，需独立申请微信开放平台移动应用并打通 unionid。
2. **安卓无 GMS，推送受限**：MVP 用**轮询**兜底（后端已有 `unread-count` 接口，与私信 25s 轮询同款），后续再接厂商推送通道。
3. **tokenStore 是唯一硬改造点**：抽存储抽象即可，其余逻辑零改。
4. **iOS 签名/安卓 keystore 保管**：遗失即无法覆盖升级。
5. **TestFlight 90 天过期**：需持续发 build 或尽早规划上架。
6. **toast 组件需 RN 化**：共享层只留状态逻辑，渲染两端各自实现。

---

## 十二、待办（评审后启动）

- [ ] 确认 Expo SDK 版本与 Node 版本要求
- [ ] 确认 pnpm workspace 是否引入（或改用 npm workspaces）
- [ ] `packages/shared` 抽离与 tokenStore 抽象改造
- [ ] App 脚手架 + 登录页跑通
