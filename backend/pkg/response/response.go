// Package response 提供统一响应结构与分页结构。
package response

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/whu-campus/luojia-bbs/pkg/xerr"
)

// Body 统一响应体：code=0 成功，非 0 为业务错误码。
type Body struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data"`
}

// Page 分页数据载体。
type Page struct {
	List     interface{} `json:"list"`
	Total    int64       `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"page_size"`
}

// OK 成功响应。
func OK(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Body{Code: xerr.CodeOK, Message: "ok", Data: data})
}

// OKPage 分页成功响应。
func OKPage(c *gin.Context, list interface{}, total int64, page, pageSize int) {
	c.JSON(http.StatusOK, Body{
		Code:    xerr.CodeOK,
		Message: "ok",
		Data:    Page{List: list, Total: total, Page: page, PageSize: pageSize},
	})
}

// Fail 业务错误响应。传入 xerr.Error 或普通 error。
func Fail(c *gin.Context, err error) {
	if e, ok := err.(*xerr.Error); ok {
		c.JSON(e.HTTP, Body{Code: e.Code, Message: e.Msg, Data: nil})
		return
	}
	c.JSON(http.StatusOK, Body{Code: xerr.CodeInternal, Message: err.Error(), Data: nil})
}
