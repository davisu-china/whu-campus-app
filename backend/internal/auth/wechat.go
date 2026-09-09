package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"github.com/whu-campus/luojia-bbs/internal/config"
	"github.com/whu-campus/luojia-bbs/pkg/xerr"
)

// WechatClient 微信小程序登录：jscode2session 换取 openid。
type WechatClient struct {
	appID  string
	secret string
	http   *http.Client
}

// NewWechatClient 构造。AppID/Secret 为空时客户端不可用（微信登录返回未配置错误）。
func NewWechatClient(cfg config.WechatConfig) *WechatClient {
	return &WechatClient{
		appID:  cfg.AppID,
		secret: cfg.Secret,
		http:   &http.Client{Timeout: 5 * time.Second},
	}
}

// code2SessionResp 微信 jscode2session 响应。
type code2SessionResp struct {
	OpenID     string `json:"openid"`
	SessionKey string `json:"session_key"`
	UnionID    string `json:"unionid"`
	ErrCode    int    `json:"errcode"`
	ErrMsg     string `json:"errmsg"`
}

// Code2Session 用 wx.login 的 code 换取 openid。
func (w *WechatClient) Code2Session(ctx context.Context, code string) (string, error) {
	if w.appID == "" || w.secret == "" {
		return "", xerr.New(xerr.CodeWechatInvalid, "微信登录未配置")
	}

	q := url.Values{}
	q.Set("appid", w.appID)
	q.Set("secret", w.secret)
	q.Set("js_code", code)
	q.Set("grant_type", "authorization_code")
	endpoint := "https://api.weixin.qq.com/sns/jscode2session?" + q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return "", xerr.New(xerr.CodeInternal, "微信登录请求失败").Wrap(err)
	}
	resp, err := w.http.Do(req)
	if err != nil {
		return "", xerr.New(xerr.CodeWechatInvalid, "微信登录服务异常").Wrap(err)
	}
	defer resp.Body.Close()

	var r code2SessionResp
	if err := json.NewDecoder(resp.Body).Decode(&r); err != nil {
		return "", xerr.New(xerr.CodeWechatInvalid, "微信登录响应异常").Wrap(err)
	}
	if r.ErrCode != 0 || r.OpenID == "" {
		return "", xerr.New(xerr.CodeWechatInvalid, fmt.Sprintf("微信登录凭证无效：%s", r.ErrMsg))
	}
	return r.OpenID, nil
}
