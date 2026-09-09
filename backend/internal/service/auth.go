package service

import (
	"context"
	"errors"
	"strings"

	"gorm.io/gorm"

	"github.com/whu-campus/luojia-bbs/internal/auth"
	campusservice "github.com/whu-campus/luojia-bbs/internal/campus/service"
	"github.com/whu-campus/luojia-bbs/internal/config"
	"github.com/whu-campus/luojia-bbs/internal/model"
	"github.com/whu-campus/luojia-bbs/internal/repository"
	"github.com/whu-campus/luojia-bbs/pkg/xerr"
)

const (
	minPasswordLen = 8  // 密码最短长度
	maxPasswordLen = 72 // bcrypt 单次可处理上限（字节）
)

// AuthService 认证：注册、密码登录、统一认证登录、找回/修改密码、令牌刷新。
type AuthService struct {
	users  *repository.UserRepo
	tokens *auth.TokenManager
	email  *auth.EmailVerifier
	wechat *auth.WechatClient
	campus *campusservice.Service // 武大统一认证（CAS）客户端，用于统一登录
	cfg    *config.Config
}

func NewAuthService(users *repository.UserRepo, tokens *auth.TokenManager, email *auth.EmailVerifier, wechat *auth.WechatClient, campus *campusservice.Service, cfg *config.Config) *AuthService {
	return &AuthService{users: users, tokens: tokens, email: email, wechat: wechat, campus: campus, cfg: cfg}
}

// SendCode 发送邮箱验证码。scene 区分用途（register/reset/login）。
func (s *AuthService) SendCode(ctx context.Context, email, scene string) error {
	email = normalizeEmail(email)
	if !s.email.AllowedDomain(email) {
		return xerr.New(xerr.CodeEmailDomainInvalid, "仅支持武汉大学邮箱（@whu.edu.cn）")
	}
	switch scene {
	case auth.SceneRegister, auth.SceneReset, auth.SceneLogin, auth.SceneBind:
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
		Email:        &email,
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

// SSOLogin 武大统一登录：用学号+密码登录 CAS 校验身份，首次自动建号。
//
// 采用「凭证代理」方式（与校园服务绑定同一条 CAS 链路）：密码仅在本请求内存中用于
// 换取 CAS 会话，用后即弃，绝不落库、落日志；落库的只有 CAS 会话 cookie（供校园服务复用）
// 与用户关联键 CasSubject。
func (s *AuthService) SSOLogin(ctx context.Context, username, password string) (*auth.TokenPair, *model.User, error) {
	username = strings.TrimSpace(username)
	if username == "" || password == "" {
		return nil, nil, xerr.New(xerr.CodeBadParam, "请输入学号与密码")
	}
	if s.campus == nil || s.cfg == nil || !s.cfg.Campus.Enabled {
		return nil, nil, xerr.ErrCampusDisabled
	}

	cookies, err := s.campus.Login(ctx, username, password)
	if err != nil {
		return nil, nil, err
	}

	user, err := s.users.FindByCasSubject(username)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil, xerr.New(xerr.CodeDBError, "查询用户失败").Wrap(err)
	}
	if user == nil {
		// 首次统一登录：自动建号并标记武大认证。
		user = &model.User{
			CasSubject: &username,
			Nickname:   nicknameFromSubject(username),
			IsVerified: true,
			Role:       model.RoleNormal,
			Status:     model.UserStatusNormal,
		}
		if err := s.users.Create(user); err != nil {
			return nil, nil, xerr.New(xerr.CodeDBError, "创建用户失败").Wrap(err)
		}
	} else if user.Status == model.UserStatusBanned {
		return nil, nil, xerr.New(xerr.CodeUserBanned, "账号已被封禁")
	}

	// 顺带保存 CAS 会话，校园服务无需二次绑定；保存失败不影响登录。
	_ = s.campus.SaveSession(ctx, user.ID, username, cookies)

	return s.issuePair(user)
}

// ChangePassword 修改密码（需登录态）。账号尚无密码时（纯验证码/统一登录用户）即「设置密码」。
func (s *AuthService) ChangePassword(ctx context.Context, userID, oldPassword, newPassword string) error {
	user, err := s.users.FindByID(userID)
	if err != nil {
		return xerr.New(xerr.CodeUserNotFound, "用户不存在")
	}
	if user.Status == model.UserStatusBanned {
		return xerr.New(xerr.CodeUserBanned, "账号已被封禁")
	}
	if user.PasswordHash != "" {
		if oldPassword == "" {
			return xerr.New(xerr.CodePasswordWrong, "请输入原密码")
		}
		if !auth.CheckPassword(user.PasswordHash, oldPassword) {
			return xerr.New(xerr.CodePasswordWrong, "原密码错误")
		}
		if auth.CheckPassword(user.PasswordHash, newPassword) {
			return xerr.New(xerr.CodePasswordWeak, "新密码不能与原密码相同")
		}
	}
	if err := validatePassword(newPassword); err != nil {
		return err
	}
	hash, err := auth.HashPassword(newPassword)
	if err != nil {
		return xerr.New(xerr.CodeInternal, "密码加密失败").Wrap(err)
	}
	if err := s.users.Update(user, map[string]interface{}{"password_hash": hash}); err != nil {
		return xerr.New(xerr.CodeDBError, "修改密码失败").Wrap(err)
	}
	return nil
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
			Email:      &email,
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

// WechatLogin 微信小程序登录：wx.login 的 code 换 openid，已绑定直接登录，未绑定自动建号（未认证）。
func (s *AuthService) WechatLogin(ctx context.Context, code, nickname, avatarURL string) (*auth.TokenPair, *model.User, error) {
	openid, err := s.wechat.Code2Session(ctx, code)
	if err != nil {
		return nil, nil, err
	}

	user, err := s.users.FindByOpenID(openid)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil, xerr.New(xerr.CodeDBError, "查询用户失败").Wrap(err)
	}
	if user == nil {
		name := strings.TrimSpace(nickname)
		if name == "" {
			name = "微信用户"
		}
		user = &model.User{
			WechatOpenID: &openid,
			Nickname:     name,
			AvatarURL:    avatarURL,
			IsVerified:   false,
			Role:         model.RoleNormal,
			Status:       model.UserStatusNormal,
		}
		if err := s.users.Create(user); err != nil {
			return nil, nil, xerr.New(xerr.CodeDBError, "创建用户失败").Wrap(err)
		}
	} else {
		if user.Status == model.UserStatusBanned {
			return nil, nil, xerr.New(xerr.CodeUserBanned, "账号已被封禁")
		}
	}
	return s.issuePair(user)
}

// BindEmail 微信账号绑定武大邮箱：校验邮箱域与验证码后绑定（邮箱已注册则走合并）。
func (s *AuthService) BindEmail(ctx context.Context, userID, email, code string) (*model.User, error) {
	email = normalizeEmail(email)
	if !s.email.AllowedDomain(email) {
		return nil, xerr.New(xerr.CodeEmailDomainInvalid, "仅支持武汉大学邮箱（@whu.edu.cn）")
	}
	if err := s.email.Verify(ctx, email, auth.SceneBind, code); err != nil {
		return nil, err
	}

	me, err := s.users.FindByID(userID)
	if err != nil {
		return nil, xerr.New(xerr.CodeUserNotFound, "用户不存在")
	}

	// 当前账号已绑定该邮箱：幂等，仅补齐认证标记。
	if me.Email != nil && *me.Email == email {
		if !me.IsVerified {
			_ = s.users.Update(me, map[string]interface{}{"is_verified": true})
		}
		return s.users.FindByID(userID)
	}

	existing, err := s.users.FindByEmail(email)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, xerr.New(xerr.CodeDBError, "查询用户失败").Wrap(err)
	}
	if existing == nil {
		// 邮箱未被注册：直接绑定并认证。
		if err := s.users.Update(me, map[string]interface{}{"email": email, "is_verified": true}); err != nil {
			return nil, xerr.New(xerr.CodeDBError, "绑定失败").Wrap(err)
		}
		return s.users.FindByID(userID)
	}

	// 邮箱已被另一账号注册：合并（临时号迁 openid 到已有账号）。
	return s.mergeWechat(me, existing)
}

