package adapter

import (
	"context"
	"time"

	"github.com/whu-campus/luojia-bbs/internal/campus/model"
)

// Card 一卡通系统（zsgx.whu.edu.cn）适配器：余额（只读）。
// 无状态：会话 cookie 由调用方传入，适配器不做跨请求持久化。
type Card struct {
	*client
}

// NewCard 创建一卡通适配器。
func NewCard(baseURL string, timeout time.Duration) *Card {
	return &Card{client: newClient(baseURL, timeout)}
}

// Balance 查询一卡通余额。
// 待联调：/ydd/card/ematong 的请求方式（GET/POST）与响应字段名（余额/卡号）需实测校准；
// 未办卡时上游可能返回「未办卡」，需改走 /ydd/card/nodata 分支。
func (c *Card) Balance(ctx context.Context, cookies map[string]string) (model.CardBalance, error) {
	var raw map[string]interface{}
	if err := c.getJSON(ctx, cookies, "/ydd/card/ematong", &raw); err != nil {
		return model.CardBalance{}, err
	}
	return model.CardBalance{
		CardNo:  str(raw["cardNo"]),     // 待联调
		Balance: floatv(raw["balance"]), // 待联调
	}, nil
}
