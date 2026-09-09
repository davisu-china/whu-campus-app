package repository

import "strings"

// likeEscaper 转义 LIKE/ILIKE 通配符，使用户输入中的 \ % _ 按字面匹配。
// 不转义的话，一个 "%" 就能命中整张表（虽仍受 status/board 等条件约束，但语义不对）。
// PostgreSQL 的 LIKE 默认转义符就是反斜杠，无需额外 ESCAPE 子句。
var likeEscaper = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)

// containsLike 构造 "%kw%" 模式（关键词已转义）。
func containsLike(kw string) string { return "%" + likeEscaper.Replace(kw) + "%" }

// prefixLike 构造 "kw%" 模式（关键词已转义）。
func prefixLike(kw string) string { return likeEscaper.Replace(kw) + "%" }
