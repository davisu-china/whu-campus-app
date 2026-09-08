// Package service 校园服务业务层：绑定/解绑/状态，以及各子系统的数据代理。
package service

import (
	"context"
	"encoding/base64"
	"fmt"
	"strings"
	"time"

	"github.com/whu-campus/luojia-bbs/internal/campus/adapter"
	"github.com/whu-campus/luojia-bbs/internal/campus/captcha"
	"github.com/whu-campus/luojia-bbs/internal/campus/cas"
	"github.com/whu-campus/luojia-bbs/internal/campus/model"
	"github.com/whu-campus/luojia-bbs/internal/campus/store"
	"github.com/whu-campus/luojia-bbs/internal/config"
	"github.com/whu-campus/luojia-bbs/pkg/xerr"
)

// Service 校园服务。无跨请求可变状态，cas 客户端按需临时构造（并发安全）。
type Service struct {
	store *store.Store
	cfg   *config.Config
	edu   *adapter.Edu
	card  *adapter.Card
	bus   *adapter.Bus
	lib   *adapter.Library
	print *adapter.Print
	gym   *adapter.Gym

	solver captcha.Solver // 滑块验证码求解器（默认顶象 SLIDER）
}

// New 创建校园服务。
func New(st *store.Store, cfg *config.Config) *Service {
	return &Service{
		store: st,
		cfg:   cfg,
		edu:   adapter.NewEdu(cfg.Campus.EduBaseURL, cfg.CampusTimeoutDuration()),
		card:  adapter.NewCard(cfg.Campus.CardBaseURL, cfg.CampusTimeoutDuration()),
		bus:   adapter.NewBus(cfg.Campus.BusBaseURL, cfg.CampusTimeoutDuration()),
		lib:   adapter.NewLibrary(cfg.Campus.LibBaseURL, cfg.CampusTimeoutDuration()),
		print: adapter.NewPrint(cfg.Campus.PrintBaseURL, cfg.CampusTimeoutDuration()),
		gym:   adapter.NewGym(cfg.Campus.GymBaseURL, cfg.CampusTimeoutDuration()),

		solver: captcha.NewDingxiangSlider(),
	}
}

// Bind 用户绑定统一认证：登录 CAS 拿会话并落 Redis。密码用后即弃，不落库不落日志。
func (s *Service) Bind(ctx context.Context, userID, username, password string) error {
	if !s.cfg.Campus.Enabled {
		return xerr.ErrCampusDisabled
	}
	client := cas.New(s.cfg.Campus.CASBaseURL, s.cfg.CampusTimeoutDuration())
	cookies, err := client.Login(ctx, username, password)
	if err != nil {
		return xerr.New(xerr.CodeCampusBindFailed, "武大统一认证登录失败，请检查学号与密码").Wrap(err)
	}
	return s.store.Save(ctx, &model.Session{
		UserID:   userID,
		System:   model.SystemCAS,
		Username: username,
		Cookies:  cookies,
		BoundAt:  time.Now().Unix(),
	})
}

// Status 返回各子系统绑定状态（含已绑定的用户名）。
func (s *Service) Status(ctx context.Context, userID string) (map[string]model.BindStatus, error) {
	sess, err := s.store.Get(ctx, userID, model.SystemCAS)
	if err != nil {
		return nil, xerr.ErrInternal
	}
	casStatus := model.BindStatus{}
	if sess != nil {
		casStatus = model.BindStatus{Bound: true, Username: sess.Username}
	}
	return map[string]model.BindStatus{
		model.SystemCAS:   casStatus,
		model.SystemEdu:   {},
		model.SystemLib:   {},
		model.SystemBus:   {},
		model.SystemCard:  {},
		model.SystemPrint: {},
		model.SystemGym:   {},
	}, nil
}

// Unbind 解绑统一认证，清除会话。
func (s *Service) Unbind(ctx context.Context, userID string) error {
	return s.store.Delete(ctx, userID, model.SystemCAS)
}

