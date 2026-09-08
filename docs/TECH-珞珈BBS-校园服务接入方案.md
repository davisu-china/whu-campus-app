# 珞珈BBS · 校园服务（课表/成绩/图书馆/校车/一卡通/云打印）接入方案

> 状态：待评审　|　依据：逆向分析开源 App「Ham」（`github.com/orangeboyChen/whu-ham`，包名 `com.nowcent.ham` v1.7.1.156）
> 目标：在珞珈BBS 基础上，新增「校园服务」板块，覆盖课表、成绩/绩点、图书馆座位、校车、一卡通、云打印。

---

## 0. 结论速览

| 项 | 结论 |
|---|---|
| 有没有官方公开 API | **没有**。这些数据散落在教务/图书馆/体育部/一卡通各自的内网系统里，无对第三方开放的标准接口 |
| Ham 是怎么做到的 | **凭证代理**：用户把学号+密码交给 App，App 登录武大 CAS，再经 CAS 的 `service` SSO 逐个跳到各子系统，拿到各子系统会话后**抓取/代操作** |
| 我们能不能绕开密码 | 不能。武大统一认证只发「身份」（OIDC `sub`/CAS 用户名），**不发各子系统的数据访问权**。要查成绩/约座位，必须持用户会话 |
| 核心风险 | 要经手并持有用户学号密码/会话，有合规与账号风控风险（见 §4） |
| 建议路线 | 自建「**凭证代理网关**」，**全量覆盖**（课表/成绩/绩点/校车/一卡通/图书馆预约/云打印），按风险分期交付 |
| 凭证策略 | **只存会话不存密码**（方案 A）：用户跳武大 CAS 页面登录，网关只持久化会话票据，密码即用即弃、不落库不落日志 |
| 落地门槛 | 与武大信息中心申请 CAS 接入**对这类功能不解决根本问题**（只给身份），真正要做必须接受凭证代理，或走官方「数据接口」单独申请 |

---

## 1. Ham 逆向分析（各功能实现逻辑）

### 1.1 总体架构：凭证代理 + 会话借用

```
用户 ──学号+密码──> App ──AES加密──> cas.whu.edu.cn/authserver/login ──> 拿到 CAS session cookie
                                                            │
        ┌───────────────────────────────────────────────────┴── 对每个子系统做 SSO 跳转
        ▼            ▼             ▼           ▼           ▼
   jwgl(教务)   seat.lib(图书馆)  gym(体育)  zsgx(一卡通)  print.lib(云打印)
        │            │             │           │           │
     抓课表/成绩   查座位/预约   查场次/下单   查余额     查打印点/上传
```

- **CAS 密码加密**（已在 `docs/TECH-珞珈BBS-武大统一认证接入.md` 附录 C 记录）：`AES-128-CBC(key=pwdEncryptSalt, iv=random16, data=random64+密码, Pkcs7)→base64`。
- Ham 把 CAS session 存在本地（MMKV），`RNCasModule.requestCasCookie()` 只是把 cookie 吐给 JS 层。
- Ham 自己的后端 `api.ham.nowcent.cn` 仅用于：三方登录（QQ/微信/Apple/GitHub）、设备证书、云端配置、图书馆 token 中转；**真正的武大数据抓取在客户端/JS 层完成**，不经过它。

### 1.2 各功能拆解

