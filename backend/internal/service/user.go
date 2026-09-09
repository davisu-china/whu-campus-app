package service

import (
	"context"
	"strings"

	"github.com/whu-campus/luojia-bbs/internal/cache"
	"github.com/whu-campus/luojia-bbs/internal/model"
	"github.com/whu-campus/luojia-bbs/internal/repository"
	"github.com/whu-campus/luojia-bbs/pkg/xerr"
	"gorm.io/gorm"
)

// UserService 用户资料。
type UserService struct {
	users *repository.UserRepo
	cache *cache.Client
}

func NewUserService(users *repository.UserRepo, c *cache.Client) *UserService {
	return &UserService{users: users, cache: c}
}

// UpdateMeInput 资料更新入参。
type UpdateMeInput struct {
	Nickname  string `json:"nickname"`
	AvatarURL string `json:"avatar_url"`
	StudentNo string `json:"student_no"`
	College   string `json:"college"`
	Grade     string `json:"grade"`
	Identity  string `json:"identity"`
	Degree    string `json:"degree"`
	Bio       string `json:"bio"`
}

// Me 我的完整资料。
func (s *UserService) Me(id string) (*model.User, error) {
	u, err := s.users.FindByID(id)
	if err != nil {
		return nil, xerr.New(xerr.CodeNotFound, "用户不存在")
	}
	return u, nil
}

// UpdateMe 更新资料。
func (s *UserService) UpdateMe(id string, in UpdateMeInput) (*model.User, error) {
	u, err := s.users.FindByID(id)
	if err != nil {
		return nil, xerr.New(xerr.CodeNotFound, "用户不存在")
	}

	fields := map[string]interface{}{}
	if in.Nickname != "" {
		if len([]rune(in.Nickname)) > 32 {
			return nil, xerr.New(xerr.CodeBadParam, "昵称最长 32 字")
		}
		fields["nickname"] = strings.TrimSpace(in.Nickname)
	}
	if in.AvatarURL != "" {
		fields["avatar_url"] = in.AvatarURL
	}
	if in.StudentNo != "" {
		fields["student_no"] = in.StudentNo
	}
	if in.College != "" {
		fields["college"] = in.College
	}
	if in.Grade != "" {
		fields["grade"] = in.Grade
	}
	if in.Identity != "" {
		fields["identity"] = in.Identity
	}
	if in.Degree != "" {
		fields["degree"] = in.Degree
	}
	if in.Bio != "" {
		if len([]rune(in.Bio)) > 200 {
			return nil, xerr.New(xerr.CodeBadParam, "签名最长 200 字")
		}
		fields["bio"] = in.Bio
	}

	if len(fields) > 0 {
		if err := s.users.Update(u, fields); err != nil {
			return nil, xerr.New(xerr.CodeDBError, "更新失败").Wrap(err)
		}
		// 失效用户缓存，使下一次鉴权回源 DB 读取最新资料。
		_ = s.cache.Del(context.Background(), cache.UserKey(id))
	}
	return s.users.FindByID(id)
}

// Profile 个人主页（公开视图）。
func (s *UserService) Profile(id string) (*model.UserPublic, error) {
	u, err := s.users.FindByID(id)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, xerr.New(xerr.CodeNotFound, "用户不存在")
		}
		return nil, xerr.New(xerr.CodeDBError, "查询用户失败").Wrap(err)
	}
	pub := u.ToPublic()
	return &pub, nil
}
