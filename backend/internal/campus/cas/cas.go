// Package cas 封装武大统一身份认证（CAS）客户端：登录换取会话票据。
//
// 采用「一次性密码换会话」策略：用户在前端输入学号+密码，后端据此登录 CAS，
// 成功后仅持久化会话 cookie（TGC），密码在本次请求内存中用后即弃，绝不落库、落日志。
package cas

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"regexp"
	"strings"
	"time"
)

// Client CAS 客户端。持有独立 cookie jar，模拟浏览器完成登录流程。
type Client struct {
	baseURL string
	jar     *cookiejar.Jar
	http    *http.Client
}

// userAgent 模拟桌面浏览器，降低被武大信息门户反爬拦截的概率。
const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

// New 创建 CAS 客户端。
func New(baseURL string, timeout time.Duration) *Client {
	jar, _ := cookiejar.New(nil)
	return &Client{
		baseURL: strings.TrimRight(baseURL, "/"),
		jar:     jar,
		http:    &http.Client{Timeout: timeout, Jar: jar},
	}
}

// Login 用学号+密码登录统一认证，成功后返回 CAS 会话 cookie（含 TGC）。
//
// 登录流程（Apereo CAS 2.0 + whuThemeNew1 主题）：
//  1. GET /authserver/login 取 pwdEncryptSalt 与隐藏表单字段（lt/execution）；
//  2. 按前端 encrypt.js 算法 AES-128-CBC 加密密码；
//  3. POST 表单登录；
//  4. 成功（302 重定向）后从 cookie jar 收集会话票据。
//
// 以下字段名/流程基于标准 Apereo CAS 与已抓取的 encrypt.js，真实联调时需以
// 武大实际登录页为准校准（见各 extract/encrypt 处的「待联调」注释）。
//
// 已知待联调项：登录页含 captcha/dynamicCode 字段（用户名失焦时 checkUserCaptcha()
// 决定是否要求验证码）。若线上强制验证码，此处需补验证码获取与求解步骤。
func (c *Client) Login(ctx context.Context, username, password string) (map[string]string, error) {
	loginURL := c.baseURL + "/authserver/login"

	// 1. 拉取登录页，取加密盐与隐藏字段。
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, loginURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", userAgent)
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch login page: %w", err)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	resp.Body.Close()
	if err != nil {
		return nil, fmt.Errorf("read login page: %w", err)
	}
	html := string(body)

	salt := extractSalt(html)
	if salt == "" {
		return nil, fmt.Errorf("未在登录页取到 pwdEncryptSalt（CAS 页面结构可能已变更，待联调校准）")
	}
	encrypted, err := encryptPassword(password, salt)
	if err != nil {
		return nil, fmt.Errorf("encrypt password: %w", err)
	}

	// 2. 组装登录表单（对齐 whuThemeNew1 的 pwdFromId 表单）。
	// cllt/dllt 决定 CAS 走哪种认证处理器：账号密码登录固定为 userNameLogin + generalLogin。
	form := url.Values{}
	form.Set("username", username)
	form.Set("password", encrypted)
	form.Set("lt", extractHidden(html, "lt"))
	form.Set("execution", extractHidden(html, "execution"))
	form.Set("cllt", "userNameLogin")
	form.Set("dllt", "generalLogin")
	form.Set("_eventId", "submit")
	form.Set("rmShown", "1")

	req2, err := http.NewRequestWithContext(ctx, http.MethodPost, loginURL, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req2.Header.Set("User-Agent", userAgent)
	req2.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp2, err := c.http.Do(req2)
	if err != nil {
		return nil, fmt.Errorf("post login: %w", err)
	}
	io.Copy(io.Discard, resp2.Body)
	resp2.Body.Close()

	// 成功：Apereo CAS 登录成功会 302 到默认落地页（或 service），并种 TGC。
	if resp2.StatusCode >= 300 && resp2.StatusCode < 400 {
		return c.cookies(), nil
	}
	// 兜底：部分主题成功后返回 200，此时以是否出现会话票据判定。
	if cks := c.cookies(); hasTGC(cks) {
		return cks, nil
	}
	return nil, fmt.Errorf("CAS 登录失败（HTTP %d，未获取到会话票据）", resp2.StatusCode)
}

// Restore 用已持久化的会话 cookie（如 TGC）重建客户端 jar，用于后续 SSO。
func (c *Client) Restore(cookies map[string]string) {
	u, _ := url.Parse(c.baseURL)
	cs := make([]*http.Cookie, 0, len(cookies))
	for k, v := range cookies {
		cs = append(cs, &http.Cookie{Name: k, Value: v})
	}
	c.jar.SetCookies(u, cs)
}

// SSO 用已持有的 TGC 换取指定 service 子系统的会话。
// 流程：GET {cas}/authserver/login?service={service}（带 TGC）→ CAS 302 到
// service?ticket=ST → 子系统校验 ticket 并种自身会话 cookie → 返回子系统 cookies。
//
// service 为子系统的 SSO 入口 URL（如 https://jwgl.whu.edu.cn/sso/jznewsixlogin）。
func (c *Client) SSO(ctx context.Context, service string) (map[string]string, error) {
	loginURL := c.baseURL + "/authserver/login"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, loginURL, nil)
	if err != nil {
		return nil, err
	}
	q := req.URL.Query()
	q.Set("service", service)
	req.URL.RawQuery = q.Encode()
	req.Header.Set("User-Agent", userAgent)

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("sso request: %w", err)
	}
	io.Copy(io.Discard, resp.Body)
	resp.Body.Close()

	svc, _ := url.Parse(service)
	cookies := map[string]string{}
	for _, ck := range c.jar.Cookies(svc) {
		cookies[ck.Name] = ck.Value
	}
	if len(cookies) == 0 {
		return nil, fmt.Errorf("SSO 未获取到子系统会话（TGC 可能已失效，需重新绑定）")
	}
	return cookies, nil
}

