// Package router 组装依赖、注册路由。
package router

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/gorm"

	"github.com/whu-campus/luojia-bbs/internal/auth"
	"github.com/whu-campus/luojia-bbs/internal/cache"
	campushandler "github.com/whu-campus/luojia-bbs/internal/campus/handler"
	campusservice "github.com/whu-campus/luojia-bbs/internal/campus/service"
	"github.com/whu-campus/luojia-bbs/internal/config"
	"github.com/whu-campus/luojia-bbs/internal/filter"
	"github.com/whu-campus/luojia-bbs/internal/handler"
	"github.com/whu-campus/luojia-bbs/internal/middleware"
	"github.com/whu-campus/luojia-bbs/internal/model"
	"github.com/whu-campus/luojia-bbs/internal/repository"
	"github.com/whu-campus/luojia-bbs/internal/service"
	"github.com/whu-campus/luojia-bbs/internal/storage"
)

// Deps 依赖注入容器（由 main 装配）。
type Deps struct {
	DB      *gorm.DB
	Cache   *cache.Client
	Storage *storage.Storage
	Tokens  *auth.TokenManager
	Email   *auth.EmailVerifier
	Matcher *filter.Matcher
	Cfg     *config.Config
	Log     *zap.Logger

	Campus     *campusservice.Service     // 校园服务（凭据代理）
	CampusPlan *service.CampusPlanService // 校园服务计划（自动预约）
}

