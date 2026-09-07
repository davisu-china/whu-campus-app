# 珞珈BBS 后端技术方案（MVP）

| 项目 | 内容 |
| --- | --- |
| 文档版本 | v0.1 |
| 更新日期 | 2026-09-08 |
| 关联文档 | 《PRD-珞珈BBS-MVP》 |
| 架构形态 | 单体（模块化单体） |
| 技术栈 | Go + GORM + PostgreSQL + Redis + MinIO |
| 文档范围 | 仅后端，前端技术方案另行产出 |

---

## 1. 概述

### 1.1 目标

本文档定义珞珈BBS 后端的 MVP 技术方案，覆盖 PRD 中 P0/P1 功能的后端实现设计，指导开发落地。方案遵循以下约束：

- **单体架构**：单一可部署二进制，内部按模块清晰分层，为将来拆分微服务留余地（模块化单体）。
- **技术栈固定**：Go + GORM（ORM）+ PostgreSQL（主存储）+ Redis（缓存/计数/限流）+ MinIO（对象存储）。
- **对齐 PRD**：数据模型与接口按 PRD 的功能编号（F-xx）与信息架构（分类/板块/标签/词典/帖子/楼层）设计。

### 1.2 非目标

- 前端实现、UI 设计。
- 即时通讯、交易担保/支付、积分/等级/商城、直播/短视频、活动报名/票务、校友认证（PRD 已明确不做）。
- 微服务化、分布式事务、多机房容灾（均为单体后续演进项）。

---

## 2. 技术选型

| 组件 | 选型 | 版本 | 说明 |
| --- | --- | --- | --- |
| 语言 | Go | 1.22+（建议 1.23） | 单二进制、并发模型适合 I/O 密集的社区场景 |
| Web 框架 | Gin | v1.10.x | 生态成熟、中间件丰富、路由性能好 |
| ORM | GORM | v2 | 配合 `gorm.io/driver/postgres`（底层 pgx） |
| 数据库 | PostgreSQL | 16 | JSONB、部分唯一索引、pg_trgm、`RETURNING` 等特性支撑核心难点 |
| 缓存/计数 | Redis | 7.x | `go-redis/v9` |
| 对象存储 | MinIO | 最新稳定版 | `minio-go/v7`，S3 兼容 |
| 鉴权 | JWT | `golang-jwt/jwt/v5` | Access + Refresh 双 token |
| 邮件服务 | SMTP | — | 发送邮箱验证码（如武大邮件服务 / 阿里云 DM / SendGrid） |
| 配置 | Viper | v1.19 | YAML + 环境变量覆盖 |
| 参数校验 | validator | v10 | 请求结构体校验 |
| 日志 | zap | v1.27 | 结构化日志 |
| ID 生成 | google/uuid | v1.6 | 主键用 UUID（避免自增 ID 泄露量级） |
| 中文搜索 | pg_trgm | PG 内置扩展 | MVP 用三元组模糊匹配，见 7.6 |
| 定时任务 | robfig/cron | v3 | 热榜计算、计数落库 |

> 说明：MVP 中文搜索用 **pg_trgm + ILIKE**（GIN 三元组索引），不引入外部搜索引擎；当搜索质量/规模成为瓶颈时，再评估 Meilisearch / OpenSearch（记为后续演进项）。

---

## 3. 总体架构

### 3.1 架构形态：模块化单体

单一进程，内部按领域分层。对外暴露 REST API；小程序与 Web 复用同一套接口。

```
                        ┌─────────────────────────────┐
   微信小程序 ────────▶ │                             │
                        │        Gin HTTP Server      │
   Web 前端   ────────▶ │   (router + middleware)     │
                        └──────────────┬──────────────┘
                                       │
                        ┌──────────────▼──────────────┐
                        │          Handler 层          │  参数校验、序列化、鉴权装配
                        └──────────────┬──────────────┘
                                       │
                        ┌──────────────▼──────────────┐
                        │          Service 层          │  业务编排、事务、状态流转
                        └───┬──────────┬──────────┬────┘
                            │          │          │
                 ┌──────────▼───┐ ┌────▼─────┐ ┌──▼──────────┐
                 │ Repository 层 │ │  Cache   │ │   Storage   │
                 │   (GORM)     │ │  (Redis) │ │   (MinIO)   │
                 └──────────┬───┘ └────┬─────┘ └──┬──────────┘
                            │          │          │
                 ┌──────────▼──────────▼──────────▼──────────┐
                 │   PostgreSQL   │   Redis   │    MinIO     │
                 └────────────────┴───────────┴──────────────┘
```

