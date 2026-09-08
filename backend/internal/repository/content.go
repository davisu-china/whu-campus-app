package repository

import (
	"gorm.io/gorm"

	"github.com/whu-campus/luojia-bbs/internal/model"
)

// ContentRepo 内容（帖子/回复/附件/草稿）数据访问。
type ContentRepo struct {
	db *gorm.DB
}

func NewContentRepo(db *gorm.DB) *ContentRepo { return &ContentRepo{db: db} }

// PostListQuery 帖子列表查询条件。
type PostListQuery struct {
	BoardID  string
	TagID    string
	AuthorID string
	Status   *int   // nil=已发布
	Sort     string // comprehensive / latest / hot / featured
	Page     int
	PageSize int
}

func (r *ContentRepo) CreatePost(p *model.Post) error { return r.db.Create(p).Error }

// CreatePostWithDetails 事务内创建帖子及其标签/结构化字段/附件。
func (r *ContentRepo) CreatePostWithDetails(post *model.Post, tagIDs []string, fields []model.PostField, atts []model.Attachment) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(post).Error; err != nil {
			return err
		}
		if len(tagIDs) > 0 {
			rows := make([]model.PostTag, 0, len(tagIDs))
			for _, tid := range tagIDs {
				rows = append(rows, model.PostTag{PostID: post.ID, TagID: tid})
			}
			if err := tx.Create(&rows).Error; err != nil {
				return err
			}
		}
		if len(fields) > 0 {
			for i := range fields {
				fields[i].PostID = post.ID
			}
			if err := tx.Create(&fields).Error; err != nil {
				return err
			}
		}
		if len(atts) > 0 {
			for i := range atts {
				atts[i].OwnerID = post.ID
				atts[i].OwnerType = model.OwnerTypePost
			}
			if err := tx.Create(&atts).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

// CreateReplyWithFloor 事务内分配楼层号并创建回复，返回楼层号。
func (r *ContentRepo) CreateReplyWithFloor(postID string, reply *model.Reply) (int, error) {
	var floor int
	err := r.db.Transaction(func(tx *gorm.DB) error {
		if reply.ParentID == nil {
			var f int
			if err := tx.Raw(
				"UPDATE posts SET reply_count = reply_count + 1 WHERE id = ? RETURNING reply_count",
				postID,
			).Scan(&f).Error; err != nil {
				return err
			}
			reply.FloorNo = f
			floor = f
		}
		return tx.Create(reply).Error
	})
	return floor, err
}

func (r *ContentRepo) GetPost(id string) (*model.Post, error) {
	var p model.Post
	err := r.db.Preload("Tags").Preload("Fields").Preload("Author").Preload("Board").
		Where("id = ?", id).First(&p).Error
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *ContentRepo) UpdatePost(id string, fields map[string]interface{}) error {
	return r.db.Model(&model.Post{}).Where("id = ?", id).Updates(fields).Error
}

// ReplacePostDetails 事务内整体替换帖子的标签与附件（tagIDs/atts 为 nil 表示不改动对应项）。
func (r *ContentRepo) ReplacePostDetails(postID string, tagIDs []string, atts []model.Attachment) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if tagIDs != nil {
			if err := tx.Where("post_id = ?", postID).Delete(&model.PostTag{}).Error; err != nil {
				return err
			}
			if len(tagIDs) > 0 {
				rows := make([]model.PostTag, 0, len(tagIDs))
				for _, tid := range tagIDs {
					rows = append(rows, model.PostTag{PostID: postID, TagID: tid})
				}
				if err := tx.Create(&rows).Error; err != nil {
					return err
				}
			}
		}
		if atts != nil {
			if err := tx.Where("owner_type = ? AND owner_id = ?", model.OwnerTypePost, postID).Delete(&model.Attachment{}).Error; err != nil {
				return err
			}
			if len(atts) > 0 {
				for i := range atts {
					atts[i].OwnerID = postID
					atts[i].OwnerType = model.OwnerTypePost
				}
				if err := tx.Create(&atts).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})
}