// mergeWechat 把微信临时号的 openid 迁到已有邮箱账号并删除临时号。
// 仅当临时号「干净」（无帖子/回复/收藏/点赞/私信）时合并，否则要求用户改用邮箱登录。
func (s *AuthService) mergeWechat(me, existing *model.User) (*model.User, error) {
	if existing.Status == model.UserStatusBanned {
		return nil, xerr.New(xerr.CodeUserBanned, "账号已被封禁")
	}
	if me.WechatOpenID == nil {
		return nil, xerr.New(xerr.CodeBadParam, "当前账号未绑定微信")
	}
	if existing.WechatOpenID != nil && *existing.WechatOpenID != *me.WechatOpenID {
		return nil, xerr.New(xerr.CodeWechatBindConflict, "该邮箱已绑定其他微信")
	}

	has, err := s.users.HasContent(me.ID)
	if err != nil {
		return nil, xerr.New(xerr.CodeDBError, "查询用户内容失败").Wrap(err)
	}
	if has {
		return nil, xerr.New(xerr.CodeWechatBindConflict, "该微信已产生内容，请用邮箱登录后在设置中绑定微信")
	}

	if err := s.users.Update(existing, map[string]interface{}{"wechat_open_id": *me.WechatOpenID}); err != nil {
		return nil, xerr.New(xerr.CodeDBError, "绑定失败").Wrap(err)
	}
	if err := s.users.Delete(me.ID); err != nil {
		return nil, xerr.New(xerr.CodeDBError, "合并失败").Wrap(err)
	}
	return existing, nil
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
	user.HasPassword = user.PasswordHash != ""
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

// nicknameFromSubject 由统一身份（学号/工号）生成默认昵称，截断保证不超 32 字。
func nicknameFromSubject(sub string) string {
	r := []rune(sub)
	if len(r) > 24 {
		r = r[:24]
	}
	return "whu_" + string(r)
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
