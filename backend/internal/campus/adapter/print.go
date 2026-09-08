package adapter

import (
	"context"
	"strconv"
	"time"

	"github.com/whu-campus/luojia-bbs/internal/campus/model"
)

// Print 云打印系统（print.lib.whu.edu.cn）适配器：打印点查询 + 文件上传打印。
// 无状态：会话 cookie 由调用方传入。
type Print struct {
	*client
}

// NewPrint 创建云打印适配器。
func NewPrint(baseURL string, timeout time.Duration) *Print {
	return &Print{client: newClient(baseURL, timeout)}
}

// Stations 打印点列表。
// 待联调：Station/GetList 的请求方式（GET/POST）与响应字段需实测校准。
func (p *Print) Stations(ctx context.Context, cookies map[string]string) ([]model.PrintStation, error) {
	var raw []map[string]interface{}
	if err := p.getJSON(ctx, cookies, "/api/client/Station/GetList", &raw); err != nil {
		return nil, err
	}
	out := make([]model.PrintStation, 0, len(raw))
	for _, r := range raw {
		out = append(out, model.PrintStation{
			ID:       str(r["id"]),
			Name:     str(r["name"]),
			Location: str(r["location"]),
			Status:   str(r["status"]),
		})
	}
	return out, nil
}

// Upload 上传文件并提交打印。
// 待联调：CloudPrint/Upload 的表单字段名（station/copies/color/duplex）与响应字段需实测校准。
func (p *Print) Upload(ctx context.Context, cookies map[string]string, filename string, fileBytes []byte, req model.PrintSubmitRequest) (model.PrintJob, error) {
	fields := map[string]string{
		"station_id": req.StationID,
		"copies":     strconv.Itoa(req.Copies),
		"color":      strconv.FormatBool(req.Color),
		"duplex":     strconv.FormatBool(req.Duplex),
	}
	var raw map[string]interface{}
	if err := p.postMultipart(ctx, cookies, "/api/client/CloudPrint/Upload", fields, filename, fileBytes, &raw); err != nil {
		return model.PrintJob{}, err
	}
	return model.PrintJob{
		ID:     str(raw["id"]),
		Status: str(raw["status"]),
	}, nil
}