### 3.2 分层职责

| 层 | 职责 | 约束 |
| --- | --- | --- |
| Handler | 解析请求、参数校验、调用 Service、统一响应 | 不写业务逻辑、不直接碰 DB |
| Service | 业务规则、事务边界、状态流转、缓存更新 | 不依赖 HTTP 细节 |
| Repository | GORM 数据访问、查询构造 | 不写业务规则 |
| Middleware | 鉴权、限流、日志、恢复、请求 ID | 无状态 |

---

## 4. 工程目录结构

```
whu-campus-app/
├── cmd/
│   └── server/
│       └── main.go           # 入口：装配配置→依赖→启动 HTTP
├── internal/
│   ├── config/               # 配置结构体与加载
│   ├── model/                # GORM 模型 / 枚举 / 常量
│   ├── repository/           # 数据访问（按领域分包）
│   ├── service/              # 业务逻辑（按领域分包）
│   ├── handler/              # HTTP 处理器
│   ├── middleware/           # 鉴权、限流、日志、恢复
│   ├── router/               # 路由注册与分组
│   ├── cache/                # Redis 客户端与封装
│   ├── storage/              # MinIO 客户端与封装
│   ├── auth/                 # JWT 签发/校验、邮箱验证码签发/校验
│   ├── filter/               # 敏感词过滤（AC 自动机）
│   ├── rank/                 # 热榜/排序计算
│   └── job/                  # 定时任务
├── pkg/                      # 通用工具（响应、分页、错误码、xerr）
├── migrations/               # 数据库迁移脚本（golang-migrate）
├── configs/                  # config.yaml(.example)
├── deploy/                   # Dockerfile、docker-compose.yml
└── go.mod
```

---

## 5. 数据模型设计

### 5.1 模型概览与关系

```
categories 1 ──── n boards 1 ──── n tags            (板块级标签)
                boards 1 ──── n posts
boards 1 ──── n posts n ──── n tags   (post_tags 关联)
posts  1 ──── n post_fields        (课程评价/竞赛组队的结构化字段)
posts  1 ──── n replies (楼层/楼中楼)
posts  1 ──── n attachments        (图片)
users  1 ──── n posts / replies / likes / favorites / reports / notifications
dict_items (词典: 学院/课程/老师/竞赛) ── 被 post_fields 引用
```

关键设计点（详见第 7 章）：
- **邮箱唯一认证**：`users.email` 唯一索引 + `is_verified` 标记；武大邮箱验证码登录即认证（F-01/F-02）。
- **匿名**：`posts/replies.is_anonymous` 标记，作者 ID 仅后台可见（F-15）。
- **楼层**：`replies.floor_no` 用「原子自增 + RETURNING」分配，避免并发错号（F-19）。
- **帖子状态机**：`posts.status` 承载审核流转（F-32）。
- **结构化字段**：`post_fields` 存「课程名/老师/学院/竞赛名」，关联词典（F-13）。

### 5.2 表结构

#### 用户与认证

**users**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid PK | 用户 ID |
| nickname | varchar(32) | 昵称 |
| avatar_url | text | 头像 |
| email | varchar(128) | 武大邮箱，MVP 唯一登录标识（唯一） |
| phone | varchar(20) | 手机号（预留，唯一可空） |
| wechat_openid | varchar(64) | 微信 openid（预留，唯一可空） |
| password_hash | varchar(255) | 密码哈希（预留，可空） |
| is_verified | bool | 武大认证标记（邮箱验证通过即 true） |
| student_no | varchar(32) | 学号（可选资料，非认证手段，唯一可空） |
| college | varchar(64) | 学院（个人资料，可空） |
| grade | varchar(16) | 年级 |
| bio | varchar(200) | 签名 |
| role | smallint | 1 普通用户 / 2 版主 / 3 运营 |
| status | smallint | 0 正常 / 1 禁言 / 2 封禁 |
| created_at / updated_at | timestamptz | |

索引：`uniq(email)`、`uniq(phone)`、`uniq(wechat_openid)`、`uniq(student_no)`（后三者部分唯一、可空）。

#### 信息架构