// New 构建 Gin 引擎并注册全部路由。
func New(d *Deps) *gin.Engine {
	// repositories
	userRepo := repository.NewUserRepo(d.DB)
	infoRepo := repository.NewInfoRepo(d.DB)
	contentRepo := repository.NewContentRepo(d.DB)
	interRepo := repository.NewInteractionRepo(d.DB)
	govRepo := repository.NewGovernanceRepo(d.DB)
	notifRepo := repository.NewNotificationRepo(d.DB)
	msgRepo := repository.NewMessageRepo(d.DB)

	// services
	authSvc := service.NewAuthService(userRepo, d.Tokens, d.Email)
	userSvc := service.NewUserService(userRepo, d.Cache)
	infoSvc := service.NewInfoService(infoRepo, d.Cache)
	contentSvc := service.NewContentService(contentRepo, infoRepo, interRepo, notifRepo, d.Cache, d.Storage, d.Matcher, d.Cfg)
	interSvc := service.NewInteractionService(interRepo, contentRepo)
	notifSvc := service.NewNotificationService(notifRepo)
	msgSvc := service.NewMessageService(msgRepo, userRepo, d.Matcher)
	adminSvc := service.NewAdminService(contentRepo, infoRepo, userRepo, govRepo, d.Cache)

	// 校园服务（凭据代理）：统一认证绑定 + 只读数据代理（课表/成绩/绩点）。
	campusH := campushandler.NewCampusHandler(d.Campus)
	planH := handler.NewCampusPlanHandler(d.CampusPlan)

	// handlers
	authH := handler.NewAuthHandler(authSvc)
	userH := handler.NewUserHandler(userSvc)
	infoH := handler.NewInfoHandler(infoSvc)
	contentH := handler.NewContentHandler(contentSvc)
	interH := handler.NewInteractionHandler(interSvc)
	notifH := handler.NewNotificationHandler(notifSvc)
	msgH := handler.NewMessageHandler(msgSvc)
	adminH := handler.NewAdminHandler(adminSvc)

	gin.SetMode(d.Cfg.Server.Mode)
	r := gin.New()
	// 仅信任可信代理（部署在 nginx/Cloudflare 后时设为 nginx 所在网段），
	// 否则 X-Forwarded-For 可被伪造，导致限流与 IP 审计失真。
	if len(d.Cfg.Server.TrustedProxies) > 0 {
		_ = r.SetTrustedProxies(d.Cfg.Server.TrustedProxies)
	} else {
		_ = r.SetTrustedProxies(nil)
	}
	r.Use(
		middleware.RequestID(),
		middleware.Logger(d.Log),
		middleware.Recovery(d.Log),
		middleware.CORS(),
	)

	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	optAuth := middleware.OptionalAuth(d.Tokens, d.DB, d.Cache)
	reqAuth := middleware.Auth(d.Tokens, d.DB, d.Cache)

	api := r.Group("/api/v1")

	// 认证
	authGroup := api.Group("/auth")
	authGroup.POST("/email/send-code",
		middleware.RateLimit(d.Cache, "send-code", d.Cfg.RateLimit.LoginPerMinute, time.Minute),
		authH.SendCode)
	authGroup.POST("/register",
		middleware.RateLimit(d.Cache, "register", d.Cfg.RateLimit.LoginPerMinute, time.Minute),
		authH.Register)
	authGroup.POST("/login",
		middleware.RateLimit(d.Cache, "login", d.Cfg.RateLimit.LoginPerMinute, time.Minute),
		authH.Login)
	authGroup.POST("/email/login",
		middleware.RateLimit(d.Cache, "login-code", d.Cfg.RateLimit.LoginPerMinute, time.Minute),
		authH.LoginByCode)
	authGroup.POST("/reset-password",
		middleware.RateLimit(d.Cache, "reset-password", d.Cfg.RateLimit.LoginPerMinute, time.Minute),
		authH.ResetPassword)
	authGroup.POST("/refresh", authH.Refresh)

	// 信息架构（公开读）
	api.GET("/categories", infoH.Categories)
	api.GET("/boards/:id", infoH.BoardDetail)
	api.GET("/boards/:id/tags", infoH.BoardTags)
	api.GET("/boards/:id/hot-tags", infoH.BoardHotTags)
	api.GET("/dict/search", infoH.DictSearch)

	// 内容（公开读，可选鉴权注入互动状态）
	api.GET("/home/feed", optAuth, contentH.HomeFeed)
	api.GET("/home/hot", optAuth, contentH.HomeHot)
	api.GET("/boards/:id/posts", optAuth, contentH.BoardPosts)
	api.GET("/posts/:id", optAuth, contentH.PostDetail)
	api.GET("/posts/:id/replies", optAuth, contentH.ListReplies)
	api.GET("/posts/:id/sub-replies", optAuth, contentH.FloorSubReplies)
	api.GET("/search", optAuth, contentH.Search)
	api.GET("/users/:id", userH.Profile)
	api.GET("/users/:id/posts", optAuth, contentH.UserPosts)

	// 需登录
	authed := api.Group("")
	authed.Use(reqAuth)
	{
		authed.GET("/users/me", userH.Me)
		authed.PUT("/users/me", userH.UpdateMe)
		authed.GET("/users/me/posts", contentH.MyPosts)
		authed.GET("/users/me/replies", contentH.MyReplies)
		authed.GET("/users/me/favorites", contentH.MyFavorites)

		authed.POST("/posts", middleware.RequireVerified(), contentH.CreatePost)
		authed.PUT("/posts/:id", contentH.UpdatePost)
		authed.DELETE("/posts/:id", contentH.DeletePost)
		authed.POST("/posts/:id/replies", contentH.CreateReply)

		authed.POST("/posts/:id/like", interH.TogglePostLike)
		authed.POST("/replies/:id/like", interH.ToggleReplyLike)
		authed.POST("/posts/:id/favorite", interH.ToggleFavorite)
		authed.POST("/reports", interH.Report)

		authed.POST("/upload/presign",
			middleware.RateLimit(d.Cache, "upload", d.Cfg.RateLimit.UploadPerMinute, time.Minute),
			contentH.PresignUpload)

		authed.GET("/notifications", notifH.List)
		authed.GET("/notifications/unread-count", notifH.UnreadCount)
		authed.POST("/notifications/read", notifH.MarkAllRead)
		authed.POST("/notifications/:id/read", notifH.MarkRead)

		authed.GET("/messages/conversations", msgH.ListConversations)
		authed.GET("/messages/conversations/:id/messages", msgH.ListMessages)
		authed.POST("/messages", msgH.Send)
		authed.GET("/messages/unread-count", msgH.UnreadCount)

		// 校园服务（武大统一身份认证绑定）
		authed.POST("/campus/cas/bind",
			middleware.RateLimit(d.Cache, "campus-bind", d.Cfg.RateLimit.LoginPerMinute, time.Minute),
			campusH.Bind)
		authed.GET("/campus/cas/status", campusH.Status)
		authed.POST("/campus/cas/unbind", campusH.Unbind)

		// 校园服务（只读数据：课表/成绩/绩点/一卡通/校车）
		authed.GET("/campus/course", campusH.Timetable)
		authed.GET("/campus/score", campusH.Scores)
		authed.GET("/campus/gpa", campusH.GPA)
		authed.GET("/campus/card", campusH.Card)
		authed.GET("/campus/bus", campusH.Bus)

		// 校园服务（图书馆座位：只读查询 + 预约/取消/签到）
		authed.GET("/campus/library/buildings", campusH.LibraryBuildings)
		authed.GET("/campus/library/rooms", campusH.LibraryRooms)
		authed.GET("/campus/library/seats", campusH.LibrarySeats)
		authed.GET("/campus/library/captcha", campusH.LibraryCaptcha)
		authed.POST("/campus/library/booking",
			middleware.RateLimit(d.Cache, "campus-book", d.Cfg.RateLimit.PostPerMinute, time.Minute),
			campusH.LibraryBooking)
		authed.POST("/campus/library/cancel", campusH.LibraryCancel)
		authed.POST("/campus/library/checkin", campusH.LibraryCheckin)

		// 校园服务（图书馆定时自动预约计划）
		authed.GET("/campus/library/plan", planH.ListBookingPlans)
		authed.POST("/campus/library/plan", planH.CreateBookingPlan)
		authed.DELETE("/campus/library/plan/:id", planH.DeleteBookingPlan)

		// 校园服务（云打印：打印点 + 上传打印）
		authed.GET("/campus/print/stations", campusH.PrintStations)
		authed.POST("/campus/print/submit",
			middleware.RateLimit(d.Cache, "print-submit", d.Cfg.RateLimit.UploadPerMinute, time.Minute),
			campusH.PrintSubmit)

		// 校园服务（体育场馆：场次查询 + 下单）
		authed.GET("/campus/gym/stadiums", campusH.GymStadiums)
		authed.GET("/campus/gym/sessions", campusH.GymSessions)
		authed.POST("/campus/gym/order",
			middleware.RateLimit(d.Cache, "gym-order", d.Cfg.RateLimit.PostPerMinute, time.Minute),
			campusH.GymOrder)
	}

	// 运营后台（role ≥ 2）
	admin := api.Group("/admin")
	admin.Use(reqAuth, middleware.RequireRole(model.RoleModerator))
	{
		admin.GET("/posts", adminH.ListPendingPosts)
		admin.POST("/posts/:id/review", adminH.ReviewPost)
		admin.POST("/posts/:id/pin", adminH.PinPost)
		admin.POST("/posts/:id/feature", adminH.FeaturePost)
		admin.DELETE("/posts/:id", adminH.DeletePost)

		admin.GET("/reports", adminH.ListReports)
		admin.POST("/reports/:id/handle", adminH.HandleReport)

		admin.GET("/users", adminH.ListUsers)
		admin.POST("/users/:id/ban", adminH.BanUser)

		admin.GET("/sensitive-words", adminH.ListSensitiveWords)
		admin.POST("/sensitive-words", adminH.AddSensitiveWord)
		admin.DELETE("/sensitive-words/:id", adminH.DeleteSensitiveWord)

		admin.POST("/boards", adminH.CreateBoard)
		admin.POST("/tags", adminH.CreateTag)
		admin.GET("/dicts", adminH.ListDicts)
		admin.POST("/dicts", adminH.CreateDict)
		admin.DELETE("/dicts/:id", adminH.DeleteDict)

		admin.GET("/stats", adminH.Stats)
	}

	return r
}