// GetTimetable 返回课表。year/semester 为空则由教务系统按当前学期返回（待联调）。
func (s *Service) GetTimetable(ctx context.Context, userID, year, semester string) ([]model.ScheduleItem, error) {
	cookies, err := s.eduSession(ctx, userID)
	if err != nil {
		return nil, err
	}
	return s.edu.Timetable(ctx, cookies, year, semester)
}

// GetScores 返回成绩。
func (s *Service) GetScores(ctx context.Context, userID, year, semester string) ([]model.ScoreItem, error) {
	cookies, err := s.eduSession(ctx, userID)
	if err != nil {
		return nil, err
	}
	return s.edu.Scores(ctx, cookies, year, semester)
}

// GetGPA 拉取成绩并计算绩点。
func (s *Service) GetGPA(ctx context.Context, userID string) (model.GPA, error) {
	scores, err := s.GetScores(ctx, userID, "", "")
	if err != nil {
		return model.GPA{}, err
	}
	return ComputeGPA(scores), nil
}

// GetCardBalance 查询一卡通余额（只读）。
func (s *Service) GetCardBalance(ctx context.Context, userID string) (model.CardBalance, error) {
	cookies, err := s.cardSession(ctx, userID)
	if err != nil {
		return model.CardBalance{}, err
	}
	return s.card.Balance(ctx, cookies)
}

// GetBusLines 查询校车线路（轻认证，暂不经 SSO）。
func (s *Service) GetBusLines(ctx context.Context) ([]model.BusLine, error) {
	return s.bus.Lines(ctx)
}

// cardSession 返回一卡通会话；无则经 CAS SSO 换取并缓存。
func (s *Service) cardSession(ctx context.Context, userID string) (map[string]string, error) {
	// 一卡通 SSO 入口（对应 Ham 的 /ydd/login）。
	cardService := strings.TrimRight(s.cfg.Campus.CardBaseURL, "/") + "/ydd/login"
	return s.subsystemSession(ctx, userID, model.SystemCard, cardService)
}

// libSession 返回图书馆会话；无则经 CAS SSO 换取并缓存。
func (s *Service) libSession(ctx context.Context, userID string) (map[string]string, error) {
	// 图书馆 SSO 入口（对应 Ham 的 /rem/static/sso/login）。
	libService := strings.TrimRight(s.cfg.Campus.LibBaseURL, "/") + "/rem/static/sso/login"
	return s.subsystemSession(ctx, userID, model.SystemLib, libService)
}

// GetLibraryBuildings 查询图书馆楼栋。
func (s *Service) GetLibraryBuildings(ctx context.Context, userID string) ([]model.LibraryBuilding, error) {
	cookies, err := s.libSession(ctx, userID)
	if err != nil {
		return nil, err
	}
	return s.lib.Buildings(ctx, cookies)
}

// GetLibraryRooms 查询图书馆房间。
func (s *Service) GetLibraryRooms(ctx context.Context, userID, buildingID string) ([]model.LibraryRoom, error) {
	cookies, err := s.libSession(ctx, userID)
	if err != nil {
		return nil, err
	}
	return s.lib.Rooms(ctx, cookies, buildingID)
}

// GetLibrarySeats 查询座位布局/空闲。
func (s *Service) GetLibrarySeats(ctx context.Context, userID, roomID, date string) ([]model.Seat, error) {
	cookies, err := s.libSession(ctx, userID)
	if err != nil {
		return nil, err
	}
	return s.lib.Seats(ctx, cookies, roomID, date)
}

// GetLibraryCaptcha 生成预约滑块验证码。
func (s *Service) GetLibraryCaptcha(ctx context.Context, userID string) (model.Captcha, error) {
	cookies, err := s.libSession(ctx, userID)
	if err != nil {
		return model.Captcha{}, err
	}
	return s.lib.Captcha(ctx, cookies)
}

