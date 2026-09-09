package service

import (
	"context"
	"time"

	"github.com/whu-campus/luojia-bbs/internal/cache"
	"github.com/whu-campus/luojia-bbs/internal/model"
	"github.com/whu-campus/luojia-bbs/internal/repository"
	"github.com/whu-campus/luojia-bbs/pkg/xerr"
)

// AdminService 运营后台。
type AdminService struct {
	content *repository.ContentRepo
	info    *repository.InfoRepo
	users   *repository.UserRepo
	gov     *repository.GovernanceRepo
	cache   *cache.Client
}

func NewAdminService(
	content *repository.ContentRepo,
	info *repository.InfoRepo,
	users *repository.UserRepo,
	gov *repository.GovernanceRepo,
	c *cache.Client,
) *AdminService {
	return &AdminService{content: content, info: info, users: users, gov: gov, cache: c}
}

// ---- 内容审核 ----

func (s *AdminService) ListPendingPosts(page, pageSize int) ([]model.Post, int64, error) {
	posts, total, err := s.content.ListPending(page, pageSize)
	if err != nil {
		return nil, 0, xerr.New(xerr.CodeDBError, "查询审核队列失败").Wrap(err)
	}
	return posts, total, nil
}

// ReviewPost 审核：approve 通过 / reject 驳回。
func (s *AdminService) ReviewPost(operatorID, postID, action, reason string) error {
	if action != model.ActionApprove && action != model.ActionReject {
		return xerr.New(xerr.CodeBadParam, "未知审核动作")
	}
	status := model.PostStatusPublished
	if action == model.ActionReject {
		status = model.PostStatusRejected
	}
	if err := s.content.UpdatePost(postID, map[string]interface{}{"status": status}); err != nil {
		return xerr.New(xerr.CodeDBError, "审核失败").Wrap(err)
	}
	s.log(operatorID, action, model.TargetTypePost, postID, reason)
	return nil
}

// PinPost 置顶/取消置顶。
func (s *AdminService) PinPost(operatorID, postID string, pinned bool) error {
	fields := map[string]interface{}{"is_pinned": pinned}
	if pinned {
		fields["pinned_at"] = time.Now()
	}
	if err := s.content.UpdatePost(postID, fields); err != nil {
		return xerr.New(xerr.CodeDBError, "置顶失败").Wrap(err)
	}
	s.log(operatorID, model.ActionPin, model.TargetTypePost, postID, "")
	return nil
}

// FeaturePost 加精/取消精华。
func (s *AdminService) FeaturePost(operatorID, postID string, featured bool) error {
	fields := map[string]interface{}{"is_featured": featured}
	if featured {
		fields["featured_at"] = time.Now()
	}
	if err := s.content.UpdatePost(postID, fields); err != nil {
		return xerr.New(xerr.CodeDBError, "加精失败").Wrap(err)
	}
	s.log(operatorID, model.ActionFeature, model.TargetTypePost, postID, "")
	return nil
}

// DeletePost 运营删除帖子。
func (s *AdminService) DeletePost(operatorID, postID, reason string) error {
	if err := s.content.UpdatePost(postID, map[string]interface{}{"status": model.PostStatusDeleted}); err != nil {
		return xerr.New(xerr.CodeDBError, "删除失败").Wrap(err)
	}
	s.log(operatorID, model.ActionDelete, model.TargetTypePost, postID, reason)
	return nil
}

// ---- 举报处理 ----

func (s *AdminService) ListReports(status *int, page, pageSize int) ([]model.Report, int64, error) {
	list, total, err := s.gov.ListReports(status, page, pageSize)
	if err != nil {
		return nil, 0, xerr.New(xerr.CodeDBError, "查询举报失败").Wrap(err)
	}
	return list, total, nil
}

// HandleReport 处理举报：handle 处理 / dismiss 驳回。
func (s *AdminService) HandleReport(operatorID, reportID, action string) error {
	if action != model.ActionApprove && action != model.ActionReject {
		return xerr.New(xerr.CodeBadParam, "未知处理动作")
	}
	report, err := s.gov.GetReport(reportID)
	if err != nil {
		return xerr.New(xerr.CodeNotFound, "举报不存在")
	}
	status := model.ReportStatusHandled
	if action == model.ActionReject {
		status = model.ReportStatusDismissed
	}
	now := time.Now()
	fields := map[string]interface{}{
		"status":     status,
		"handled_by": operatorID,
		"handled_at": now,
	}
	if err := s.gov.UpdateReport(reportID, fields); err != nil {
		return xerr.New(xerr.CodeDBError, "处理失败").Wrap(err)
	}
	_ = report
	return nil
}

// ---- 用户管理 ----

func (s *AdminService) ListUsers(page, pageSize int, q string) ([]model.User, int64, error) {
	list, total, err := s.users.List(page, pageSize, q)
	if err != nil {
		return nil, 0, xerr.New(xerr.CodeDBError, "查询用户失败").Wrap(err)
	}
	return list, total, nil
}

