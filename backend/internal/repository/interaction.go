package repository

import (
	"gorm.io/gorm"

	"github.com/whu-campus/luojia-bbs/internal/model"
)

// InteractionRepo 互动（点赞/收藏/关注/举报）数据访问。
type InteractionRepo struct {
	db *gorm.DB
}

func NewInteractionRepo(db *gorm.DB) *InteractionRepo { return &InteractionRepo{db: db} }

// ---- 点赞 ----

func (r *InteractionRepo) HasLike(userID, targetType, targetID string) (bool, error) {
	var count int64
	err := r.db.Model(&model.Like{}).
		Where("user_id = ? AND target_type = ? AND target_id = ?", userID, targetType, targetID).
		Count(&count).Error
	return count > 0, err
}

func (r *InteractionRepo) CreateLike(l *model.Like) error { return r.db.Create(l).Error }

func (r *InteractionRepo) DeleteLike(userID, targetType, targetID string) error {
	return r.db.Where("user_id = ? AND target_type = ? AND target_id = ?", userID, targetType, targetID).
		Delete(&model.Like{}).Error
}

// ---- 收藏 ----

func (r *InteractionRepo) HasFavorite(userID, postID string) (bool, error) {
	var count int64
	err := r.db.Model(&model.Favorite{}).
		Where("user_id = ? AND post_id = ?", userID, postID).Count(&count).Error
	return count > 0, err
}

func (r *InteractionRepo) CreateFavorite(f *model.Favorite) error { return r.db.Create(f).Error }

func (r *InteractionRepo) DeleteFavorite(userID, postID string) error {
	return r.db.Where("user_id = ? AND post_id = ?", userID, postID).
		Delete(&model.Favorite{}).Error
}

// ListFavorites 我的收藏（分页，返回帖子）。
func (r *InteractionRepo) ListFavorites(userID string, page, pageSize int) ([]model.Post, int64, error) {
	var total int64
	query := r.db.Model(&model.Favorite{}).Where("user_id = ?", userID)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var favs []model.Favorite
	err := query.Order("created_at DESC").
		Offset((page - 1) * pageSize).Limit(pageSize).Find(&favs).Error
	if err != nil {
		return nil, 0, err
	}
	if len(favs) == 0 {
		return []model.Post{}, total, nil
	}

	ids := make([]string, 0, len(favs))
	for _, f := range favs {
		ids = append(ids, f.PostID)
	}
	var posts []model.Post
	err = r.db.Preload("Tags").Preload("Author").Preload("Board").
		Where("id IN ?", ids).Find(&posts).Error
	if err != nil {
		return nil, 0, err
	}
	return posts, total, nil
}

// ---- 关注板块 ----

func (r *InteractionRepo) FollowBoard(userID, boardID string) error {
	return r.db.Create(&model.BoardFollow{UserID: userID, BoardID: boardID}).Error
}

func (r *InteractionRepo) UnfollowBoard(userID, boardID string) error {
	return r.db.Where("user_id = ? AND board_id = ?", userID, boardID).
		Delete(&model.BoardFollow{}).Error
}

// ---- 举报 ----

func (r *InteractionRepo) CreateReport(report *model.Report) error {
	return r.db.Create(report).Error
}
