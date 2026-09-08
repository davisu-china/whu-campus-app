// Package store 负责校园服务会话的持久化（Redis）。
package store

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/whu-campus/luojia-bbs/internal/cache"
	"github.com/whu-campus/luojia-bbs/internal/campus/model"
)

// Store 校园服务会话存储。
type Store struct {
	cache *cache.Client
	ttl   time.Duration
}

// New 创建会话存储。
func New(c *cache.Client, ttl time.Duration) *Store {
	return &Store{cache: c, ttl: ttl}
}

// sessionKey 会话缓存键，按子系统 + 用户隔离。
func sessionKey(userID, system string) string {
	return fmt.Sprintf("campus:session:%s:%s", system, userID)
}

// Save 写入会话。
func (s *Store) Save(ctx context.Context, sess *model.Session) error {
	b, err := json.Marshal(sess)
	if err != nil {
		return err
	}
	return s.cache.Set(ctx, sessionKey(sess.UserID, sess.System), string(b), s.ttl)
}

// Get 读取会话；不存在返回 (nil, nil)。
func (s *Store) Get(ctx context.Context, userID, system string) (*model.Session, error) {
	v, err := s.cache.Get(ctx, sessionKey(userID, system))
	if err != nil {
		return nil, err
	}
	if v == "" {
		return nil, nil
	}
	var sess model.Session
	if err := json.Unmarshal([]byte(v), &sess); err != nil {
		return nil, err
	}
	return &sess, nil
}

// Has 判断会话是否存在。
func (s *Store) Has(ctx context.Context, userID, system string) (bool, error) {
	return s.cache.Exists(ctx, sessionKey(userID, system))
}

// Delete 删除会话。
func (s *Store) Delete(ctx context.Context, userID, system string) error {
	return s.cache.Del(ctx, sessionKey(userID, system))
}
