package repository

import (
	"errors"

	"gorm.io/gorm"

	"github.com/whu-campus/luojia-bbs/internal/model"
)

// MessageRepo 私信数据访问。
type MessageRepo struct {
	db *gorm.DB
}

func NewMessageRepo(db *gorm.DB) *MessageRepo { return &MessageRepo{db: db} }

// FindOrCreateConversation 按字典序规范化后查找会话，不存在则创建。
func (r *MessageRepo) FindOrCreateConversation(userA, userB string) (*model.Conversation, error) {
	if userA > userB {
		userA, userB = userB, userA
	}
	var conv model.Conversation
	err := r.db.Where("user_a = ? AND user_b = ?", userA, userB).First(&conv).Error
	if err == nil {
		return &conv, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	conv = model.Conversation{UserA: userA, UserB: userB}
	if cerr := r.db.Create(&conv).Error; cerr != nil {
		return nil, cerr
	}
	return &conv, nil
}

// CreateMessage 插入消息并更新会话的最后消息冗余字段（事务）。
func (r *MessageRepo) CreateMessage(m *model.Message, conv *model.Conversation) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(m).Error; err != nil {
			return err
		}
		return tx.Model(&model.Conversation{}).Where("id = ?", conv.ID).
			Updates(map[string]interface{}{"last_message": m.Content, "last_message_at": m.CreatedAt}).Error
	})
}

// ListConversations 列出用户参与的全部会话，按最后消息时间倒序。
func (r *MessageRepo) ListConversations(userID string, page, pageSize int) ([]model.Conversation, int64, error) {
	var total int64
	query := r.db.Model(&model.Conversation{}).Where("user_a = ? OR user_b = ?", userID, userID)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var list []model.Conversation
	err := query.Order("last_message_at DESC").
		Offset((page - 1) * pageSize).Limit(pageSize).Find(&list).Error
	return list, total, err
}

// GetConversation 按 ID 取会话。
func (r *MessageRepo) GetConversation(id string) (*model.Conversation, error) {
	var conv model.Conversation
	if err := r.db.Where("id = ?", id).First(&conv).Error; err != nil {
		return nil, err
	}
	return &conv, nil
}

// ListMessages 列出会话消息，按时间倒序（最新在前）。
func (r *MessageRepo) ListMessages(convID string, page, pageSize int) ([]model.Message, int64, error) {
	var total int64
	query := r.db.Model(&model.Message{}).Where("conversation_id = ?", convID)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var list []model.Message
	err := query.Order("created_at DESC").
		Offset((page - 1) * pageSize).Limit(pageSize).Find(&list).Error
	return list, total, err
}

// MarkRead 将会话内发给指定用户的消息标记已读。
func (r *MessageRepo) MarkRead(convID, userID string) error {
	return r.db.Model(&model.Message{}).
		Where("conversation_id = ? AND recipient_id = ? AND is_read = ?", convID, userID, false).
		UpdateColumn("is_read", true).Error
}

// CountUnread 统计发给指定用户的未读消息总数。
func (r *MessageRepo) CountUnread(userID string) (int64, error) {
	var count int64
	err := r.db.Model(&model.Message{}).
		Where("recipient_id = ? AND is_read = ?", userID, false).Count(&count).Error
	return count, err
}

type convUnread struct {
	ConversationID string
	Count          int64
}

// UnreadByConv 批量统计各会话未读数（发给指定用户、未读）。
func (r *MessageRepo) UnreadByConv(userID string, convIDs []string) (map[string]int64, error) {
	if len(convIDs) == 0 {
		return map[string]int64{}, nil
	}
	var rows []convUnread
	err := r.db.Model(&model.Message{}).
		Select("conversation_id, count(*) AS count").
		Where("recipient_id = ? AND is_read = ? AND conversation_id IN ?", userID, false, convIDs).
		Group("conversation_id").Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	res := make(map[string]int64, len(rows))
	for _, r := range rows {
		res[r.ConversationID] = r.Count
	}
	return res, nil
}
