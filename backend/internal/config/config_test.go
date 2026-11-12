package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func mapLookup(values map[string]string) func(string) (string, bool) {
	return func(key string) (string, bool) {
		value, ok := values[key]
		return value, ok
	}
}

func validEnv() map[string]string {
	return map[string]string{
		"APP_ENV":     "development",
		"DB_HOST":     "localhost",
		"DB_USER":     "root",
		"DB_PASSWORD": "dev@123",
		"DB_NAME":     "todolist",
	}
}

func TestParse_ValidWithDefaults(t *testing.T) {
	cfg, err := parse(mapLookup(validEnv()))
	require.NoError(t, err)

	assert.Equal(t, "todolist", cfg.App.Name)
	assert.Equal(t, 8080, cfg.App.Port)
	assert.Equal(t, "Asia/Jakarta", cfg.App.DefaultTimezone)
	assert.True(t, cfg.App.SwaggerEnabled)

	assert.Equal(t, "info", cfg.Log.Level)
	assert.Equal(t, "json", cfg.Log.Format)

	assert.Equal(t, 5432, cfg.DB.Port)
	assert.Equal(t, "disable", cfg.DB.SSLMode)
	assert.Equal(t, 10, cfg.DB.MaxIdleConnections)
	assert.Equal(t, 50, cfg.DB.MaxOpenConnections)
	assert.Equal(t, 30*time.Minute, cfg.DB.ConnMaxLifetime)
	assert.Equal(t, 5*time.Minute, cfg.DB.ConnMaxIdleTime)
	assert.Equal(t, 10*time.Second, cfg.DB.ConnectTimeout)

	assert.Equal(t, 10*time.Second, cfg.HTTP.ReadTimeout)
	assert.Equal(t, 15*time.Second, cfg.HTTP.ShutdownTimeout)
	assert.Equal(t, []string{"http://localhost:3000"}, cfg.CORS.AllowedOrigins)
	assert.False(t, cfg.CORS.AllowCredentials)
}

func TestParse_CustomValues(t *testing.T) {
	env := validEnv()
	env["APP_NAME"] = "todoit-test"
	env["APP_PORT"] = "9090"
	env["APP_DEFAULT_TIMEZONE"] = "America/New_York"
	env["APP_LOG_LEVEL"] = "debug"
	env["APP_LOG_FORMAT"] = "text"
	env["DB_PORT"] = "55432"
	env["DB_MAX_IDLE_CONNECTIONS"] = "5"
	env["DB_MAX_OPEN_CONNECTIONS"] = "20"
	env["DB_CONNECTION_MAX_LIFETIME"] = "1h"
	env["HTTP_READ_TIMEOUT"] = "3s"
	env["CORS_ALLOWED_ORIGINS"] = "http://localhost:3000, https://app.example.com"
	env["CORS_ALLOW_CREDENTIALS"] = "true"

	cfg, err := parse(mapLookup(env))
	require.NoError(t, err)

	assert.Equal(t, "todoit-test", cfg.App.Name)
	assert.Equal(t, 9090, cfg.App.Port)
	assert.Equal(t, "America/New_York", cfg.App.DefaultTimezone)
	assert.Equal(t, "debug", cfg.Log.Level)
	assert.Equal(t, "text", cfg.Log.Format)
	assert.Equal(t, 55432, cfg.DB.Port)
	assert.Equal(t, 5, cfg.DB.MaxIdleConnections)
	assert.Equal(t, 20, cfg.DB.MaxOpenConnections)
	assert.Equal(t, time.Hour, cfg.DB.ConnMaxLifetime)
	assert.Equal(t, 3*time.Second, cfg.HTTP.ReadTimeout)
	assert.Equal(t, []string{"http://localhost:3000", "https://app.example.com"}, cfg.CORS.AllowedOrigins)
	assert.True(t, cfg.CORS.AllowCredentials)
}

func TestParse_MissingRequired(t *testing.T) {
	tests := []struct {
		name   string
		delete string
	}{
		{name: "app env", delete: "APP_ENV"},
		{name: "db host", delete: "DB_HOST"},
		{name: "db user", delete: "DB_USER"},
		{name: "db password", delete: "DB_PASSWORD"},
		{name: "db name", delete: "DB_NAME"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			env := validEnv()
			delete(env, tt.delete)

			cfg, err := parse(mapLookup(env))
			require.Error(t, err)
			assert.Nil(t, cfg)
			assert.Contains(t, err.Error(), tt.delete)
		})
	}
}