| 功能 | 认证方式 | 关键端点（实测） | 实现要点 |
|---|---|---|---|
| **CAS 登录** | 密码加密提交 | `cas.whu.edu.cn/authserver/login` | 原生 `RNCasModule`/`qg.e`（CasContext）持会话，密码 AES 加密，带验证码降级 |
| **课表** | CAS→教务 SSO | `jwgl.whu.edu.cn/kbcx/xskbcx_cxXsgrkb.html`（本科）；`yjs.whu.edu.cn/ssfw/pygl/xkgl/xskb.do`（研究生） | JS `Api.fastLogin({service:'https%3A%2F%2Fjwgl.whu.edu.cn%2Fsso%2Fjznewsixlogin'})` 拿教务会话，再 POST 抓 JSON；结果回传原生 `onGetCourseList` 存 Realm 供小组件/离线 |
| **成绩** | 同上 | `jwgl.whu.edu.cn/cjcx/cjcx_cxXsgrcj.html` | POST `xnm`(学年)/`xqm`(学期)/`gnmkdm`，响应 `\xa0` 替换后 `JSON.parse` |
| **绩点计算** | 无需后端 | 社区 JS 脚本（GitHub 托管，含 author/version/script） | `RNScoreCalcModule` 本地跑脚本算 GPA，支持多套算法切换 |
| **图书馆座位** | CAS→图书馆 SSO | `seat.lib.whu.edu.cn/jsq/static/frontApi/*`（querySeatLayout/freeBook/cancel/stop/history）、`/jsq/static/cap/cg/gen/SLIDER`+`/check`（滑块验证码） | 原生 Kotlin，缓存楼栋/房间映射（`LibraryBasicInfo`），含自动预约提醒+桌面小组件 |
| **校车** | 轻认证/WebView | `bus.whu.edu.cn/mobile/?ticket=`、`/interface/whubus/weben/` | WebView 承载为主 |
| **一卡通** | CAS→卡系统 | `zsgx.whu.edu.cn/ydd/login`、`/ydd/card/ematong`、`/ydd/card/nodata` | 查余额/流水 |
| **云打印** | SSO | `print.lib.whu.edu.cn/api/client/{Auth/SSoPage,Auth/Check,Station/GetList,CloudPrint/Upload}` | 打印点列表 + 文件上传 + SSO 会话校验 |

> 补充：Ham 对**自家后端** `api.ham.nowcent.cn` 的请求用原生 `libsec.so`（`SignatureUtils`，checkKey=`H7eG0XsL`）做 `timestamp+nonce+body` 签名防篡改——这是它自己的 API 鉴权，与武大系统无关，我们可借鉴但不是必需。

---

## 2. 核心架构：自建「凭证代理网关」

### 2.1 为什么是网关而不是前端直连

前端直连武大系统有两个硬伤：

1. **跨域/CORS**：浏览器 H5 无法直接 POST `jwgl.whu.edu.cn`（无 CORS 头）；小程序也受域名白名单限制。
2. **凭证安全**：学号密码/会话若落在前端，泄露面更大；且各子系统会话要统一管理、续期、失败重登。

所以把「登录+抓取+缓存」收敛到后端一个网关服务，前端只拿结构化数据。

### 2.2 网关职责

```
前端(H5/小程序)
    │  API: /api/v1/campus/course | /score | /library/seats | /bus | /card | /print
    ▼
凭证代理网关（Go，与现有后端同仓或独立服务）
    ├─ 凭证库：为每个用户存 CAS 会话（或加密凭证），Redis 缓存会话、DB 存加密凭证
    ├─ CAS 客户端：登录/续期/SSO 跳转拿各子系统会话
    ├─ 子系统适配器：jwgl / seat.lib / gym / zsgx / print.lib 各自的抓取+解析
    ├─ 任务调度：定时刷新课表、图书馆自动预约、失败重试
    └─ 反爬对抗：验证码识别（顶象滑块）、UA/频率控制、会话失效检测
```

### 2.3 凭证存储（安全关键）

| 方案 | 说明 | 风险 |
|---|---|---|
| A. 存**会话 cookie/ticket**（推荐） | 登录后只存 CAS 及各子系统 session，不存明文密码 | 会话过期需用户重登；换设备/改密后失效 |
| B. 存**加密密码**（Ham 官方 App 用） | 用服务端密钥 AES 加密密码落库，自动续期 | 一旦密钥泄露=全量密码泄露，**强烈不推荐** |
| C. 仅内存持有 | 每次登录只在本进程存活，重启即失 | 体验差，但仍比落库安全 |

