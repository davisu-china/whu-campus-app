package handler

import (
	"github.com/gin-gonic/gin"

	"github.com/whu-campus/luojia-bbs/internal/auth"
	"github.com/whu-campus/luojia-bbs/internal/service"
	"github.com/whu-campus/luojia-bbs/pkg/response"
	"github.com/whu-campus/luojia-bbs/pkg/xerr"
)

// AuthHandler 认证接口。
type AuthHandler struct {
	svc *service.AuthService
}

func NewAuthHandler(svc *service.AuthService) *AuthHandler { return &AuthHandler{svc: svc} }

func (h *AuthHandler) SendCode(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required,email"`
		Scene string `json:"scene"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, xerr.ErrBadParam)
		return
	}
	if req.Scene == "" {
		req.Scene = auth.SceneLogin
	}
	if err := h.svc.SendCode(c.Request.Context(), req.Email, req.Scene); err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, nil)
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req struct {
		Email    string `json:"email" binding:"required,email"`
		Code     string `json:"code" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, xerr.ErrBadParam)
		return
	}
	pair, user, err := h.svc.Register(c.Request.Context(), req.Email, req.Code, req.Password)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, gin.H{
		"access_token":  pair.AccessToken,
		"refresh_token": pair.RefreshToken,
		"expires_in":    pair.ExpiresIn,
		"user":          user,
	})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req struct {
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, xerr.ErrBadParam)
		return
	}
	pair, user, err := h.svc.Login(c.Request.Context(), req.Email, req.Password)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, gin.H{
		"access_token":  pair.AccessToken,
		"refresh_token": pair.RefreshToken,
		"expires_in":    pair.ExpiresIn,
		"user":          user,
	})
}

// LoginByCode 邮箱验证码登录（小程序兼容保留）。
func (h *AuthHandler) LoginByCode(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required,email"`
		Code  string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, xerr.ErrBadParam)
		return
	}
	pair, user, err := h.svc.LoginByCode(c.Request.Context(), req.Email, req.Code)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, gin.H{
		"access_token":  pair.AccessToken,
		"refresh_token": pair.RefreshToken,
		"expires_in":    pair.ExpiresIn,
		"user":          user,
	})
}

func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req struct {
		Email    string `json:"email" binding:"required,email"`
		Code     string `json:"code" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, xerr.ErrBadParam)
		return
	}
	if err := h.svc.ResetPassword(c.Request.Context(), req.Email, req.Code, req.Password); err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, nil)
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	var req struct {
		RefreshToken string `json:"refresh_token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, xerr.ErrBadParam)
		return
	}
	pair, err := h.svc.Refresh(req.RefreshToken)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, pair)
}
