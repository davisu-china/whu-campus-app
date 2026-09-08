package middleware

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/whu-campus/luojia-bbs/internal/cache"
	"github.com/whu-campus/luojia-bbs/pkg/response"
	"github.com/whu-campus/luojia-bbs/pkg/xerr"
)

// RateLimit 基于 Redis 固定窗口的限流中间件。
// limit 为窗口内最大请求数；window 为窗口时长；scope 用于构造 key。
func RateLimit(rc *cache.Client, scope string, limit int, window time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		if rc == nil || limit <= 0 {
			c.Next()
			return
		}
		ident := CurrentUserID(c)
		if ident == "" {
			ident = ClientIP(c)
		}
		key := fmt.Sprintf("rate:%s:%s", scope, ident)

		n, err := rc.IncrWithTTL(c.Request.Context(), key, window)
		if err != nil {
			// 限流依赖 Redis，异常时降级放行，避免阻塞业务。
			c.Next()
			return
		}
		if n > int64(limit) {
			response.Fail(c, xerr.New(xerr.CodeRateLimit, "操作过于频繁，请稍后再试").
				WithHTTP(http.StatusTooManyRequests))
			c.Abort()
			return
		}
		c.Next()
	}
}
