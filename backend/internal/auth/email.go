package auth

import (
	"context"
	"crypto/rand"
	"crypto/tls"
	"fmt"
	"math/big"
	"net/smtp"
	"strings"
	"time"

	"go.uber.org/zap"

	"github.com/whu-campus/luojia-bbs/internal/cache"
	"github.com/whu-campus/luojia-bbs/internal/config"
	"github.com/whu-campus/luojia-bbs/pkg/xerr"
)

const (
	codeTTL      = 5 * time.Minute
	codeCooldown = 60 * time.Second // 同邮箱重发冷却
)

// 验证码场景：区分用途，隔离不同流程的验证码。
const (
	SceneLogin    = "login"
	SceneRegister = "register"
	SceneReset    = "reset"
)

// EmailVerifier 邮箱验证码签发与校验。
type EmailVerifier struct {
	cache          *cache.Client
	cfg            config.SMTPConfig
	ses            *sesSender
	allowedDomains []string
	log            *zap.Logger
}

// NewEmailVerifier 构造。
func NewEmailVerifier(c *cache.Client, cfg *config.Config, log *zap.Logger) *EmailVerifier {
	return &EmailVerifier{
		cache:          c,
		cfg:            cfg.SMTP,
		ses:            newSESSender(cfg.TencentSES),
		allowedDomains: cfg.Auth.AllowedEmailDomains,
		log:            log,
	}
}

// AllowedDomain 校验邮箱域是否在允许列表（如 @whu.edu.cn）。
func (e *EmailVerifier) AllowedDomain(email string) bool {
	at := strings.LastIndex(email, "@")
	if at < 0 || at == len(email)-1 {
		return false
	}
	domain := strings.ToLower(email[at+1:])
	for _, d := range e.allowedDomains {
		if domain == strings.ToLower(strings.TrimPrefix(d, "@")) {
			return true
		}
	}
	return false
}

// SendCode 生成验证码、写 Redis 并发送。scene 区分用途（login/register/reset）。
func (e *EmailVerifier) SendCode(ctx context.Context, email, scene string) error {
	// 同邮箱 60s 内重发冷却。
	cooldownKey := cooldownKey(email)
	exists, err := e.cache.Exists(ctx, cooldownKey)
	if err != nil {
		return xerr.New(xerr.CodeCacheErr, "验证码服务异常").Wrap(err)
	}
	if exists {
		return xerr.New(xerr.CodeRateLimit, "发送太频繁，请稍后再试")
	}

	code, err := randomCode()
	if err != nil {
		return err
	}
	if err := e.cache.Set(ctx, codeKey(scene, email), code, codeTTL); err != nil {
		return xerr.New(xerr.CodeCacheErr, "验证码存储失败").Wrap(err)
	}
	_ = e.cache.Set(ctx, cooldownKey, "1", codeCooldown)

	if e.cfg.Mock {
		e.log.Info("email code (mock)", zap.String("email", email), zap.String("scene", scene), zap.String("code", code))
		return nil
	}
	return e.send(ctx, email, subjectFor(scene), bodyFor(scene, code))
}

// Verify 校验验证码，成功即删除。
func (e *EmailVerifier) Verify(ctx context.Context, email, scene, code string) error {
	stored, err := e.cache.Get(ctx, codeKey(scene, email))
	if err != nil {
		return xerr.New(xerr.CodeCacheErr, "验证码校验失败").Wrap(err)
	}
	if stored == "" {
		return xerr.New(xerr.CodeVerifyCodeExpired, "验证码已过期，请重新获取")
	}
	if stored != code {
		return xerr.New(xerr.CodeVerifyCodeWrong, "验证码错误")
	}
	_ = e.cache.Del(ctx, codeKey(scene, email))
	return nil
}

func codeKey(scene, email string) string { return "email:code:" + scene + ":" + email }
func cooldownKey(email string) string    { return "email:cooldown:" + email }

func randomCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

// send 发送验证码邮件：优先腾讯云 SES，失败降级到 SMTP。
func (e *EmailVerifier) send(ctx context.Context, email, subject, body string) error {
	if e.ses.configured() {
		if err := e.ses.send(ctx, email, subject, body); err == nil {
			e.log.Info("email sent via tencent ses", zap.String("email", email))
			return nil
		} else {
			e.log.Warn("tencent ses send failed, fallback to smtp", zap.String("email", email), zap.Error(err))
		}
	}
	return e.sendSMTP(email, subject, body)
}

