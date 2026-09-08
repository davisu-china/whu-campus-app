package repository

import (
	"time"

	"gorm.io/gorm"

	"github.com/whu-campus/luojia-bbs/internal/model"
)

// BookingPlanRepo 图书馆自动预约计划数据访问。
type BookingPlanRepo struct {
	db *gorm.DB
}

// NewBookingPlanRepo 构造。
func NewBookingPlanRepo(db *gorm.DB) *BookingPlanRepo { return &BookingPlanRepo{db: db} }

// Create 新增计划。
func (r *BookingPlanRepo) Create(p *model.BookingPlan) error { return r.db.Create(p).Error }

// ListByUser 按用户列出计划。
func (r *BookingPlanRepo) ListByUser(userID string) ([]model.BookingPlan, error) {
	var list []model.BookingPlan
	err := r.db.Where("user_id = ?", userID).Order("book_at ASC").Find(&list).Error
	return list, err
}

// Delete 删除指定计划（仅本人）。
func (r *BookingPlanRepo) Delete(userID, id string) error {
	return r.db.Where("id = ? AND user_id = ?", id, userID).Delete(&model.BookingPlan{}).Error
}

// ListDue 返回已到期且待执行的计划。
func (r *BookingPlanRepo) ListDue(now time.Time) ([]model.BookingPlan, error) {
	var list []model.BookingPlan
	err := r.db.Where("status = ? AND book_at <= ?", model.BookingPlanPending, now).Find(&list).Error
	return list, err
}

// UpdateStatus 更新计划状态与最近结果。
func (r *BookingPlanRepo) UpdateStatus(id string, status int, result string) error {
	return r.db.Model(&model.BookingPlan{}).Where("id = ?", id).
		Updates(map[string]interface{}{"status": status, "last_result": result}).Error
}
