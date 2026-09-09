// Package rank 提供热度排序分计算。
package rank

import (
	"math"
	"time"
)

// HotScore 计算综合热度分（热门话题排序）：
//
//	hot_score = (reply×3 + like×2 + favorite×2) / (1 + age_hours)^1.5
//
// 兼顾互动量（评论/点赞/收藏）与时间衰减，越新的互动权重越高。
func HotScore(replyCount, likeCount, favoriteCount int, createdAt time.Time) float64 {
	interaction := float64(replyCount)*3 + float64(likeCount)*2 + float64(favoriteCount)*2
	ageHours := time.Since(createdAt).Hours()
	if ageHours < 0 {
		ageHours = 0
	}
	return interaction / math.Pow(1+ageHours, 1.5)
}