**建议：方案 A 为主**——用户首次登录后只持久化「会话票据」，密码即用即弃（不落库、不落日志）。会话失效时提示用户重新走一遍 CAS 登录（跳武大页面，不碰明文）。

### 2.4 登录流程（不碰密码的凭证代理变体）

Ham 是「App 内表单输密码 → 加密 → POST CAS」。我们可更收敛一步：

```
用户点「绑定教务/图书馆」→ 跳转武大 CAS 登录页（用户在武大页面输密码）
  → CAS 302 回我们的回调（带 ticket / 会话）
  → 网关用 ticket 换各子系统会话，存 Redis
  → 之后网关代抓数据
```

关键点：**密码只在武大 CAS 页面出现，我们的代码不接触明文**。这比 Ham 的「自建表单加密」更干净，但注意 CAS 登录页有 `service` 白名单——需向信息中心登记回调地址（这条与 `TECH-武大统一认证接入.md` 的诉求一致）。

---

## 3. 分功能实现方案（映射现有 Go 后端）

> 现有后端结构：`handler → service → repository → model`，Postgres + Redis + MinIO。校园服务作为新的一组模块挂进去。

### 3.1 新增模块骨架

```
backend/internal/
  campus/
    cas/          # CAS 客户端：login/SSO跳转/会话续期
    adapter/
      edu.go      # jwgl 课表/成绩
      library.go  # seat.lib 座位
      bus.go      # 校车
      card.go     # 一卡通
      print.go    # 云打印
      gym.go      # 体育场馆（可选）
    service/      # 面向 handler 的业务服务
    model/        # 课表/成绩/座位 缓存模型
    store/        # 会话存储（Redis）+ 加密凭证（可选）
```

新增配置段 `config.go`：

```go
type CampusConfig struct {
    Enabled     bool   `mapstructure:"enabled"`
    CASBaseURL  string `mapstructure:"cas_base_url"`   // https://cas.whu.edu.cn
    EduBaseURL  string `mapstructure:"edu_base_url"`   // https://jwgl.whu.edu.cn
    LibBaseURL  string `mapstructure:"lib_base_url"`   // https://seat.lib.whu.edu.cn
    BusBaseURL  string `mapstructure:"bus_base_url"`
    CardBaseURL string `mapstructure:"card_base_url"`
    PrintBaseURL string `mapstructure:"print_base_url"`
    ProxyTTL    string `mapstructure:"proxy_ttl"`      // 会话缓存 TTL
    // 凭证加密（仅方案 B 时启用）
    CredKey     string `mapstructure:"cred_key"`
}
```

### 3.2 课表 / 成绩（只读，最优先）

```
前端 GET /api/v1/campus/course?year=&semester=
  → gateway: 取用户教务会话(Redis) → 无则走 CAS SSO 登录 → POST jwgl 抓 JSON → 解析 → 缓存 → 返回
```

- 首次需绑定：跳武大 CAS，回调拿教务会话，落 Redis（key: `campus:edu:session:{userID}`）。
- 抓取接口：`kbcx`（课表）、`cjcx`（成绩），POST 参数 `xnm/xqm/gnmkdm`，`\xa0` 替换后 JSON 解析。
- 结果缓存在 Redis（TTL 如 1h），避免每次实打实抓。
- 模型：`ScheduleItem{CourseName, Teacher, Weeks, DayOfWeek, StartSection, EndSection, Location}`；`ScoreItem{CourseName, Score, Credit, CourseType, Semester}`。

### 3.3 绩点计算（纯本地，无后端风险）

- 把社区 GPA 算法做成**前端配置脚本**（或后端配置化），对成绩列表本地计算。
- 参考 Ham：脚本含 `author/version/script`，从 GitHub 拉取。我们可简化为内置 2~3 种武大常见算法（平均绩点、加权绩点），不必做脚本市场。

