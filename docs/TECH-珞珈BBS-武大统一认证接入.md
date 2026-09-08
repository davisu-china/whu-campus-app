# 珞珈BBS · 武大统一身份认证（SSO）接入技术方案

> 状态：待评审　|　目标：用户直接用武大统一身份登录珞珈BBS，首次登录即自动建号，无需单独注册
> 前置调研：已实测武大 CAS（`cas.whu.edu.cn`）协议端点与未注册拦截行为，见文末「附录」。

---

## 0. 结论速览

| 项 | 结论 |
|---|---|
| 用哪套协议 | **优先 OIDC（Authorization Code 流程）**，CAS 2.0 作为降级备选 |
| 需不需要用户再注册 | **不需要**。首次 SSO 登录自动建号（`is_verified=true`） |
| 用户唯一身份 | OIDC `sub` 为第一优先；若能拿到 `email`/学号则与现有 `users.email`/`student_no` 做**账号合并** |
| 最大前置条件 | **必须向武大信息中心注册接入**（client_id / service URL），否则 CAS 返回「应用未注册」 |
| 我们侧改动 | 新增 1 个 SSO 客户端 + 3 个路由 + 用户表加 1 字段，复用现有 JWT 体系 |
| 密码是否经手 | **不碰用户密码**。用户只在武大 CAS 页面输密码，我们只拿 ticket/code 换身份 |

---

## 1. 背景与目标

当前珞珈BBS 的注册/登录依赖「武大邮箱 + 验证码」自建账号体系（`internal/service/auth.go`）。目标是在此基础上**新增**一条「武大统一身份认证」登录路径：

- 用户在 BBS 点「武大统一登录」→ 跳武大 CAS 登录页 → 输学号/工号密码（在武大页面完成，我们不见明文）
- CAS 校验通过后回调我们 → 我们拿到用户身份 → **首次自动建号** / **已有账号直接登录**
- 登录后仍走现有 JWT（access + refresh）体系，对下游零感知

---

## 2. 协议选型

武大 CAS（`https://cas.whu.edu.cn/authserver`）实测同时开放：

| 协议 | 端点 | 特点 |
|---|---|---|
| **OIDC（推荐）** | `/oidc/authorize`、`/oidc/accessToken`、`/oidc/profile`、`/oidc/jwks` | 标准 OAuth2+OIDC，返回 RS256 签名的 `id_token`，`sub` 稳定且唯一 |
| CAS 2.0 | `/login`、`/serviceValidate` | 更简单，无 client secret，返回 XML，属性释放依赖对方配置 |
| OAuth2.0 | `/oauth2.0/authorize` | 与 OIDC 同源，不额外采用 |

### 为什么优先 OIDC

1. `sub`（subject）是**稳定、唯一、且对第三方不可逆**的用户标识，适合做我们侧的账号关联键。
2. 标准库成熟（Go 用 `coreos/go-oidc` 或 `lestrrat-go/jwx`），省去 CAS XML 解析与属性映射的不确定性。
3. 发现文档明确支持 `authorization_code`、`RS256`，签名可用 `/oidc/jwks` 公钥校验。

### 备选：CAS 2.0

若信息中心只开放 CAS 2.0（或要求 service URL 白名单方式），则改用 `/serviceValidate` 校验 ticket，从 XML 取 `<cas:user>` 与属性（学号/姓名/邮箱）。关键差异：CAS 2.0 **没有 client secret**，安全性靠「service URL 精确匹配 + ticket 一次性」。

> 两条路线最终如何落地，取决于信息中心批复给你的：**client_id/client_secret（OIDC）** 还是 **service URL（CAS 2.0）**，以及**释放哪些属性**。方案已兼容两者。

---

## 3. 关键前置条件（不可绕过）

实测：用未注册 service 请求 `/authserver/login`，CAS 直接返回 **「应用未注册」**，无法进入登录页。

**必须先向武汉大学信息中心（网络信息中心）申请统一身份认证接入**，通常需要提供：

