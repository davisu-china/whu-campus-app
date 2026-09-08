package handler

import (
	"fmt"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/whu-campus/luojia-bbs/internal/middleware"
	"github.com/whu-campus/luojia-bbs/internal/service"
	"github.com/whu-campus/luojia-bbs/pkg/response"
	"github.com/whu-campus/luojia-bbs/pkg/xerr"
)

// CampusPlanHandler 校园服务计划（图书馆定时自动预约）接口。
type CampusPlanHandler struct {
	svc *service.CampusPlanService
}

// NewCampusPlanHandler 构造。
func NewCampusPlanHandler(svc *service.CampusPlanService) *CampusPlanHandler {
	return &CampusPlanHandler{svc: svc}
}

// CreateBookingPlan 创建自动预约计划。
// POST /api/v1/campus/library/plan
func (h *CampusPlanHandler) CreateBookingPlan(c *gin.Context) {
	var req struct {
		RoomID    string `json:"room_id" binding:"required"`
		SeatID    string `json:"seat_id" binding:"required"`
		RoomName  string `json:"room_name"`
		SeatName  string `json:"seat_name"`
		Date      string `json:"date" binding:"required"`
		StartTime string `json:"start_time" binding:"required"`
		EndTime   string `json:"end_time" binding:"required"`
		BookAt    string `json:"book_at" binding:"required"` // RFC3339 或 "2006-01-02 15:04[:05]"
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, xerr.ErrBadParam)
		return
	}
	bookAt, err := parseBookAt(req.BookAt)
	if err != nil {
		response.Fail(c, xerr.ErrBadParam)
		return
	}
	plan, err := h.svc.CreateBookingPlan(c.Request.Context(), middleware.CurrentUserID(c), service.BookingPlanCreate{
		RoomID:    req.RoomID,
		SeatID:    req.SeatID,
		RoomName:  req.RoomName,
		SeatName:  req.SeatName,
		Date:      req.Date,
		StartTime: req.StartTime,
		EndTime:   req.EndTime,
		BookAt:    bookAt,
	})
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, plan)
}

// ListBookingPlans 查询自动预约计划。
// GET /api/v1/campus/library/plan
func (h *CampusPlanHandler) ListBookingPlans(c *gin.Context) {
	list, err := h.svc.ListBookingPlans(c.Request.Context(), middleware.CurrentUserID(c))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

// DeleteBookingPlan 删除自动预约计划。
// DELETE /api/v1/campus/library/plan/:id
func (h *CampusPlanHandler) DeleteBookingPlan(c *gin.Context) {
	if err := h.svc.DeleteBookingPlan(c.Request.Context(), middleware.CurrentUserID(c), c.Param("id")); err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, nil)
}

// parseBookAt 解析触发时间，支持 RFC3339 与 "2006-01-02 15:04[:05]"。
func parseBookAt(s string) (time.Time, error) {
	for _, layout := range []string{time.RFC3339, "2006-01-02 15:04:05", "2006-01-02 15:04"} {
		if t, err := time.Parse(layout, s); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("invalid book_at: %s", s)
}
