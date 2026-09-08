package database

import "gorm.io/gorm"

// EnsureSearchIndexes 启用 pg_trgm 扩展并创建中文子串搜索索引（幂等）。
// AutoMigrate 不负责此类 GIN 表达式索引，故在此显式创建；失败不阻断启动。
func EnsureSearchIndexes(db *gorm.DB) error {
	if err := db.Exec("CREATE EXTENSION IF NOT EXISTS pg_trgm").Error; err != nil {
		return err
	}
	if err := db.Exec(
		"CREATE INDEX IF NOT EXISTS idx_posts_title_trgm ON posts USING gin (title gin_trgm_ops)",
	).Error; err != nil {
		return err
	}
	return db.Exec(
		"CREATE INDEX IF NOT EXISTS idx_posts_content_trgm ON posts USING gin (content gin_trgm_ops)",
	).Error
}
