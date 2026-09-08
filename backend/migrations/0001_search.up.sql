-- 搜索索引（pg_trgm 中文子串模糊匹配）
-- 说明：MVP 用 GORM AutoMigrate 建表，此脚本为生产显式迁移（golang-migrate）的对应物。
-- 本地开发由 internal/database.EnsureSearchIndexes 幂等执行。

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_posts_title_trgm
    ON posts USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_posts_content_trgm
    ON posts USING gin (content gin_trgm_ops);