func TestParse_InvalidInteger(t *testing.T) {
	env := validEnv()
	env["APP_PORT"] = "not-a-number"

	_, err := parse(mapLookup(env))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "APP_PORT")
	assert.Contains(t, err.Error(), "integer")
}

func TestParse_PortOutOfRange(t *testing.T) {
	env := validEnv()
	env["APP_PORT"] = "70000"

	_, err := parse(mapLookup(env))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "APP_PORT")
}

func TestParse_InvalidDuration(t *testing.T) {
	env := validEnv()
	env["DB_CONNECTION_MAX_LIFETIME"] = "thirty-minutes"

	_, err := parse(mapLookup(env))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "DB_CONNECTION_MAX_LIFETIME")
}

func TestParse_InvalidTimezone(t *testing.T) {
	env := validEnv()
	env["APP_DEFAULT_TIMEZONE"] = "Mars/Olympus"

	_, err := parse(mapLookup(env))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "APP_DEFAULT_TIMEZONE")
}

func TestParse_InvalidBoolean(t *testing.T) {
	env := validEnv()
	env["CORS_ALLOW_CREDENTIALS"] = "yes-please"

	_, err := parse(mapLookup(env))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "CORS_ALLOW_CREDENTIALS")
}

func TestParse_TestEnvironmentRequiresTestDatabase(t *testing.T) {
	env := validEnv()
	env["APP_ENV"] = "test"
	env["DB_NAME"] = "todolist"

	_, err := parse(mapLookup(env))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "DB_NAME")
	assert.Contains(t, err.Error(), "_test")
}

func TestParse_ProductionRequiresSecureSSL(t *testing.T) {
	env := validEnv()
	env["APP_ENV"] = "production"
	env["DB_SSLMODE"] = "disable"

	_, err := parse(mapLookup(env))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "DB_SSLMODE")
}

func TestParse_ProductionSwaggerDefaultsOff(t *testing.T) {
	env := validEnv()
	env["APP_ENV"] = "production"
	env["DB_SSLMODE"] = "verify-full"

	cfg, err := parse(mapLookup(env))
	require.NoError(t, err)
	assert.False(t, cfg.App.SwaggerEnabled)
}

func TestParse_MaxIdleGreaterThanMaxOpen(t *testing.T) {
	env := validEnv()
	env["DB_MAX_IDLE_CONNECTIONS"] = "20"
	env["DB_MAX_OPEN_CONNECTIONS"] = "10"

	_, err := parse(mapLookup(env))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "DB_MAX_IDLE_CONNECTIONS")
}

func TestParse_WildcardCORSWithCredentialsRejected(t *testing.T) {
	env := validEnv()
	env["CORS_ALLOWED_ORIGINS"] = "*"
	env["CORS_ALLOW_CREDENTIALS"] = "true"

	_, err := parse(mapLookup(env))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "CORS_ALLOWED_ORIGINS")
}

func TestParse_InvalidCORSOrigin(t *testing.T) {
	env := validEnv()
	env["CORS_ALLOWED_ORIGINS"] = "localhost:3000"

	_, err := parse(mapLookup(env))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "CORS_ALLOWED_ORIGINS")
}

func TestParse_ErrorDoesNotLeakPassword(t *testing.T) {
	env := validEnv()
	env["DB_PASSWORD"] = "super-secret-password"
	env["APP_PORT"] = "invalid"

	_, err := parse(mapLookup(env))
	require.Error(t, err)
	assert.NotContains(t, err.Error(), "super-secret-password")
}

func TestLoad_EnvironmentOverridesEnvFile(t *testing.T) {
	dir := t.TempDir()
	envFile := filepath.Join(dir, ".env.testing")
	contents := strings.Join([]string{
		"APP_ENV=development",
		"APP_PORT=8080",
		"DB_HOST=file-host",
		"DB_USER=file-user",
		"DB_PASSWORD=file-password",
		"DB_NAME=file-database",
	}, "\n")
	require.NoError(t, os.WriteFile(envFile, []byte(contents), 0o600))

	t.Setenv("ENV_FILE", envFile)
	t.Setenv("APP_PORT", "9090")
	t.Setenv("DB_HOST", "process-host")

	cfg, err := Load()
	require.NoError(t, err)
	assert.Equal(t, 9090, cfg.App.Port)
	assert.Equal(t, "process-host", cfg.DB.Host)
	assert.Equal(t, "file-password", cfg.DB.Password)
}

func TestLoad_MissingEnvFile(t *testing.T) {
	t.Setenv("ENV_FILE", filepath.Join(t.TempDir(), "missing.env"))

	_, err := Load()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "load env file")
}
