// Package captcha 图书馆预约滑块验证码求解（顶象 SLIDER）。
//
// 目标：服务端自动求解「缺口位置 + 拖动轨迹」，供定时自动预约使用。
// 逆向依据：seat.lib.whu.edu.cn /cap/cg/gen/SLIDER → /cap/cg/check。
package captcha

import (
	"bytes"
	"fmt"
	"image"
	_ "image/jpeg" // 注册 jpeg 解码器
	_ "image/png"  // 注册 png 解码器
	"math"
	"math/rand"
)

// Point 轨迹点（顶象 trace 元素，字段名待联调）。
type Point struct {
	X int `json:"x"`
	Y int `json:"y"`
	T int `json:"t"` // 相对时间（ms）
}

// Solution 一次求解结果。
type Solution struct {
	X     int     `json:"x"`     // 滑块横向偏移（px）
	Trace []Point `json:"trace"` // 拖动轨迹
}

// Solver 验证码求解器接口。不同验证码厂商/模式实现各自求解。
type Solver interface {
	Solve(bg, slider []byte) (Solution, error)
}

// DingxiangSlider 顶象 SLIDER 滑块求解器。
type DingxiangSlider struct{}

// NewDingxiangSlider 构造顶象滑块求解器。
func NewDingxiangSlider() *DingxiangSlider { return &DingxiangSlider{} }

// Solve 定位缺口并生成类人拖动轨迹。
func (s *DingxiangSlider) Solve(bg, slider []byte) (Solution, error) {
	x, err := locateGap(bg, slider)
	if err != nil {
		return Solution{}, err
	}
	return Solution{X: x, Trace: Trace(x)}, nil
}

// Trace 由横向偏移生成类人拖动轨迹（加速-匀速-减速 + Y 抖动）。
func Trace(distance int) []Point {
	if distance <= 0 {
		return nil
	}
	steps := 40 + distance/20
	if steps > 80 {
		steps = 80
	}
	pts := make([]Point, 0, steps+1)
	t := 0
	lastX := 0
	for i := 0; i <= steps; i++ {
		p := float64(i) / float64(steps)
		// easeOutCubic：起步快、收尾慢，符合人手拖动。
		x := int(float64(distance) * (1 - math.Pow(1-p, 3)))
		if x < lastX {
			x = lastX
		}
		t += 5 + rand.Intn(11) // 每步 5~15ms
		y := rand.Intn(5) - 2  // Y 抖动 ±2px
		pts = append(pts, Point{X: x, Y: y, T: t})
		lastX = x
	}
	pts[len(pts)-1].X = distance // 终点精确落在缺口
	return pts
}

// BuildCheckPayload 构造 /cap/cg/check 请求体。
// 待联调：顶象要求对偏移/轨迹做签名加密（AES/DES，密钥内嵌其前端 JS），
// 此处仅拼出结构，加密与确切字段名需在拿到其 JS 后逆向补全。
func BuildCheckPayload(captchaID string, sol Solution) map[string]interface{} {
	return map[string]interface{}{
		"captcha_id": captchaID,
		"data": map[string]interface{}{
			"x":     sol.X,
			"trace": sol.Trace,
		},
	}
}

// locateGap 在背景图中定位缺口横向位置。
// 待联调：顶象 SLIDER 的背景图/滑块图确切格式（是否同宽、滑块块是否带透明通道）需实测校准；
// 此处用「逐列差异峰值」启发式：滑块图与背景图差异最大的列即缺口所在列。
func locateGap(bg, slider []byte) (int, error) {
	bgImg, _, err := image.Decode(bytes.NewReader(bg))
	if err != nil {
		return 0, fmt.Errorf("decode bg: %w", err)
	}
	slImg, _, err := image.Decode(bytes.NewReader(slider))
	if err != nil {
		return 0, fmt.Errorf("decode slider: %w", err)
	}
	b := bgImg.Bounds()
	s := slImg.Bounds()
	if b.Dx() != s.Dx() {
		return 0, fmt.Errorf("滑块图与背景图宽度不一致（待联调：确认顶象图片格式）")
	}
	bestX, bestDiff := 0, 0.0
	for x := 0; x < b.Dx(); x++ {
		var diff float64
		for y := 0; y < b.Dy(); y++ {
			d := grayY(slImg, x, y) - grayY(bgImg, x, y)
			if d < 0 {
				d = -d
			}
			diff += d
		}
		if diff > bestDiff {
			bestDiff, bestX = diff, x
		}
	}
	return bestX, nil
}

// grayY 返回像素的灰度值（0~255）。
func grayY(img image.Image, x, y int) float64 {
	r, g, b, _ := img.At(x, y).RGBA()
	return (0.299*float64(r>>8) + 0.587*float64(g>>8) + 0.114*float64(b>>8))
}
