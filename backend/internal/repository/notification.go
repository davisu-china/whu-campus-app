package repository

import (
	"gorm.io/gorm"

	"github.com/whu-campus/luojia-bbs/internal/model"
)

// NotificationRepo 通知数据访问。
type NotificationRepo struct {
	db *gorm.DB
}

func NewNotificationRepo(db *gorm.DB) *NotificationRepo { return &NotificationRepo{db: db} }

func (r *NotificationRepo) Create(n *model.Notification) error { return r.db.Create(n).Error }

func (r *NotificationRepo) List(userID string, page, pageSize int) ([]model.Notification, int64, error) {
	var total int64
	query := r.db.Model(&model.Notification{}).Where("user_id = ?", userID)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var list []model.Notification
	err := query.Order("created_at DESC").
		Offset((page - 1) * pageSize).Limit(pageSize).Find(&list).Error
	return list, total, err
}

func (r *NotificationRepo) CountUnread(userID string) (int64, error) {
	var count int64
	err := r.db.Model(&model.Notification{}).
		Where("user_id = ? AND is_read = ?", userID, false).Count(&count).Error
	return count, err
}

// MarkAllRead 全部标记已读。
func (r *NotificationRepo) MarkAllRead(userID string) error {
	return r.db.Model(&model.Notification{}).
		Where("user_id = ? AND is_read = ?", userID, false).
		UpdateColumn("is_read", true).Error
}

// MarkRead 标记单条已读。
func (r *NotificationRepo) MarkRead(userID, id string) error {
	return r.db.Model(&model.Notification{}).
		Where("id = ? AND user_id = ?", id, userID).
		UpdateColumn("is_read", true).Error
}
