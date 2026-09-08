// Package handler 校园服务 HTTP 处理器。
package handler

import (
	"io"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/whu-campus/luojia-bbs/internal/campus/model"
	"github.com/whu-campus/luojia-bbs/internal/campus/service"
	"github.com/whu-campus/luojia-bbs/internal/middleware"
	"github.com/whu-campus/luojia-bbs/pkg/response"
	"github.com/whu-campus/luojia-bbs/pkg/xerr"
)

// CampusHandler 校园服务处理器。
type CampusHandler struct {
	svc *service.Service
}

// NewCampusHandler 创建校园服务处理器。
func NewCampusHandler(svc *service.Service) *CampusHandler {
	return &CampusHandler{svc: svc}
}

// Bind 绑定武大统一身份认证。
// POST /api/v1/campus/cas/bind
func (h *CampusHandler) Bind(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, xerr.ErrBadParam)
		return
	}
	if err := h.svc.Bind(c.Request.Context(), middleware.CurrentUserID(c), req.Username, req.Password); err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, nil)
}

// Status 查询绑定状态。
// GET /api/v1/campus/cas/status
func (h *CampusHandler) Status(c *gin.Context) {
	status, err := h.svc.Status(c.Request.Context(), middleware.CurrentUserID(c))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, status)
}

// Unbind 解绑统一认证。
// POST /api/v1/campus/cas/unbind
func (h *CampusHandler) Unbind(c *gin.Context) {
	if err := h.svc.Unbind(c.Request.Context(), middleware.CurrentUserID(c)); err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, nil)
}

// Timetable 课表。
// GET /api/v1/campus/course?year=&semester=
func (h *CampusHandler) Timetable(c *gin.Context) {
	list, err := h.svc.GetTimetable(c.Request.Context(), middleware.CurrentUserID(c), c.Query("year"), c.Query("semester"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

// Scores 成绩。
// GET /api/v1/campus/score?year=&semester=
func (h *CampusHandler) Scores(c *gin.Context) {
	list, err := h.svc.GetScores(c.Request.Context(), middleware.CurrentUserID(c), c.Query("year"), c.Query("semester"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

// GPA 绩点。
// GET /api/v1/campus/gpa
func (h *CampusHandler) GPA(c *gin.Context) {
	gpa, err := h.svc.GetGPA(c.Request.Context(), middleware.CurrentUserID(c))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, gpa)
}

// Card 一卡通余额。
// GET /api/v1/campus/card
func (h *CampusHandler) Card(c *gin.Context) {
	bal, err := h.svc.GetCardBalance(c.Request.Context(), middleware.CurrentUserID(c))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, bal)
}

// Bus 校车线路。
// GET /api/v1/campus/bus
func (h *CampusHandler) Bus(c *gin.Context) {
	lines, err := h.svc.GetBusLines(c.Request.Context())
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, lines)
}

// LibraryBuildings 图书馆楼栋。
// GET /api/v1/campus/library/buildings
func (h *CampusHandler) LibraryBuildings(c *gin.Context) {
	list, err := h.svc.GetLibraryBuildings(c.Request.Context(), middleware.CurrentUserID(c))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

// LibraryRooms 图书馆房间。
// GET /api/v1/campus/library/rooms?building=
func (h *CampusHandler) LibraryRooms(c *gin.Context) {
	list, err := h.svc.GetLibraryRooms(c.Request.Context(), middleware.CurrentUserID(c), c.Query("building"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

// LibrarySeats 座位布局/空闲。
// GET /api/v1/campus/library/seats?room=&date=
func (h *CampusHandler) LibrarySeats(c *gin.Context) {
	list, err := h.svc.GetLibrarySeats(c.Request.Context(), middleware.CurrentUserID(c), c.Query("room"), c.Query("date"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

// LibraryCaptcha 生成预约滑块验证码。
// GET /api/v1/campus/library/captcha
func (h *CampusHandler) LibraryCaptcha(c *gin.Context) {
	cap, err := h.svc.GetLibraryCaptcha(c.Request.Context(), middleware.CurrentUserID(c))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, cap)
}

// LibraryBooking 预约座位。
// POST /api/v1/campus/library/booking
func (h *CampusHandler) LibraryBooking(c *gin.Context) {
	var req model.BookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, xerr.ErrBadParam)
		return
	}
	bk, err := h.svc.BookSeat(c.Request.Context(), middleware.CurrentUserID(c), req)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, bk)
}

// LibraryCancel 取消预约。
// POST /api/v1/campus/library/cancel
func (h *CampusHandler) LibraryCancel(c *gin.Context) {
	var req struct {
		BookingID string `json:"booking_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, xerr.ErrBadParam)
		return
	}
	if err := h.svc.CancelBooking(c.Request.Context(), middleware.CurrentUserID(c), req.BookingID); err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, nil)
}

// LibraryCheckin 预约签到。
// POST /api/v1/campus/library/checkin
func (h *CampusHandler) LibraryCheckin(c *gin.Context) {
	var req struct {
		BookingID string `json:"booking_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, xerr.ErrBadParam)
		return
	}
	if err := h.svc.Checkin(c.Request.Context(), middleware.CurrentUserID(c), req.BookingID); err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, nil)
}

// PrintStations 云打印点列表。
// GET /api/v1/campus/print/stations
func (h *CampusHandler) PrintStations(c *gin.Context) {
	list, err := h.svc.GetPrintStations(c.Request.Context(), middleware.CurrentUserID(c))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

// PrintSubmit 上传文件并提交打印。
// POST /api/v1/campus/print/submit（multipart：file + station_id/copies/color/duplex）
func (h *CampusHandler) PrintSubmit(c *gin.Context) {
	stationID := c.PostForm("station_id")
	copies, _ := strconv.Atoi(c.PostForm("copies"))
	color := c.PostForm("color") == "true" || c.PostForm("color") == "1"
	duplex := c.PostForm("duplex") == "true" || c.PostForm("duplex") == "1"
	if stationID == "" || copies <= 0 {
		response.Fail(c, xerr.ErrBadParam)
		return
	}
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		response.Fail(c, xerr.ErrBadParam)
		return
	}
	defer file.Close()
	fileBytes, err := io.ReadAll(io.LimitReader(file, 50<<20))
	if err != nil {
		response.Fail(c, xerr.ErrBadParam)
		return
	}
	job, err := h.svc.SubmitPrint(c.Request.Context(), middleware.CurrentUserID(c), header.Filename, fileBytes, model.PrintSubmitRequest{
		StationID: stationID,
		Copies:    copies,
		Color:     color,
		Duplex:    duplex,
	})
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, job)
}

// GymStadiums 体育场馆列表。
// GET /api/v1/campus/gym/stadiums
func (h *CampusHandler) GymStadiums(c *gin.Context) {
	list, err := h.svc.GetGymStadiums(c.Request.Context(), middleware.CurrentUserID(c))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

// GymSessions 可预约场次。
// GET /api/v1/campus/gym/sessions?stadium=&date=
func (h *CampusHandler) GymSessions(c *gin.Context) {
	list, err := h.svc.GetGymSessions(c.Request.Context(), middleware.CurrentUserID(c), c.Query("stadium"), c.Query("date"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

// GymOrder 场馆下单。
// POST /api/v1/campus/gym/order
func (h *CampusHandler) GymOrder(c *gin.Context) {
	var req model.GymOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, xerr.ErrBadParam)
		return
	}
	order, err := h.svc.OrderGym(c.Request.Context(), middleware.CurrentUserID(c), req)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, order)
}
