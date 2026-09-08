package adapter

import (
	"context"
	"time"

	"github.com/whu-campus/luojia-bbs/internal/campus/model"
)

// Bus 校车系统（bus.whu.edu.cn）适配器：线路/实时位置（轻认证）。
// 无状态：如上游需 ticket 鉴权，票据由调用方传入（暂未接通）。
type Bus struct {
	*client
}

// NewBus 创建校车适配器。
func NewBus(baseURL string, timeout time.Duration) *Bus {
	return &Bus{client: newClient(baseURL, timeout)}
}

// Lines 查询校车线路。
// 待联调：/interface/whubus/weben/ 下具体子路径、请求参数（可能需 ticket）与响应字段名需实测校准；
// 无法结构化时前端可退化为 WebView 嵌入 /mobile/?ticket=。
func (b *Bus) Lines(ctx context.Context) ([]model.BusLine, error) {
	var raw []map[string]interface{}
	if err := b.getJSON(ctx, nil, "/interface/whubus/weben/lines", &raw); err != nil {
		return nil, err
	}
	lines := make([]model.BusLine, 0, len(raw))
	for _, r := range raw {
		lines = append(lines, model.BusLine{
			Name:  str(r["name"]),       // 待联调
			Stops: strSlice(r["stops"]), // 待联调
		})
	}
	return lines, nil
}
