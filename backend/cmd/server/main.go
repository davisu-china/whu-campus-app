package main

import (
	"context"
	"flag"

	"go.uber.org/zap"

	"github.com/whu-campus/luojia-bbs/internal/auth"
	"github.com/whu-campus/luojia-bbs/internal/cache"
	"github.com/whu-campus/luojia-bbs/internal/config"
	"github.com/whu-campus/luojia-bbs/internal/database"
	"github.com/whu-campus/luojia-bbs/internal/filter"
	"github.com/whu-campus/luojia-bbs/internal/job"
	"github.com/whu-campus/luojia-bbs/internal/repository"
	"github.com/whu-campus/luojia-bbs/internal/router"
	"github.com/whu-campus/luojia-bbs/internal/storage"
)

func main() {
	configPath := flag.String("config", "", "配置文件路径（默认 ./configs/config.yaml）")
	flag.Parse()

	logger, err := zap.NewProduction()
	if err != nil {
		panic(err)
	}
	defer func() { _ = logger.Sync() }()

	cfg, err := config.Load(*configPath)
	if err != nil {
		logger.Fatal("加载配置失败", zap.Error(err))
	}

	// 数据库
	db, err := database.Connect(cfg.Database)
	if err != nil {
		logger.Fatal("连接数据库失败", zap.Error(err))
	}
	if err := database.Migrate(db); err != nil {
		logger.Fatal("数据库迁移失败", zap.Error(err))
	}
	if err := database.EnsureSearchIndexes(db); err != nil {
		logger.Warn("创建搜索索引失败（pg_trgm 可能不可用）", zap.Error(err))
	}
	if err := database.Seed(db); err != nil {
		logger.Fatal("初始化种子数据失败", zap.Error(err))
	}

	// Redis
	rc := cache.New(cfg.Redis.Addr, cfg.Redis.Password, cfg.Redis.DB)
	if err := rc.Ping(context.Background()); err != nil {
		logger.Warn("Redis 连接失败（验证码/限流将不可用）", zap.Error(err))
	}

	// MinIO
	st, err := storage.New(cfg.MinIO)
	if err != nil {
		logger.Fatal("初始化对象存储失败", zap.Error(err))
	}

	// 认证
	tokens := auth.NewTokenManager(cfg.JWT)
	email := auth.NewEmailVerifier(rc, cfg, logger)

	// 敏感词过滤
	govRepo := repository.NewGovernanceRepo(db)
	words, err := govRepo.ListActiveSensitiveWords()
	if err != nil {
		logger.Warn("加载敏感词失败", zap.Error(err))
	}
	matcher := filter.New(words)

	// 定时任务
	contentRepo := repository.NewContentRepo(db)
	cronRunner := job.New(contentRepo, rc, logger)
	c := cronRunner.Start()
	defer c.Stop()

	// 装配与启动
	deps := &router.Deps{
		DB:      db,
		Cache:   rc,
		Storage: st,
		Tokens:  tokens,
		Email:   email,
		Matcher: matcher,
		Cfg:     cfg,
		Log:     logger,
	}
	engine := router.New(deps)

	logger.Info("server starting", zap.String("addr", cfg.Server.Addr))
	if err := engine.Run(cfg.Server.Addr); err != nil {
		logger.Fatal("server stopped", zap.Error(err))
	}
}
