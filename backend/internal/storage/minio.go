// Package storage 封装 MinIO 对象存储客户端与预签名上传。
package storage

import (
	"context"
	"fmt"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"

	"github.com/whu-campus/luojia-bbs/internal/config"
)

// Storage MinIO 客户端封装。
type Storage struct {
	client *minio.Client
	cfg    config.MinIOConfig
}

// New 创建 MinIO 客户端。
func New(cfg config.MinIOConfig) (*Storage, error) {
	client, err := minio.New(cfg.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKey, cfg.SecretKey, ""),
		Secure: cfg.UseSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("new minio client: %w", err)
	}
	return &Storage{client: client, cfg: cfg}, nil
}

// Client 返回底层客户端。
func (s *Storage) Client() *minio.Client { return s.client }

// PresignPut 生成上传预签名 PUT URL。
func (s *Storage) PresignPut(ctx context.Context, bucket, objectKey string, ttl time.Duration) (string, error) {
	u, err := s.client.PresignedPutObject(ctx, bucket, objectKey, ttl)
	if err != nil {
		return "", fmt.Errorf("presign put: %w", err)
	}
	return u.String(), nil
}

// PublicImagesBucket 帖子/回复图片桶。
func (s *Storage) PublicImagesBucket() string { return s.cfg.PublicImagesBucket }

// PublicAvatarsBucket 头像桶。
func (s *Storage) PublicAvatarsBucket() string { return s.cfg.PublicAvatarsBucket }
