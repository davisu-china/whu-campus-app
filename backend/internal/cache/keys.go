// Package cache 的键名与 TTL 常量。
package cache

import (
	"fmt"
	"time"
)

// TTL 常量。
const (
	UserTTL        = 10 * time.Minute // 用户对象缓存
	InfoTTL        = 10 * time.Minute // 信息架构（分类/板块/标签/词典）缓存
	ContentListTTL = 15 * time.Second // 内容列表缓存（第一页）
	HotTagsTTL     = 2 * time.Minute  // 板块热门标签统计缓存
)

// 键构造。
func UserKey(id string) string { return "user:" + id }

func CategoryTreeKey() string { return "info:category_tree" }

func BoardKey(id string) string { return "info:board:" + id }

func BoardTagsKey(boardID string) string { return "info:board_tags:" + boardID }

func HotTagsKey(boardID string, limit int) string {
	return fmt.Sprintf("info:hot_tags:%s:%d", boardID, limit)
}

func DictSearchKey(dictType, q string, limit int) string {
	return fmt.Sprintf("info:dict:%s:%s:%d", dictType, q, limit)
}

func HomeFeedKey(page, pageSize int) string {
	return fmt.Sprintf("content:home_feed:%d:%d", page, pageSize)
}

func HomeHotKey(limit int) string { return fmt.Sprintf("content:home_hot:%d", limit) }

func BoardPostsKey(boardID, sort, tagID string, page, pageSize int) string {
	return fmt.Sprintf("content:board:%s:%s:%s:%d:%d", boardID, sort, tagID, page, pageSize)
}

func ViewPendingKey() string { return "view:pending" }

// HotSearchKey 搜索热词榜（ZSET：member=关键词，score=搜索次数）。
func HotSearchKey() string { return "content:search_hot" }