// BookSeat 预约座位（写操作，含滑块校验）。
func (s *Service) BookSeat(ctx context.Context, userID string, req model.BookRequest) (model.Booking, error) {
	cookies, err := s.libSession(ctx, userID)
	if err != nil {
		return model.Booking{}, err
	}
	return s.lib.Book(ctx, cookies, req)
}

// AutoBook 自动预约：取验证码 → 求解缺口/轨迹 → 提交预约（供定时任务调用）。
func (s *Service) AutoBook(ctx context.Context, userID, roomID, seatID, date, startTime, endTime string) (model.Booking, error) {
	cap, err := s.GetLibraryCaptcha(ctx, userID)
	if err != nil {
		return model.Booking{}, err
	}
	// 待联调：验证码图可能为 URL 而非 base64，此处先按 base64 解码。
	bg, err := base64.StdEncoding.DecodeString(cap.BgImage)
	if err != nil {
		return model.Booking{}, xerr.ErrCampusUpstream.Wrap(fmt.Errorf("验证码背景图非 base64（待联调：可能为 URL）"))
	}
	sl, err := base64.StdEncoding.DecodeString(cap.SlImage)
	if err != nil {
		return model.Booking{}, xerr.ErrCampusUpstream.Wrap(fmt.Errorf("验证码滑块图非 base64（待联调：可能为 URL）"))
	}
	sol, err := s.solver.Solve(bg, sl)
	if err != nil {
		return model.Booking{}, xerr.ErrCampusUpstream.Wrap(err)
	}
	return s.BookSeat(ctx, userID, model.BookRequest{
		RoomID:    roomID,
		SeatID:    seatID,
		Date:      date,
		StartTime: startTime,
		EndTime:   endTime,
		CaptchaID: cap.ID,
		CaptchaX:  sol.X,
	})
}

// CancelBooking 取消预约。
func (s *Service) CancelBooking(ctx context.Context, userID, bookingID string) error {
	cookies, err := s.libSession(ctx, userID)
	if err != nil {
		return err
	}
	return s.lib.Cancel(ctx, cookies, bookingID)
}

// Checkin 预约签到。
func (s *Service) Checkin(ctx context.Context, userID, bookingID string) error {
	cookies, err := s.libSession(ctx, userID)
	if err != nil {
		return err
	}
	return s.lib.Checkin(ctx, cookies, bookingID)
}

// printSession 返回云打印会话；无则经 CAS SSO 换取并缓存。
func (s *Service) printSession(ctx context.Context, userID string) (map[string]string, error) {
	// 云打印 SSO 入口（对应 Ham 的 /api/client/Auth/SSoPage）。
	printService := strings.TrimRight(s.cfg.Campus.PrintBaseURL, "/") + "/api/client/Auth/SSoPage"
	return s.subsystemSession(ctx, userID, model.SystemPrint, printService)
}

// gymSession 返回体育场馆会话；无则经 CAS SSO 换取并缓存。
func (s *Service) gymSession(ctx context.Context, userID string) (map[string]string, error) {
	// 体育场馆 SSO 入口（待联调：确切 SSO 入口路径需实测校准）。
	gymService := strings.TrimRight(s.cfg.Campus.GymBaseURL, "/") + "/api/Auth/SSoPage"
	return s.subsystemSession(ctx, userID, model.SystemGym, gymService)
}

// GetPrintStations 查询云打印点。
func (s *Service) GetPrintStations(ctx context.Context, userID string) ([]model.PrintStation, error) {
	cookies, err := s.printSession(ctx, userID)
	if err != nil {
		return nil, err
	}
	return s.print.Stations(ctx, cookies)
}

// SubmitPrint 上传文件并提交打印（写操作）。
func (s *Service) SubmitPrint(ctx context.Context, userID, filename string, fileBytes []byte, req model.PrintSubmitRequest) (model.PrintJob, error) {
	cookies, err := s.printSession(ctx, userID)
	if err != nil {
		return model.PrintJob{}, err
	}
	return s.print.Upload(ctx, cookies, filename, fileBytes, req)
}

