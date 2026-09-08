package service

import (
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"

	"github.com/whu-campus/luojia-bbs/internal/filter"
	"github.com/whu-campus/luojia-bbs/internal/model"
	"github.com/whu-campus/luojia-bbs/internal/repository"
	"github.com/whu-campus/luojia-bbs/pkg/xerr"
)

// MessageService 私信。
type MessageService struct {
	msg     *repository.MessageRepo
	users   *repository.UserRepo
	matcher *filter.Matcher
}

func NewMessageService(msg *repository.MessageRepo, users *repository.UserRepo, matcher *filter.Matcher) *MessageService {
	return &MessageService{msg: msg, users: users, matcher: matcher}
}

// ConversationView 会话列表项（含对方信息与未读数）。
type ConversationView struct {
	ID            string            `json:"id"`
	OtherUser     *model.UserPublic `json:"other_user"`
	LastMessage   string            `json:"last_message"`
	LastMessageAt time.Time         `json:"last_message_at"`
	UnreadCount   int64             `json:"unread_count"`
}

// ListConversations 列出当前用户会话。
func (s *MessageService) ListConversations(userID string, page, pageSize int) ([]ConversationView, int64, error) {
	convs, total, err := s.msg.ListConversations(userID, page, pageSize)
	if err != nil {
		return nil, 0, xerr.New(xerr.CodeDBError, "查询会话失败").Wrap(err)
	}

	ids := make([]string, 0, len(convs))
	views := make([]ConversationView, 0, len(convs))
	otherIDs := make([]string, 0, len(convs))
	for _, c := range convs {
		ids = append(ids, c.ID)
		other := c.UserB
		if c.UserA != userID {
			other = c.UserA
		}
		otherIDs = append(otherIDs, other)
		views = append(views, ConversationView{
			ID:            c.ID,
			LastMessage:   c.LastMessage,
			LastMessageAt: c.LastMessageAt,
		})
	}

	// 未读角标
	unread, err := s.msg.UnreadByConv(userID, ids)
	if err != nil {
		return nil, 0, xerr.New(xerr.CodeDBError, "查询未读失败").Wrap(err)
	}

	// 对方公开信息（会话量小，逐条取，MVP 足够）
	for i, otherID := range otherIDs {
		u, err := s.users.FindByID(otherID)
		if err == nil {
			pub := u.ToPublic()
			views[i].OtherUser = &pub
		}
		views[i].UnreadCount = unread[views[i].ID]
	}

	return views, total, nil
}

// ListMessages 列出会话消息，并把发给当前用户的消息标记已读。
func (s *MessageService) ListMessages(userID, convID string, page, pageSize int) ([]model.Message, int64, error) {
	conv, err := s.msg.GetConversation(convID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, 0, xerr.New(xerr.CodeConvNotFound, "会话不存在")
	}
	if err != nil {
		return nil, 0, xerr.New(xerr.CodeDBError, "查询会话失败").Wrap(err)
	}
	if conv.UserA != userID && conv.UserB != userID {
		return nil, 0, xerr.New(xerr.CodeConvNotFound, "会话不存在")
	}

	list, total, err := s.msg.ListMessages(convID, page, pageSize)
	if err != nil {
		return nil, 0, xerr.New(xerr.CodeDBError, "查询消息失败").Wrap(err)
	}
	_ = s.msg.MarkRead(convID, userID) // 打开会话即已读，失败不影响返回
	return list, total, nil
}

// SendInput 发送私信入参。
type SendInput struct {
	ToUserID string `json:"to_user_id"`
	Content  string `json:"content"`
}

// SendResult 发送结果。
type SendResult struct {
	ConversationID string        `json:"conversation_id"`
	Message        *model.Message `json:"message"`
}

// Send 发送私信（无会话则自动创建）。
func (s *MessageService) Send(userID string, in SendInput) (*SendResult, error) {
	content := strings.TrimSpace(in.Content)
	if content == "" {
		return nil, xerr.New(xerr.CodeBadParam, "消息内容不能为空")
	}
	if len([]rune(content)) > 2000 {
		return nil, xerr.New(xerr.CodeBadParam, "消息内容过长")
	}
	if in.ToUserID == "" {
		return nil, xerr.New(xerr.CodeBadParam, "缺少收件人")
	}
	if in.ToUserID == userID {
		return nil, xerr.New(xerr.CodeMessageSelf, "不能给自己发私信")
	}

	if _, err := s.users.FindByID(in.ToUserID); errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, xerr.New(xerr.CodeUserNotFound, "收件人不存在")
	} else if err != nil {
		return nil, xerr.New(xerr.CodeDBError, "查询收件人失败").Wrap(err)
	}

	// 敏感词过滤：高危词拒绝，一般词放行（私信非公开）。
	if s.matcher != nil {
		if s.matcher.Match(content).Level == filter.MatchHigh {
			return nil, xerr.New(xerr.CodeSensitiveWord, "内容包含违规信息，无法发送")
		}
	}

	conv, err := s.msg.FindOrCreateConversation(userID, in.ToUserID)
	if err != nil {
		return nil, xerr.New(xerr.CodeDBError, "创建会话失败").Wrap(err)
	}

	m := &model.Message{
		ConversationID: conv.ID,
		SenderID:       userID,
		RecipientID:    in.ToUserID,
		Content:        content,
	}
	if err := s.msg.CreateMessage(m, conv); err != nil {
		return nil, xerr.New(xerr.CodeDBError, "发送失败").Wrap(err)
	}

	return &SendResult{ConversationID: conv.ID, Message: m}, nil
}

// UnreadCount 未读私信数。
func (s *MessageService) UnreadCount(userID string) (int64, error) {
	n, err := s.msg.CountUnread(userID)
	if err != nil {
		return 0, xerr.New(xerr.CodeDBError, "查询未读数失败").Wrap(err)
	}
	return n, nil
}