- 应用名称、简介、负责人、联系方式
- 回调地址（redirect_uri / service URL，**必须是公网 HTTPS**）
- 需要的用户属性（学号、工号、姓名、武大邮箱 `xxx@whu.edu.cn`、院系等）——尽量申请到 **email 或学号**，用于和现有账号合并
- 生产与测试环境各一份

批复后拿到其中之一：
- **OIDC**：`client_id` + `client_secret` + 已登记的 `redirect_uri`
- **CAS 2.0**：已登记的 `service` 回调 URL

> ⚠️ 这是方案能否上线的前提。在拿到批复前，可先用「附录 C：凭证代理」做临时联调，但**不推荐长期使用**。

---

## 4. 认证流程设计

### 4.1 OIDC（Authorization Code + PKCE 可选）

```
前端                    后端(BBS)                       武大 CAS
 │  GET /auth/sso/login    │                                │
 │────────────────────────>│ 生成 state(防CSRF)+nonce       │
 │                         │ 302 → /oidc/authorize          │
 │                         │  ?response_type=code           │
 │                         │  &client_id=...                │
 │                         │  &redirect_uri=...             │
 │                         │  &scope=openid+profile+email   │
 │                         │  &state=...&nonce=...          │
 │                         │───────────────────────────────>│
 │  ← 武大登录页（用户输密码）│                                │
 │                         │  校验通过，302 回 redirect_uri   │
 │                         │  ?code=xxx&state=xxx           │
 │                         │<───────────────────────────────│
 │  GET /auth/sso/callback │                                │
 │────────────────────────>│ 1) 校验 state                   │
 │                         │ 2) POST /oidc/accessToken       │
 │                         │    code+client_id+secret+redirect_uri
 │                         │    → id_token + access_token    │
 │                         │ 3) 验 id_token 签名/iss/aud/nonce│
 │                         │ 4) GET /oidc/profile 取用户属性  │
 │                         │ 5) find-or-create user          │
 │                         │ 6) 签发我们自己的 JWT pair       │
 │                         │<── 302 回前端(带一次性票据/置Cookie)
```

**token_endpoint 注意**：武大 OIDC 的 token 端点是 `/oidc/accessToken`（非标准 `/token`），userinfo 是 `/oidc/profile`，均以发现文档为准。

### 4.2 CAS 2.0（备选）

```
GET /authserver/login?service=https://<host>/api/v1/auth/sso/callback
  → 用户登录 → 302 回 service 地址 ?ticket=ST-xxxx
GET /authserver/serviceValidate?service=<同service>&ticket=ST-xxxx
  → XML: <cas:user>xxx</cas:user> + <cas:attributes>...
```

---

## 5. 用户模型与自动建号（account provisioning）

现有 `model.User`（`backend/internal/model/user.go`）已具备大部分字段：

```go
Email      string  `gorm:"size:128;uniqueIndex"`   // @whu.edu.cn 唯一
StudentNo  *string `gorm:"size:32;uniqueIndex"`    // 学号（已预留）
College    string  `gorm:"size:64"`
Grade      string  `gorm:"size:16"`
IsVerified bool                                      // 武大认证标记
```

**新增一个 SSO 关联键字段**（用于 OIDC `sub` 或 CAS 用户名，作为稳定关联，避免 email 变更后断链）：

```go
CasSubject *string `gorm:"size:128;uniqueIndex" json:"-"` // 武大统一身份 sub/username
```

### find-or-create 逻辑（核心）

按优先级匹配，避免重复建号：

1. `CasSubject` 命中 → 该用户已关联，直接登录。
2. 未命中，但 CAS 返回了 `email` 且 `users.email` 已存在 → **账号合并**：把 `CasSubject` 回填到该用户（一个武大身份对应一个 BBS 号）。
3. 仍未命中 → **自动建号**：`IsVerified=true`，回填 email / student_no / college / grade / nickname（默认用学号或邮箱前缀），`Role=RoleNormal`，`Status=Normal`。
4. 建号时若 `email`/`student_no` 与现有唯一索引冲突（并发/脏数据），按唯一索引兜底降级为合并，不抛 500。

