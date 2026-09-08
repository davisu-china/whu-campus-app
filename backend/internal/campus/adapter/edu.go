// Package adapter 武大各子系统的抓取/解析适配器。
// 每个适配器负责：用子系统会话 cookie 请求其内部接口，解析为结构化模型。
package adapter

import (
	"context"
	"net/url"
	"time"

	"github.com/whu-campus/luojia-bbs/internal/campus/model"
)

// Edu 教务系统（jwgl.whu.edu.cn）适配器：课表 / 成绩。
// 无状态：会话 cookie 由调用方传入，适配器不做跨请求持久化，天然并发安全。
type Edu struct {
	*client
}

// NewEdu 创建教务适配器。
func NewEdu(baseURL string, timeout time.Duration) *Edu {
	return &Edu{client: newClient(baseURL, timeout)}
}

// Timetable 抓取课表。
// 待联调：POST /kbcx/xskbcx_cxXsgrkb.html，参数 xnm(学年)/xqm(学期) 的确切取值，
// 以及响应 JSON 字段名（下方按正方教务系统常见字段名推测），需以真实教务为准。
func (e *Edu) Timetable(ctx context.Context, cookies map[string]string, year, semester string) ([]model.ScheduleItem, error) {
	form := url.Values{}
	form.Set("xnm", year)
	form.Set("xqm", semester)

	var raw []map[string]interface{}
	if err := e.postJSON(ctx, cookies, "/kbcx/xskbcx_cxXsgrkb.html", form, &raw); err != nil {
		return nil, err
	}
	items := make([]model.ScheduleItem, 0, len(raw))
	for _, r := range raw {
		start, end := parseRange(str(r["jcs"]))
		items = append(items, model.ScheduleItem{
			CourseName:   str(r["kcmc"]),
			Teacher:      str(r["xm"]),
			Weeks:        str(r["zcd"]),
			DayOfWeek:    intv(r["xqj"]),
			StartSection: start,
			EndSection:   end,
			Location:     str(r["cdmc"]),
		})
	}
	return items, nil
}

// Scores 抓取成绩。
// 待联调：POST /cjcx/cjcx_cxXsgrcj.html，参数 xnm/xqm/gnmkdm 与响应字段需实测校准。
func (e *Edu) Scores(ctx context.Context, cookies map[string]string, year, semester string) ([]model.ScoreItem, error) {
	form := url.Values{}
	form.Set("xnm", year)
	form.Set("xqm", semester)
	form.Set("gnmkdm", "") // 待联调：查询类别代码，需实测确定

	var raw []map[string]interface{}
	if err := e.postJSON(ctx, cookies, "/cjcx/cjcx_cxXsgrcj.html", form, &raw); err != nil {
		return nil, err
	}
	items := make([]model.ScoreItem, 0, len(raw))
	for _, r := range raw {
		items = append(items, model.ScoreItem{
			CourseName: str(r["kcmc"]),
			Score:      floatv(r["cj"]),
			Credit:     floatv(r["xf"]),
			CourseType: str(r["kcxzmc"]),
			Semester:   str(r["xnm"]) + "-" + str(r["xqm"]),
		})
	}
	return items, nil
}
