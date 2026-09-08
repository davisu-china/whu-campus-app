// Package database 负责 PostgreSQL 连接与模型迁移。
package database

import (
	"fmt"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/whu-campus/luojia-bbs/internal/config"
	"github.com/whu-campus/luojia-bbs/internal/model"
)

// Connect 建立 PostgreSQL 连接并配置连接池。
func Connect(cfg config.DatabaseConfig) (*gorm.DB, error) {
	dsn := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.DBName, cfg.SSLMode,
	)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		return nil, fmt.Errorf("open postgres: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("get sql.DB: %w", err)
	}
	sqlDB.SetMaxOpenConns(cfg.MaxOpenConns)
	sqlDB.SetMaxIdleConns(cfg.MaxIdleConns)
	if d, err := time.ParseDuration(cfg.ConnMaxLifetime); err == nil {
		sqlDB.SetConnMaxLifetime(d)
	}

	return db, nil
}

// Migrate 自动迁移全部模型。MVP 起步用 AutoMigrate，生产建议改用 migrations/ 显式迁移。
func Migrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&model.User{},
		&model.Category{},
		&model.Board{},
		&model.Tag{},
		&model.DictItem{},
		&model.Post{},
		&model.PostTag{},
		&model.PostField{},
		&model.Reply{},
		&model.Attachment{},
		&model.Draft{},
		&model.Like{},
		&model.Favorite{},
		&model.BoardFollow{},
		&model.Report{},
		&model.SensitiveWord{},
		&model.Ban{},
		&model.Notification{},
		&model.ModerationLog{},
		&model.Conversation{},
		&model.Message{},
		&model.BookingPlan{},
	)
}