func (r *ContentRepo) ListPosts(q PostListQuery) ([]model.Post, int64, error) {
	query := r.db.Model(&model.Post{})

	if q.BoardID != "" {
		query = query.Where("board_id = ?", q.BoardID)
	}
	if q.AuthorID != "" {
		query = query.Where("author_id = ?", q.AuthorID)
	}
	if q.Status != nil {
		query = query.Where("status = ?", *q.Status)
	} else {
		query = query.Where("status = ?", model.PostStatusPublished)
	}
	if q.TagID != "" {
		query = query.Where("EXISTS (SELECT 1 FROM post_tags WHERE post_tags.post_id = posts.id AND post_tags.tag_id = ?)", q.TagID)
	}

	// 精华筛选
	if q.Sort == "featured" {
		query = query.Where("is_featured = ?", true)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 排序：置顶优先，其次按所选维度。
	order := "is_pinned DESC, hot_score DESC"
	switch q.Sort {
	case "latest":
		order = "is_pinned DESC, created_at DESC"
	case "hot":
		order = "is_pinned DESC, reply_count DESC"
	case "featured":
		order = "is_pinned DESC, hot_score DESC"
	}

	var list []model.Post
	err := query.Preload("Tags").Preload("Author").Preload("Board").
		Order(order).
		Offset((q.Page - 1) * q.PageSize).Limit(q.PageSize).
		Find(&list).Error
	return list, total, err
}

// SearchPosts 关键词模糊搜索（pg_trgm + ILIKE）。
func (r *ContentRepo) SearchPosts(keyword, boardID, tagID string, page, pageSize int) ([]model.Post, int64, error) {
	like := "%" + keyword + "%"
	query := r.db.Model(&model.Post{}).
		Where("status = ?", model.PostStatusPublished).
		Where("title ILIKE ? OR content ILIKE ?", like, like)

	if boardID != "" {
		query = query.Where("board_id = ?", boardID)
	}
	if tagID != "" {
		query = query.Where("EXISTS (SELECT 1 FROM post_tags WHERE post_tags.post_id = posts.id AND post_tags.tag_id = ?)", tagID)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var list []model.Post
	err := query.Preload("Tags").Preload("Author").Preload("Board").
		Order("is_pinned DESC, hot_score DESC").
		Offset((page - 1) * pageSize).Limit(pageSize).Find(&list).Error
	return list, total, err
}

// ListFeatured 首页精选流：精华帖按热度。
func (r *ContentRepo) ListFeatured(page, pageSize int) ([]model.Post, int64, error) {
	query := r.db.Model(&model.Post{}).
		Where("status = ? AND is_featured = ?", model.PostStatusPublished, true)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var list []model.Post
	err := query.Preload("Tags").Preload("Author").Preload("Board").
		Order("hot_score DESC").
		Offset((page - 1) * pageSize).Limit(pageSize).Find(&list).Error
	return list, total, err
}

// ListHot 全站热门：按回复数。
func (r *ContentRepo) ListHot(limit int) ([]model.Post, error) {
	var list []model.Post
	err := r.db.Model(&model.Post{}).
		Where("status = ?", model.PostStatusPublished).
		Preload("Author").Preload("Board").
		Order("reply_count DESC, hot_score DESC").
		Limit(limit).Find(&list).Error
	return list, err
}

// ListPending 待审核队列（运营后台）。
func (r *ContentRepo) ListPending(page, pageSize int) ([]model.Post, int64, error) {
	status := model.PostStatusPending
	return r.listByStatus(&status, page, pageSize)
}

// ListByStatus 按状态列表（运营后台，status 可空=全部）。
func (r *ContentRepo) ListByStatus(status *int, page, pageSize int) ([]model.Post, int64, error) {
	return r.listByStatus(status, page, pageSize)
}

func (r *ContentRepo) listByStatus(status *int, page, pageSize int) ([]model.Post, int64, error) {
	query := r.db.Model(&model.Post{})
	if status != nil {
		query = query.Where("status = ?", *status)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var list []model.Post
	err := query.Preload("Tags").Preload("Author").Preload("Board").
		Order("created_at DESC").
		Offset((page - 1) * pageSize).Limit(pageSize).Find(&list).Error
	return list, total, err
}

// ---- 运营统计 ----

// CountPosts 帖子总数（status 可空）。
func (r *ContentRepo) CountPosts(status *int) (int64, error) {
	q := r.db.Model(&model.Post{})
	if status != nil {
		q = q.Where("status = ?", *status)
	}
	var n int64
	err := q.Count(&n).Error
	return n, err
}

// CountReplies 回复总数。
func (r *ContentRepo) CountReplies() (int64, error) {
	var n int64
	err := r.db.Model(&model.Reply{}).Count(&n).Error
	return n, err
}

// CountTodayPosts 今日发帖数。
func (r *ContentRepo) CountTodayPosts() (int64, error) {
	var n int64
	err := r.db.Model(&model.Post{}).
		Where("created_at >= date_trunc('day', now())").Count(&n).Error
	return n, err
}

// ---- 楼层与计数 ----

// AllocateFloor 原子分配楼层号：自增 reply_count 并返回新值（RETURNING）。
func (r *ContentRepo) AllocateFloor(postID string) (int, error) {
	var floor int
	err := r.db.Raw(
		"UPDATE posts SET reply_count = reply_count + 1 WHERE id = ? RETURNING reply_count",
		postID,
	).Scan(&floor).Error
	return floor, err
}

// IncrementView 浏览计数 +delta。
func (r *ContentRepo) IncrementView(postID string, delta int64) error {
	return r.db.Model(&model.Post{}).Where("id = ?", postID).
		UpdateColumn("view_count", gorm.Expr("view_count + ?", delta)).Error
}

// IncrementLike 帖子点赞计数 +delta。
func (r *ContentRepo) IncrementLike(postID string, delta int) error {
	return r.db.Model(&model.Post{}).Where("id = ?", postID).
		UpdateColumn("like_count", gorm.Expr("like_count + ?", delta)).Error
}

// IncrementReplyLike 回复点赞计数 +delta。
func (r *ContentRepo) IncrementReplyLike(replyID string, delta int) error {
	return r.db.Model(&model.Reply{}).Where("id = ?", replyID).
		UpdateColumn("like_count", gorm.Expr("like_count + ?", delta)).Error
}

// UpdateHotScore 更新综合排序分。
func (r *ContentRepo) UpdateHotScore(postID string, score float64) error {
	return r.db.Model(&model.Post{}).Where("id = ?", postID).
		UpdateColumn("hot_score", score).Error
}

// ListForRank 拉取全部已发布帖子用于热榜重算。
func (r *ContentRepo) ListForRank() ([]model.Post, error) {
	var list []model.Post
	err := r.db.Where("status = ?", model.PostStatusPublished).
		Select("id, board_id, reply_count, like_count, view_count, created_at").
		Find(&list).Error
	return list, err
}

// ---- 标签与结构化字段 ----

func (r *ContentRepo) CreatePostTags(postID string, tagIDs []string) error {
	if len(tagIDs) == 0 {
		return nil
	}
	rows := make([]model.PostTag, 0, len(tagIDs))
	for _, tid := range tagIDs {
		rows = append(rows, model.PostTag{PostID: postID, TagID: tid})
	}
	return r.db.Create(&rows).Error
}

func (r *ContentRepo) CreatePostFields(postID string, fields []model.PostField) error {
	if len(fields) == 0 {
		return nil
	}
	for i := range fields {
		fields[i].PostID = postID
	}
	return r.db.Create(&fields).Error
}

func (r *ContentRepo) ListPostFields(postID string) ([]model.PostField, error) {
	var list []model.PostField
	err := r.db.Where("post_id = ?", postID).Find(&list).Error
	return list, err
}

// ---- 回复 ----

func (r *ContentRepo) CreateReply(reply *model.Reply) error { return r.db.Create(reply).Error }

func (r *ContentRepo) GetReply(id string) (*model.Reply, error) {
	var reply model.Reply
	err := r.db.Preload("Author").Where("id = ?", id).First(&reply).Error
	if err != nil {
		return nil, err
	}
	return &reply, nil
}

// ListReplies 帖子全部有效回复（按楼层与时间排序，MVP 不分页）。
func (r *ContentRepo) ListReplies(postID string) ([]model.Reply, error) {
	var list []model.Reply
	err := r.db.Preload("Author").
		Where("post_id = ? AND status = ?", postID, model.ReplyStatusNormal).
		Order("floor_no ASC, created_at ASC").Find(&list).Error
	return list, err
}

func (r *ContentRepo) UpdateReply(id string, fields map[string]interface{}) error {
	return r.db.Model(&model.Reply{}).Where("id = ?", id).Updates(fields).Error
}

// ---- 个人中心 ----

// ListMyPosts 我的帖子（不含已删除）。
func (r *ContentRepo) ListMyPosts(authorID string, page, pageSize int) ([]model.Post, int64, error) {
	query := r.db.Model(&model.Post{}).
		Where("author_id = ? AND status <> ?", authorID, model.PostStatusDeleted)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var list []model.Post
	err := query.Preload("Tags").Preload("Author").Preload("Board").
		Order("created_at DESC").
		Offset((page - 1) * pageSize).Limit(pageSize).Find(&list).Error
	return list, total, err
}

// ListMyReplies 我的回复。
func (r *ContentRepo) ListMyReplies(authorID string, page, pageSize int) ([]model.Reply, int64, error) {
	query := r.db.Model(&model.Reply{}).
		Where("author_id = ? AND status = ?", authorID, model.ReplyStatusNormal)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var list []model.Reply
	err := query.Preload("Post").
		Order("created_at DESC").
		Offset((page - 1) * pageSize).Limit(pageSize).Find(&list).Error
	return list, total, err
}

// ---- 附件 ----

func (r *ContentRepo) CreateAttachments(atts []model.Attachment) error {
	if len(atts) == 0 {
		return nil
	}
	return r.db.Create(&atts).Error
}

func (r *ContentRepo) ListAttachments(ownerType, ownerID string) ([]model.Attachment, error) {
	var list []model.Attachment
	err := r.db.Where("owner_type = ? AND owner_id = ?", ownerType, ownerID).
		Order("sort ASC").Find(&list).Error
	return list, err
}
