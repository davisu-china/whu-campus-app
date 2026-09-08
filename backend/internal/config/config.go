// Package config 负责配置加载：YAML 文件 + 环境变量覆盖。
package config

import (
	"fmt"
	"strings"
	"time"

	"github.com/spf13/viper"
)

// Config 汇总所有配置。
type Config struct {
	Server     ServerConfig     `mapstructure:"server"`
	Database   DatabaseConfig   `mapstructure:"database"`
	Redis      RedisConfig      `mapstructure:"redis"`
	MinIO      MinIOConfig      `mapstructure:"minio"`
	JWT        JWTConfig        `mapstructure:"jwt"`
	SMTP       SMTPConfig       `mapstructure:"smtp"`
	TencentSES TencentSESConfig `mapstructure:"tencent_ses"`
	Upload     UploadConfig     `mapstructure:"upload"`
	Auth       AuthConfig       `mapstructure:"auth"`
	RateLimit  RateLimitConfig  `mapstructure:"ratelimit"`
}

type ServerConfig struct {
	Addr           string   `mapstructure:"addr"`
	Mode           string   `mapstructure:"mode"`
	TrustedProxies []string `mapstructure:"trusted_proxies"`
}

type DatabaseConfig struct {
	Host            string `mapstructure:"host"`
	Port            int    `mapstructure:"port"`
	User            string `mapstructure:"user"`
	Password        string `mapstructure:"password"`
	DBName          string `mapstructure:"dbname"`
	SSLMode         string `mapstructure:"sslmode"`
	MaxOpenConns    int    `mapstructure:"max_open_conns"`
	MaxIdleConns    int    `mapstructure:"max_idle_conns"`
	ConnMaxLifetime string `mapstructure:"conn_max_lifetime"`
}

type RedisConfig struct {
	Addr     string `mapstructure:"addr"`
	Password string `mapstructure:"password"`
	DB       int    `mapstructure:"db"`
}

type MinIOConfig struct {
	Endpoint            string `mapstructure:"endpoint"`
	AccessKey           string `mapstructure:"access_key"`
	SecretKey           string `mapstructure:"secret_key"`
	UseSSL              bool   `mapstructure:"use_ssl"`
	PublicImagesBucket  string `mapstructure:"public_images_bucket"`
	PublicAvatarsBucket string `mapstructure:"public_avatars_bucket"`
	PublicBaseURL       string `mapstructure:"public_base_url"` // 图片公开访问域名前缀，空则仅返回 object_key
}

type JWTConfig struct {
	AccessSecret  string `mapstructure:"access_secret"`
	RefreshSecret string `mapstructure:"refresh_secret"`
	AccessTTL     string `mapstructure:"access_ttl"`
	RefreshTTL    string `mapstructure:"refresh_ttl"`
}

type SMTPConfig struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	Username string `mapstructure:"username"`
	Password string `mapstructure:"password"`
	From     string `mapstructure:"from"`
	Mock     bool   `mapstructure:"mock"`
}

// TencentSESConfig 腾讯云邮件推送（SES）配置。
type TencentSESConfig struct {
	SecretID    string `mapstructure:"secret_id"`
	SecretKey   string `mapstructure:"secret_key"`
	FromAddress string `mapstructure:"from_address"`
	FromName    string `mapstructure:"from_name"`
	Region      string `mapstructure:"region"`
}

type UploadConfig struct {
	MaxImageMB int    `mapstructure:"max_image_mb"`
	PresignTTL string `mapstructure:"presign_ttl"`
}

type AuthConfig struct {
	AllowedEmailDomains []string `mapstructure:"allowed_email_domains"`
}

type RateLimitConfig struct {
	Enabled         bool `mapstructure:"enabled"`
	PostPerMinute   int  `mapstructure:"post_per_minute"`
	LoginPerMinute  int  `mapstructure:"login_per_minute"`
	UploadPerMinute int  `mapstructure:"upload_per_minute"`
}

