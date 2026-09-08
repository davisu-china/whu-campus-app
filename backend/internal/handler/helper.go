package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/whu-campus/luojia-bbs/pkg/response"
)

// pageParams 解析分页参数。
func pageParams(c *gin.Context) (int, int) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	return response.NormalizePage(page, size)
}
