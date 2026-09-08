package repository

import (
	"gorm.io/gorm"

	"github.com/whu-campus/luojia-bbs/internal/model"
)

// InfoRepo 信息架构（分类/板块/标签/词典）数据访问。
type InfoRepo struct {
	db *gorm.DB
}

func NewInfoRepo(db *gorm.DB) *InfoRepo { return &InfoRepo{db: db} }

func (r *InfoRepo) ListCategories() ([]model.Category, error) {
	var list []model.Category
	err := r.db.Where("status = ?", model.StatusEnabled).
		Order("sort ASC").Find(&list).Error
	return list, err
}

func (r *InfoRepo) ListBoards() ([]model.Board, error) {
	var list []model.Board
	err := r.db.Where("status = ?", model.StatusEnabled).
		Order("sort ASC").Find(&list).Error
	return list, err
}

func (r *InfoRepo) GetBoard(id string) (*model.Board, error) {
	var b model.Board
	err := r.db.Where("id = ?", id).First(&b).Error
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func (r *InfoRepo) ListTags(boardID string) ([]model.Tag, error) {
	var list []model.Tag
	err := r.db.Where("board_id = ? AND status = ?", boardID, model.StatusEnabled).
		Order("sort ASC").Find(&list).Error
	return list, err
}

func (r *InfoRepo) GetTag(id string) (*model.Tag, error) {
	var t model.Tag
	err := r.db.Where("id = ?", id).First(&t).Error
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// SearchDict 词典搜索补全：前缀 ILIKE，返回 top N。
func (r *InfoRepo) SearchDict(dictType, q string, limit int) ([]model.DictItem, error) {
	var list []model.DictItem
	err := r.db.Where("dict_type = ? AND status = ? AND name ILIKE ?",
		dictType, model.StatusEnabled, q+"%").
		Order("name ASC").Limit(limit).Find(&list).Error
	return list, err
}

func (r *InfoRepo) ListDicts(dictType string) ([]model.DictItem, error) {
	var list []model.DictItem
	query := r.db.Model(&model.DictItem{})
	if dictType != "" {
		query = query.Where("dict_type = ?", dictType)
	}
	err := query.Order("dict_type ASC, name ASC").Find(&list).Error
	return list, err
}

func (r *InfoRepo) CreateDict(d *model.DictItem) error { return r.db.Create(d).Error }

func (r *InfoRepo) DeleteDict(id string) error {
	return r.db.Where("id = ?", id).Delete(&model.DictItem{}).Error
}

// CreateBoard 新建板块。
func (r *InfoRepo) CreateBoard(b *model.Board) error { return r.db.Create(b).Error }

// CreateTag 新建标签。
func (r *InfoRepo) CreateTag(t *model.Tag) error { return r.db.Create(t).Error }

// GetBoardBySlug 按 slug 查板块（种子数据去重用）。
func (r *InfoRepo) GetBoardBySlug(slug string) (*model.Board, error) {
	var b model.Board
	err := r.db.Where("slug = ?", slug).First(&b).Error
	if err != nil {
		return nil, err
	}
	return &b, nil
}
