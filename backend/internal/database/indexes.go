package database

import (
	"gorm.io/gorm"
)

// perfIndexes 性能索引的权威定义（幂等，启动时执行）。
//
// 不放在 model tag / AutoMigrate 里的原因：
//   - 部分索引（WHERE）、GIN trgm、复合 DESC 排序等 GORM tag 表达不了；
//   - AutoMigrate 只建不删，索引结构调整后旧索引会残留，必须显式清理。
//
// 全部用 CONCURRENTLY 建：GORM 的 Exec 是单语句自动提交、不在事务块内，满足
// CONCURRENTLY 的要求，且构建期间不阻塞写入（大表上启动也不会锁表）。
var perfIndexes = []struct {
	name string
	ddl  string
}{
	// ---- post_tags：按标签反查帖子 ----
	// 触发：按标签筛帖子的 EXISTS 子查询、热门标签统计的 JOIN。
	// 主键是 (post_id, tag_id)，tag_id 非前缀，反查只能全表扫。
	{"idx_post_tags_tag",
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_tags_tag ON post_tags (tag_id, post_id)"},

	// ---- favorites：按帖子统计收藏数 ----
	// 触发：热榜重算 ListForRank 的关联子查询 count(*) WHERE post_id = posts.id。
	// uniq_fav 是 (user_id, post_id)，post_id 非前缀。
	{"idx_favorites_post",
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_favorites_post ON favorites (post_id)"},

	// ---- posts ----
	// 列表排序都是「置顶优先 + 某维度」，is_pinned 必须紧跟等值列（board_id/status）
	// 之后、且方向为 DESC（与 ORDER BY is_pinned DESC 一致），索引才能同时提供过滤
	// 与完整排序——若 is_pinned 用默认 ASC，正反扫都对不上，等于白建。
	{"idx_posts_board_pinned_hot",
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_board_pinned_hot ON posts (board_id, status, is_pinned DESC, hot_score DESC)"},
	{"idx_posts_board_pinned_created",
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_board_pinned_created ON posts (board_id, status, is_pinned DESC, created_at DESC)"},
	// 全站最新流（HomeFeed）+ 运营后台按状态列表。后台只按 status 过滤，
	// 命中行数很少，is_pinned 那点排序代价可忽略。
	{"idx_posts_status_pinned_created",
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_status_pinned_created ON posts (status, is_pinned DESC, created_at DESC)"},
	// 全站热榜 ListHot：只查已发布，用部分索引比全表索引小得多。
	{"idx_posts_hot_partial",
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_hot_partial ON posts (hot_score DESC, reply_count DESC) WHERE status = 2"},
	// 首页精选流 ListFeatured。
	{"idx_posts_featured_hot",
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_featured_hot ON posts (hot_score DESC) WHERE status = 2 AND is_featured"},
	// 个人中心「我的帖子」。
	{"idx_posts_author_created",
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_author_created ON posts (author_id, created_at DESC)"},

	// ---- replies ----
	// 个人中心「我的回复」。
	{"idx_replies_author_created",
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_replies_author_created ON replies (author_id, created_at DESC)"},

	// ---- conversations ----
	// 私信列表是 user_a = ? OR user_b = ?，两个分支各自需要一条索引。
	{"idx_conv_user_a",
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conv_user_a ON conversations (user_a, last_message_at DESC)"},
	{"idx_conv_user_b",
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conv_user_b ON conversations (user_b, last_message_at DESC)"},

	// ---- messages ----
	// 未读数统计（CountUnread 总量 + UnreadByConv 分会话）。
	{"idx_messages_recipient_unread",
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_recipient_unread ON messages (recipient_id, is_read, conversation_id)"},

	// ---- notifications ----
	// 列表按时间倒序；未读计数单独走小体积部分索引。
	{"idx_notifications_user_created",
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_created ON notifications (user_id, created_at DESC)"},
	{"idx_notifications_unread",
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_unread ON notifications (user_id) WHERE is_read = false"},

	// ---- 运营后台 / 校园服务 ----
	{"idx_reports_status_created",
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reports_status_created ON reports (status, created_at)"},
	{"idx_booking_plans_due",
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_booking_plans_due ON booking_plans (status, book_at)"},
	{"idx_attachments_owner",
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attachments_owner ON attachments (owner_type, owner_id, sort)"},

	// ---- 子串模糊搜索（pg_trgm）----
	{"idx_posts_title_trgm",
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_title_trgm ON posts USING gin (title gin_trgm_ops)"},
	{"idx_posts_content_trgm",
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_content_trgm ON posts USING gin (content gin_trgm_ops)"},
	{"idx_dict_items_name_trgm",
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dict_items_name_trgm ON dict_items USING gin (name gin_trgm_ops)"},
	// 运营后台用户搜索：nickname/email/student_no 三列 OR 模糊匹配，缺一条就退化成全表扫。
	{"idx_users_nickname_trgm",
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_nickname_trgm ON users USING gin (nickname gin_trgm_ops)"},
	{"idx_users_email_trgm",
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_trgm ON users USING gin (email gin_trgm_ops)"},
	{"idx_users_student_no_trgm",
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_student_no_trgm ON users USING gin (student_no gin_trgm_ops)"},
}

// legacyIndexes 已被 perfIndexes 取代的旧索引，启动时清理。
// 对应 model 里已删除的 index tag——AutoMigrate 只建不删，不显式 DROP 就会残留成写放大。
var legacyIndexes = []string{
	"idx_posts_author_id",
	"idx_posts_hot_score",
	"idx_board_status_created",
	"idx_conversations_last_message_at",
	"idx_user_read_created",
	"idx_messages_recipient_id",
	"idx_booking_plans_book_at",
	"idx_replies_author_id",
	"idx_attachments_owner_id",
	"idx_tags_board_id",
	"idx_posts_status_created", // 已被 idx_posts_status_pinned_created 取代
}

// EnsureIndexes 启用 pg_trgm 并幂等地建立全部性能索引。失败不阻断启动，由调用方记警告。
func EnsureIndexes(db *gorm.DB) error {
	if err := db.Exec("CREATE EXTENSION IF NOT EXISTS pg_trgm").Error; err != nil {
		return err
	}
	for _, name := range legacyIndexes {
		if err := db.Exec("DROP INDEX CONCURRENTLY IF EXISTS " + name).Error; err != nil {
			return err
		}
	}
	if err := createPerfIndexes(db); err != nil {
		return err
	}

	// CONCURRENTLY 构建失败会留下 INVALID 索引：查询用不到它，但 IF NOT EXISTS
	// 会因同名而跳过重建。删掉后重建一次，避免永久停留在无效状态。
	invalid, err := invalidIndexes(db)
	if err != nil || len(invalid) == 0 {
		return err
	}
	for _, name := range invalid {
		if err := db.Exec("DROP INDEX CONCURRENTLY IF EXISTS " + name).Error; err != nil {
			return err
		}
	}
	return createPerfIndexes(db)
}

func createPerfIndexes(db *gorm.DB) error {
	for _, idx := range perfIndexes {
		if err := db.Exec(idx.ddl).Error; err != nil {
			return err
		}
	}
	return nil
}

// invalidIndexes 返回 perfIndexes 中当前处于 INVALID 状态的索引名。
func invalidIndexes(db *gorm.DB) ([]string, error) {
	names := make([]string, 0, len(perfIndexes))
	for _, idx := range perfIndexes {
		names = append(names, idx.name)
	}
	var invalid []string
	err := db.Raw(
		`SELECT c.relname FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
		 WHERE NOT i.indisvalid AND c.relname = ANY(?)`, names,
	).Scan(&invalid).Error
	return invalid, err
}
