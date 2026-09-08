package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// RequestID 为每个请求生成 request_id，写入上下文与响应头。
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		rid := c.GetHeader("X-Request-ID")
		if rid == "" {
			rid = uuid.NewString()
		}
		c.Set(CtxReqIDKey, rid)
		c.Header("X-Request-ID", rid)
		c.Next()
	}
}

// Logger 结构化访问日志。
func Logger(log *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		raw := c.Request.URL.RawQuery

		c.Next()

		latency := time.Since(start)
		status := c.Writer.Status()
		rid, _ := c.Get(CtxReqIDKey)

		if raw != "" {
			path = path + "?" + raw
		}
		fields := []zap.Field{
			zap.String("request_id", toString(rid)),
			zap.Int("status", status),
			zap.String("method", c.Request.Method),
			zap.String("path", path),
			zap.String("ip", c.ClientIP()),
			zap.Duration("latency", latency),
			zap.String("user_id", CurrentUserID(c)),
		}
		if len(c.Errors) > 0 {
			fields = append(fields, zap.String("errors", c.Errors.String()))
		}
		if status >= 500 {
			log.Error("request", fields...)
		} else {
			log.Info("request", fields...)
		}
	}
}

// Recovery 捕获 panic，记录堆栈并返回统一错误。
func Recovery(log *zap.Logger) gin.HandlerFunc {
	return gin.CustomRecovery(func(c *gin.Context, recovered interface{}) {
		rid, _ := c.Get(CtxReqIDKey)
		log.Error("panic recovered",
			zap.Any("err", recovered),
			zap.String("request_id", toString(rid)),
			zap.String("path", c.Request.URL.Path),
		)
		c.AbortWithStatusJSON(500, gin.H{"code": 10999, "message": "系统繁忙，请稍后再试", "data": nil})
	})
}

func toString(v interface{}) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}
