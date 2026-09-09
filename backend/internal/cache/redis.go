// Package cache 封装 Redis 客户端。
package cache

import (
	"context"
	"encoding/json"
	"time"

	"github.com/redis/go-redis/v9"
)

// Client Redis 客户端封装。
type Client struct {
	rdb *redis.Client
}

// New 创建 Redis 客户端。
func New(addr, password string, db int) *Client {
	rdb := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       db,
	})
	return &Client{rdb: rdb}
}

// RDB 返回底层客户端，供复杂操作使用。
func (c *Client) RDB() *redis.Client { return c.rdb }

// Ping 探活。
func (c *Client) Ping(ctx context.Context) error {
	return c.rdb.Ping(ctx).Err()
}

// Close 关闭连接。
func (c *Client) Close() error { return c.rdb.Close() }

// Get 读取字符串值；key 不存在返回 ("", nil)。
func (c *Client) Get(ctx context.Context, key string) (string, error) {
	v, err := c.rdb.Get(ctx, key).Result()
	if err == redis.Nil {
		return "", nil
	}
	return v, err
}

// Set 写入字符串，带过期时间。
func (c *Client) Set(ctx context.Context, key, val string, ttl time.Duration) error {
	return c.rdb.Set(ctx, key, val, ttl).Err()
}

// Del 删除 key。
func (c *Client) Del(ctx context.Context, keys ...string) error {
	if len(keys) == 0 {
		return nil
	}
	return c.rdb.Del(ctx, keys...).Err()
}

// Incr 自增，返回自增后的值。
func (c *Client) Incr(ctx context.Context, key string) (int64, error) {
	return c.rdb.Incr(ctx, key).Result()
}

// Decr 自减。
func (c *Client) Decr(ctx context.Context, key string) (int64, error) {
	return c.rdb.Decr(ctx, key).Result()
}

// Expire 设置过期时间。
func (c *Client) Expire(ctx context.Context, key string, ttl time.Duration) error {
	return c.rdb.Expire(ctx, key, ttl).Err()
}

// IncrWithTTL 自增并在首次时设置过期（用于限流窗口）。
func (c *Client) IncrWithTTL(ctx context.Context, key string, ttl time.Duration) (int64, error) {
	pipe := c.rdb.TxPipeline()
	incr := pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, ttl)
	if _, err := pipe.Exec(ctx); err != nil {
		return 0, err
	}
	return incr.Val(), nil
}

// Exists 判断 key 是否存在。
func (c *Client) Exists(ctx context.Context, key string) (bool, error) {
	n, err := c.rdb.Exists(ctx, key).Result()
	if err != nil {
		return false, err
	}
	return n > 0, nil
}

// ZAdd 向有序集合添加成员。
func (c *Client) ZAdd(ctx context.Context, key string, score float64, member string) error {
	return c.rdb.ZAdd(ctx, key, redis.Z{Score: score, Member: member}).Err()
}

// ZRevRange 返回有序集合按分数降序的成员（含分数）。
func (c *Client) ZRevRangeWithScores(ctx context.Context, key string, start, stop int64) ([]redis.Z, error) {
	return c.rdb.ZRevRangeWithScores(ctx, key, start, stop).Result()
}

// GetJSON 读取并反序列化 JSON 到 dest；miss 返回 (false, nil)。
func (c *Client) GetJSON(ctx context.Context, key string, dest any) (bool, error) {
	v, err := c.Get(ctx, key)
	if err != nil {
		return false, err
	}
	if v == "" {
		return false, nil
	}
	if err := json.Unmarshal([]byte(v), dest); err != nil {
		return false, err
	}
	return true, nil
}

// SetJSON 序列化 val 并写入，带过期时间。
func (c *Client) SetJSON(ctx context.Context, key string, val any, ttl time.Duration) error {
	b, err := json.Marshal(val)
	if err != nil {
		return err
	}
	return c.Set(ctx, key, string(b), ttl)
}

// HIncrBy 哈希字段自增，返回自增后的值。
func (c *Client) HIncrBy(ctx context.Context, key, field string, delta int64) (int64, error) {
	return c.rdb.HIncrBy(ctx, key, field, delta).Result()
}

// HGetAll 返回整个哈希。
func (c *Client) HGetAll(ctx context.Context, key string) (map[string]string, error) {
	return c.rdb.HGetAll(ctx, key).Result()
}

// HDel 删除哈希字段。
func (c *Client) HDel(ctx context.Context, key string, fields ...string) error {
	if len(fields) == 0 {
		return nil
	}
	return c.rdb.HDel(ctx, key, fields...).Err()
}

// DelByPattern 按模式删除所有匹配的 key（SCAN 分批，避免 KEYS 阻塞）。
func (c *Client) DelByPattern(ctx context.Context, pattern string) error {
	iter := c.rdb.Scan(ctx, 0, pattern, 100).Iterator()
	keys := make([]string, 0)
	for iter.Next(ctx) {
		keys = append(keys, iter.Val())
	}
	if err := iter.Err(); err != nil {
		return err
	}
	return c.Del(ctx, keys...)
}
