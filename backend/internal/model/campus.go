package model

import "time"

// 图书馆自动预约计划状态。
const (
	BookingPlanPending   = 0 // 待预约
	BookingPlanSucceeded = 1 // 已成功
	BookingPlanFailed    = 2 // 已失败
	BookingPlanCancelled = 3 // 已取消
)

// BookingPlan 图书馆自动预约计划（定时到点自动提交 freeBook）。
type BookingPlan struct {
	Base
	UserID     string    `gorm:"type:uuid;index" json:"user_id"`
	RoomID     string    `json:"room_id"`
	SeatID     string    `json:"seat_id"`
	RoomName   string    `gorm:"size:64" json:"room_name"` // 冗余：便于列表展示
	SeatName   string    `gorm:"size:64" json:"seat_name"` // 冗余：便于列表展示
	Date       string    `gorm:"size:16" json:"date"`      // yyyy-MM-dd
	StartTime  string    `gorm:"size:8" json:"start_time"` // HH:mm
	EndTime    string    `gorm:"size:8" json:"end_time"`   // HH:mm
	BookAt     time.Time `gorm:"index" json:"book_at"`     // 触发预约的时间点
	Status     int       `gorm:"type:smallint;default:0" json:"status"`
	LastResult string    `gorm:"size:200" json:"last_result"` // 最近一次执行结果
}
