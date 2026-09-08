package service

import (
	"errors"
	"strings"

	"gorm.io/gorm"

	"github.com/whu-campus/luojia-bbs/internal/model"
	"github.com/whu-campus/luojia-bbs/internal/repository"
	"github.com/whu-campus/luojia-bbs/pkg/xerr"
)

// InteractionService 互动：点赞、收藏、举报。
type InteractionService struct {
	inter   *repository.InteractionRepo
	content *repository.ContentRepo
}

func NewInteractionService(inter *repository.InteractionRepo, content *repository.ContentRepo) *InteractionService {
	return &InteractionService{inter: inter, content: content}
}

// ToggleLike 点赞/取消，返回操作后的点赞状态。
func (s *InteractionService) ToggleLike(userID, targetType, targetID string) (bool, error) {
	if targetType != model.TargetTypePost && targetType != model.TargetTypeReply {
		return false, xerr.New(xerr.CodeBadParam, "未知目标类型")
	}
	if err := s.ensureTarget(targetType, targetID); err != nil {
		return false, err
	}

	exists, err := s.inter.HasLike(userID, targetType, targetID)
	if err != nil {
		return false, xerr.New(xerr.CodeDBError, "查询点赞失败").Wrap(err)
	}

	if exists {
		if err := s.inter.DeleteLike(userID, targetType, targetID); err != nil {
			return false, xerr.New(xerr.CodeDBError, "取消点赞失败").Wrap(err)
		}
		s.adjustCount(targetType, targetID, -1)
		return false, nil
	}

	like := &model.Like{UserID: userID, TargetType: targetType, TargetID: targetID}
	if err := s.inter.CreateLike(like); err != nil {
		return false, xerr.New(xerr.CodeDBError, "点赞失败").Wrap(err)
	}
	s.adjustCount(targetType, targetID, 1)
	return true, nil
}

func (s *InteractionService) adjustCount(targetType, targetID string, delta int) {
	if targetType == model.TargetTypePost {
		_ = s.content.IncrementLike(targetID, delta)
	} else {
		_ = s.content.IncrementReplyLike(targetID, delta)
	}
}

func (s *InteractionService) ensureTarget(targetType, targetID string) error {
	if targetType == model.TargetTypePost {
		_, err := s.content.GetPost(targetID)
		if err != nil {
			return xerr.New(xerr.CodePostNotFound, "帖子不存在")
		}
		return nil
	}
	_, err := s.content.GetReply(targetID)
	if err != nil {
		return xerr.New(xerr.CodeReplyNotFound, "回复不存在")
	}
	return nil
}

// ToggleFavorite 收藏/取消，返回操作后的收藏状态。
func (s *InteractionService) ToggleFavorite(userID, postID string) (bool, error) {
	_, err := s.content.GetPost(postID)
	if err != nil {
		return false, xerr.New(xerr.CodePostNotFound, "帖子不存在")
	}
	exists, err := s.inter.HasFavorite(userID, postID)
	if err != nil {
		return false, xerr.New(xerr.CodeDBError, "查询收藏失败").Wrap(err)
	}
	if exists {
		if err := s.inter.DeleteFavorite(userID, postID); err != nil {
			return false, xerr.New(xerr.CodeDBError, "取消收藏失败").Wrap(err)
		}
		return false, nil
	}
	fav := &model.Favorite{UserID: userID, PostID: postID}
	if err := s.inter.CreateFavorite(fav); err != nil {
		return false, xerr.New(xerr.CodeDBError, "收藏失败").Wrap(err)
	}
	return true, nil
}

// Report 举报。
func (s *InteractionService) Report(userID, targetType, targetID, reason string) error {
	if targetType != model.TargetTypePost && targetType != model.TargetTypeReply {
		return xerr.New(xerr.CodeBadParam, "未知举报目标")
	}
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return xerr.New(xerr.CodeBadParam, "请填写举报原因")
	}
	if err := s.ensureTarget(targetType, targetID); err != nil {
		return err
	}
	report := &model.Report{
		ReporterID: userID,
		TargetType: targetType,
		TargetID:   targetID,
		Reason:     reason,
		Status:     model.ReportStatusPending,
	}
	if err := s.inter.CreateReport(report); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return xerr.New(xerr.CodeNotFound, "举报目标不存在")
		}
		return xerr.New(xerr.CodeDBError, "举报失败").Wrap(err)
	}
	return nil
}