**categories**（分类）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid PK | |
| name | varchar(32) | 分类名（校园生活/学习成长/…） |
| sort | int | 排序 |
| status | smallint | 0 启用 / 1 停用 |

**boards**（板块）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid PK | |
| category_id | uuid FK | 所属分类 |
| name | varchar(32) | 板块名 |
| slug | varchar(32) | 唯一标识（URL 用） |
| description | varchar(200) | 说明 |
| field_mode | smallint | 0 预置标签 / 1 结构化字段（课程评价/竞赛组队） |
| sort | int | 排序 |
| status | smallint | 0 启用 / 1 停用 |

**tags**（板块级标签）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid PK | |
| board_id | uuid FK | 所属板块 |
| name | varchar(32) | 标签名 |
| is_required | bool | 是否必选（强分类板块） |
| sort | int | 排序 |
| status | smallint | 0 启用 / 1 停用 |

**dict_items**（词典：学院/课程/老师/竞赛，归一化后的标准条目）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid PK | |
| dict_type | varchar(16) | `college` / `course` / `teacher` / `contest` |
| name | varchar(128) | 标准名 |
| status | smallint | 0 启用 / 1 停用 |
| created_at | timestamptz | |

索引：`uniq(dict_type, name)`。

#### 内容

**posts**（帖子）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid PK | |
| board_id | uuid FK | 所属板块 |
| author_id | uuid FK | 作者（匿名仍存真实 ID） |
| title | varchar(120) | 标题 |
| content | text | 正文 |
| status | smallint | 状态机，见 7.3：0 草稿 / 1 待审核 / 2 已发布 / 3 已驳回 / 4 已删除 |
| is_anonymous | bool | 是否匿名（F-15） |
| is_pinned | bool | 置顶 |
| is_featured | bool | 精华 |
| view_count | bigint | 浏览数（Redis 计数，异步落库） |
| reply_count | int | 回复数（楼层数） |
| like_count | int | 点赞数 |
| hot_score | numeric | 综合排序分（定时重算） |
| pinned_at / featured_at | timestamptz | |
| created_at / updated_at | timestamptz | |

索引：`idx(board_id, status, created_at)`、`idx(hot_score desc)`、`idx(board_id, is_pinned)`、`gin(title, content)`（pg_trgm，供搜索）。

**post_tags**（帖子-标签）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| post_id | uuid FK | |
| tag_id | uuid FK | |

主键 `(post_id, tag_id)`。

**post_fields**（结构化字段，课程评价/竞赛组队）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| post_id | uuid FK | |
| field_key | varchar(16) | `course` / `teacher` / `college` / `contest` |
| dict_item_id | uuid FK | 命中词典时的标准条目（可空） |
| raw_value | varchar(128) | 自由输入兜底原文（未归一） |

索引：`idx(post_id)`、`idx(dict_item_id)`。

**replies**（回复/楼层）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid PK | |
| post_id | uuid FK | 所属帖子 |
| author_id | uuid FK | 作者 |
| parent_id | uuid | 楼中楼：父回复 ID（顶层为空） |
| reply_to_id | uuid | 被回复的回复 ID（@ 对象） |
| floor_no | int | 楼层号（顶层才有；楼中楼沿用父楼层） |
| content | text | 内容 |
| is_anonymous | bool | 匿名 |
| status | smallint | 0 正常 / 1 删除 |
| like_count | int | |
| created_at | timestamptz | |

索引：`idx(post_id, floor_no)`。

**attachments**（图片）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid PK | |
| owner_type | varchar(16) | `post` / `reply` |
| owner_id | uuid | |
| object_key | text | MinIO 对象 key |
| sort | int | 排序 |

**drafts**（草稿，F-16，P2）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid PK | |
| user_id | uuid FK | |
| board_id | uuid | |
| title | varchar(120) | |
| content | text | |
| updated_at | timestamptz | |

#### 互动

**likes**（点赞，帖子/回复多态）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid PK | |
| user_id | uuid | |
| target_type | varchar(16) | `post` / `reply` |
| target_id | uuid | |
| created_at | timestamptz | |

唯一索引：`uniq(user_id, target_type, target_id)`（防重复点赞，天然幂等）。

**favorites**（收藏）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid PK | |
| user_id | uuid | |
| post_id | uuid | |
| created_at | timestamptz | |

唯一索引：`uniq(user_id, post_id)`。

