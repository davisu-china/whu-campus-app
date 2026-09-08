package adapter

import (
	"context"
	"fmt"
	"time"

	"github.com/whu-campus/luojia-bbs/internal/campus/captcha"
	"github.com/whu-campus/luojia-bbs/internal/campus/model"
)

// Library 图书馆座位系统（seat.lib.whu.edu.cn）适配器：座位查询 + 预约（写）。
// 无状态：会话 cookie 由调用方传入，适配器不做跨请求持久化。
type Library struct {
	*client
}

// NewLibrary 创建图书馆适配器。
func NewLibrary(baseURL string, timeout time.Duration) *Library {
	return &Library{client: newClient(baseURL, timeout)}
}

// Buildings 楼栋列表。
// 待联调：/jsq/static/frontApi/res/ 下具体端点、请求体与响应字段需实测校准。
func (l *Library) Buildings(ctx context.Context, cookies map[string]string) ([]model.LibraryBuilding, error) {
	var raw []map[string]interface{}
	if err := l.postJSONBody(ctx, cookies, "/jsq/static/frontApi/res/getBuildingList", map[string]interface{}{}, &raw); err != nil {
		return nil, err
	}
	out := make([]model.LibraryBuilding, 0, len(raw))
	for _, r := range raw {
		out = append(out, model.LibraryBuilding{
			ID:   str(r["id"]),   // 待联调
			Name: str(r["name"]), // 待联调
		})
	}
	return out, nil
}

// Rooms 房间列表。
// 待联调：端点/字段需实测校准。
func (l *Library) Rooms(ctx context.Context, cookies map[string]string, buildingID string) ([]model.LibraryRoom, error) {
	body := map[string]interface{}{"building_id": buildingID}
	var raw []map[string]interface{}
	if err := l.postJSONBody(ctx, cookies, "/jsq/static/frontApi/res/getRoomList", body, &raw); err != nil {
		return nil, err
	}
	out := make([]model.LibraryRoom, 0, len(raw))
	for _, r := range raw {
		out = append(out, model.LibraryRoom{
			ID:       str(r["id"]),
			Name:     str(r["name"]),
			Building: str(r["building_id"]),
		})
	}
	return out, nil
}

// Seats 座位布局与空闲状态。
// 待联调：querySeatLayout 的请求体（room/date）与响应字段需实测校准。
func (l *Library) Seats(ctx context.Context, cookies map[string]string, roomID, date string) ([]model.Seat, error) {
	body := map[string]interface{}{"room_id": roomID, "date": date}
	var raw []map[string]interface{}
	if err := l.postJSONBody(ctx, cookies, "/jsq/static/frontApi/res/querySeatLayout", body, &raw); err != nil {
		return nil, err
	}
	out := make([]model.Seat, 0, len(raw))
	for _, r := range raw {
		out = append(out, model.Seat{
			ID:       str(r["id"]),
			Room:     str(r["room_id"]),
			Name:     str(r["name"]),
			Status:   str(r["status"]),
			HasPower: str(r["has_power"]) == "1" || str(r["has_power"]) == "true",
		})
	}
	return out, nil
}

// Captcha 生成预约滑块验证码（顶象 SLIDER）。
// 待联调：/cap/cg/gen/SLIDER 的响应字段（验证码 id、背景图、滑块图）需实测校准。
func (l *Library) Captcha(ctx context.Context, cookies map[string]string) (model.Captcha, error) {
	var raw map[string]interface{}
	if err := l.getJSON(ctx, cookies, "/cap/cg/gen/SLIDER", &raw); err != nil {
		return model.Captcha{}, err
	}
	return model.Captcha{
		ID:      str(raw["id"]),
		BgImage: str(raw["bg"]),
		SlImage: str(raw["slider"]),
	}, nil
}

// Book 预约座位（freeBook）。先校验滑块，再提交预约。
// 待联调：freeBook 请求体/响应字段需实测校准。
func (l *Library) Book(ctx context.Context, cookies map[string]string, req model.BookRequest) (model.Booking, error) {
	if err := l.captchaCheck(ctx, cookies, req.CaptchaID, req.CaptchaX); err != nil {
		return model.Booking{}, err
	}
	body := map[string]interface{}{
		"room_id":    req.RoomID,
		"seat_id":    req.SeatID,
		"date":       req.Date,
		"start_time": req.StartTime,
		"end_time":   req.EndTime,
	}
	var raw map[string]interface{}
	if err := l.postJSONBody(ctx, cookies, "/jsq/static/frontApi/make/freeBook", body, &raw); err != nil {
		return model.Booking{}, err
	}
	return model.Booking{
		ID:        str(raw["id"]),
		SeatID:    req.SeatID,
		Date:      req.Date,
		TimeRange: req.StartTime + "-" + req.EndTime,
		Status:    str(raw["status"]),
	}, nil
}

// Cancel 取消预约。
// 待联调：cancel 端点/请求体需实测校准。
func (l *Library) Cancel(ctx context.Context, cookies map[string]string, bookingID string) error {
	var raw map[string]interface{}
	return l.postJSONBody(ctx, cookies, "/jsq/static/frontApi/make/cancel",
		map[string]interface{}{"booking_id": bookingID}, &raw)
}

// Checkin 签到（stop）。
// 待联调：签到端点/请求体需实测校准。
func (l *Library) Checkin(ctx context.Context, cookies map[string]string, bookingID string) error {
	var raw map[string]interface{}
	return l.postJSONBody(ctx, cookies, "/jsq/static/frontApi/make/stop",
		map[string]interface{}{"booking_id": bookingID}, &raw)
}

// captchaCheck 校验滑块。
// 待联调：顶象 SLIDER 需要完整滑动轨迹签名；此处按 captcha 包生成类人轨迹并拼请求体，
// 加密/签名步骤（captcha.BuildCheckPayload）需在拿到其前端 JS 后逆向补全。
// 失败关闭：未明确确认成功即报错，避免绕过验证码。
func (l *Library) captchaCheck(ctx context.Context, cookies map[string]string, id string, x int) error {
	sol := captcha.Solution{X: x, Trace: captcha.Trace(x)}
	payload := captcha.BuildCheckPayload(id, sol)
	var raw map[string]interface{}
	if err := l.postJSONBody(ctx, cookies, "/cap/cg/check", payload, &raw); err != nil {
		return err
	}
	if ok, _ := raw["success"].(bool); !ok {
		return fmt.Errorf("滑块校验未通过")
	}
	return nil
}
