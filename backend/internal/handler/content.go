package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/whu-campus/luojia-bbs/internal/middleware"
	"github.com/whu-campus/luojia-bbs/internal/service"
	"github.com/whu-campus/luojia-bbs/pkg/response"
	"github.com/whu-campus/luojia-bbs/pkg/xerr"
)

// ContentHandler 内容接口：帖子、回复、搜索、上传。
type ContentHandler struct {
	svc *service.ContentService
}

func NewContentHandler(svc *service.ContentService) *ContentHandler { return &ContentHandler{svc: svc} }

func (h *ContentHandler) HomeFeed(c *gin.Context) {
	page, size := pageParams(c)
	list, total, err := h.svc.HomeFeed(page, size)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OKPage(c, list, total, page, size)
}

func (h *ContentHandler) HomeHot(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	list, err := h.svc.HomeHot(limit)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

func (h *ContentHandler) BoardPosts(c *gin.Context) {
	page, size := pageParams(c)
	sort := c.DefaultQuery("sort", "comprehensive")
	tagID := c.Query("tag_id")
	list, total, err := h.svc.BoardPosts(c.Param("id"), sort, tagID, page, size)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OKPage(c, list, total, page, size)
}

func (h *ContentHandler) PostDetail(c *gin.Context) {
	view, err := h.svc.PostDetail(c.Param("id"), middleware.CurrentUserID(c))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, view)
}

func (h *ContentHandler) CreatePost(c *gin.Context) {
	author := middleware.CurrentUser(c)
	if author == nil {
		response.Fail(c, xerr.ErrUnauthorized)
		return
	}
	var req service.CreatePostInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, xerr.ErrBadParam)
		return
	}
	view, err := h.svc.CreatePost(author, req)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, view)
}

func (h *ContentHandler) UpdatePost(c *gin.Context) {
	author := middleware.CurrentUser(c)
	if author == nil {
		response.Fail(c, xerr.ErrUnauthorized)
		return
	}
	var req service.UpdatePostInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, xerr.ErrBadParam)
		return
	}
	view, err := h.svc.UpdatePost(author, c.Param("id"), req)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, view)
}

func (h *ContentHandler) DeletePost(c *gin.Context) {
	author := middleware.CurrentUser(c)
	if author == nil {
		response.Fail(c, xerr.ErrUnauthorized)
		return
	}
	if err := h.svc.DeletePost(author, c.Param("id")); err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, nil)
}

func (h *ContentHandler) ListReplies(c *gin.Context) {
	list, err := h.svc.ListReplies(c.Param("id"), middleware.CurrentUserID(c))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

func (h *ContentHandler) CreateReply(c *gin.Context) {
	author := middleware.CurrentUser(c)
	if author == nil {
		response.Fail(c, xerr.ErrUnauthorized)
		return
	}
	var req service.CreateReplyInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, xerr.ErrBadParam)
		return
	}
	view, err := h.svc.CreateReply(author, c.Param("id"), req)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, view)
}

func (h *ContentHandler) Search(c *gin.Context) {
	page, size := pageParams(c)
	q := c.Query("q")
	boardID := c.Query("board_id")
	tagID := c.Query("tag_id")
	list, total, err := h.svc.Search(q, boardID, tagID, page, size)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OKPage(c, list, total, page, size)
}

func (h *ContentHandler) PresignUpload(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	var req struct {
		Filename string `json:"filename" binding:"required"`
		Client   string `json:"client"`  // web | miniapp，默认 web
		Purpose  string `json:"purpose"` // image（默认，帖子图片）| avatar（头像）
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, xerr.ErrBadParam)
		return
	}
	res, err := h.svc.PresignUpload(c.Request.Context(), userID, req.Filename, req.Client, req.Purpose)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, res)
}

func (h *ContentHandler) MyPosts(c *gin.Context) {
	page, size := pageParams(c)
	list, total, err := h.svc.MyPosts(middleware.CurrentUserID(c), page, size)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OKPage(c, list, total, page, size)
}

// UserPosts 某用户的公开帖子列表（复用 MyPosts 查询）。
func (h *ContentHandler) UserPosts(c *gin.Context) {
	page, size := pageParams(c)
	list, total, err := h.svc.MyPosts(c.Param("id"), page, size)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OKPage(c, list, total, page, size)
}

func (h *ContentHandler) MyReplies(c *gin.Context) {
	page, size := pageParams(c)
	list, total, err := h.svc.MyReplies(middleware.CurrentUserID(c), page, size)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OKPage(c, list, total, page, size)
}

func (h *ContentHandler) MyFavorites(c *gin.Context) {
	page, size := pageParams(c)
	list, total, err := h.svc.MyFavorites(middleware.CurrentUserID(c), page, size)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OKPage(c, list, total, page, size)
}
