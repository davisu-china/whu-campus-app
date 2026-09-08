package handler

import (
	"github.com/gin-gonic/gin"

	"github.com/whu-campus/luojia-bbs/internal/middleware"
	"github.com/whu-campus/luojia-bbs/internal/service"
	"github.com/whu-campus/luojia-bbs/pkg/response"
)

// NotificationHandler 通知接口。
type NotificationHandler struct {
	svc *service.NotificationService
}

func NewNotificationHandler(svc *service.NotificationService) *NotificationHandler {
	return &NotificationHandler{svc: svc}
}

func (h *NotificationHandler) List(c *gin.Context) {
	page, size := pageParams(c)
	list, total, err := h.svc.List(middleware.CurrentUserID(c), page, size)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OKPage(c, list, total, page, size)
}

func (h *NotificationHandler) UnreadCount(c *gin.Context) {
	n, err := h.svc.UnreadCount(middleware.CurrentUserID(c))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, gin.H{"unread_count": n})
}

func (h *NotificationHandler) MarkAllRead(c *gin.Context) {
	if err := h.svc.MarkAllRead(middleware.CurrentUserID(c)); err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, nil)
}

func (h *NotificationHandler) MarkRead(c *gin.Context) {
	if err := h.svc.MarkRead(middleware.CurrentUserID(c), c.Param("id")); err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, nil)
}
