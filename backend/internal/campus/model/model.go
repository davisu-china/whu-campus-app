// Package model 定义校园服务内部数据模型。
package model

// 子系统标识，对应武大各内部系统。凭据代理按 system 隔离会话。
const (
	SystemCAS   = "cas"   // 统一身份认证（会话主体）
	SystemEdu   = "edu"   // 教务系统（课表/成绩/绩点）
	SystemLib   = "lib"   // 图书馆座位预约
	SystemBus   = "bus"   // 校车查询
	SystemCard  = "card"  // 校园一卡通
	SystemPrint = "print" // 图书馆云打印
	SystemGym   = "gym"   // 体育场馆预约
)

// Session 用户在某个武大子系统持有的会话（凭据代理的核心状态）。
// 只存会话不存密码：Cookies 即子系统会话票据，密码用后即弃。
type Session struct {
	UserID   string            `json:"user_id"`  // 珞珈BBS 用户 ID
	System   string            `json:"system"`   // 子系统标识
	Username string            `json:"username"` // 学号/统一认证用户名
	Cookies  map[string]string `json:"cookies"`  // 子系统会话 cookie（如 CAS 的 TGC）
	BoundAt  int64             `json:"bound_at"` // 绑定时间（Unix 秒）
}

// BindStatus 单个子系统的绑定状态（接口返回给前端的 DTO）。
type BindStatus struct {
	Bound    bool   `json:"bound"`              // 是否已绑定
	Username string `json:"username,omitempty"` // 绑定的学号/用户名（已绑定时返回）
}

// ScheduleItem 一节课。
type ScheduleItem struct {
	CourseName   string `json:"course_name"`
	Teacher      string `json:"teacher"`
	Weeks        string `json:"weeks"`         // 周次区间，如 "1-16"
	DayOfWeek    int    `json:"day_of_week"`   // 1-7
	StartSection int    `json:"start_section"` // 起始节次
	EndSection   int    `json:"end_section"`   // 结束节次
	Location     string `json:"location"`
}

// ScoreItem 一门课的成绩。
type ScoreItem struct {
	CourseName string  `json:"course_name"`
	Score      float64 `json:"score"` // 百分制；等级制/非百分制的映射待联调
	Credit     float64 `json:"credit"`
	CourseType string  `json:"course_type"` // 必修/选修/通识等
	Semester   string  `json:"semester"`    // 如 "2024-2025-1"
}

// GPA 绩点计算结果。
type GPA struct {
	GPA         float64 `json:"gpa"`          // 加权平均绩点
	TotalCredit float64 `json:"total_credit"` // 参与计算的总学分
	CourseCount int     `json:"course_count"`
}

// CardBalance 一卡通余额（只读）。
type CardBalance struct {
	CardNo  string  `json:"card_no"` // 卡号（建议后端脱敏后返回）
	Balance float64 `json:"balance"` // 余额（元）
}

// BusLine 一条校车线路。
type BusLine struct {
	Name  string   `json:"name"`  // 线路名
	Stops []string `json:"stops"` // 站点（有序）
}

// LibraryBuilding 图书馆楼栋。
type LibraryBuilding struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// LibraryRoom 图书馆房间/阅览室。
type LibraryRoom struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Building string `json:"building"`
}

// Seat 座位布局与空闲状态（只读查询）。
type Seat struct {
	ID       string `json:"id"`
	Room     string `json:"room"`
	Name     string `json:"name"`      // 座位号，如 "001"
	Status   string `json:"status"`    // 待联调：空闲/占用枚举
	HasPower bool   `json:"has_power"` // 是否靠电源
}

// Captcha 图书馆预约滑块验证码生成结果。
type Captcha struct {
	ID      string `json:"id"`       // 验证码标识
	BgImage string `json:"bg_image"` // 背景图（base64 或 URL）
	SlImage string `json:"sl_image"` // 滑块图（base64 或 URL）
}

// BookRequest 预约座位请求（写操作）。
type BookRequest struct {
	RoomID    string `json:"room_id"`
	SeatID    string `json:"seat_id"`
	Date      string `json:"date"`       // yyyy-MM-dd
	StartTime string `json:"start_time"` // HH:mm
	EndTime   string `json:"end_time"`   // HH:mm
	CaptchaID string `json:"captcha_id"` // 滑块验证码标识
	CaptchaX  int    `json:"captcha_x"`  // 滑块横向偏移（px）；顶象若需轨迹签名需二期逆向
}

// Booking 一条预约记录。
type Booking struct {
	ID        string `json:"id"`
	SeatID    string `json:"seat_id"`
	Date      string `json:"date"`
	TimeRange string `json:"time_range"` // "HH:mm-HH:mm"
	Status    string `json:"status"`
}

// PrintStation 云打印点/打印机。
type PrintStation struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Location string `json:"location"`
	Status   string `json:"status"` // 待联调：在线/离线枚举
}

// PrintSubmitRequest 提交打印请求（文件经 multipart 单独上传）。
type PrintSubmitRequest struct {
	StationID string `json:"station_id"`
	Copies    int    `json:"copies"`
	Color     bool   `json:"color"`  // 彩色
	Duplex    bool   `json:"duplex"` // 双面
}

// PrintJob 打印任务结果。
type PrintJob struct {
	ID     string `json:"id"`
	Status string `json:"status"`
}

// GymStadium 体育场馆。
type GymStadium struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Location string `json:"location"`
}

// GymSession 一个可预约场次。
type GymSession struct {
	ID        string  `json:"id"`
	StadiumID string  `json:"stadium_id"`
	Sport     string  `json:"sport"` // 项目，如羽毛球/篮球
	Date      string  `json:"date"`
	TimeRange string  `json:"time_range"` // "HH:mm-HH:mm"
	Price     float64 `json:"price"`
	Available bool    `json:"available"`
}

// GymOrderRequest 场馆预约/下单请求。
type GymOrderRequest struct {
	SessionID string `json:"session_id"`
	Count     int    `json:"count"`
}

// GymOrder 场馆下单结果。
type GymOrder struct {
	ID     string `json:"id"`
	Status string `json:"status"`
}
