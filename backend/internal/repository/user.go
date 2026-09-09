package repository

import (
	"gorm.io/gorm"

	"github.com/whu-campus/luojia-bbs/internal/model"
)

// UserRepo 用户数据访问。
type UserRepo struct {
	db *gorm.DB
}

func NewUserRepo(db *gorm.DB) *UserRepo { return &UserRepo{db: db} }

func (r *UserRepo) FindByEmail(email string) (*model.User, error) {
	var u model.User
	err := r.db.Where("email = ?", email).First(&u).Error
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *UserRepo) FindByID(id string) (*model.User, error) {
	var u model.User
	err := r.db.Where("id = ?", id).First(&u).Error
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *UserRepo) Create(u *model.User) error { return r.db.Create(u).Error }

func (r *UserRepo) Update(u *model.User, fields map[string]interface{}) error {
	return r.db.Model(u).Updates(fields).Error
}

// FindByCasSubject 按武大统一身份（学号/工号）查找用户。
func (r *UserRepo) FindByCasSubject(sub string) (*model.User, error) {
	var u model.User
	err := r.db.Where(&model.User{CasSubject: &sub}).First(&u).Error
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// FindByOpenID 按微信 openid 查找用户。
func (r *UserRepo) FindByOpenID(openid string) (*model.User, error) {
	var u model.User
	err := r.db.Where(&model.User{WechatOpenID: &openid}).First(&u).Error
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// Delete 硬删除用户（微信临时号合并用）。
func (r *UserRepo) Delete(id string) error {
	return r.db.Delete(&model.User{}, "id = ?", id).Error
}

// HasContent 判断用户是否已产生任何实质内容（合并前检查临时号是否「干净」）。
func (r *UserRepo) HasContent(userID string) (bool, error) {
	type check struct {
		model interface{}
		query string
		args  []interface{}
	}
	checks := []check{
		{&model.Post{}, "author_id = ?", []interface{}{userID}},
		{&model.Reply{}, "author_id = ?", []interface{}{userID}},
		{&model.Favorite{}, "user_id = ?", []interface{}{userID}},
		{&model.Like{}, "user_id = ?", []interface{}{userID}},
		{&model.Message{}, "sender_id = ? OR recipient_id = ?", []interface{}{userID, userID}},
		{&model.Conversation{}, "user_a = ? OR user_b = ?", []interface{}{userID, userID}},
	}
	for _, c := range checks {
		var n int64
		if err := r.db.Model(c.model).Where(c.query, c.args...).Count(&n).Error; err != nil {
			return false, err
		}
		if n > 0 {
			return true, nil
		}
	}
	return false, nil
}

// Count 用户总数。
func (r *UserRepo) Count() (int64, error) {
	var n int64
	err := r.db.Model(&model.User{}).Count(&n).Error
	return n, err
}

// List 运营后台用户分页查询。
func (r *UserRepo) List(page, pageSize int, q string) ([]model.User, int64, error) {
	var list []model.User
	var total int64
	query := r.db.Model(&model.User{})
	if q != "" {
		like := containsLike(q)
		query = query.Where("nickname ILIKE ? OR email ILIKE ? OR student_no ILIKE ?", like, like, like)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.Order("created_at DESC").
		Offset((page - 1) * pageSize).Limit(pageSize).Find(&list).Error
	return list, total, err
}
