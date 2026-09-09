package repository

import (
	"time"

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

// FindTagByName 按板块+名称查标签（即时创建去重用）。找不到返回 gorm.ErrRecordNotFound。
func (r *InfoRepo) FindTagByName(boardID, name string) (*model.Tag, error) {
	var t model.Tag
	err := r.db.Where("board_id = ? AND name = ? AND status = ?",
		boardID, name, model.StatusEnabled).First(&t).Error
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// HotTag 热门标签（含近 30 天已发布帖子用量）。
type HotTag struct {
	TagID     string `json:"tag_id"`
	Name      string `json:"name"`
	PostCount int64  `json:"post_count"`
}

// ListHotTags 统计板块内近 30 天已发布帖子的标签使用量，按用量降序取前 N。
func (r *InfoRepo) ListHotTags(boardID string, since time.Time, limit int) ([]HotTag, error) {
	list := make([]HotTag, 0)
	err := r.db.Raw(`
		SELECT t.id AS tag_id, t.name AS name, COUNT(pt.post_id) AS post_count
		FROM tags t
		JOIN post_tags pt ON pt.tag_id = t.id
		JOIN posts p ON p.id = pt.post_id
		WHERE t.board_id = ? AND t.status = ?
		  AND p.status = ? AND p.created_at >= ?
		GROUP BY t.id, t.name
		ORDER BY post_count DESC, t.sort ASC, t.name ASC
		LIMIT ?
	`, boardID, model.StatusEnabled, model.PostStatusPublished, since, limit).Scan(&list).Error
	return list, err
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
