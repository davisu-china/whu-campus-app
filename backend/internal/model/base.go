package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Base 提供 UUID 主键与时间戳，供多数实体嵌入。
type Base struct {
	ID        string    `gorm:"type:uuid;primaryKey" json:"id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// BeforeCreate 生成 UUID 主键（若未显式指定）。
func (b *Base) BeforeCreate(_ *gorm.DB) error {
	if b.ID == "" {
		b.ID = uuid.NewString()
	}
	return nil
}
