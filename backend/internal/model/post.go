package model

import "time"

// Post 帖子。
type Post struct {
	Base
	BoardID     string     `gorm:"type:uuid;index:idx_board_status_created" json:"board_id"`
	AuthorID    string     `gorm:"type:uuid;index" json:"author_id"`
	Title       string     `gorm:"size:120" json:"title"`
	Content     string     `gorm:"type:text" json:"content"`
	Status      int        `gorm:"type:smallint;default:0;index:idx_board_status_created" json:"status"`
	IsAnonymous bool       `gorm:"default:false" json:"is_anonymous"`
	IsPinned    bool       `gorm:"default:false" json:"is_pinned"`
	IsFeatured  bool       `gorm:"default:false" json:"is_featured"`
	ViewCount   int64      `gorm:"default:0" json:"view_count"`
	ReplyCount  int        `gorm:"default:0" json:"reply_count"`
	LikeCount   int        `gorm:"default:0" json:"like_count"`
	HotScore    float64    `gorm:"type:numeric(20,6);default:0;index" json:"hot_score"`
	PinnedAt    *time.Time `json:"pinned_at,omitempty"`
	FeaturedAt  *time.Time `json:"featured_at,omitempty"`
	CreatedAt   time.Time  `gorm:"index:idx_board_status_created,sort:desc" json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`

	// 关联（查询时预加载）
	Author *User       `gorm:"foreignKey:AuthorID" json:"author,omitempty"`
	Board  *Board      `gorm:"foreignKey:BoardID" json:"board,omitempty"`
	Tags   []Tag       `gorm:"many2many:post_tags;" json:"tags,omitempty"`
	Fields []PostField `gorm:"foreignKey:PostID" json:"fields,omitempty"`
}

// PostTag 帖子-标签关联。
type PostTag struct {
	PostID string `gorm:"type:uuid;primaryKey" json:"post_id"`
	TagID  string `gorm:"type:uuid;primaryKey" json:"tag_id"`
}

// PostField 结构化字段（课程评价/竞赛组队）。
type PostField struct {
	PostID     string `gorm:"type:uuid;index" json:"post_id"`
	FieldKey   string `gorm:"size:16" json:"field_key"` // course/teacher/college/contest
	DictItemID string `gorm:"type:uuid;index" json:"dict_item_id"`
	RawValue   string `gorm:"size:128" json:"raw_value"`
}

// Reply 回复/楼层。
type Reply struct {
	Base
	PostID      string    `gorm:"type:uuid;index:idx_post_floor" json:"post_id"`
	AuthorID    string    `gorm:"type:uuid;index" json:"author_id"`
	ParentID    *string   `gorm:"type:uuid" json:"parent_id"`   // 楼中楼：父回复 ID（顶层为 nil → NULL）
	ReplyToID   *string   `gorm:"type:uuid" json:"reply_to_id"` // 被回复回复 ID（@ 对象，顶层为 nil）
	FloorNo     int       `gorm:"index:idx_post_floor" json:"floor_no"`
	Content     string    `gorm:"type:text" json:"content"`
	IsAnonymous bool      `gorm:"default:false" json:"is_anonymous"`
	Status      int       `gorm:"type:smallint;default:0" json:"status"`
	LikeCount   int       `gorm:"default:0" json:"like_count"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	Author *User `gorm:"foreignKey:AuthorID" json:"author,omitempty"`
	Post   *Post `gorm:"foreignKey:PostID" json:"post,omitempty"`
}

// Attachment 图片附件。
type Attachment struct {
	Base
	OwnerType string `gorm:"size:16" json:"owner_type"` // post / reply
	OwnerID   string `gorm:"type:uuid;index" json:"owner_id"`
	ObjectKey string `gorm:"type:text" json:"object_key"`
	Sort      int    `gorm:"default:0" json:"sort"`
}

// Draft 草稿（P2）。
type Draft struct {
	Base
	UserID  string `gorm:"type:uuid;index" json:"user_id"`
	BoardID string `gorm:"type:uuid" json:"board_id"`
	Title   string `gorm:"size:120" json:"title"`
	Content string `gorm:"type:text" json:"content"`
}
