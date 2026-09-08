package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/whu-campus/luojia-bbs/internal/middleware"
	"github.com/whu-campus/luojia-bbs/internal/service"
	"github.com/whu-campus/luojia-bbs/pkg/response"
	"github.com/whu-campus/luojia-bbs/pkg/xerr"
)

// AdminHandler 运营后台接口（需 role ≥ 2）。
type AdminHandler struct {
	svc *service.AdminService
}

func NewAdminHandler(svc *service.AdminService) *AdminHandler { return &AdminHandler{svc: svc} }

func (h *AdminHandler) operator(c *gin.Context) string { return middleware.CurrentUserID(c) }

// ---- 内容审核 ----

func (h *AdminHandler) ListPendingPosts(c *gin.Context) {
	page, size := pageParams(c)
	list, total, err := h.svc.ListPendingPosts(page, size)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OKPage(c, list, total, page, size)
}

func (h *AdminHandler) ReviewPost(c *gin.Context) {
	var req struct {
		Action string `json:"action" binding:"required"` // approve / reject
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, xerr.ErrBadParam)
		return
	}
	if err := h.svc.ReviewPost(h.operator(c), c.Param("id"), req.Action, req.Reason); err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, nil)
}

func (h *AdminHandler) PinPost(c *gin.Context) {
	var req struct {
		Pinned bool `json:"pinned"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, xerr.ErrBadParam)
		return
	}
	if err := h.svc.PinPost(h.operator(c), c.Param("id"), req.Pinned); err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, nil)
}

func (h *AdminHandler) FeaturePost(c *gin.Context) {
	var req struct {
		Featured bool `json:"featured"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, xerr.ErrBadParam)
		return
	}
	if err := h.svc.FeaturePost(h.operator(c), c.Param("id"), req.Featured); err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, nil)
}

func (h *AdminHandler) DeletePost(c *gin.Context) {
	var req struct {
		Reason string `json:"reason"`
	}
	_ = c.ShouldBindJSON(&req)
	if err := h.svc.DeletePost(h.operator(c), c.Param("id"), req.Reason); err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, nil)
}

// ---- 举报处理 ----

func (h *AdminHandler) ListReports(c *gin.Context) {
	page, size := pageParams(c)
	var status *int
	if s, err := strconv.Atoi(c.Query("status")); err == nil {
		status = &s
	}
	list, total, err := h.svc.ListReports(status, page, size)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OKPage(c, list, total, page, size)
}

func (h *AdminHandler) HandleReport(c *gin.Context) {
	var req struct {
		Action string `json:"action" binding:"required"` // approve(处理) / reject(驳回)
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, xerr.ErrBadParam)
		return
	}
	if err := h.svc.HandleReport(h.operator(c), c.Param("id"), req.Action); err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, nil)
}

// ---- 用户管理 ----

func (h *AdminHandler) ListUsers(c *gin.Context) {
	page, size := pageParams(c)
	q := c.Query("q")
	list, total, err := h.svc.ListUsers(page, size, q)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OKPage(c, list, total, page, size)
}

func (h *AdminHandler) BanUser(c *gin.Context) {
	var req struct {
		BanType       string `json:"ban_type" binding:"required"` // mute / ban
		Reason        string `json:"reason"`
		DurationHours int    `json:"duration_hours"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, xerr.ErrBadParam)
		return
	}
	if err := h.svc.BanUser(h.operator(c), c.Param("id"), req.BanType, req.Reason, req.DurationHours); err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, nil)
}

// ---- 敏感词 ----

func (h *AdminHandler) ListSensitiveWords(c *gin.Context) {
	list, err := h.svc.ListSensitiveWords()
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

func (h *AdminHandler) AddSensitiveWord(c *gin.Context) {
	var req struct {
		Word     string `json:"word" binding:"required"`
		Category string `json:"category"`
		Level    int    `json:"level"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, xerr.ErrBadParam)
		return
	}
	if err := h.svc.AddSensitiveWord(req.Word, req.Category, req.Level); err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, nil)
}

func (h *AdminHandler) DeleteSensitiveWord(c *gin.Context) {
	if err := h.svc.DeleteSensitiveWord(c.Param("id")); err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, nil)
}

// ---- 板块/标签/词典 ----

func (h *AdminHandler) CreateBoard(c *gin.Context) {
	var req struct {
		CategoryID  string `json:"category_id" binding:"required"`
		Name        string `json:"name" binding:"required"`
		Slug        string `json:"slug" binding:"required"`
		Description string `json:"description"`
		FieldMode   int    `json:"field_mode"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, xerr.ErrBadParam)
		return
	}
	b, err := h.svc.CreateBoard(req.CategoryID, req.Name, req.Slug, req.Description, req.FieldMode)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, b)
}

func (h *AdminHandler) CreateTag(c *gin.Context) {
	var req struct {
		BoardID    string `json:"board_id" binding:"required"`
		Name       string `json:"name" binding:"required"`
		IsRequired bool   `json:"is_required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, xerr.ErrBadParam)
		return
	}
	t, err := h.svc.CreateTag(req.BoardID, req.Name, req.IsRequired)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, t)
}

func (h *AdminHandler) ListDicts(c *gin.Context) {
	list, err := h.svc.ListDicts(c.Query("type"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

func (h *AdminHandler) CreateDict(c *gin.Context) {
	var req struct {
		DictType string `json:"dict_type" binding:"required"`
		Name     string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, xerr.ErrBadParam)
		return
	}
	d, err := h.svc.CreateDict(req.DictType, req.Name)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, d)
}

func (h *AdminHandler) DeleteDict(c *gin.Context) {
	if err := h.svc.DeleteDict(c.Param("id")); err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, nil)
}

// ---- 数据看板 ----

func (h *AdminHandler) Stats(c *gin.Context) {
	stats, err := h.svc.Stats()
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, stats)
}
