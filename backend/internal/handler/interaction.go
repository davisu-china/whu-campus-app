package handler

import (
	"github.com/gin-gonic/gin"

	"github.com/whu-campus/luojia-bbs/internal/middleware"
	"github.com/whu-campus/luojia-bbs/internal/service"
	"github.com/whu-campus/luojia-bbs/pkg/response"
	"github.com/whu-campus/luojia-bbs/pkg/xerr"
)

// InteractionHandler 互动接口。
type InteractionHandler struct {
	svc *service.InteractionService
}

func NewInteractionHandler(svc *service.InteractionService) *InteractionHandler {
	return &InteractionHandler{svc: svc}
}

func (h *InteractionHandler) TogglePostLike(c *gin.Context) {
	liked, err := h.svc.ToggleLike(middleware.CurrentUserID(c), "post", c.Param("id"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, gin.H{"liked": liked})
}

func (h *InteractionHandler) ToggleReplyLike(c *gin.Context) {
	liked, err := h.svc.ToggleLike(middleware.CurrentUserID(c), "reply", c.Param("id"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, gin.H{"liked": liked})
}

func (h *InteractionHandler) ToggleFavorite(c *gin.Context) {
	favorited, err := h.svc.ToggleFavorite(middleware.CurrentUserID(c), c.Param("id"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, gin.H{"favorited": favorited})
}

func (h *InteractionHandler) Report(c *gin.Context) {
	var req struct {
		TargetType string `json:"target_type" binding:"required"`
		TargetID   string `json:"target_id" binding:"required"`
		Reason     string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, xerr.ErrBadParam)
		return
	}
	if err := h.svc.Report(middleware.CurrentUserID(c), req.TargetType, req.TargetID, req.Reason); err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, nil)
}
