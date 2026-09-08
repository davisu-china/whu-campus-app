package config

import (
	"os"
	"path/filepath"
	"testing"
)

// TestEnvOverride 验证环境变量覆盖是否真正作用于 Unmarshal（viper AutomaticEnv 的已知坑）。
func TestEnvOverride(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "config.yaml")
	content := []byte("smtp:\n  password: \"from-file\"\ndatabase:\n  password: \"db-from-file\"\n")
	if err := os.WriteFile(cfgPath, content, 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("SMTP_PASSWORD", "from-env")
	t.Setenv("DATABASE_PASSWORD", "db-from-env")

	cfg, err := Load(cfgPath)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.SMTP.Password != "from-env" {
		t.Fatalf("smtp.password = %q, want \"from-env\"（环境变量覆盖未生效）", cfg.SMTP.Password)
	}
	if cfg.Database.Password != "db-from-env" {
		t.Fatalf("database.password = %q, want \"db-from-env\"（环境变量覆盖未生效）", cfg.Database.Password)
	}
}
