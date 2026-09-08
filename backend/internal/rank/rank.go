// Package rank 提供热度排序分计算。
package rank

import (
	"math"
	"time"
)

// HotScore 计算综合排序分（PRD 第 6 章热度公式）：
//
//	hot_score = (reply×3 + like×2 + view×0.1) / (1 + age_hours)^1.5
func HotScore(replyCount int, likeCount int, viewCount int64, createdAt time.Time) float64 {
	interaction := float64(replyCount)*3 + float64(likeCount)*2 + float64(viewCount)*0.1
	ageHours := time.Since(createdAt).Hours()
	if ageHours < 0 {
		ageHours = 0
	}
	return interaction / math.Pow(1+ageHours, 1.5)
}
