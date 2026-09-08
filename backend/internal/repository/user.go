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
		like := "%" + q + "%"
		query = query.Where("nickname ILIKE ? OR email ILIKE ? OR student_no ILIKE ?", like, like, like)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.Order("created_at DESC").
		Offset((page - 1) * pageSize).Limit(pageSize).Find(&list).Error
	return list, total, err
}
