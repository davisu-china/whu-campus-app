package handler

import (
	"github.com/gin-gonic/gin"

	"github.com/whu-campus/luojia-bbs/internal/auth"
	"github.com/whu-campus/luojia-bbs/internal/middleware"
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

// SSOLogin 武大统一登录（学号/工号 + 统一认证密码）。
func (h *AuthHandler) SSOLogin(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, xerr.ErrBadParam)
		return
	}
	pair, user, err := h.svc.SSOLogin(c.Request.Context(), req.Username, req.Password)
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

// ChangePassword 修改/设置密码（需登录态）。
func (h *AuthHandler) ChangePassword(c *gin.Context) {
	var req struct {
		OldPassword string `json:"old_password"`
		NewPassword string `json:"new_password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, xerr.ErrBadParam)
		return
	}
	if err := h.svc.ChangePassword(c.Request.Context(), middleware.CurrentUserID(c), req.OldPassword, req.NewPassword); err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, nil)
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

// WechatLogin 微信小程序登录。
func (h *AuthHandler) WechatLogin(c *gin.Context) {
	var req struct {
		Code      string `json:"code" binding:"required"`
		Nickname  string `json:"nickname"`
		AvatarURL string `json:"avatar_url"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, xerr.ErrBadParam)
		return
	}
	pair, user, err := h.svc.WechatLogin(c.Request.Context(), req.Code, req.Nickname, req.AvatarURL)
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

// BindEmail 微信账号绑定武大邮箱（需登录态）。
func (h *AuthHandler) BindEmail(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required,email"`
		Code  string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, xerr.ErrBadParam)
		return
	}
	user, err := h.svc.BindEmail(c.Request.Context(), middleware.CurrentUserID(c), req.Email, req.Code)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, user)
}
