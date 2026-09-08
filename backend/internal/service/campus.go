package service

import (
	"context"
	"time"

	campusservice "github.com/whu-campus/luojia-bbs/internal/campus/service"
	"github.com/whu-campus/luojia-bbs/internal/model"
	"github.com/whu-campus/luojia-bbs/internal/repository"
	"github.com/whu-campus/luojia-bbs/pkg/xerr"
)

// BookingPlanCreate 创建自动预约计划的入参。
type BookingPlanCreate struct {
	RoomID    string
	SeatID    string
	RoomName  string
	SeatName  string
	Date      string
	StartTime string
	EndTime   string
	BookAt    time.Time
}

// CampusPlanService 校园服务计划：图书馆定时自动预约（DB 计划 + 到点执行 + 站内推送）。
type CampusPlanService struct {
	plan   *repository.BookingPlanRepo
	notif  *repository.NotificationRepo
	campus *campusservice.Service
}

// NewCampusPlanService 构造。
func NewCampusPlanService(plan *repository.BookingPlanRepo, notif *repository.NotificationRepo, campus *campusservice.Service) *CampusPlanService {
	return &CampusPlanService{plan: plan, notif: notif, campus: campus}
}

// CreateBookingPlan 创建自动预约计划。
func (s *CampusPlanService) CreateBookingPlan(ctx context.Context, userID string, in BookingPlanCreate) (*model.BookingPlan, error) {
	p := &model.BookingPlan{
		UserID:    userID,
		RoomID:    in.RoomID,
		SeatID:    in.SeatID,
		RoomName:  in.RoomName,
		SeatName:  in.SeatName,
		Date:      in.Date,
		StartTime: in.StartTime,
		EndTime:   in.EndTime,
		BookAt:    in.BookAt,
		Status:    model.BookingPlanPending,
	}
	if err := s.plan.Create(p); err != nil {
		return nil, xerr.New(xerr.CodeDBError, "创建预约计划失败").Wrap(err)
	}
	return p, nil
}

// ListBookingPlans 列出用户的自动预约计划。
func (s *CampusPlanService) ListBookingPlans(ctx context.Context, userID string) ([]model.BookingPlan, error) {
	list, err := s.plan.ListByUser(userID)
	if err != nil {
		return nil, xerr.New(xerr.CodeDBError, "查询预约计划失败").Wrap(err)
	}
	return list, nil
}

// DeleteBookingPlan 删除计划（仅本人）。
func (s *CampusPlanService) DeleteBookingPlan(ctx context.Context, userID, id string) error {
	if err := s.plan.Delete(userID, id); err != nil {
		return xerr.New(xerr.CodeDBError, "删除预约计划失败").Wrap(err)
	}
	return nil
}

// RunDueBookings 执行到期的自动预约计划（由定时任务调用）。
func (s *CampusPlanService) RunDueBookings(ctx context.Context) error {
	plans, err := s.plan.ListDue(time.Now())
	if err != nil {
		return err
	}
	for _, p := range plans {
		s.runOne(ctx, p)
	}
	return nil
}

// runOne 执行单个计划并推送结果。
func (s *CampusPlanService) runOne(ctx context.Context, p model.BookingPlan) {
	booking, err := s.campus.AutoBook(ctx, p.UserID, p.RoomID, p.SeatID, p.Date, p.StartTime, p.EndTime)
	if err != nil {
		_ = s.plan.UpdateStatus(p.ID, model.BookingPlanFailed, err.Error())
		s.notify(p.UserID, "图书馆自动预约失败", "座位 "+p.SeatID+" 自动预约失败："+err.Error())
		return
	}
	_ = s.plan.UpdateStatus(p.ID, model.BookingPlanSucceeded, booking.ID)
	s.notify(p.UserID, "图书馆自动预约成功", p.Date+" "+p.StartTime+"-"+p.EndTime+" 已为您预约座位 "+p.SeatID)
}

// notify 推送站内系统通知。
func (s *CampusPlanService) notify(userID, title, content string) {
	if len(content) > 200 {
		content = content[:200]
	}
	_ = s.notif.Create(&model.Notification{
		UserID:  userID,
		Type:    "system",
		Title:   title,
		Content: content,
	})
}