// GetGymStadiums 查询体育场馆。
func (s *Service) GetGymStadiums(ctx context.Context, userID string) ([]model.GymStadium, error) {
	cookies, err := s.gymSession(ctx, userID)
	if err != nil {
		return nil, err
	}
	return s.gym.Stadiums(ctx, cookies)
}

// GetGymSessions 查询可预约场次。
func (s *Service) GetGymSessions(ctx context.Context, userID, stadiumID, date string) ([]model.GymSession, error) {
	cookies, err := s.gymSession(ctx, userID)
	if err != nil {
		return nil, err
	}
	return s.gym.Sessions(ctx, cookies, stadiumID, date)
}

// OrderGym 场馆下单（写操作）。
func (s *Service) OrderGym(ctx context.Context, userID string, req model.GymOrderRequest) (model.GymOrder, error) {
	cookies, err := s.gymSession(ctx, userID)
	if err != nil {
		return model.GymOrder{}, err
	}
	return s.gym.Order(ctx, cookies, req)
}

// eduSession 返回教务系统会话；无则经 CAS SSO 换取并缓存。
func (s *Service) eduSession(ctx context.Context, userID string) (map[string]string, error) {
	// 教务 SSO 入口（对应 Ham 的 fastLogin service 参数）。
	eduService := strings.TrimRight(s.cfg.Campus.EduBaseURL, "/") + "/sso/jznewsixlogin"
	return s.subsystemSession(ctx, userID, model.SystemEdu, eduService)
}

// subsystemSession 返回某子系统会话：先查缓存，缺失则用 CAS TGC 走 SSO 换取。
func (s *Service) subsystemSession(ctx context.Context, userID, system, ssoService string) (map[string]string, error) {
	sess, err := s.store.Get(ctx, userID, system)
	if err != nil {
		return nil, xerr.ErrInternal
	}
	if sess != nil {
		return sess.Cookies, nil
	}
	casSess, err := s.store.Get(ctx, userID, model.SystemCAS)
	if err != nil {
		return nil, xerr.ErrInternal
	}
	if casSess == nil {
		return nil, xerr.ErrCampusNotBound
	}
	client := cas.New(s.cfg.Campus.CASBaseURL, s.cfg.CampusTimeoutDuration())
	client.Restore(casSess.Cookies)
	cookies, err := client.SSO(ctx, ssoService)
	if err != nil {
		return nil, xerr.ErrCampusSessionExpired.Wrap(err)
	}
	_ = s.store.Save(ctx, &model.Session{
		UserID:   userID,
		System:   system,
		Username: casSess.Username,
		Cookies:  cookies,
		BoundAt:  time.Now().Unix(),
	})
	return cookies, nil
}

// ComputeGPA 按武大常见 4.0 加权平均绩点算法计算（纯本地，无上游依赖）。
func ComputeGPA(scores []model.ScoreItem) model.GPA {
	var totalPoint, totalCredit float64
	cnt := 0
	for _, sc := range scores {
		if sc.Credit <= 0 {
			continue
		}
		totalPoint += gradeToPoint(sc.Score) * sc.Credit
		totalCredit += sc.Credit
		cnt++
	}
	if totalCredit == 0 {
		return model.GPA{}
	}
	return model.GPA{
		GPA:         totalPoint / totalCredit,
		TotalCredit: totalCredit,
		CourseCount: cnt,
	}
}

// gradeToPoint 百分制→4.0 绩点映射（武大常见口径，待与官方校准）。
func gradeToPoint(score float64) float64 {
	switch {
	case score >= 90:
		return 4.0
	case score >= 85:
		return 3.7
	case score >= 82:
		return 3.3
	case score >= 78:
		return 3.0
	case score >= 75:
		return 2.7
	case score >= 72:
		return 2.3
	case score >= 68:
		return 2.0
	case score >= 64:
		return 1.5
	case score >= 60:
		return 1.0
	default:
		return 0
	}
}
