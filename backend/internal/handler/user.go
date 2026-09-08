package handler

import (
	"github.com/gin-gonic/gin"

	"github.com/whu-campus/luojia-bbs/internal/middleware"
	"github.com/whu-campus/luojia-bbs/internal/service"
	"github.com/whu-campus/luojia-bbs/pkg/response"
	"github.com/whu-campus/luojia-bbs/pkg/xerr"
)

// UserHandler 用户接口。
type UserHandler struct {
	svc *service.UserService
}

func NewUserHandler(svc *service.UserService) *UserHandler { return &UserHandler{svc: svc} }

func (h *UserHandler) Me(c *gin.Context) {
	u, err := h.svc.Me(middleware.CurrentUserID(c))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, u)
}

func (h *UserHandler) UpdateMe(c *gin.Context) {
	var req service.UpdateMeInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, xerr.ErrBadParam)
		return
	}
	u, err := h.svc.UpdateMe(middleware.CurrentUserID(c), req)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, u)
}

func (h *UserHandler) Profile(c *gin.Context) {
	pub, err := h.svc.Profile(c.Param("id"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, pub)
}
