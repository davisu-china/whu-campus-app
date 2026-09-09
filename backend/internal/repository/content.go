package repository

import (
	"time"

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

// CreateReplyWithFloor 事务内创建回复：自增总回复数并（顶层）分配楼层号。
//
// 楼层号按「当前顶层楼层数 + 1」计算。先 UPDATE 自增 reply_count 会对帖子行加锁，
// 从而串行化同一帖子的并发回复，保证楼层号不重不漏。
func (r *ContentRepo) CreateReplyWithFloor(postID string, reply *model.Reply) (int, error) {
	var floor int
	err := r.db.Transaction(func(tx *gorm.DB) error {
		// 每条回复（顶层 + 楼中楼）都计入总回复数；UPDATE 同时锁定帖子行。
		if err := tx.Model(&model.Post{}).Where("id = ?", postID).
			UpdateColumn("reply_count", gorm.Expr("reply_count + 1")).Error; err != nil {
			return err
		}
		if reply.ParentID == nil {
			var cnt int64
			if err := tx.Model(&model.Reply{}).
				Where("post_id = ? AND parent_id IS NULL", postID).
				Count(&cnt).Error; err != nil {
				return err
			}
			reply.FloorNo = int(cnt) + 1
			floor = reply.FloorNo
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

// ListHot 全站热门：按综合热度分（评论/点赞/收藏 + 时间衰减）。
func (r *ContentRepo) ListHot(limit int) ([]model.Post, error) {
	var list []model.Post
	err := r.db.Model(&model.Post{}).
		Where("status = ?", model.PostStatusPublished).
		Preload("Author").Preload("Board").
		Order("hot_score DESC, reply_count DESC").
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

// rankRow 热榜重算所需的帖子计数字段（收藏数实时子查询，避免冗余列漂移）。
type rankRow struct {
	ID            string
	BoardID       string
	ReplyCount    int
	LikeCount     int
	FavoriteCount int
	CreatedAt     time.Time
}

// ListForRank 拉取全部已发布帖子用于热榜重算（含实时收藏数）。
func (r *ContentRepo) ListForRank() ([]rankRow, error) {
	var list []rankRow
	err := r.db.Model(&model.Post{}).
		Select(`posts.id, posts.board_id, posts.reply_count, posts.like_count, posts.created_at,
			(SELECT count(*) FROM favorites WHERE favorites.post_id = posts.id) AS favorite_count`).
		Where("posts.status = ?", model.PostStatusPublished).
		Scan(&list).Error
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

// CountFloors 帖子顶层楼层数（不含楼中楼）。
func (r *ContentRepo) CountFloors(postID string) (int64, error) {
	var n int64
	err := r.db.Model(&model.Reply{}).
		Where("post_id = ? AND status = ? AND parent_id IS NULL", postID, model.ReplyStatusNormal).
		Count(&n).Error
	return n, err
}

// ListFloors 分页列出顶层楼层（parent_id 为空），按楼层号正序。
func (r *ContentRepo) ListFloors(postID string, page, pageSize int) ([]model.Reply, error) {
	var list []model.Reply
	err := r.db.Preload("Author").
		Where("post_id = ? AND status = ? AND parent_id IS NULL", postID, model.ReplyStatusNormal).
		Order("floor_no ASC").
		Offset((page - 1) * pageSize).Limit(pageSize).
		Find(&list).Error
	return list, err
}

// CountSubReplies 各楼层楼中楼数量（parent_id 非空），返回 floor_no -> count。
func (r *ContentRepo) CountSubReplies(postID string, floorNos []int) (map[int]int64, error) {
	if len(floorNos) == 0 {
		return map[int]int64{}, nil
	}
	type row struct {
		FloorNo int   `gorm:"column:floor_no"`
		Cnt     int64 `gorm:"column:cnt"`
	}
	var rows []row
	err := r.db.Model(&model.Reply{}).
		Select("floor_no, count(*) AS cnt").
		Where("post_id = ? AND status = ? AND parent_id IS NOT NULL AND floor_no IN ?",
			postID, model.ReplyStatusNormal, floorNos).
		Group("floor_no").Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	m := make(map[int]int64, len(rows))
	for _, r := range rows {
		m[r.FloorNo] = r.Cnt
	}
	return m, nil
}

// ListSubReplies 列出指定楼层下的全部楼中楼（按时间正序）。
func (r *ContentRepo) ListSubReplies(postID string, floorNos []int) ([]model.Reply, error) {
	if len(floorNos) == 0 {
		return []model.Reply{}, nil
	}
	var list []model.Reply
	err := r.db.Preload("Author").
		Where("post_id = ? AND status = ? AND parent_id IS NOT NULL AND floor_no IN ?",
			postID, model.ReplyStatusNormal, floorNos).
		Order("created_at ASC").Find(&list).Error
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
