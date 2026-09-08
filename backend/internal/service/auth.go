package service

import (
	"context"
	"errors"
	"strings"

	"gorm.io/gorm"

	"github.com/whu-campus/luojia-bbs/internal/auth"
	"github.com/whu-campus/luojia-bbs/internal/model"
	"github.com/whu-campus/luojia-bbs/internal/repository"
	"github.com/whu-campus/luojia-bbs/pkg/xerr"
)

// AuthService 认证：邮箱验证码登录、令牌刷新。
type AuthService struct {
	users  *repository.UserRepo
	tokens *auth.TokenManager
	email  *auth.EmailVerifier
}

func NewAuthService(users *repository.UserRepo, tokens *auth.TokenManager, email *auth.EmailVerifier) *AuthService {
	return &AuthService{users: users, tokens: tokens, email: email}
}

// SendCode 发送邮箱验证码。
func (s *AuthService) SendCode(ctx context.Context, email string) error {
	email = strings.TrimSpace(strings.ToLower(email))
	if !s.email.AllowedDomain(email) {
		return xerr.New(xerr.CodeEmailDomainInvalid, "仅支持武汉大学邮箱（@whu.edu.cn）登录")
	}
	return s.email.SendCode(ctx, email)
}

// Login 邮箱验证码登录：校验验证码，找/建用户，签发令牌。
func (s *AuthService) Login(ctx context.Context, email, code string) (*auth.TokenPair, *model.User, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	if !s.email.AllowedDomain(email) {
		return nil, nil, xerr.New(xerr.CodeEmailDomainInvalid, "仅支持武汉大学邮箱（@whu.edu.cn）登录")
	}
	if err := s.email.Verify(ctx, email, code); err != nil {
		return nil, nil, err
	}

	user, err := s.users.FindByEmail(email)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil, xerr.New(xerr.CodeDBError, "查询用户失败").Wrap(err)
	}

	// 新用户：以邮箱前缀作为默认昵称；邮箱登录即武大认证。
	if user == nil {
		user = &model.User{
			Email:      email,
			Nickname:   defaultNickname(email),
			IsVerified: true,
			Role:       model.RoleNormal,
			Status:     model.UserStatusNormal,
		}
		if err := s.users.Create(user); err != nil {
			return nil, nil, xerr.New(xerr.CodeDBError, "创建用户失败").Wrap(err)
		}
	} else {
		if user.Status == model.UserStatusBanned {
			return nil, nil, xerr.New(xerr.CodeUserBanned, "账号已被封禁")
		}
		// 补认证标记（历史账号未认证场景）
		if !user.IsVerified {
			_ = s.users.Update(user, map[string]interface{}{"is_verified": true})
			user.IsVerified = true
		}
	}

	pair, err := s.tokens.GeneratePair(user.ID, user.Role)
	if err != nil {
		return nil, nil, xerr.New(xerr.CodeInternal, "签发令牌失败").Wrap(err)
	}
	return pair, user, nil
}

// Refresh 刷新令牌。
func (s *AuthService) Refresh(refreshToken string) (*auth.TokenPair, error) {
	claims, err := s.tokens.ParseRefresh(refreshToken)
	if err != nil {
		return nil, xerr.New(xerr.CodeTokenExpired, "刷新令牌无效或已过期")
	}
	user, err := s.users.FindByID(claims.UserID)
	if err != nil {
		return nil, xerr.New(xerr.CodeUnauthorized, "用户不存在")
	}
	if user.Status == model.UserStatusBanned {
		return nil, xerr.New(xerr.CodeUserBanned, "账号已被封禁")
	}
	return s.tokens.GeneratePair(user.ID, user.Role)
}

func defaultNickname(email string) string {
	local := email
	if i := strings.Index(email, "@"); i >= 0 {
		local = email[:i]
	}
	if len(local) > 20 {
		local = local[:20]
	}
	return "whu_" + local
}