// sendSMTP 兜底：标准 SMTP 发送 HTML 邮件。
// 465 端口为隐式 TLS，net/smtp.SendMail 仅支持 STARTTLS，需单独建连。
func (e *EmailVerifier) sendSMTP(email, subject, htmlBody string) error {
	addr := fmt.Sprintf("%s:%d", e.cfg.Host, e.cfg.Port)
	msg := smtpMessage(e.cfg.From, email, subject, htmlBody)
	envelopeFrom := bareAddress(e.cfg.From)

	var auth smtp.Auth
	if e.cfg.Username != "" {
		auth = smtp.PlainAuth("", e.cfg.Username, e.cfg.Password, e.cfg.Host)
		envelopeFrom = e.cfg.Username
	}

	if e.cfg.Port == 465 {
		return e.sendSMTPS(addr, auth, envelopeFrom, email, msg)
	}
	if err := smtp.SendMail(addr, auth, envelopeFrom, []string{email}, msg); err != nil {
		return xerr.New(xerr.CodeInternal, "邮件发送失败，请稍后再试").Wrap(err)
	}
	return nil
}

// sendSMTPS 隐式 TLS 建连发送（QQ SMTP 465）。
func (e *EmailVerifier) sendSMTPS(addr string, auth smtp.Auth, from, to string, msg []byte) error {
	conn, err := tls.Dial("tcp", addr, &tls.Config{ServerName: e.cfg.Host})
	if err != nil {
		return xerr.New(xerr.CodeInternal, "邮件发送失败，请稍后再试").Wrap(err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, e.cfg.Host)
	if err != nil {
		return xerr.New(xerr.CodeInternal, "邮件发送失败，请稍后再试").Wrap(err)
	}
	defer client.Close()

	if auth != nil {
		if err := client.Auth(auth); err != nil {
			return xerr.New(xerr.CodeInternal, "邮件发送失败，请稍后再试").Wrap(err)
		}
	}
	if err := client.Mail(from); err != nil {
		return xerr.New(xerr.CodeInternal, "邮件发送失败，请稍后再试").Wrap(err)
	}
	if err := client.Rcpt(to); err != nil {
		return xerr.New(xerr.CodeInternal, "邮件发送失败，请稍后再试").Wrap(err)
	}
	w, err := client.Data()
	if err != nil {
		return xerr.New(xerr.CodeInternal, "邮件发送失败，请稍后再试").Wrap(err)
	}
	if _, err := w.Write(msg); err != nil {
		return xerr.New(xerr.CodeInternal, "邮件发送失败，请稍后再试").Wrap(err)
	}
	if err := w.Close(); err != nil {
		return xerr.New(xerr.CodeInternal, "邮件发送失败，请稍后再试").Wrap(err)
	}
	return client.Quit()
}

// smtpMessage 构造 RFC822 邮件（含 From/To/Subject 头与 HTML 正文）。
func smtpMessage(from, to, subject, htmlBody string) []byte {
	return []byte(fmt.Sprintf(
		"From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n%s",
		from, to, subject, htmlBody,
	))
}

// bareAddress 从 "Name <addr>" 中提取纯地址，用于 MAIL FROM 信封。
func bareAddress(s string) string {
	if i := strings.LastIndex(s, "<"); i >= 0 {
		if j := strings.LastIndex(s, ">"); j > i {
			return strings.TrimSpace(s[i+1 : j])
		}
	}
	return strings.TrimSpace(s)
}

// subjectFor 按场景返回邮件主题。
func subjectFor(scene string) string {
	switch scene {
	case SceneRegister:
		return "【在武大】注册验证码"
	case SceneReset:
		return "【在武大】重置密码验证码"
	default:
		return "【在武大】邮箱验证码"
	}
}

// bodyFor 按场景返回邮件正文。
func bodyFor(scene, code string) string {
	var action string
	switch scene {
	case SceneRegister:
		action = "注册在武大账号"
	case SceneReset:
		action = "重置登录密码"
	default:
		action = "登录在武大"
	}
	return htmlBody(action, code)
}

// htmlBody 验证码邮件 HTML 正文。
func htmlBody(action, code string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="zh-CN">
<body style="margin:0;padding:0;background:#f6f6f6;">
  <div style="max-width:480px;margin:0 auto;padding:32px;background:#fff;font-family:system-ui,-apple-system,'PingFang SC',sans-serif;">
    <h2 style="color:#333;">在武大 邮箱验证</h2>
    <p style="color:#555;line-height:1.6;">您正在%s，验证码如下，有效期 %d 分钟：</p>
    <div style="margin:24px 0;padding:16px 32px;background:#f4f4f5;border-radius:8px;text-align:center;">
      <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#16a34a;">%s</span>
    </div>
    <p style="color:#999;font-size:12px;">若非本人操作，请忽略本邮件。</p>
  </div>
</body>
</html>`, action, int(codeTTL.Minutes()), code)
}
