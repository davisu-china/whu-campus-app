package model

import "time"

// Conversation 私信会话（1 对 1）。
// UserA/UserB 按字典序规范化存储（较小的 ID 放 UserA），配合唯一索引保证同一对用户只有一个会话。
type Conversation struct {
	Base
	UserA         string    `gorm:"type:uuid;uniqueIndex:uniq_conv_pair" json:"user_a"`
	UserB         string    `gorm:"type:uuid;uniqueIndex:uniq_conv_pair" json:"user_b"`
	LastMessage   string    `gorm:"size:500" json:"last_message"` // 冗余最后一条消息，列表预览用
	LastMessageAt time.Time `gorm:"index" json:"last_message_at"`
}

// Message 私信消息。RecipientID 冗余接收方，便于按用户统计未读、清已读，避免 join。
type Message struct {
	Base
	ConversationID string    `gorm:"type:uuid;index:idx_conv_created" json:"conversation_id"`
	SenderID       string    `gorm:"type:uuid;index" json:"sender_id"`
	RecipientID    string    `gorm:"type:uuid;index" json:"recipient_id"`
	Content        string    `gorm:"size:2000" json:"content"`
	IsRead         bool      `gorm:"default:false" json:"is_read"`
	CreatedAt      time.Time `gorm:"index:idx_conv_created,sort:desc" json:"created_at"`
	UpdatedAt      time.Time `json:"-"`
}
