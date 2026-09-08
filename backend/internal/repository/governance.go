package repository

import (
	"time"

	"gorm.io/gorm"

	"github.com/whu-campus/luojia-bbs/internal/model"
)

// GovernanceRepo 治理（举报/敏感词/处罚/审计日志）数据访问。
type GovernanceRepo struct {
	db *gorm.DB
}

func NewGovernanceRepo(db *gorm.DB) *GovernanceRepo { return &GovernanceRepo{db: db} }

// ---- 敏感词 ----

func (r *GovernanceRepo) ListActiveSensitiveWords() ([]model.SensitiveWord, error) {
	var list []model.SensitiveWord
	err := r.db.Where("status = ?", model.StatusEnabled).Find(&list).Error
	return list, err
}

func (r *GovernanceRepo) CreateSensitiveWord(w *model.SensitiveWord) error {
	return r.db.Create(w).Error
}

func (r *GovernanceRepo) DeleteSensitiveWord(id string) error {
	return r.db.Where("id = ?", id).Delete(&model.SensitiveWord{}).Error
}

// ---- 举报 ----

func (r *GovernanceRepo) ListReports(status *int, page, pageSize int) ([]model.Report, int64, error) {
	query := r.db.Model(&model.Report{})
	if status != nil {
		query = query.Where("status = ?", *status)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var list []model.Report
	err := query.Order("created_at ASC").
		Offset((page - 1) * pageSize).Limit(pageSize).Find(&list).Error
	return list, total, err
}

func (r *GovernanceRepo) GetReport(id string) (*model.Report, error) {
	var rep model.Report
	err := r.db.Where("id = ?", id).First(&rep).Error
	if err != nil {
		return nil, err
	}
	return &rep, nil
}

func (r *GovernanceRepo) UpdateReport(id string, fields map[string]interface{}) error {
	return r.db.Model(&model.Report{}).Where("id = ?", id).Updates(fields).Error
}

// ---- 处罚 ----

func (r *GovernanceRepo) CreateBan(b *model.Ban) error { return r.db.Create(b).Error }

// ActiveBan 查询用户当前生效的封禁/禁言。
func (r *GovernanceRepo) ActiveBan(userID string) (*model.Ban, error) {
	var b model.Ban
	now := time.Now()
	err := r.db.Where(
		"user_id = ? AND status = ? AND (ended_at IS NULL OR ended_at > ?)",
		userID, model.StatusEnabled, now,
	).Order("created_at DESC").First(&b).Error
	if err != nil {
		return nil, err
	}
	return &b, nil
}

// ---- 审计日志 ----

func (r *GovernanceRepo) CreateModerationLog(l *model.ModerationLog) error {
	return r.db.Create(l).Error
}