**board_follows**（关注板块，F-29，P2）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| user_id | uuid | |
| board_id | uuid | |

主键 `(user_id, board_id)`。

#### 治理

**reports**（举报）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid PK | |
| reporter_id | uuid | |
| target_type | varchar(16) | `post` / `reply` |
| target_id | uuid | |
| reason | varchar(200) | 举报原因 |
| status | smallint | 0 待处理 / 1 已处理 / 2 驳回 |
| handled_by | uuid | |
| handled_at | timestamptz | |

**sensitive_words**（敏感词）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid PK | |
| word | varchar(64) | 敏感词 |
| category | varchar(16) | 分类（广告/色情/违法/辱骂） |
| status | smallint | 0 启用 / 1 停用 |

**bans**（禁言/封禁）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid PK | |
| user_id | uuid | |
| ban_type | varchar(16) | `mute` / `ban` |
| reason | varchar(200) | |
| started_at / ended_at | timestamptz | 处罚起止（ended_at 可空=永久） |
| status | smallint | 0 生效 / 1 解除 |

**notifications**（通知）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid PK | |
| user_id | uuid | 接收人 |
| type | varchar(16) | `reply` / `mention` / `like` / `system` |
| title | varchar(100) | |
| content | varchar(500) | |
| related_id | uuid | 关联帖子/回复 |
| is_read | bool | |
| created_at | timestamptz | |

索引：`idx(user_id, is_read, created_at)`。

**moderation_logs**（运营操作日志）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | uuid PK | |
| operator_id | uuid | 运营/版主 |
| action | varchar(32) | `approve` / `reject` / `pin` / `feature` / `delete` / `ban` |
| target_type | varchar(16) | |
| target_id | uuid | |
| reason | varchar(200) | |
| created_at | timestamptz | |

---

## 6. API 设计

### 6.1 通用约定

- **协议**：REST，JSON。
- **统一响应**：`{ "code": 0, "message": "ok", "data": {...} }`；`code=0` 成功，非 0 为业务错误码（见 `pkg/xerr`）。
- **分页**：MVP 用 `page` + `page_size`（列表接口）；高频信息流（帖子列表）预留 cursor 演进，MVP 不强制。
- **鉴权**：`Authorization: Bearer <access_token>`。匿名可读接口无需 token；发帖/回复/互动需登录；交易类板块互动需已认证。
- **匿名输出**：`is_anonymous=true` 的内容，响应中作者字段返回 `匿名`，**不返回 author_id**。

### 6.2 接口清单（按模块）

**认证与用户**

| 方法 | 路径 | 说明 | 对应 PRD |
| --- | --- | --- | --- |
| POST | `/api/v1/auth/email/send-code` | 发送邮箱验证码（校验武大邮箱域） | F-01 |
| POST | `/api/v1/auth/email/login` | 邮箱验证码登录 | F-01 |
| POST | `/api/v1/auth/refresh` | 刷新 token | — |
| GET | `/api/v1/users/me` | 我的资料 | F-03 |
| PUT | `/api/v1/users/me` | 更新资料（学号/学院/年级等可选） | F-03 |
| GET | `/api/v1/users/{id}` | 个人主页 | F-23 |

**信息架构**

| 方法 | 路径 | 说明 | 对应 PRD |
| --- | --- | --- | --- |
| GET | `/api/v1/categories` | 分类+板块树 | F-06 |
| GET | `/api/v1/boards/{id}` | 板块详情 | F-09 |
| GET | `/api/v1/boards/{id}/tags` | 板块标签 | F-11 |
| GET | `/api/v1/dict/search?type=&q=` | 词典搜索补全 | F-13 |

**内容**