> 该逻辑即满足「统一认证就不需要再注册」：SSO 回调即注册+登录二合一。

### 封禁联动

登录前仍检查 `Status == UserStatusBanned`，被封禁的 SSO 用户同样拒绝（沿用 `Login` 的既有逻辑）。

---

## 6. 后端实现方案（映射现有代码结构）

### 6.1 配置 `internal/config/config.go`

新增 `SSO` 配置段：

```go
type SSOConfig struct {
    Enabled      bool   `mapstructure:"enabled"`
    Protocol     string `mapstructure:"protocol"` // "oidc" | "cas"
    Issuer       string `mapstructure:"issuer"`   // https://cas.whu.edu.cn/authserver
    ClientID     string `mapstructure:"client_id"`
    ClientSecret string `mapstructure:"client_secret"`
    RedirectURI  string `mapstructure:"redirect_uri"`
    Service      string `mapstructure:"service"` // CAS 2.0 的 service 回调
    Scopes       []string `mapstructure:"scopes"`
}
```

默认值：`Issuer=https://cas.whu.edu.cn/authserver`、`Scopes=["openid","profile","email"]`。

### 6.2 新增 SSO 客户端 `internal/auth/sso.go`

- `NewSSOClient(cfg)`：按 `Protocol` 装配 OIDC provider（`coreos/go-oidc`）或 CAS 客户端。
- `LoginURL(state, nonce)`：生成授权跳转 URL（OIDC）或 CAS login URL。
- `Exchange(ctx, code)`：OIDC 用 code 换 `id_token`，校验签名/iss/aud/nonce，返回 `Identity{Sub, Email, Name, StudentNo, College}`。
- `ValidateTicket(ctx, service, ticket)`：CAS 2.0 校验 ticket，解析 XML，返回同上 `Identity`。
- JWKS 公钥缓存（OIDC 验签），避免每次拉取。

### 6.3 服务层 `internal/service/auth.go`

新增方法：

- `SSOLoginURL() (string, error)`：生成并返回跳转 URL，同时把 `state` 写入 Redis（短 TTL，如 5min）用于回调校验。
- `SSOCallback(ctx, state, code/ticket) (*TokenPair, *User, error)`：
  1. 校验 `state`（一次性，比对后删除）
  2. 调 `SSOClient` 换身份
  3. 执行第 5 节 find-or-create
  4. 复用 `issuePair(user)` 签发 JWT

### 6.4 仓库层 `internal/repository/user.go`

新增：

- `FindByCasSubject(sub string)`
- `FindByStudentNo(no string)`（如 CAS 2.0 只给学号）

### 6.5 路由 `internal/router/router.go` + handler

```go
// 认证
authGroup.GET("/sso/login",    middleware.RateLimit(...), authH.SSOLogin)     // 302 跳 CAS
authGroup.GET("/sso/callback", authH.SSOCallback)                              // 处理 code/ticket
```

`handler/auth.go` 新增两个方法。回调成功后：

- **Web 端**：`Set-Cookie`（httpOnly, Secure, SameSite=Lax）写入 access/refresh，再 `302` 回前端落地页；或返回一次性 `state` 让前端去 `/auth/sso/token` 换 JWT（与现有 JSON 风格一致）。
- **小程序/App**：回调地址落到一个中间页，通过 `postMessage`/URL fragment 把一次性票据交回原生，再由原生调后端换 JWT。

### 6.6 错误码 `pkg/xerr/xerr.go`

新增（沿用 2xxx 段）：

- `CodeSSOStateInvalid = 20013`：state 失效/不匹配（防 CSRF）
- `CodeSSOUnregistered = 20014`：应用未注册（对方返回）
- `CodeSSOFailed = 20015`：SSO 身份校验失败
- `CodeSSOAccountBanned = 20016`：关联账号被封禁（可复用 CodeUserBanned，视需要）

---

## 7. 安全设计

