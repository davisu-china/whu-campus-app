// Package storage 封装 MinIO 对象存储客户端与预签名上传。
package storage

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"

	"github.com/whu-campus/luojia-bbs/internal/config"
)

// Storage MinIO 客户端封装。
type Storage struct {
	client        *minio.Client // 内部访问（服务端读/管理）
	presignClient *minio.Client // 预签名客户端（面向浏览器直传，走公网域名）
	cfg           config.MinIOConfig
}

// New 创建 MinIO 客户端。
func New(cfg config.MinIOConfig) (*Storage, error) {
	client, err := newMinioClient(cfg.Endpoint, cfg.UseSSL, cfg.AccessKey, cfg.SecretKey)
	if err != nil {
		return nil, fmt.Errorf("new minio client: %w", err)
	}
	s := &Storage{client: client, presignClient: client, cfg: cfg}
	// 浏览器直传必须用公网域名签名（否则预签名 URL 指向内部 127.0.0.1，客户端无法访问）。
	if cfg.PublicEndpoint != "" {
		pc, err := newMinioClient(cfg.PublicEndpoint, true, cfg.AccessKey, cfg.SecretKey)
		if err != nil {
			return nil, fmt.Errorf("new public minio client: %w", err)
		}
		s.presignClient = pc
	}
	return s, nil
}

func newMinioClient(endpoint string, secure bool, ak, sk string) (*minio.Client, error) {
	return minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(ak, sk, ""),
		Secure: secure,
	})
}

// Client 返回底层客户端。
func (s *Storage) Client() *minio.Client { return s.client }

// PresignPut 生成上传预签名 PUT URL。
func (s *Storage) PresignPut(ctx context.Context, bucket, objectKey string, ttl time.Duration) (string, error) {
	u, err := s.presignClient.PresignedPutObject(ctx, bucket, objectKey, ttl)
	if err != nil {
		return "", fmt.Errorf("presign put: %w", err)
	}
	return u.String(), nil
}

// PresignPost 生成小程序上传用的 PostPolicy 表单（POST multipart）。
func (s *Storage) PresignPost(ctx context.Context, bucket, objectKey string, ttl time.Duration) (string, map[string]string, error) {
	policy := minio.NewPostPolicy()
	if err := policy.SetBucket(bucket); err != nil {
		return "", nil, fmt.Errorf("post policy bucket: %w", err)
	}
	if err := policy.SetKey(objectKey); err != nil {
		return "", nil, fmt.Errorf("post policy key: %w", err)
	}
	policy.SetExpires(time.Now().UTC().Add(ttl))
	u, form, err := s.presignClient.PresignedPostPolicy(ctx, policy)
	if err != nil {
		return "", nil, fmt.Errorf("presign post: %w", err)
	}
	return u.String(), form, nil
}

// PublicURL 帖子图片的公开访问 URL（images 桶）。
func (s *Storage) PublicURL(objectKey string) string {
	return s.PublicURLForBucket(s.cfg.PublicImagesBucket, objectKey)
}

// PublicURLForBucket 拼装指定桶的公开访问 URL。public_base_url 约定为「<origin>/<images 桶名>」，
// 这里把末尾的 images 桶名替换为 bucket 后拼 object_key。
func (s *Storage) PublicURLForBucket(bucket, objectKey string) string {
	base := strings.TrimRight(s.cfg.PublicBaseURL, "/")
	if base == "" {
		return objectKey
	}
	origin := strings.TrimRight(strings.TrimSuffix(base, s.cfg.PublicImagesBucket), "/")
	if origin == "" {
		origin = base
	}
	return origin + "/" + bucket + "/" + objectKey
}

// PublicImagesBucket 帖子/回复图片桶。
func (s *Storage) PublicImagesBucket() string { return s.cfg.PublicImagesBucket }

// PublicAvatarsBucket 头像桶。
func (s *Storage) PublicAvatarsBucket() string { return s.cfg.PublicAvatarsBucket }