| 方法 | 路径 | 说明 | 对应 PRD |
| --- | --- | --- | --- |
| GET | `/api/v1/home/feed` | 首页精选流 | F-05 |
| GET | `/api/v1/home/hot` | 热门讨论 | F-07 |
| GET | `/api/v1/boards/{id}/posts` | 帖子列表（排序/标签筛选） | F-09/F-10/F-11 |
| GET | `/api/v1/posts/{id}` | 帖子详情 | F-17 |
| POST | `/api/v1/posts` | 发帖 | F-13 |
| PUT | `/api/v1/posts/{id}` | 编辑（仅作者） | — |
| DELETE | `/api/v1/posts/{id}` | 删除（作者/运营） | — |
| GET | `/api/v1/posts/{id}/replies` | 回复列表（楼层） | F-18 |
| POST | `/api/v1/posts/{id}/replies` | 回复 | F-18 |
| POST | `/api/v1/posts/{id}/favorite` | 收藏/取消 | F-20 |
| POST | `/api/v1/posts/{id}/like` | 点赞/取消（帖子） | F-27 |
| POST | `/api/v1/replies/{id}/like` | 点赞/取消（回复） | F-27 |
| POST | `/api/v1/reports` | 举报 | F-28 |
| GET | `/api/v1/search?q=&board=&tag=` | 搜索 | F-21 |
| POST | `/api/v1/upload/presign` | 获取上传预签名 URL | F-14 |
| GET | `/api/v1/users/me/posts` | 我的帖子 | F-24 |
| GET | `/api/v1/users/me/favorites` | 我的收藏 | F-25 |
| GET | `/api/v1/users/me/replies` | 我的回复 | F-26 |

**通知**

| 方法 | 路径 | 说明 | 对应 PRD |
| --- | --- | --- | --- |
| GET | `/api/v1/notifications` | 通知列表 | F-30/F-31 |
| GET | `/api/v1/notifications/unread-count` | 未读数 | F-30 |
| POST | `/api/v1/notifications/read` | 标记已读 | — |

**运营后台（需 role≥2）**

| 方法 | 路径 | 说明 | 对应 PRD |
| --- | --- | --- | --- |
| GET/POST | `/api/v1/admin/posts` | 内容审核队列/处理 | F-32/F-37 |
| POST | `/api/v1/admin/posts/{id}/pin` `.../feature` | 置顶/加精 | F-37 |
| GET | `/api/v1/admin/users` | 用户查询 | F-39 |
| POST | `/api/v1/admin/users/{id}/ban` | 禁言/封禁 | F-34/F-39 |
| POST | `/api/v1/admin/boards` `.../tags` `.../dicts` | 板块/标签/词典维护 | F-38 |
| GET | `/api/v1/admin/stats` | 数据看板 | F-40 |

---

## 7. 核心模块设计

### 7.1 用户与认证

**登录（F-01）——邮箱验证码（MVP 唯一登录方式）**

1. 用户输入武大邮箱，后端校验域名是否为 `@whu.edu.cn`（非该域直接拒绝）。
2. 生成 6 位验证码（存 Redis，5 分钟过期），通过 SMTP 发信到该邮箱。
3. 用户回填验证码，校验通过后按邮箱找/建用户，签发 JWT。

- 邮箱唯一：`users.email` 唯一索引，一个邮箱一个账号。
- **预留扩展**：`phone` / `wechat_openid` / `password_hash` 字段保留，登录 Service 留扩展位；MVP 不暴露手机号密码、微信登录接口。

**认证（F-02）——邮箱即认证**

- 通过武大邮箱验证码登录即默认 `users.is_verified=true`（邮箱域本身即身份证明，无需证件照片）。
- 学号降级为可选个人资料（`users.student_no`），不再作为认证手段；`student_verifications` 表与照片审核链路 MVP 移除。

**JWT 策略**
- Access Token 短时效（2h）+ Refresh Token 长时效（14d）。
- Refresh Token 存 Redis（`refresh:{user_id}:{jti}`），支持主动失效与登出。

**匿名（F-15）**：`is_anonymous` 标记持久化在帖子/回复上；接口输出层统一脱敏（作者显示「匿名」、隐藏 author_id），运营后台仍可溯源。

**身份标识（F-04）**：接口返回 `is_verified`，前端据此展示「武大学生」徽标。

### 7.2 板块、标签与词典

- 分类/板块/标签为低频读、高频写配置，**全量缓存到 Redis**（见 8），写操作时失效。
- **预置标签板块**（field_mode=0）：发帖时校验所选 tag 属于该 board，`is_required=true` 的标签必选（F-13）。
- **结构化字段板块**（field_mode=1）：发帖时写入 `post_fields`，见 7.3。
- **词典搜索补全（F-13）**：`/dict/search` 按 `dict_type` 查询，MVP 用 `ILIKE 'q%'` 前缀匹配 + `pg_trgm` 相似度，返回 top N。

### 7.3 帖子

**发帖流程（F-13）**（事务内）：

