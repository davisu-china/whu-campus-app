package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/whu-campus/luojia-bbs/internal/service"
	"github.com/whu-campus/luojia-bbs/pkg/response"
)

// InfoHandler 信息架构接口。
type InfoHandler struct {
	svc *service.InfoService
}

func NewInfoHandler(svc *service.InfoService) *InfoHandler { return &InfoHandler{svc: svc} }

func (h *InfoHandler) Categories(c *gin.Context) {
	tree, err := h.svc.CategoryTree()
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, tree)
}

func (h *InfoHandler) BoardDetail(c *gin.Context) {
	b, err := h.svc.BoardDetail(c.Param("id"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, b)
}

func (h *InfoHandler) BoardTags(c *gin.Context) {
	tags, err := h.svc.BoardTags(c.Param("id"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, tags)
}

func (h *InfoHandler) DictSearch(c *gin.Context) {
	dictType := c.Query("type")
	q := c.Query("q")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	items, err := h.svc.SearchDict(dictType, q, limit)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, items)
}
