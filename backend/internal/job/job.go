// Package job 定时任务：热榜重算、图书馆自动预约计划执行等。
package job

import (
	"context"

	"github.com/robfig/cron/v3"
	"go.uber.org/zap"

	"github.com/whu-campus/luojia-bbs/internal/cache"
	"github.com/whu-campus/luojia-bbs/internal/rank"
	"github.com/whu-campus/luojia-bbs/internal/repository"
	"github.com/whu-campus/luojia-bbs/internal/service"
)

// Runner 定时任务运行器。
type Runner struct {
	content *repository.ContentRepo
	cache   *cache.Client
	plan    *service.CampusPlanService
	log     *zap.Logger
}

// New 构造。
func New(content *repository.ContentRepo, c *cache.Client, plan *service.CampusPlanService, log *zap.Logger) *Runner {
	return &Runner{content: content, cache: c, plan: plan, log: log}
}

// Start 启动定时任务，返回 cron 实例（可 Stop）。
func (r *Runner) Start() *cron.Cron {
	c := cron.New()
	_, _ = c.AddFunc("@every 5m", r.recomputeHotScores)
	_, _ = c.AddFunc("@every 1m", r.runDueBookings)
	c.Start()
	r.log.Info("cron jobs started")
	return c
}

// recomputeHotScores 重算全部已发布帖子的热度分并刷新板块热榜 ZSET。
func (r *Runner) recomputeHotScores() {
	ctx := context.Background()
	posts, err := r.content.ListForRank()
	if err != nil {
		r.log.Error("recompute hot score: list posts failed", zap.Error(err))
		return
	}
	for _, p := range posts {
		score := rank.HotScore(p.ReplyCount, p.LikeCount, p.ViewCount, p.CreatedAt)
		if err := r.content.UpdateHotScore(p.ID, score); err != nil {
			r.log.Error("recompute hot score: update failed", zap.String("post_id", p.ID), zap.Error(err))
			continue
		}
		if err := r.cache.ZAdd(ctx, "rank:board:"+p.BoardID, score, p.ID); err != nil {
			r.log.Warn("recompute hot score: zadd failed", zap.String("post_id", p.ID), zap.Error(err))
		}
	}
	r.log.Info("hot score recomputed", zap.Int("count", len(posts)))
}

// runDueBookings 执行到期的图书馆自动预约计划（内部逐条推送结果通知）。
func (r *Runner) runDueBookings() {
	ctx := context.Background()
	if err := r.plan.RunDueBookings(ctx); err != nil {
		r.log.Error("run due bookings failed", zap.Error(err))
	}
}