### 3.4 图书馆座位（写操作，含验证码，二期）

```
GET  /api/v1/campus/library/buildings       # 楼栋列表（可缓存）
GET  /api/v1/campus/library/rooms?building= # 房间
GET  /api/v1/campus/library/seats?room=&date=  # 座位布局/空闲
POST /api/v1/campus/library/booking         # 预约（freeBook）
POST /api/v1/campus/library/cancel          # 取消
POST /api/v1/campus/library/checkin         # 签到（stop/签到接口）
```

- 认证走 `seat.lib.whu.edu.cn/rem/static/sso/login` 拿图书馆会话。
- **滑块验证码**（`/cap/cg/gen/SLIDER`→`/cap/cg/check`）是最大难点：需接入验证码识别（人工/第三方打码/极简提示用户手滑）。一期可先做「只读查询座位」，预约二期再接验证码。
- 自动预约/提醒：后端定时任务（复用现有 `internal/job`），到点自动提交预约并发推送（复用现有 notification + 多厂商推送）。

### 3.5 校车（轻，一期可上）

- `bus.whu.edu.cn` 提供线路/实时位置；`?ticket=` 说明可能需 CAS ticket。
- 一期用 **H5 WebView 直接嵌入**官方页面（最低成本），或抓 `interface/whubus/weben` 做结构化展示。

### 3.6 一卡通（只读余额，一期可上）

- 走 `zsgx.whu.edu.cn/ydd/login` 拿卡会话，`/ydd/card/ematong` 查余额，`/nodata` 处理未办卡。
- 只做**余额/近期流水只读展示**，不做充值（充值涉及支付，风险高）。

### 3.7 云打印（写操作，二期）

- SSO（`Auth/SSoPage`）→ `Station/GetList` 查打印点 → `CloudPrint/Upload` 上传。
- 文件走现有 MinIO，上传后调打印系统提交。

---

## 4. 风险与合规（务必评审）

| 风险 | 等级 | 说明与对策 |
|---|---|---|
| **持有用户凭证** | 🔴 高 | 学号密码/会话是敏感数据。对策：方案 A（只存会话不存密码）、加密落库、密钥托管、最小权限、日志脱敏 |
| **账号风控/封号** | 🟠 中 | 频繁抓取可能触发武大系统风控（验证码、临时封禁）。对策：请求频率限制、UA 拟真、失败退避、会话失效提示 |
| **违反校方 ToS** | 🟠 中 | 第三方抓取可能违反武大各系统的使用条款。对策：在隐私政策中明确告知用户「授权代查」，并可考虑联系信息中心说明用途 |
| **验证码** | 🟠 中 | 图书馆/登录滑块验证码是自动化最大障碍。对策：一期绕开（只读），二期人工辅助或第三方打码 |
| **接口随时变更** | 🟡 低-中 | 武大系统页面/接口无稳定承诺。对策：适配器层隔离、缓存兜底、监控告警 |
| **数据一致性** | 🟡 低 | 缓存过期导致数据旧。对策：短 TTL + 手动刷新入口 |

---

## 5. 分阶段落地（全量，按风险排序）

> 决策已锁：**全部功能都要**，凭证用**方案 A（只存会话不存密码）**。

### M1 · 网关骨架 + CAS 会话代理（一切的前提）
- [ ] `campus/config`：新增 `CampusConfig`（各子系统 baseURL、会话 TTL、UA/频率参数）
- [ ] `campus/cas`：CAS 客户端——`LoginURL()`、SSO 跳转拿 `service` ticket、会话续期/失效检测
- [ ] `campus/store`：会话仓储（Redis `campus:session:{sys}:{userID}`，TTL 续期）
- [ ] 统一「绑定」流程：前端跳武大 CAS 页 → 回调 → 网关落会话（密码不落库）
- [ ] 反爬基建：UA 池、请求频率限制、失败退避、会话失效告警
- **验收**：能成功走通「跳 CAS → 拿到教务会话」并缓存。

