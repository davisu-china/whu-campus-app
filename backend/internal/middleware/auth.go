package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/whu-campus/luojia-bbs/internal/auth"
	"github.com/whu-campus/luojia-bbs/internal/model"
	"github.com/whu-campus/luojia-bbs/pkg/response"
	"github.com/whu-campus/luojia-bbs/pkg/xerr"
)

func extractToken(c *gin.Context) string {
	h := c.GetHeader("Authorization")
	if h == "" {
		return ""
	}
	parts := strings.SplitN(h, " ", 2)
	if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
		return parts[1]
	}
	return parts[0]
}

// Auth 鉴权中间件：解析 JWT、加载用户、校验封禁状态。
func Auth(tm *auth.TokenManager, db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := extractToken(c)
		if token == "" {
			response.Fail(c, xerr.ErrUnauthorized)
			c.Abort()
			return
		}
		claims, err := tm.ParseAccess(token)
		if err != nil {
			response.Fail(c, xerr.ErrUnauthorized)
			c.Abort()
			return
		}

		var user model.User
		if err := db.First(&user, "id = ?", claims.UserID).Error; err != nil {
			response.Fail(c, xerr.ErrUnauthorized)
			c.Abort()
			return
		}
		if user.Status == model.UserStatusBanned {
			response.Fail(c, xerr.New(xerr.CodeUserBanned, "账号已被封禁"))
			c.Abort()
			return
		}

		c.Set(CtxUserKey, &user)
		c.Set(CtxClaimsKey, claims)
		c.Next()
	}
}

// OptionalAuth 可选鉴权：有合法 token 则装载用户，否则匿名放行。
func OptionalAuth(tm *auth.TokenManager, db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := extractToken(c)
		if token == "" {
			c.Next()
			return
		}
		claims, err := tm.ParseAccess(token)
		if err != nil {
			c.Next()
			return
		}
		var user model.User
		if err := db.First(&user, "id = ?", claims.UserID).Error; err != nil {
			c.Next()
			return
		}
		c.Set(CtxUserKey, &user)
		c.Set(CtxClaimsKey, claims)
		c.Next()
	}
}

// RequireVerified 要求已认证（武大学生）用户。
func RequireVerified() gin.HandlerFunc {
	return func(c *gin.Context) {
		u := CurrentUser(c)
		if u == nil {
			response.Fail(c, xerr.ErrUnauthorized)
			c.Abort()
			return
		}
		if !u.IsVerified {
			response.Fail(c, xerr.New(xerr.CodeVerifyRequired, "该操作需要武大学生认证"))
			c.Abort()
			return
		}
		c.Next()
	}
}

// RequireRole 要求指定及以上角色（2 版主 / 3 运营）。
func RequireRole(minRole int) gin.HandlerFunc {
	return func(c *gin.Context) {
		u := CurrentUser(c)
		if u == nil {
			response.Fail(c, xerr.ErrUnauthorized)
			c.Abort()
			return
		}
		if u.Role < minRole {
			response.Fail(c, xerr.New(xerr.CodeNoPermission, "权限不足"))
			c.Abort()
			return
		}
		c.Next()
	}
}
