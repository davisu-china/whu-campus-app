package adapter

import (
	"context"
	"time"

	"github.com/whu-campus/luojia-bbs/internal/campus/model"
)

// Gym 体育场馆系统（gym.whu.edu.cn）适配器：场馆/场次查询 + 下单。
// 无状态：会话 cookie 由调用方传入。
type Gym struct {
	*client
}

// NewGym 创建体育场馆适配器。
func NewGym(baseURL string, timeout time.Duration) *Gym {
	return &Gym{client: newClient(baseURL, timeout)}
}

// Stadiums 场馆列表。
// 待联调：GSStadiums 的端点/响应字段需实测校准。
func (g *Gym) Stadiums(ctx context.Context, cookies map[string]string) ([]model.GymStadium, error) {
	var raw []map[string]interface{}
	if err := g.getJSON(ctx, cookies, "/api/GSStadiums/list", &raw); err != nil {
		return nil, err
	}
	out := make([]model.GymStadium, 0, len(raw))
	for _, r := range raw {
		out = append(out, model.GymStadium{
			ID:       str(r["id"]),
			Name:     str(r["name"]),
			Location: str(r["location"]),
		})
	}
	return out, nil
}

// Sessions 可预约场次。
// 待联调：场次查询端点/参数/响应字段需实测校准。
func (g *Gym) Sessions(ctx context.Context, cookies map[string]string, stadiumID, date string) ([]model.GymSession, error) {
	path := "/api/GSStadiums/sessions?stadium_id=" + stadiumID + "&date=" + date
	var raw []map[string]interface{}
	if err := g.getJSON(ctx, cookies, path, &raw); err != nil {
		return nil, err
	}
	out := make([]model.GymSession, 0, len(raw))
	for _, r := range raw {
		out = append(out, model.GymSession{
			ID:        str(r["id"]),
			StadiumID: str(r["stadium_id"]),
			Sport:     str(r["sport"]),
			Date:      str(r["date"]),
			TimeRange: str(r["time_range"]),
			Price:     floatv(r["price"]),
			Available: str(r["available"]) == "1" || str(r["available"]) == "true",
		})
	}
	return out, nil
}

// Order 场馆下单（写操作）。
// 待联调：GSOrder 端点/请求体/响应字段需实测校准。
func (g *Gym) Order(ctx context.Context, cookies map[string]string, req model.GymOrderRequest) (model.GymOrder, error) {
	body := map[string]interface{}{
		"session_id": req.SessionID,
		"count":      req.Count,
	}
	var raw map[string]interface{}
	if err := g.postJSONBody(ctx, cookies, "/api/GSOrder/create", body, &raw); err != nil {
		return model.GymOrder{}, err
	}
	return model.GymOrder{
		ID:     str(raw["id"]),
		Status: str(raw["status"]),
	}, nil
}