1. 校验板块状态、用户状态（未禁言/封禁）。
2. 敏感词过滤（7.5）：命中高危词 → 拒绝；命中一般词 → 进入「待审核」。
3. 写入 `posts`（状态依过滤结果 = 待审核/已发布）。
4. 写入 `post_tags`（预置标签板块）或 `post_fields`（结构化字段板块，含词典命中或自由输入原文）。
5. 关联 `attachments`；触发通知/计数。
6. 缓存失效（板块列表、首页流）。

**帖子状态机（F-32）**

```
draft ──提交──▶ pending ──通过──▶ published ──删除──▶ deleted
                  │  │                    ▲
                  │  └──驳回──▶ rejected  │（重新编辑后重新提交）
                  └──────────────────────┘
published ──（运营）置顶/加精──▶ is_pinned / is_featured（布尔位，非状态）
```

- MVP 采用「先发后审」：未命中敏感词直接 `published`，命中则 `pending` 走人工队列。
- 列表/详情仅展示 `published`；作者可见自己的 `pending/rejected`。

**楼层体系（F-19）**：

- 顶层回复分配 `floor_no`：用 PostgreSQL 原子自增——
  `UPDATE posts SET reply_count = reply_count + 1 WHERE id = ? RETURNING reply_count`，返回值即楼层号，避免并发错号。
- 楼中楼：`parent_id` 指向某条回复，`floor_no` 沿用父楼层，展示时挂在父楼层下。
- `@提及`：解析回复内容中的 `@用户`，生成 `mention` 类型通知。

**排序策略（F-10 / 第 6 章）**：

- `hot_score = (reply_count×3 + like_count×2 + view_count×0.1) / (1 + age_hours)^1.5`
- 由定时任务（`internal/job`）周期性重算 `posts.hot_score`，并维护 Redis ZSET `rank:board:{board_id}` 供「最热」快速取数。
- 列表默认「综合」= `hot_score` 降序；「最新」= `created_at` 降序；「精华」= `is_featured` 过滤。

**浏览计数**：`view_count` 用 Redis `INCR` 计数，定时批量落库，避免高频写库。

### 7.4 互动

- **点赞（F-27）**：`likes` 唯一索引保证幂等；点赞数用 Redis 维护（`INCR/DECR`），异步落库到 `posts.like_count / replies.like_count`。
- **收藏（F-20）**：`favorites` 唯一索引幂等，插入即收藏、删除即取消。
- **举报（F-28）**：写入 `reports(status=待处理)`，进入运营举报队列（F-33）。

### 7.5 内容治理

- **敏感词过滤（F-35）**：`sensitive_words` 加载进内存，构建 **Aho-Corasick 自动机**，对标题+正文做多模式匹配；命中结果分级（高危/一般）决定拦截或送审。
- **审核队列（F-32/F-33）**：运营后台拉取 `posts(status=pending)` 与 `reports(status=待处理)`，操作均写 `moderation_logs`。
- **禁言/封禁（F-34）**：写入 `bans`；鉴权中间件或发帖 Service 校验 `bans` 是否生效，命中则拒绝写操作。

### 7.6 搜索（F-21）

- MVP 用 `pg_trgm` GIN 索引 + `ILIKE '%kw%'` 对 `title`/`content` 做子串模糊匹配，支持按板块/标签/时间过滤。
- 中文分词不是 PG 原生强项，故 MVP 只做子串匹配；当数据量与搜索体验要求提升时，引入 Meilisearch/OpenSearch（后续演进）。

### 7.7 文件上传（F-14，MinIO）

- 前端先调 `/upload/presign` 换取 **预签名 PUT URL**，直接上传到 MinIO，不经过后端中转（减轻后端压力、支持大图）。
- 上传完成后前端回传 object key，随发帖一并提交，写入 `attachments`。
- 详见第 9 章。

---

## 8. 缓存设计（Redis）

### 8.1 缓存对象

