// Package middleware 提供鉴权、限流、日志、恢复、请求 ID、CORS 中间件。
package middleware

import (
	"github.com/gin-gonic/gin"

	"github.com/whu-campus/luojia-bbs/internal/auth"
	"github.com/whu-campus/luojia-bbs/internal/model"
)

// 上下文键。
const (
	CtxUserKey   = "ctx_user"
	CtxClaimsKey = "ctx_claims"
	CtxReqIDKey  = "ctx_req_id"
)

// CurrentUser 返回当前登录用户，未登录返回 nil。
func CurrentUser(c *gin.Context) *model.User {
	v, ok := c.Get(CtxUserKey)
	if !ok {
		return nil
	}
	u, _ := v.(*model.User)
	return u
}

// CurrentUserID 返回当前用户 ID，未登录返回空串。
func CurrentUserID(c *gin.Context) string {
	if u := CurrentUser(c); u != nil {
		return u.ID
	}
	return ""
}

// CurrentClaims 返回 JWT 载荷。
func CurrentClaims(c *gin.Context) *auth.Claims {
	v, ok := c.Get(CtxClaimsKey)
	if !ok {
		return nil
	}
	cl, _ := v.(*auth.Claims)
	return cl
}

// ClientIP 客户端 IP。
func ClientIP(c *gin.Context) string {
	return c.ClientIP()
}
