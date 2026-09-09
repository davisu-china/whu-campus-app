// Package job 定时任务：热榜重算、图书馆自动预约计划执行等。
package job

import (
	"context"
	"strconv"

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
	_, _ = c.AddFunc("@every 1m", r.flushViewCounts)
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
		score := rank.HotScore(p.ReplyCount, p.LikeCount, p.FavoriteCount, p.CreatedAt)
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

// flushViewCounts 将 Redis 中的浏览计数增量批量落库，并清空已落库字段。
func (r *Runner) flushViewCounts() {
	ctx := context.Background()
	pending, err := r.cache.HGetAll(ctx, cache.ViewPendingKey())
	if err != nil {
		r.log.Error("flush view counts: hgetall failed", zap.Error(err))
		return
	}
	flushed := 0
	for postID, v := range pending {
		delta, err := strconv.ParseInt(v, 10, 64)
		if err != nil || delta == 0 {
			continue
		}
		if err := r.content.IncrementView(postID, delta); err != nil {
			r.log.Error("flush view counts: update failed", zap.String("post_id", postID), zap.Error(err))
			continue
		}
		if err := r.cache.HDel(ctx, cache.ViewPendingKey(), postID); err != nil {
			r.log.Warn("flush view counts: hdel failed", zap.String("post_id", postID), zap.Error(err))
		}
		flushed++
	}
	if flushed > 0 {
		r.log.Info("view counts flushed", zap.Int("count", flushed))
	}
}