| Key 模式 | 内容 | TTL / 失效 |
| --- | --- | --- |
| `cat:tree` | 分类+板块树 | 写配置时 DEL |
| `tags:board:{id}` | 板块标签 | 写标签时 DEL |
| `post:{id}` | 帖子详情 | 短 TTL（60s），更新时 DEL |
| `board:posts:{id}:{sort}` | 板块帖子列表分页 | 短 TTL（30–60s） |
| `home:feed` | 首页精选流 | 短 TTL（60s） |
| `rank:board:{id}` | 板块热榜 ZSET | 定时任务重建 |
| `rank:hot` | 全站热门 ZSET | 定时任务重建 |
| `dict:{type}:*` | 词典搜索前缀缓存 | 短 TTL |
| `email:code:{email}` | 邮箱验证码 | 5 分钟 |
| `rate:{key}` | 限流计数 | 窗口 TTL |
| `refresh:{uid}:{jti}` | Refresh Token | 14d |

### 8.2 计数缓存

`view_count`、`like_count` 等高频计数先落 Redis（`INCR/DECR`），由定时任务（如每 5 分钟）批量回写 PostgreSQL，兼顾性能与最终一致。

### 8.3 一致性策略

- 读多写少的配置类数据：**Cache-Aside**（读未命中回源并写缓存，写操作删除缓存）。
- 计数类：**Redis 为准 + 异步落库**，容忍短时不一致（社区场景可接受）。
- 缓存雪崩/穿透：TTL 加随机抖动；空结果短时缓存防穿透。

---

## 9. 对象存储设计（MinIO）

### 9.1 Bucket 规划

| Bucket | 用途 | 访问策略 |
| --- | --- | --- |
| `public-images` | 帖子/回复图片 | 公开读（CDN/直链） |
| `public-avatars` | 用户头像 | 公开读 |

### 9.2 上传流程（预签名）

```
前端 ──POST /upload/presign──▶ 后端（校验登录/权限）
      ◀── 返回 { upload_url, object_key } ──
前端 ──PUT upload_url──▶ MinIO（直传，后端不中转）
前端 ──提交发帖(带 object_key)──▶ 后端（写 attachments）
```

### 9.3 隐私与安全

- **object_key 规范**：`{bucket}/{user_id}/{uuid}.{ext}`，避免路径冲突与越权猜测。
- 文件大小/类型限制：图片 ≤ 10MB，校验 content-type 与扩展名，防恶意上传。

---

## 10. 安全设计

| 项 | 措施 |
| --- | --- |
| 鉴权 | JWT 校验中间件；role 校验用于后台接口 |
| 越权防护 | 资源属主校验（改/删仅作者或运营） |
| 限流 | Redis 限流中间件，重点限发帖/登录/上传/认证 |
| 敏感信息 | 密钥走环境变量；验证码与 Token 短时效 |
| 注入 | 参数化查询（GORM）+ 请求校验（validator） |
| XSS | 内容输出转义；富文本白名单（MVP 仅存纯文本/图片） |
| 匿名溯源 | 匿名仅前端脱敏，后端保留 author_id 供治理 |
| 日志 | 全链路 request_id + 操作审计（moderation_logs） |

---

## 11. 部署与运维

- **构建**：多阶段 Dockerfile 编译出单二进制（`scratch`/`alpine` 基础镜像）。
- **本地开发**：`docker-compose.yml` 一键起 PostgreSQL + Redis + MinIO（+ MailHog 本地 mock 邮件），后端本地 `go run`。
- **配置**：`configs/config.yaml` + 环境变量覆盖（DB/Redis/MinIO/JWT/SMTP 密钥不进仓库，用 `.example`）。
- **迁移**：golang-migrate 管理 `migrations/`，上线自动执行（MVP 也可先用 GORM AutoMigrate 起步，但生产建议显式迁移）。
- **可观测**：zap 结构化日志 + `/healthz` 健康检查 + `/metrics`（Prometheus，可选）。
- **灰度与回滚**：单体二进制便于快速部署回滚。

---

## 12. 后续演进（非 MVP）

| 方向 | 说明 |
| --- | --- |
| 搜索引擎 | 中文分词引入 Meilisearch/OpenSearch，替换 pg_trgm 子串匹配 |
| 推送 | 微信订阅消息 / WebSocket/SSE 实时通知，替换轮询 |
| 图片处理 | 缩略图、压缩、水印（MinIO 事件 + 异步任务） |
| 拆分 | 模块化单体按领域拆服务（用户/内容/治理），引入消息队列 |
| 认证升级 | 接入武汉大学统一认证平台（在邮箱认证之上进一步核验） |

---

*本方案为后端 MVP 设计，聚焦数据模型、核心链路与三大基础设施（PG/Redis/MinIO）的落地方式。*
