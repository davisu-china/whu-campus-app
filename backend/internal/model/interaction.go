package model

// Like 点赞（帖子/回复多态，唯一索引防重复）。
type Like struct {
	Base
	UserID     string `gorm:"type:uuid;uniqueIndex:uniq_like" json:"user_id"`
	TargetType string `gorm:"size:16;uniqueIndex:uniq_like" json:"target_type"` // post / reply
	TargetID   string `gorm:"type:uuid;uniqueIndex:uniq_like" json:"target_id"`
}

// Favorite 收藏。
type Favorite struct {
	Base
	UserID string `gorm:"type:uuid;uniqueIndex:uniq_fav" json:"user_id"`
	PostID string `gorm:"type:uuid;uniqueIndex:uniq_fav" json:"post_id"`
}

// BoardFollow 关注板块（P2）。
type BoardFollow struct {
	UserID  string `gorm:"type:uuid;primaryKey" json:"user_id"`
	BoardID string `gorm:"type:uuid;primaryKey" json:"board_id"`
}
