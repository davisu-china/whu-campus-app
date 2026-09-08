package model

import "time"

// Report 举报。
type Report struct {
	Base
	ReporterID string     `gorm:"type:uuid;index" json:"reporter_id"`
	TargetType string     `gorm:"size:16" json:"target_type"` // post / reply
	TargetID   string     `gorm:"type:uuid;index" json:"target_id"`
	Reason     string     `gorm:"size:200" json:"reason"`
	Status     int        `gorm:"type:smallint;default:0" json:"status"`
	HandledBy  string     `gorm:"type:uuid" json:"handled_by"`
	HandledAt  *time.Time `json:"handled_at,omitempty"`
}

// SensitiveWord 敏感词。
type SensitiveWord struct {
	Base
	Word     string `gorm:"size:64;uniqueIndex" json:"word"`
	Category string `gorm:"size:16" json:"category"` // 广告/色情/违法/辱骂
	Level    int    `gorm:"type:smallint;default:0" json:"level"`
	Status   int    `gorm:"type:smallint;default:0" json:"status"`
}

// Ban 禁言/封禁处罚。
type Ban struct {
	Base
	UserID    string     `gorm:"type:uuid;index" json:"user_id"`
	BanType   string     `gorm:"size:16" json:"ban_type"` // mute / ban
	Reason    string     `gorm:"size:200" json:"reason"`
	StartedAt time.Time  `json:"started_at"`
	EndedAt   *time.Time `json:"ended_at,omitempty"` // 空=永久
	Status    int        `gorm:"type:smallint;default:0" json:"status"`
}

// Notification 通知。
type Notification struct {
	Base
	UserID    string    `gorm:"type:uuid;index:idx_user_read_created" json:"user_id"`
	Type      string    `gorm:"size:16" json:"type"` // reply/mention/like/system
	Title     string    `gorm:"size:100" json:"title"`
	Content   string    `gorm:"size:500" json:"content"`
	RelatedID string    `gorm:"type:uuid" json:"related_id"`
	IsRead    bool      `gorm:"default:false;index:idx_user_read_created" json:"is_read"`
	CreatedAt time.Time `gorm:"index:idx_user_read_created,sort:desc" json:"created_at"`
	UpdatedAt time.Time `json:"-"`
}

// ModerationLog 运营操作日志。
type ModerationLog struct {
	Base
	OperatorID string `gorm:"type:uuid" json:"operator_id"`
	Action     string `gorm:"size:32" json:"action"`
	TargetType string `gorm:"size:16" json:"target_type"`
	TargetID   string `gorm:"type:uuid" json:"target_id"`
	Reason     string `gorm:"size:200" json:"reason"`
}
