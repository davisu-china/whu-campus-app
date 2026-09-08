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

const (
	minPasswordLen = 8  // 密码最短长度
	maxPasswordLen = 72 // bcrypt 单次可处理上限（字节）
)

// AuthService 认证：注册、密码登录、找回密码、令牌刷新。
type AuthService struct {
	users  *repository.UserRepo
	tokens *auth.TokenManager
	email  *auth.EmailVerifier
}

func NewAuthService(users *repository.UserRepo, tokens *auth.TokenManager, email *auth.EmailVerifier) *AuthService {
	return &AuthService{users: users, tokens: tokens, email: email}
}

// SendCode 发送邮箱验证码。scene 区分用途（register/reset/login）。
func (s *AuthService) SendCode(ctx context.Context, email, scene string) error {
	email = normalizeEmail(email)
	if !s.email.AllowedDomain(email) {
		return xerr.New(xerr.CodeEmailDomainInvalid, "仅支持武汉大学邮箱（@whu.edu.cn）")
	}
	switch scene {
	case auth.SceneRegister, auth.SceneReset, auth.SceneLogin:
	default:
		return xerr.New(xerr.CodeBadParam, "未知的验证码用途")
	}
	return s.email.SendCode(ctx, email, scene)
}

// Register 注册：武大邮箱 + 验证码 + 设置密码。注册即武大认证，自动登录。
func (s *AuthService) Register(ctx context.Context, email, code, password string) (*auth.TokenPair, *model.User, error) {
	email = normalizeEmail(email)
	if !s.email.AllowedDomain(email) {
		return nil, nil, xerr.New(xerr.CodeEmailDomainInvalid, "仅支持武汉大学邮箱（@whu.edu.cn）注册")
	}
	if err := validatePassword(password); err != nil {
		return nil, nil, err
	}
	if err := s.email.Verify(ctx, email, auth.SceneRegister, code); err != nil {
		return nil, nil, err
	}

	if _, err := s.users.FindByEmail(email); err == nil {
		return nil, nil, xerr.New(xerr.CodeEmailRegistered, "该邮箱已注册，请直接登录")
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil, xerr.New(xerr.CodeDBError, "查询用户失败").Wrap(err)
	}

	hash, err := auth.HashPassword(password)
	if err != nil {
		return nil, nil, xerr.New(xerr.CodeInternal, "密码加密失败").Wrap(err)
	}
	user := &model.User{
		Email:        email,
		PasswordHash: hash,
		Nickname:     defaultNickname(email),
		IsVerified:   true,
		Role:         model.RoleNormal,
		Status:       model.UserStatusNormal,
	}
	if err := s.users.Create(user); err != nil {
		return nil, nil, xerr.New(xerr.CodeDBError, "创建用户失败").Wrap(err)
	}
	return s.issuePair(user)
}

// Login 邮箱密码登录。
func (s *AuthService) Login(ctx context.Context, email, password string) (*auth.TokenPair, *model.User, error) {
	email = normalizeEmail(email)
	user, err := s.users.FindByEmail(email)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, xerr.New(xerr.CodeUserNotFound, "账号不存在，请先注册")
		}
		return nil, nil, xerr.New(xerr.CodeDBError, "查询用户失败").Wrap(err)
	}
	if user.Status == model.UserStatusBanned {
		return nil, nil, xerr.New(xerr.CodeUserBanned, "账号已被封禁")
	}
	if user.PasswordHash == "" || !auth.CheckPassword(user.PasswordHash, password) {
		return nil, nil, xerr.New(xerr.CodePasswordWrong, "密码错误")
	}
	return s.issuePair(user)
}

// ResetPassword 找回密码：验证邮箱验证码后重置密码。
func (s *AuthService) ResetPassword(ctx context.Context, email, code, password string) error {
	email = normalizeEmail(email)
	if !s.email.AllowedDomain(email) {
		return xerr.New(xerr.CodeEmailDomainInvalid, "仅支持武汉大学邮箱（@whu.edu.cn）")
	}
	if err := validatePassword(password); err != nil {
		return err
	}
	if err := s.email.Verify(ctx, email, auth.SceneReset, code); err != nil {
		return err
	}
	user, err := s.users.FindByEmail(email)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return xerr.New(xerr.CodeUserNotFound, "该邮箱未注册")
		}
		return xerr.New(xerr.CodeDBError, "查询用户失败").Wrap(err)
	}
	if user.Status == model.UserStatusBanned {
		return xerr.New(xerr.CodeUserBanned, "账号已被封禁")
	}
	hash, err := auth.HashPassword(password)
	if err != nil {
		return xerr.New(xerr.CodeInternal, "密码加密失败").Wrap(err)
	}
	if err := s.users.Update(user, map[string]interface{}{"password_hash": hash}); err != nil {
		return xerr.New(xerr.CodeDBError, "重置密码失败").Wrap(err)
	}
	return nil
}

// LoginByCode 邮箱验证码登录（小程序兼容保留）：校验验证码后找/建用户。
func (s *AuthService) LoginByCode(ctx context.Context, email, code string) (*auth.TokenPair, *model.User, error) {
	email = normalizeEmail(email)
	if !s.email.AllowedDomain(email) {
		return nil, nil, xerr.New(xerr.CodeEmailDomainInvalid, "仅支持武汉大学邮箱（@whu.edu.cn）登录")
	}
	if err := s.email.Verify(ctx, email, auth.SceneLogin, code); err != nil {
		return nil, nil, err
	}

	user, err := s.users.FindByEmail(email)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil, xerr.New(xerr.CodeDBError, "查询用户失败").Wrap(err)
	}
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
		if !user.IsVerified {
			_ = s.users.Update(user, map[string]interface{}{"is_verified": true})
			user.IsVerified = true
		}
	}
	return s.issuePair(user)
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

// issuePair 为已存在的用户签发令牌对。
func (s *AuthService) issuePair(user *model.User) (*auth.TokenPair, *model.User, error) {
	pair, err := s.tokens.GeneratePair(user.ID, user.Role)
	if err != nil {
		return nil, nil, xerr.New(xerr.CodeInternal, "签发令牌失败").Wrap(err)
	}
	return pair, user, nil
}

func normalizeEmail(email string) string {
	return strings.TrimSpace(strings.ToLower(email))
}

func validatePassword(password string) error {
	if len(password) < minPasswordLen {
		return xerr.New(xerr.CodePasswordWeak, "密码至少 8 位")
	}
	if len(password) > maxPasswordLen {
		return xerr.New(xerr.CodePasswordWeak, "密码过长")
	}
	return nil
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