| 风险 | 对策 |
|---|---|
| CSRF（回调被伪造） | `state` 参数：服务端生成、写 Redis、回调比对后一次性销毁 |
| id_token 重放 | 校验 `nonce`、`aud`（=client_id）、`iss`、`exp`、RS256 签名 |
| ticket 重放（CAS 2.0） | ticket 天然一次性，服务端立即消费，不做缓存复用 |
| redirect_uri 劫持 | 回调地址与登记值**精确匹配**，拒绝一切动态拼接 |
| 账号枚举 | SSO 回调不返回「是否已存在」差异，统一走 find-or-create |
| 属性泄露 | 只落库必要字段（sub/email/学号/院系），日志脱敏，不回显敏感信息 |
| 会话残留 | 我们侧 token 走现有 TTL；用户退出可跳 CAS `/logout` 全局登出（可选） |

---

## 8. 降级 / 兜底方案

### 8.1 官方接入前（联调期）

可用「**凭证代理**」临时跑通：我们自建登录表单，后端代理提交到 CAS（含上轮逆向出的 AES 密码加密）——**强烈不推荐上线**：

- 需要经手并临时持有用户明文密码，安全责任大；
- CAS 有验证码与失败限流，易被风控拦截；
- 依赖 `pwdEncryptSalt` 与加密细节，对方一改即失效。

结论：**仅用于内部联调，拿到官方批复后立即切换回 4.1 的标准流程。**

### 8.2 现有邮箱体系保留

- 统一登录是**新增**路径，不影响现有「邮箱+验证码」注册/登录；
- 若某用户两个渠道都用了同一个 `@whu.edu.cn`，由第 5 节账号合并逻辑收敛为一个账号。

---

## 9. 落地检查清单

- [ ] 向武大信息中心提交接入申请，确认协议（OIDC/CAS2）、回调地址、属性（email/学号）
- [ ] 拿到 client_id/secret（或 service 白名单）后填 `config.yaml` 的 `sso` 段
- [ ] 用户表迁移：新增 `cas_subject`（`*string, uniqueIndex, nullable`）
- [ ] 实现 `internal/auth/sso.go` + `service` + `handler` + `router` + 错误码
- [ ] 前端加「武大统一登录」入口，处理 302 回调与 token 落地
- [ ] 联调：新用户首次登录自动建号；老邮箱用户登录合并；被封禁用户拒绝
- [ ] 上线前做一次安全评审（state/nonce/aud/iss 校验全覆盖）

---

## 附录 A：实测端点清单

| 端点 | 结果 |
|---|---|
| `GET /authserver/oidc/.well-known/openid-configuration` | ✅ 200，完整 OIDC 发现文档 |
| `GET /authserver/oidc/jwks` | ✅ 200，RS256 公钥 |
| `GET /authserver/serviceValidate?service=..&ticket=ST-invalid` | ✅ 200 XML，`INVALID_TICKET`（协议可用） |
| `GET /authserver/login?service=<未注册>` | ❌ 返回「应用未注册」 |
| `GET /authserver/oidc/authorize` | ✅ 302 到登录页 |

## 附录 B：OIDC 发现文档关键字段

- `issuer`: `https://cas.whu.edu.cn/authserver/oidc/`
- `authorization_endpoint`: `/oidc/authorize`
- `token_endpoint`: `/oidc/accessToken`（注意非 `/token`）
- `userinfo_endpoint`: `/oidc/profile`
- `jwks_uri`: `/oidc/jwks`
- `id_token_signing_alg_values_supported`: `["none","RS256"]`
- `grant_types_supported`: `authorization_code / password / client_credentials / refresh_token`
- `scopes_supported`: `openid profile email address phone offline_access`

## 附录 C：CAS 密码加密（仅联调参考）

`cas.whu.edu.cn/authserver/whuThemeNew1/static/common/encrypt.js`：

```
encryptPassword(pwd, salt)  → AES-128-CBC(key=salt=pwdEncryptSalt,
                                        iv=random16, data=random64+pwd, Pkcs7) → base64
```

> 仅用于 8.1 的临时联调，正式方案（4.1）不涉及密码。
