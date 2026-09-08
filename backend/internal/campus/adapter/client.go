// Package adapter 武大各子系统的抓取/解析适配器。
// 每个适配器负责：用子系统会话 cookie 请求其内部接口，解析为结构化模型。
package adapter

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// ua 模拟桌面浏览器，降低被上游系统反爬拦截的概率。
const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

// client 各子系统适配器共用的无状态 HTTP 客户端。
// 会话 cookie 由调用方按次传入，适配器不做跨请求持久化，天然并发安全。
type client struct {
	baseURL string
	http    *http.Client
}

// newClient 创建共用客户端，baseURL 末尾的 "/" 会被去除。
func newClient(baseURL string, timeout time.Duration) *client {
	return &client{
		baseURL: strings.TrimRight(baseURL, "/"),
		http:    &http.Client{Timeout: timeout},
	}
}

// getJSON GET 并解析 JSON 响应。
func (c *client) getJSON(ctx context.Context, cookies map[string]string, path string, out interface{}) error {
	return c.doJSON(ctx, http.MethodGet, cookies, path, nil, out)
}

// postJSON POST 表单并解析 JSON 响应。
func (c *client) postJSON(ctx context.Context, cookies map[string]string, path string, form url.Values, out interface{}) error {
	return c.doJSON(ctx, http.MethodPost, cookies, path, form, out)
}

// postJSONBody POST JSON 体并解析 JSON 响应（图书馆/云打印等 JSON RPC 风格接口）。
func (c *client) postJSONBody(ctx context.Context, cookies map[string]string, path string, body interface{}, out interface{}) error {
	b, err := json.Marshal(body)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path, bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", ua)
	req.Header.Set("Content-Type", "application/json;charset=UTF-8")
	req.Header.Set("X-Requested-With", "XMLHttpRequest")
	if len(cookies) > 0 {
		req.Header.Set("Cookie", cookieHeader(cookies))
	}
	return c.execJSON(req, path, out)
}

// postMultipart POST multipart/form-data（文件 + 表单字段）并解析 JSON 响应（云打印上传等）。
func (c *client) postMultipart(ctx context.Context, cookies map[string]string, path string, fields map[string]string, filename string, fileBytes []byte, out interface{}) error {
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	for k, v := range fields {
		_ = w.WriteField(k, v)
	}
	fw, err := w.CreateFormFile("file", filename)
	if err != nil {
		return err
	}
	if _, err := fw.Write(fileBytes); err != nil {
		return err
	}
	if err := w.Close(); err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path, &buf)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", ua)
	req.Header.Set("Content-Type", w.FormDataContentType())
	if len(cookies) > 0 {
		req.Header.Set("Cookie", cookieHeader(cookies))
	}
	return c.execJSON(req, path, out)
}

// doJSON 表单请求并解析 JSON。
func (c *client) doJSON(ctx context.Context, method string, cookies map[string]string, path string, form url.Values, out interface{}) error {
	var body io.Reader
	if method == http.MethodPost {
		body = strings.NewReader(form.Encode())
	}
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, body)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", ua)
	req.Header.Set("X-Requested-With", "XMLHttpRequest")
	if method == http.MethodPost {
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded;charset=UTF-8")
	}
	if len(cookies) > 0 {
		req.Header.Set("Cookie", cookieHeader(cookies))
	}
	return c.execJSON(req, path, out)
}

// execJSON 执行请求并解析 JSON。上游响应常夹带 \xa0（不换行空格），先替换再解析。
func (c *client) execJSON(req *http.Request, path string, out interface{}) error {
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("%s %s: %w", strings.ToLower(req.Method), path, err)
	}
	defer resp.Body.Close()
	bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return fmt.Errorf("read %s: %w", path, err)
	}
	cleaned := strings.ReplaceAll(string(bodyBytes), "\xa0", " ")
	if err := json.Unmarshal([]byte(cleaned), out); err != nil {
		return fmt.Errorf("parse %s: %w（原始：%s）", path, err, truncate(cleaned, 200))
	}
	return nil
}

// cookieHeader 将 cookie map 拼成 "k=v; k2=v2" 形式的请求头。
func cookieHeader(cookies map[string]string) string {
	parts := make([]string, 0, len(cookies))
	for k, v := range cookies {
		parts = append(parts, k+"="+v)
	}
	return strings.Join(parts, "; ")
}

// parseRange 解析 "1-2" 形式的节次区间。
func parseRange(s string) (int, int) {
	parts := strings.SplitN(s, "-", 2)
	if len(parts) != 2 {
		return 0, 0
	}
	return intv(parts[0]), intv(parts[1])
}

// str 把上游 JSON 任意标量安全转成字符串。
func str(v interface{}) string {
	switch t := v.(type) {
	case string:
		return t
	case float64:
		return fmt.Sprintf("%g", t)
	case nil:
		return ""
	default:
		return fmt.Sprint(t)
	}
}

// strSlice 把上游 JSON 的 []interface{} 转成 []string。
func strSlice(v interface{}) []string {
	arr, ok := v.([]interface{})
	if !ok {
		return nil
	}
	out := make([]string, 0, len(arr))
	for _, x := range arr {
		out = append(out, str(x))
	}
	return out
}

func intv(v interface{}) int {
	switch t := v.(type) {
	case float64:
		return int(t)
	case string:
		var n int
		fmt.Sscanf(strings.TrimSpace(t), "%d", &n)
		return n
	default:
		return 0
	}
}

func floatv(v interface{}) float64 {
	switch t := v.(type) {
	case float64:
		return t
	case string:
		var f float64
		fmt.Sscanf(strings.TrimSpace(t), "%f", &f)
		return f
	default:
		return 0
	}
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