### M2 · 只读功能（课表/成绩/绩点/校车/一卡通）
- [ ] `campus/adapter/edu.go`：课表 `kbcx`、成绩 `cjcx` 抓取+解析（`\xa0` 清理、JSON 解析）
- [ ] `campus/model`：`ScheduleItem` / `ScoreItem` 模型 + 缓存（Redis 1h）
- [ ] `campus/service` + `handler` + `router`：`GET /campus/course`、`GET /campus/score`
- [ ] 绩点计算：内置 2~3 种武大算法，本地算，不依赖后端
- [ ] 校车：`bus.whu.edu.cn` WebView 兜底 + `weben` 结构化（择一）
- [ ] 一卡通余额：`zsgx.whu.edu.cn/ydd/ematong` 只读
- **验收**：用户绑定后能拉到课表/成绩/卡余额。

### M3 · 写操作：图书馆座位预约（含验证码）
- [ ] `campus/adapter/library.go`：SSO 认证 → 楼栋/房间/座位图/空闲查询
- [ ] 座位**只读查询**接口先行
- [ ] 滑块验证码（`/cap/cg/gen/SLIDER`→`/check`）：一期人工辅助提示，二期接自动识别
- [ ] `freeBook`/`cancel`/签到 写接口 + 幂等 + 错误映射
- [ ] 定时自动预约（复用 `internal/job`）+ 推送提醒（复用 notification）
- **验收**：可查询座位并完成一次预约/取消。

### M4 · 云打印 + 体育场馆
- [ ] `campus/adapter/print.go`：SSO（`Auth/SSoPage`）→ `Station/GetList` → `CloudPrint/Upload`（文件走 MinIO）
- [ ] `campus/adapter/gym.go`（可选）：`GSStadiums`/`GSOrder` 查询与下单
- **验收**：打印点列表 + 上传打印；体育场次查询（下单视需要）。

### M5 · 体验增强 + 官方接口兜底
- [ ] 桌面小组件（课表/图书馆）、本地日历同步、多厂商推送提醒
- [ ] 会话失效的「重登引导」流程（不碰密码）
- [ ] 若武大信息中心提供官方数据接口，切换官方通道、废弃凭证代理

### 依赖前置（与写代码并行推进）
- [ ] 向武大信息中心登记 CAS 回调 `service` URL（公网 HTTPS），否则「应用未注册」
- [ ] 隐私政策补充「用户授权代查/代操作」条款，明确数据只读/缓存范围
- [ ] 摸清图书馆滑块验证码的滑块轨迹校验逻辑（M3 的关键前置）

---

## 附录：Ham 关键端点速查

| 系统 | 端点 |
|---|---|
| CAS | `cas.whu.edu.cn/authserver/login` |
| 教务登录 | `jwgl.whu.edu.cn/sso/jznewsixlogin` |
| 课表 | `jwgl.whu.edu.cn/kbcx/xskbcx_cxXsgrkb.html` |
| 成绩 | `jwgl.whu.edu.cn/cjcx/cjcx_cxXsgrcj.html` |
| 研究生课表 | `yjs.whu.edu.cn/ssfw/pygl/xkgl/xskb.do` |
| 图书馆 | `seat.lib.whu.edu.cn/jsq/static/frontApi/{res,make,user}/*`、`/cap/cg/gen/SLIDER` |
| 校车 | `bus.whu.edu.cn/interface/whubus/weben/`、`bus.whu.edu.cn/mobile/?ticket=` |
| 一卡通 | `zsgx.whu.edu.cn/ydd/{login,card/ematong,card/nodata}` |
| 云打印 | `print.lib.whu.edu.cn/api/client/{Auth,Station,CloudPrint}/*` |
| 体育场馆 | `gym.whu.edu.cn/api/{GSOrder,GSStadiums}/*` |
