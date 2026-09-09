-- 性能索引：补齐缺失索引 + 用复合/部分索引取代低效的单列索引。
-- 说明：与 internal/database/indexes.go 的 perfIndexes/legacyIndexes 保持一致，
--       该文件是启动时幂等执行的对应物，两者改一处必须同步另一处。
--
-- 注意：CREATE/DROP INDEX CONCURRENTLY 不能在事务块内执行，本文件不能包在 BEGIN/COMMIT 里，
--       用 `psql -f` 或逐条执行。CONCURRENTLY 构建期间不阻塞写入，适合已有数据的生产库。

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---- 清理被取代的旧索引（AutoMigrate 只建不删，不显式 DROP 会残留成写放大）----
DROP INDEX CONCURRENTLY IF EXISTS idx_posts_author_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_posts_hot_score;
DROP INDEX CONCURRENTLY IF EXISTS idx_board_status_created;
DROP INDEX CONCURRENTLY IF EXISTS idx_conversations_last_message_at;
DROP INDEX CONCURRENTLY IF EXISTS idx_user_read_created;
DROP INDEX CONCURRENTLY IF EXISTS idx_messages_recipient_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_booking_plans_book_at;
DROP INDEX CONCURRENTLY IF EXISTS idx_replies_author_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_attachments_owner_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_tags_board_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_posts_status_created;

-- ---- post_tags：按标签反查帖子（主键是 (post_id, tag_id)，tag_id 非前缀）----
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_tags_tag
    ON post_tags (tag_id, post_id);

-- ---- favorites：按帖子统计收藏数（热榜重算的关联子查询）----
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_favorites_post
    ON favorites (post_id);

-- ---- posts ----
-- 列表排序都是「置顶优先 + 某维度」。is_pinned 必须紧跟等值列之后且方向为 DESC
-- （与 ORDER BY is_pinned DESC 一致），否则正反扫都对不上，索引等于白建。
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_board_pinned_hot
    ON posts (board_id, status, is_pinned DESC, hot_score DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_board_pinned_created
    ON posts (board_id, status, is_pinned DESC, created_at DESC);
-- 全站最新流 + 运营后台按状态列表
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_status_pinned_created
    ON posts (status, is_pinned DESC, created_at DESC);
-- 全站热榜（仅已发布）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_hot_partial
    ON posts (hot_score DESC, reply_count DESC) WHERE status = 2;
-- 首页精选流
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_featured_hot
    ON posts (hot_score DESC) WHERE status = 2 AND is_featured;
-- 个人中心「我的帖子」
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_author_created
    ON posts (author_id, created_at DESC);

-- ---- replies ----
-- 个人中心「我的回复」
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_replies_author_created
    ON replies (author_id, created_at DESC);

-- ---- conversations：列表是 user_a = ? OR user_b = ?，两个分支各需一条索引 ----
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conv_user_a
    ON conversations (user_a, last_message_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conv_user_b
    ON conversations (user_b, last_message_at DESC);

-- ---- messages：未读数统计（总量 + 分会话）----
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_recipient_unread
    ON messages (recipient_id, is_read, conversation_id);

-- ---- notifications ----
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_created
    ON notifications (user_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_unread
    ON notifications (user_id) WHERE is_read = false;

-- ---- 运营后台 / 校园服务 ----
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reports_status_created
    ON reports (status, created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_booking_plans_due
    ON booking_plans (status, book_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attachments_owner
    ON attachments (owner_type, owner_id, sort);

-- ---- 子串模糊搜索（pg_trgm）----
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_title_trgm
    ON posts USING gin (title gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_content_trgm
    ON posts USING gin (content gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dict_items_name_trgm
    ON dict_items USING gin (name gin_trgm_ops);
-- 运营后台用户搜索：三列 OR 模糊匹配，缺一条就退化成全表扫。
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_nickname_trgm
    ON users USING gin (nickname gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_trgm
    ON users USING gin (email gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_student_no_trgm
    ON users USING gin (student_no gin_trgm_ops);
