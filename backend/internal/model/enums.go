package model

// 用户角色
const (
	RoleNormal    = 1 // 普通用户
	RoleModerator = 2 // 版主
	RoleOperator  = 3 // 运营
)

// 用户状态
const (
	UserStatusNormal = 0 // 正常
	UserStatusMuted  = 1 // 禁言
	UserStatusBanned = 2 // 封禁
)

// 板块字段模式
const (
	FieldModeTags       = 0 // 预置标签
	FieldModeStructured = 1 // 结构化字段（课程评价/竞赛组队）
)

// 通用启停状态
const (
	StatusEnabled  = 0
	StatusDisabled = 1
)

// 帖子状态机
const (
	PostStatusDraft     = 0 // 草稿
	PostStatusPending   = 1 // 待审核
	PostStatusPublished = 2 // 已发布
	PostStatusRejected  = 3 // 已驳回
	PostStatusDeleted   = 4 // 已删除
)

// 回复状态
const (
	ReplyStatusNormal  = 0
	ReplyStatusDeleted = 1
)

// 举报状态
const (
	ReportStatusPending   = 0 // 待处理
	ReportStatusHandled   = 1 // 已处理
	ReportStatusDismissed = 2 // 驳回
)

// 通知类型
const (
	NotifyTypeReply   = "reply"
	NotifyTypeMention = "mention"
	NotifyTypeLike    = "like"
	NotifyTypeSystem  = "system"
)

// 词典类型
const (
	DictTypeCollege = "college"
	DictTypeCourse  = "course"
	DictTypeTeacher = "teacher"
	DictTypeContest = "contest"
)

// 处罚类型
const (
	BanTypeMute = "mute" // 禁言
	BanTypeBan  = "ban"  // 封禁
)

// 附件归属类型
const (
	OwnerTypePost  = "post"
	OwnerTypeReply = "reply"
)

// 点赞/举报目标类型
const (
	TargetTypePost  = "post"
	TargetTypeReply = "reply"
)

// 运营操作类型
const (
	ActionApprove = "approve"
	ActionReject  = "reject"
	ActionPin     = "pin"
	ActionFeature = "feature"
	ActionDelete  = "delete"
	ActionBan     = "ban"
)

// 敏感词等级：命中后的处理策略
const (
	SensitiveLevelNormal = 0 // 一般：送审
	SensitiveLevelHigh   = 1 // 高危：直接拒绝
)
