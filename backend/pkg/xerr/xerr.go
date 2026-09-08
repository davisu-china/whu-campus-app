// Package xerr 定义统一业务错误码与错误类型。
// code 为业务错误码（响应体中的 code 字段），HTTP 为建议的 HTTP 状态码。
package xerr

import (
	"fmt"
	"net/http"
)

// Error 携带业务错误码、用户可读信息与 HTTP 状态码。
type Error struct {
	Code int    // 业务错误码
	Msg  string // 用户可读信息
	HTTP int    // HTTP 状态码
}

func (e *Error) Error() string {
	return fmt.Sprintf("code=%d msg=%s", e.Code, e.Msg)
}

// New 构造业务错误。
func New(code int, msg string) *Error {
	return &Error{Code: code, Msg: msg, HTTP: http.StatusOK}
}

// WithHTTP 指定 HTTP 状态码（默认 200，统一响应体承载错误码）。
func (e *Error) WithHTTP(status int) *Error {
	e.HTTP = status
	return e
}

// Wrap 携带底层错误，仅用于日志排查，不对外暴露。
func (e *Error) Wrap(err error) *Error {
	if err != nil {
		e.Msg = fmt.Sprintf("%s: %v", e.Msg, err)
	}
	return e
}

// 通用错误码分段：
//
//	0           成功
//	1xxx        通用
//	2xxx        认证/用户
//	3xxx        信息架构（分类/板块/标签/词典）
//	4xxx        内容（帖子/回复）
//	5xxx        互动（点赞/收藏/举报）
//	6xxx        治理/权限
//	7xxx        通知
//	9xxx        系统内部
const (
	CodeOK = 0

	// 1xxx 通用
	CodeBadParam  = 10001
	CodeNotFound  = 10002
	CodeConflict  = 10003
	CodeRateLimit = 10004
	CodeInternal  = 10999

	// 2xxx 认证/用户
	CodeUnauthorized       = 20001
	CodeTokenExpired       = 20002
	CodeEmailDomainInvalid = 20003
	CodeVerifyCodeWrong    = 20004
	CodeVerifyCodeExpired  = 20005
	CodeForbidden          = 20006
	CodeUserBanned         = 20007
	CodeVerifyRequired     = 20008

	// 3xxx 信息架构
	CodeBoardNotFound = 30001
	CodeTagInvalid    = 30002
	CodeTagRequired   = 30003

	// 4xxx 内容
	CodePostNotFound   = 40001
	CodePostNotVisible = 40002
	CodeReplyNotFound  = 40003
	CodeSensitiveWord  = 40004

	// 5xxx 互动
	CodeAlreadyLiked = 50001

	// 6xxx 治理/权限
	CodeNotAuthor    = 60001
	CodeNoPermission = 60002

	// 9xxx 系统
	CodeDBError    = 90001
	CodeCacheErr   = 90002
	CodeStorageErr = 90003
)

// 预定义错误。
var (
	ErrBadParam     = New(CodeBadParam, "参数错误")
	ErrNotFound     = New(CodeNotFound, "资源不存在")
	ErrInternal     = New(CodeInternal, "系统繁忙，请稍后再试")
	ErrUnauthorized = New(CodeUnauthorized, "未登录或登录已过期").WithHTTP(http.StatusUnauthorized)
	ErrForbidden    = New(CodeForbidden, "无权访问").WithHTTP(http.StatusForbidden)
)
