package service

import (
	"time"

	"github.com/whu-campus/luojia-bbs/internal/model"
)

// AnonymousName 匿名展示名。
const AnonymousName = "匿名"

// ImageRef 图片引用：object_key + 公开 URL。
type ImageRef struct {
	ObjectKey string `json:"object_key"`
	URL       string `json:"url"`
}

// PostView 帖子对外视图（已做匿名脱敏与互动状态注入）。
type PostView struct {
	ID          string             `json:"id"`
	BoardID     string             `json:"board_id"`
	BoardName   string             `json:"board_name,omitempty"`
	AuthorID    string             `json:"author_id,omitempty"`
	Author      *model.UserPublic  `json:"author,omitempty"`
	IsMine      bool               `json:"is_mine"`
	Title       string             `json:"title"`
	Content     string             `json:"content"`
	Status      int                `json:"status"`
	IsAnonymous bool               `json:"is_anonymous"`
	IsPinned    bool               `json:"is_pinned"`
	IsFeatured  bool               `json:"is_featured"`
	ViewCount   int64              `json:"view_count"`
	ReplyCount  int                `json:"reply_count"`
	LikeCount   int                `json:"like_count"`
	CreatedAt   time.Time          `json:"created_at"`
	UpdatedAt   time.Time          `json:"updated_at"`
	Tags        []model.Tag        `json:"tags,omitempty"`
	Fields      []model.PostField  `json:"fields,omitempty"`
	Images      []ImageRef         `json:"images,omitempty"`
	Liked       bool               `json:"liked"`
	Favorited   bool               `json:"favorited"`
}

// ReplyView 回复/楼层对外视图。
type ReplyView struct {
	ID          string            `json:"id"`
	PostID      string            `json:"post_id"`
	AuthorID    string            `json:"author_id,omitempty"`
	Author      *model.UserPublic `json:"author,omitempty"`
	ParentID    string            `json:"parent_id,omitempty"`
	ReplyToID   string            `json:"reply_to_id,omitempty"`
	FloorNo     int               `json:"floor_no"`
	Content     string            `json:"content"`
	IsAnonymous bool              `json:"is_anonymous"`
	LikeCount   int               `json:"like_count"`
	CreatedAt   time.Time         `json:"created_at"`
	Liked       bool              `json:"liked"`
	Children    []ReplyView       `json:"children,omitempty"`
}

// CategoryWithBoards 分类+板块树。
type CategoryWithBoards struct {
	model.Category
	Boards []model.Board `json:"boards"`
}

// authorView 帖子/回复作者脱敏。
func authorView(isAnonymous bool, u *model.User) (string, *model.UserPublic) {
	if isAnonymous || u == nil {
		return "", &model.UserPublic{Nickname: AnonymousName}
	}
	return u.ID, ptrPublic(u.ToPublic())
}

func ptrPublic(p model.UserPublic) *model.UserPublic { return &p }
