package model

// User 用户。武大邮箱为 MVP 唯一登录标识，认证即邮箱域校验通过。
type User struct {
	Base
	Nickname     string `gorm:"size:32" json:"nickname"`
	AvatarURL    string `gorm:"type:text" json:"avatar_url"`
	Email        string `gorm:"size:128;uniqueIndex" json:"email"`
	Phone        string `gorm:"size:20;uniqueIndex" json:"-"`     // 预留
	WechatOpenID string `gorm:"size:64;uniqueIndex" json:"-"`     // 预留
	PasswordHash string `gorm:"size:255" json:"-"`                // 预留
	IsVerified   bool   `gorm:"default:false" json:"is_verified"` // 武大认证标记
	StudentNo    string `gorm:"size:32;uniqueIndex" json:"student_no"`
	College      string `gorm:"size:64" json:"college"`
	Grade        string `gorm:"size:16" json:"grade"`
	Bio          string `gorm:"size:200" json:"bio"`
	Role         int    `gorm:"type:smallint;default:1" json:"role"`
	Status       int    `gorm:"type:smallint;default:0" json:"status"`
}

// UserPublic 对外展示的用户信息（不含邮箱/手机号等敏感字段）。
type UserPublic struct {
	ID         string `json:"id"`
	Nickname   string `json:"nickname"`
	AvatarURL  string `json:"avatar_url"`
	IsVerified bool   `json:"is_verified"`
	College    string `json:"college"`
	Grade      string `json:"grade"`
	Bio        string `json:"bio"`
	Role       int    `json:"role"`
}

// ToPublic 生成对外用户视图。
func (u *User) ToPublic() UserPublic {
	return UserPublic{
		ID:         u.ID,
		Nickname:   u.Nickname,
		AvatarURL:  u.AvatarURL,
		IsVerified: u.IsVerified,
		College:    u.College,
		Grade:      u.Grade,
		Bio:        u.Bio,
		Role:       u.Role,
	}
}