// BanUser 禁言/封禁。
func (s *AdminService) BanUser(operatorID, userID, banType, reason string, durationHours int) error {
	if banType != model.BanTypeMute && banType != model.BanTypeBan {
		return xerr.New(xerr.CodeBadParam, "未知处罚类型")
	}
	user, err := s.users.FindByID(userID)
	if err != nil {
		return xerr.New(xerr.CodeNotFound, "用户不存在")
	}

	now := time.Now()
	var endedAt *time.Time
	if durationHours > 0 {
		t := now.Add(time.Duration(durationHours) * time.Hour)
		endedAt = &t
	}

	ban := &model.Ban{
		UserID:    userID,
		BanType:   banType,
		Reason:    reason,
		StartedAt: now,
		EndedAt:   endedAt,
		Status:    model.StatusEnabled,
	}
	if err := s.gov.CreateBan(ban); err != nil {
		return xerr.New(xerr.CodeDBError, "创建处罚失败").Wrap(err)
	}

	status := model.UserStatusMuted
	if banType == model.BanTypeBan {
		status = model.UserStatusBanned
	}
	if err := s.users.Update(user, map[string]interface{}{"status": status}); err != nil {
		return xerr.New(xerr.CodeDBError, "更新用户状态失败").Wrap(err)
	}
	// 失效用户缓存，使封禁立即生效。
	_ = s.cache.Del(context.Background(), cache.UserKey(userID))
	s.log(operatorID, model.ActionBan, "user", userID, reason)
	return nil
}

// ---- 敏感词 ----

func (s *AdminService) ListSensitiveWords() ([]model.SensitiveWord, error) {
	return s.gov.ListActiveSensitiveWords()
}

func (s *AdminService) AddSensitiveWord(word, category string, level int) error {
	w := &model.SensitiveWord{Word: word, Category: category, Level: level, Status: model.StatusEnabled}
	if err := s.gov.CreateSensitiveWord(w); err != nil {
		return xerr.New(xerr.CodeDBError, "添加敏感词失败").Wrap(err)
	}
	return nil
}

func (s *AdminService) DeleteSensitiveWord(id string) error {
	if err := s.gov.DeleteSensitiveWord(id); err != nil {
		return xerr.New(xerr.CodeDBError, "删除敏感词失败").Wrap(err)
	}
	return nil
}

// ---- 板块/标签/词典维护 ----

func (s *AdminService) CreateBoard(categoryID, name, slug, description string, fieldMode int) (*model.Board, error) {
	b := &model.Board{
		CategoryID:  categoryID,
		Name:        name,
		Slug:        slug,
		Description: description,
		FieldMode:   fieldMode,
		Status:      model.StatusEnabled,
	}
	if err := s.info.CreateBoard(b); err != nil {
		return nil, xerr.New(xerr.CodeDBError, "创建板块失败").Wrap(err)
	}
	// 失效分类树缓存。
	_ = s.cache.Del(context.Background(), cache.CategoryTreeKey())
	return b, nil
}

func (s *AdminService) CreateTag(boardID, name string, isRequired bool) (*model.Tag, error) {
	t := &model.Tag{BoardID: boardID, Name: name, IsRequired: isRequired, Status: model.StatusEnabled}
	if err := s.info.CreateTag(t); err != nil {
		return nil, xerr.New(xerr.CodeDBError, "创建标签失败").Wrap(err)
	}
	// 失效该板块标签缓存。
	_ = s.cache.Del(context.Background(), cache.BoardTagsKey(boardID))
	return t, nil
}

func (s *AdminService) ListDicts(dictType string) ([]model.DictItem, error) {
	return s.info.ListDicts(dictType)
}

func (s *AdminService) CreateDict(dictType, name string) (*model.DictItem, error) {
	d := &model.DictItem{DictType: dictType, Name: name, Status: model.StatusEnabled}
	if err := s.info.CreateDict(d); err != nil {
		return nil, xerr.New(xerr.CodeDBError, "创建词典失败").Wrap(err)
	}
	// 失效词典搜索补全缓存。
	_ = s.cache.DelByPattern(context.Background(), "info:dict:*")
	return d, nil
}

func (s *AdminService) DeleteDict(id string) error {
	if err := s.info.DeleteDict(id); err != nil {
		return xerr.New(xerr.CodeDBError, "删除词典失败").Wrap(err)
	}
	// 失效词典搜索补全缓存。
	_ = s.cache.DelByPattern(context.Background(), "info:dict:*")
	return nil
}

// ---- 数据看板 ----

// Stats 数据看板指标。
type Stats struct {
	Users        int64 `json:"users"`
	Posts        int64 `json:"posts"`
	Replies      int64 `json:"replies"`
	TodayPosts   int64 `json:"today_posts"`
	PendingPosts int64 `json:"pending_posts"`
}

func (s *AdminService) Stats() (*Stats, error) {
	users, err1 := s.users.Count()
	posts, err2 := s.content.CountPosts(nil)
	replies, err3 := s.content.CountReplies()
	today, err4 := s.content.CountTodayPosts()
	pending, err5 := s.content.CountPosts(intPtr(model.PostStatusPending))
	for _, err := range []error{err1, err2, err3, err4, err5} {
		if err != nil {
			return nil, xerr.New(xerr.CodeDBError, "统计数据失败").Wrap(err)
		}
	}
	return &Stats{Users: users, Posts: posts, Replies: replies, TodayPosts: today, PendingPosts: pending}, nil
}

func (s *AdminService) log(operatorID, action, targetType, targetID, reason string) {
	_ = s.gov.CreateModerationLog(&model.ModerationLog{
		OperatorID: operatorID,
		Action:     action,
		TargetType: targetType,
		TargetID:   targetID,
		Reason:     reason,
	})
}

func intPtr(v int) *int { return &v }
