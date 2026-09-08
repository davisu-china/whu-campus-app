package service

import (
	"github.com/whu-campus/luojia-bbs/internal/model"
	"github.com/whu-campus/luojia-bbs/internal/repository"
	"github.com/whu-campus/luojia-bbs/pkg/xerr"
)

// NotificationService 通知。
type NotificationService struct {
	notif *repository.NotificationRepo
}

func NewNotificationService(notif *repository.NotificationRepo) *NotificationService {
	return &NotificationService{notif: notif}
}

func (s *NotificationService) List(userID string, page, pageSize int) ([]model.Notification, int64, error) {
	list, total, err := s.notif.List(userID, page, pageSize)
	if err != nil {
		return nil, 0, xerr.New(xerr.CodeDBError, "查询通知失败").Wrap(err)
	}
	return list, total, nil
}

func (s *NotificationService) UnreadCount(userID string) (int64, error) {
	n, err := s.notif.CountUnread(userID)
	if err != nil {
		return 0, xerr.New(xerr.CodeDBError, "查询未读数失败").Wrap(err)
	}
	return n, nil
}

func (s *NotificationService) MarkAllRead(userID string) error {
	if err := s.notif.MarkAllRead(userID); err != nil {
		return xerr.New(xerr.CodeDBError, "标记失败").Wrap(err)
	}
	return nil
}

func (s *NotificationService) MarkRead(userID, id string) error {
	if err := s.notif.MarkRead(userID, id); err != nil {
		return xerr.New(xerr.CodeDBError, "标记失败").Wrap(err)
	}
	return nil
}
