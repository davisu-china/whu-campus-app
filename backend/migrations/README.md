# 数据库迁移

MVP 采用 **GORM AutoMigrate**（`internal/database.Migrate`）自动建表，便于快速起步。

- 表结构以 `internal/model` 的 GORM 模型为唯一事实来源。
- 搜索所需的 `pg_trgm` 扩展与 GIN 表达式索引无法由 AutoMigrate 表达，由
  `internal/database.EnsureSearchIndexes` 在启动时幂等创建（见 `0001_search.up.sql`）。

**生产演进**：当表结构开始出现破坏性变更时，应切换到显式迁移（golang-migrate），
把 `migrations/*.up.sql` 作为正式迁移脚本，移除 AutoMigrate 调用。