// aesChars 与 cas.whu.edu.cn/authserver/whuThemeNew1/static/common/encrypt.js 的
// $aes_chars 一致，刻意剔除 I/L/O/0/1/9 等易混字符。
const aesChars = "ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678"

// randomString 从 aesChars 中取 n 个字符（对齐 encrypt.js 的 randomString）。
func randomString(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	out := make([]byte, n)
	for i := range b {
		out[i] = aesChars[int(b[i])%len(aesChars)]
	}
	return string(out)
}

// encryptPassword 复刻 CAS 前端 encrypt.js 的密码加密：
// AES-128-CBC，key=UTF8(trim(salt))，iv=UTF8(randomString(16))，
// 明文 = randomString(64) + password，PKCS7 填充，输出 base64(密文)。
//
// 注意：与 CryptoJS 默认 OpenSSL formatter 一致，输出为 base64(ciphertext)，
// 不含 iv 前缀。iv 随机且不随密文传输，其如何被服务端还原属 CAS 侧约定，
// 需在真实联调时以实际登录成功为准校准（待联调）。
func encryptPassword(password, salt string) (string, error) {
	key := []byte(strings.TrimSpace(salt))
	iv := []byte(randomString(16))
	plaintext := []byte(randomString(64) + password)

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	padded := pkcs7Pad(plaintext, aes.BlockSize)
	ciphertext := make([]byte, len(padded))
	cipher.NewCBCEncrypter(block, iv).CryptBlocks(ciphertext, padded)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// pkcs7Pad 标准 PKCS#7 填充。
func pkcs7Pad(data []byte, blockSize int) []byte {
	pad := blockSize - len(data)%blockSize
	out := make([]byte, len(data)+pad)
	copy(out, data)
	for i := len(data); i < len(out); i++ {
		out[i] = byte(pad)
	}
	return out
}

var (
	// 线上页面为 <input type="hidden" id="pwdEncryptSalt" value="xxx" />（只有 id，没有 name），
	// 故按 id 取；下面两条覆盖 id/value 属性顺序颠倒的写法。
	saltIDRe  = regexp.MustCompile(`(?i)<input[^>]*id=["']pwdEncryptSalt["'][^>]*value=["']([^"']*)["']`)
	saltIDRe2 = regexp.MustCompile(`(?i)<input[^>]*value=["']([^"']*)["'][^>]*id=["']pwdEncryptSalt["']`)
	saltJSRe  = regexp.MustCompile(`(?i)pwdEncryptSalt\s*[=:]\s*["']([^"']+)["']`) // 兜底：JS 赋值式
	hiddenRe  = regexp.MustCompile(`(?i)<input[^>]+name=["']([^"']+)["'][^>]*value=["']([^"']*)["']`)
	hiddenRe2 = regexp.MustCompile(`(?i)<input[^>]+value=["']([^"']*)["'][^>]*name=["']([^"']+)["']`)
)

// extractSalt 从登录页 HTML 提取 pwdEncryptSalt。
func extractSalt(html string) string {
	for _, re := range []*regexp.Regexp{saltIDRe, saltIDRe2, saltJSRe} {
		if m := re.FindStringSubmatch(html); len(m) > 1 && m[1] != "" {
			return m[1]
		}
	}
	return ""
}

// extractHidden 提取指定 name 的隐藏表单字段值（lt/execution）。
// 兼容 name/value 属性顺序颠倒的写法。
func extractHidden(html, name string) string {
	for _, m := range hiddenRe.FindAllStringSubmatch(html, -1) {
		if len(m) >= 3 && m[1] == name {
			return m[2]
		}
	}
	for _, m := range hiddenRe2.FindAllStringSubmatch(html, -1) {
		if len(m) >= 3 && m[2] == name {
			return m[1]
		}
	}
	return ""
}

// cookies 汇总当前 jar 中 CAS 域下的会话 cookie。
func (c *Client) cookies() map[string]string {
	u, _ := url.Parse(c.baseURL)
	out := map[string]string{}
	for _, ck := range c.jar.Cookies(u) {
		out[ck.Name] = ck.Value
	}
	return out
}

// hasTGC 判断 cookie 集合中是否已含 CAS 会话票据（TGC）。
// Apereo CAS 默认票据名为 CASTGC；若武大改名，以 Login 的 302 分支兜底（待联调校准）。
func hasTGC(cookies map[string]string) bool {
	_, ok := cookies["CASTGC"]
	return ok
}
