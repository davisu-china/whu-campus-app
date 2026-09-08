package auth

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/whu-campus/luojia-bbs/internal/config"
)

// 腾讯云邮件推送（SES）接入，采用 TC3-HMAC-SHA256 签名。
// 接口文档：https://cloud.tencent.com/document/product/1288/51034
const (
	sesHost    = "ses.tencentcloudapi.com"
	sesService = "ses"
	sesAction  = "SendEmail"
	sesVersion = "2020-10-02"
)

// sesSender 腾讯云 SES 发信客户端。
type sesSender struct {
	cfg    config.TencentSESConfig
	client *http.Client
}

func newSESSender(cfg config.TencentSESConfig) *sesSender {
	return &sesSender{
		cfg:    cfg,
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

// configured 是否已配置可用的 SES 凭证。
func (s *sesSender) configured() bool {
	return s.cfg.SecretID != "" && s.cfg.SecretKey != "" && s.cfg.FromAddress != ""
}

// region 返回区域，默认 ap-guangzhou。
func (s *sesSender) region() string {
	if s.cfg.Region == "" {
		return "ap-guangzhou"
	}
	return s.cfg.Region
}

// send 发送一封 HTML 邮件，失败返回 error 供上层降级到 SMTP。
func (s *sesSender) send(ctx context.Context, to, subject, htmlBody string) error {
	payload, err := s.buildPayload(to, subject, htmlBody)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://"+sesHost, bytes.NewReader(payload))
	if err != nil {
		return err
	}

	timestamp, _, authorization := s.sign(string(payload))

	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	req.Header.Set("Host", sesHost)
	req.Header.Set("X-TC-Action", sesAction)
	req.Header.Set("X-TC-Version", sesVersion)
	req.Header.Set("X-TC-Timestamp", timestamp)
	req.Header.Set("X-TC-Region", s.region())
	req.Header.Set("Authorization", authorization)

	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("tencent ses http %d: %s", resp.StatusCode, string(body))
	}

	// 腾讯云错误时 HTTP 仍为 200，需解析 body 中的 Error。
	var r struct {
		Response struct {
			Error *struct {
				Code    string `json:"Code"`
				Message string `json:"Message"`
			} `json:"Error"`
		} `json:"Response"`
	}
	if err := json.Unmarshal(body, &r); err != nil {
		return err
	}
	if r.Response.Error != nil {
		return fmt.Errorf("tencent ses %s: %s", r.Response.Error.Code, r.Response.Error.Message)
	}
	return nil
}

// buildPayload 构造 SendEmail 请求体；Simple.Html 需 Base64 编码。
func (s *sesSender) buildPayload(to, subject, htmlBody string) ([]byte, error) {
	from := fmt.Sprintf("%s <%s>", s.cfg.FromName, s.cfg.FromAddress)
	html := base64.StdEncoding.EncodeToString([]byte(htmlBody))
	return json.Marshal(map[string]interface{}{
		"FromEmailAddress": from,
		"Destination":      []string{to},
		"Subject":          subject,
		"Simple": map[string]string{
			"Html": html,
			"Text": "",
		},
	})
}

// sign 计算 TC3-HMAC-SHA256 签名，返回 timestamp、date 与 Authorization。
func (s *sesSender) sign(payload string) (timestamp, date, authorization string) {
	now := time.Now().UTC()
	timestamp = fmt.Sprintf("%d", now.Unix())
	date = now.Format("2006-01-02")

	canonicalRequest := "POST\n/\n\ncontent-type:application/json; charset=utf-8\nhost:" + sesHost +
		"\n\ncontent-type;host\n" + sha256Hex(payload)
	credentialScope := date + "/" + sesService + "/tc3_request"
	stringToSign := "TC3-HMAC-SHA256\n" + timestamp + "\n" + credentialScope + "\n" + sha256Hex(canonicalRequest)

	secretDate := hmacSHA256([]byte("TC3"+s.cfg.SecretKey), date)
	secretService := hmacSHA256(secretDate, sesService)
	secretSigning := hmacSHA256(secretService, "tc3_request")
	signature := hex.EncodeToString(hmacSHA256(secretSigning, stringToSign))

	authorization = "TC3-HMAC-SHA256 Credential=" + s.cfg.SecretID + "/" + credentialScope +
		", SignedHeaders=content-type;host, Signature=" + signature
	return
}

func sha256Hex(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}

func hmacSHA256(key []byte, msg string) []byte {
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(msg))
	return mac.Sum(nil)
}
