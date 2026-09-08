// Package auth 负责 JWT 签发/校验与邮箱验证码。
package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"github.com/whu-campus/luojia-bbs/internal/config"
)

// Claims JWT 载荷。
type Claims struct {
	UserID string `json:"uid"`
	Role   int    `json:"role"`
	jwt.RegisteredClaims
}

// TokenManager 签发与校验 Access/Refresh Token。
type TokenManager struct {
	accessSecret  []byte
	refreshSecret []byte
	accessTTL     time.Duration
	refreshTTL    time.Duration
}

// NewTokenManager 构造。
func NewTokenManager(cfg config.JWTConfig) *TokenManager {
	return &TokenManager{
		accessSecret:  []byte(cfg.AccessSecret),
		refreshSecret: []byte(cfg.RefreshSecret),
		accessTTL:     mustDuration(cfg.AccessTTL, 2*time.Hour),
		refreshTTL:    mustDuration(cfg.RefreshTTL, 14*24*time.Hour),
	}
}

// TokenPair access + refresh。
type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"` // access 有效期秒
}

// GeneratePair 生成一对 token。
func (m *TokenManager) GeneratePair(userID string, role int) (*TokenPair, error) {
	now := time.Now()
	access, err := m.sign(userID, role, m.accessSecret, now.Add(m.accessTTL), "access")
	if err != nil {
		return nil, err
	}
	refresh, err := m.sign(userID, role, m.refreshSecret, now.Add(m.refreshTTL), "refresh")
	if err != nil {
		return nil, err
	}
	return &TokenPair{
		AccessToken:  access,
		RefreshToken: refresh,
		ExpiresIn:    int64(m.accessTTL.Seconds()),
	}, nil
}

func (m *TokenManager) sign(userID string, role int, secret []byte, exp time.Time, typ string) (string, error) {
	claims := Claims{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    "luojia-bbs",
			Subject:   userID,
			ID:        uuid.NewString(),
			ExpiresAt: jwt.NewNumericDate(exp),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(secret)
}

// ParseAccess 校验 access token。
func (m *TokenManager) ParseAccess(tokenStr string) (*Claims, error) {
	return m.parse(tokenStr, m.accessSecret)
}

// ParseRefresh 校验 refresh token。
func (m *TokenManager) ParseRefresh(tokenStr string) (*Claims, error) {
	return m.parse(tokenStr, m.refreshSecret)
}

func (m *TokenManager) parse(tokenStr string, secret []byte) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return secret, nil
	})
	if err != nil {
		return nil, err
	}
	if !token.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}

func mustDuration(s string, def time.Duration) time.Duration {
	d, err := time.ParseDuration(s)
	if err != nil {
		return def
	}
	return d
}