// Load 从指定路径加载配置，并用环境变量覆盖。
func Load(path string) (*Config, error) {
	v := viper.New()

	if path != "" {
		v.SetConfigFile(path)
	} else {
		v.SetConfigName("config")
		v.SetConfigType("yaml")
		v.AddConfigPath("./configs")
		v.AddConfigPath(".")
	}

	// 环境变量覆盖：DB_PASSWORD -> database.password
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	if err := v.ReadInConfig(); err != nil {
		// 允许无配置文件（纯环境变量启动）
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("read config: %w", err)
		}
	}

	cfg := &Config{}
	if err := v.Unmarshal(cfg); err != nil {
		return nil, fmt.Errorf("unmarshal config: %w", err)
	}

	applyDefaults(cfg)
	return cfg, nil
}

func applyDefaults(cfg *Config) {
	if cfg.Server.Addr == "" {
		cfg.Server.Addr = ":8080"
	}
	if cfg.Server.Mode == "" {
		cfg.Server.Mode = "debug"
	}
	if cfg.Database.Host == "" {
		cfg.Database.Host = "127.0.0.1"
	}
	if cfg.Database.Port == 0 {
		cfg.Database.Port = 5432
	}
	if cfg.Database.SSLMode == "" {
		cfg.Database.SSLMode = "disable"
	}
	if cfg.Database.MaxOpenConns == 0 {
		cfg.Database.MaxOpenConns = 50
	}
	if cfg.Database.MaxIdleConns == 0 {
		cfg.Database.MaxIdleConns = 10
	}
	if cfg.Database.ConnMaxLifetime == "" {
		cfg.Database.ConnMaxLifetime = "1h"
	}
	if cfg.Redis.Addr == "" {
		cfg.Redis.Addr = "127.0.0.1:6379"
	}
	if cfg.TencentSES.Region == "" {
		cfg.TencentSES.Region = "ap-guangzhou"
	}
	if cfg.MinIO.PublicImagesBucket == "" {
		cfg.MinIO.PublicImagesBucket = "public-images"
	}
	if cfg.MinIO.PublicAvatarsBucket == "" {
		cfg.MinIO.PublicAvatarsBucket = "public-avatars"
	}
	if cfg.JWT.AccessTTL == "" {
		cfg.JWT.AccessTTL = "2h"
	}
	if cfg.JWT.RefreshTTL == "" {
		cfg.JWT.RefreshTTL = "336h"
	}
	if cfg.Upload.MaxImageMB == 0 {
		cfg.Upload.MaxImageMB = 10
	}
	if cfg.Upload.PresignTTL == "" {
		cfg.Upload.PresignTTL = "15m"
	}
	if len(cfg.Auth.AllowedEmailDomains) == 0 {
		cfg.Auth.AllowedEmailDomains = []string{"whu.edu.cn"}
	}
	if cfg.RateLimit.PostPerMinute == 0 {
		cfg.RateLimit.PostPerMinute = 5
	}
	if cfg.RateLimit.LoginPerMinute == 0 {
		cfg.RateLimit.LoginPerMinute = 5
	}
	if cfg.RateLimit.UploadPerMinute == 0 {
		cfg.RateLimit.UploadPerMinute = 10
	}
}

// AccessTTLDuration 解析 access token 时长。
func (c *Config) AccessTTLDuration() time.Duration {
	d, err := time.ParseDuration(c.JWT.AccessTTL)
	if err != nil {
		return 2 * time.Hour
	}
	return d
}

// RefreshTTLDuration 解析 refresh token 时长。
func (c *Config) RefreshTTLDuration() time.Duration {
	d, err := time.ParseDuration(c.JWT.RefreshTTL)
	if err != nil {
		return 14 * 24 * time.Hour
	}
	return d
}

// PresignTTLDuration 解析预签名 URL 时长。
func (c *Config) PresignTTLDuration() time.Duration {
	d, err := time.ParseDuration(c.Upload.PresignTTL)
	if err != nil {
		return 15 * time.Minute
	}
	return d
}

// ConnMaxLifetimeDuration 解析连接最大生命周期。
func (c *Config) ConnMaxLifetimeDuration() time.Duration {
	d, err := time.ParseDuration(c.Database.ConnMaxLifetime)
	if err != nil {
		return time.Hour
	}
	return d
}
