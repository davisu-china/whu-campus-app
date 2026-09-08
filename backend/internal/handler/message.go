package handler

import (
	"github.com/gin-gonic/gin"

	"github.com/whu-campus/luojia-bbs/internal/middleware"
	"github.com/whu-campus/luojia-bbs/internal/service"
	"github.com/whu-campus/luojia-bbs/pkg/response"
	"github.com/whu-campus/luojia-bbs/pkg/xerr"
)

// MessageHandler 私信接口。
type MessageHandler struct {
	svc *service.MessageService
}

func NewMessageHandler(svc *service.MessageService) *MessageHandler {
	return &MessageHandler{svc: svc}
}

func (h *MessageHandler) ListConversations(c *gin.Context) {
	page, size := pageParams(c)
	list, total, err := h.svc.ListConversations(middleware.CurrentUserID(c), page, size)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OKPage(c, list, total, page, size)
}

func (h *MessageHandler) ListMessages(c *gin.Context) {
	page, size := pageParams(c)
	list, total, err := h.svc.ListMessages(middleware.CurrentUserID(c), c.Param("id"), page, size)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OKPage(c, list, total, page, size)
}

func (h *MessageHandler) Send(c *gin.Context) {
	var req service.SendInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, xerr.ErrBadParam)
		return
	}
	res, err := h.svc.Send(middleware.CurrentUserID(c), req)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, res)
}

func (h *MessageHandler) UnreadCount(c *gin.Context) {
	n, err := h.svc.UnreadCount(middleware.CurrentUserID(c))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, gin.H{"unread_count": n})
}
