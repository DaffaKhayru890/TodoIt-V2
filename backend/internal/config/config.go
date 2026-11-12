// Package config memuat seluruh konfigurasi aplikasi dari environment.
// Konfigurasi hanya dibaca sekali saat bootstrap dan diteruskan sebagai
// dependency; package lain tidak boleh membaca environment secara langsung.
package config

import (
	"errors"
	"fmt"
	"net/url"
	"os"
	"reflect"
	"strconv"
	"strings"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/joho/godotenv"
)

// Environment yang dikenali aplikasi.
const (
	EnvDevelopment = "development"
	EnvTest        = "test"
	EnvStaging     = "staging"
	EnvProduction  = "production"
)

// Config adalah konfigurasi aplikasi yang sudah tervalidasi.
type Config struct {
	App  AppConfig  `validate:"required"`
	Log  LogConfig  `validate:"required"`
	DB   DBConfig   `validate:"required"`
	HTTP HTTPConfig `validate:"required"`
	CORS CORSConfig `validate:"required"`
}

// AppConfig berisi identitas dan perilaku dasar aplikasi.
type AppConfig struct {
	Name            string `env:"APP_NAME" validate:"required"`
	Env             string `env:"APP_ENV" validate:"required,oneof=development test staging production"`
	Port            int    `env:"APP_PORT" validate:"gte=1,lte=65535"`
	DefaultTimezone string `env:"APP_DEFAULT_TIMEZONE" validate:"required,timezone"`
	SwaggerEnabled  bool   `env:"APP_SWAGGER_ENABLED"`
}

// LogConfig mengatur format dan level structured logging.
type LogConfig struct {
	Level  string `env:"APP_LOG_LEVEL" validate:"required,oneof=debug info warn error"`
	Format string `env:"APP_LOG_FORMAT" validate:"required,oneof=json text"`
}

// DBConfig berisi koneksi PostgreSQL dan konfigurasi connection pool.
type DBConfig struct {
	Host               string        `env:"DB_HOST" validate:"required"`
	Port               int           `env:"DB_PORT" validate:"gte=1,lte=65535"`
	User               string        `env:"DB_USER" validate:"required"`
	Password           string        `env:"DB_PASSWORD" validate:"required"`
	Name               string        `env:"DB_NAME" validate:"required"`
	SSLMode            string        `env:"DB_SSLMODE" validate:"required,oneof=disable require verify-ca verify-full"`
	MaxIdleConnections int           `env:"DB_MAX_IDLE_CONNECTIONS" validate:"gte=0"`
	MaxOpenConnections int           `env:"DB_MAX_OPEN_CONNECTIONS" validate:"gte=1"`
	ConnMaxLifetime    time.Duration `env:"DB_CONNECTION_MAX_LIFETIME" validate:"gt=0"`
	ConnMaxIdleTime    time.Duration `env:"DB_CONNECTION_MAX_IDLE_TIME" validate:"gt=0"`
	ConnectTimeout     time.Duration `env:"DB_CONNECT_TIMEOUT" validate:"gt=0"`
}

// HTTPConfig mengatur timeout server dan graceful shutdown.
type HTTPConfig struct {
	ReadTimeout       time.Duration `env:"HTTP_READ_TIMEOUT" validate:"gt=0"`
	ReadHeaderTimeout time.Duration `env:"HTTP_READ_HEADER_TIMEOUT" validate:"gt=0"`
	WriteTimeout      time.Duration `env:"HTTP_WRITE_TIMEOUT" validate:"gt=0"`
	IdleTimeout       time.Duration `env:"HTTP_IDLE_TIMEOUT" validate:"gt=0"`
	ShutdownTimeout   time.Duration `env:"HTTP_SHUTDOWN_TIMEOUT" validate:"gt=0"`
}

// CORSConfig berisi allowlist origin dan izin credentials.
type CORSConfig struct {
	AllowedOrigins   []string `env:"CORS_ALLOWED_ORIGINS" validate:"dive,url"`
	AllowCredentials bool     `env:"CORS_ALLOW_CREDENTIALS"`
}

// Error adalah kesalahan konfigurasi yang aman ditampilkan. Nilai secret
// tidak pernah dimasukkan ke dalam pesan.
type Error struct {
	Fields []string
}

func (e *Error) Error() string {
	return "invalid configuration: " + strings.Join(e.Fields, "; ")
}

// Load memuat file env opsional lalu membaca environment proses.
//
// Precedence (tinggi ke rendah):
//  1. environment proses (OS/Docker/secret manager)
//  2. file yang ditunjuk ENV_FILE
//  3. file .env di working directory
//  4. default di kode
//
// File .env.development tidak dimuat otomatis agar file development tidak
// pernah terpakai tanpa sengaja di staging/production. Gunakan ENV_FILE.
func Load() (*Config, error) {
	if envFile := strings.TrimSpace(os.Getenv("ENV_FILE")); envFile != "" {
		if err := godotenv.Load(envFile); err != nil {
			return nil, fmt.Errorf("load env file %q: %w", envFile, err)
		}
	} else if _, err := os.Stat(".env"); err == nil {
		if err := godotenv.Load(".env"); err != nil {
			return nil, fmt.Errorf("load .env: %w", err)
		}
	}

	return parse(os.LookupEnv)
}

// parse memisahkan pembacaan environment dari Load agar mudah diuji.
func parse(lookup func(string) (string, bool)) (*Config, error) {
	p := &parser{lookup: lookup}

	cfg := &Config{
		App: AppConfig{
			Name:            p.str("APP_NAME", "todolist", false),
			Env:             p.str("APP_ENV", "", true),
			Port:            p.integer("APP_PORT", 8080),
			DefaultTimezone: p.str("APP_DEFAULT_TIMEZONE", "Asia/Jakarta", false),
		},
		Log: LogConfig{
			Level:  p.str("APP_LOG_LEVEL", "info", false),
			Format: p.str("APP_LOG_FORMAT", "json", false),
		},
		DB: DBConfig{
			Host:               p.str("DB_HOST", "", true),
			Port:               p.integer("DB_PORT", 5432),
			User:               p.str("DB_USER", "", true),
			Password:           p.str("DB_PASSWORD", "", true),
			Name:               p.str("DB_NAME", "", true),
			SSLMode:            p.str("DB_SSLMODE", "disable", false),
			MaxIdleConnections: p.integer("DB_MAX_IDLE_CONNECTIONS", 10),
			MaxOpenConnections: p.integer("DB_MAX_OPEN_CONNECTIONS", 50),
			ConnMaxLifetime:    p.duration("DB_CONNECTION_MAX_LIFETIME", 30*time.Minute),
			ConnMaxIdleTime:    p.duration("DB_CONNECTION_MAX_IDLE_TIME", 5*time.Minute),
			ConnectTimeout:     p.duration("DB_CONNECT_TIMEOUT", 10*time.Second),
		},
		HTTP: HTTPConfig{
			ReadTimeout:       p.duration("HTTP_READ_TIMEOUT", 10*time.Second),
			ReadHeaderTimeout: p.duration("HTTP_READ_HEADER_TIMEOUT", 5*time.Second),
			WriteTimeout:      p.duration("HTTP_WRITE_TIMEOUT", 30*time.Second),
			IdleTimeout:       p.duration("HTTP_IDLE_TIMEOUT", 60*time.Second),
			ShutdownTimeout:   p.duration("HTTP_SHUTDOWN_TIMEOUT", 15*time.Second),
		},
		CORS: CORSConfig{
			AllowedOrigins:   p.csv("CORS_ALLOWED_ORIGINS", []string{"http://localhost:3000"}),
			AllowCredentials: p.boolean("CORS_ALLOW_CREDENTIALS", false),
		},
	}

	// Default Swagger mengikuti environment, tetapi tetap dapat dioverride.
	defaultSwagger := cfg.App.Env == EnvDevelopment || cfg.App.Env == EnvTest
	cfg.App.SwaggerEnabled = p.boolean("APP_SWAGGER_ENABLED", defaultSwagger)

	if len(p.errs) > 0 {
		return nil, &Error{Fields: p.errs}
	}

	if err := cfg.validate(); err != nil {
		return nil, err
	}
	return cfg, nil
}

func (c *Config) validate() error {
	v := validator.New()
	if err := v.RegisterValidation("timezone", func(fl validator.FieldLevel) bool {
		value := strings.TrimSpace(fl.Field().String())
		if value == "" {
			return false
		}
		_, err := time.LoadLocation(value)
		return err == nil
	}); err != nil {
		return fmt.Errorf("register timezone validator: %w", err)
	}
	v.RegisterTagNameFunc(func(field reflect.StructField) string {
		if name := field.Tag.Get("env"); name != "" {
			return name
		}
		return field.Name
	})

	if err := v.Struct(c); err != nil {
		var validationErrors validator.ValidationErrors
		if !errors.As(err, &validationErrors) {
			return fmt.Errorf("validate configuration: %w", err)
		}
		fields := make([]string, 0, len(validationErrors))
		for _, field := range validationErrors {
			message := fmt.Sprintf("%s: %s", field.Field(), validationMessage(field.Tag()))
			if field.Param() != "" && field.Tag() == "oneof" {
				message = fmt.Sprintf("%s: must be one of [%s]", field.Field(), field.Param())
			}
			fields = append(fields, message)
		}
		return &Error{Fields: fields}
	}

	var fields []string
	if c.DB.MaxIdleConnections > c.DB.MaxOpenConnections {
		fields = append(fields, "DB_MAX_IDLE_CONNECTIONS: must be <= DB_MAX_OPEN_CONNECTIONS")
	}
	if c.App.Env == EnvProduction && c.DB.SSLMode == "disable" {
		fields = append(fields, "DB_SSLMODE: production requires a secure mode (require/verify-ca/verify-full)")
	}
	if c.App.Env == EnvTest && !strings.HasSuffix(strings.ToLower(c.DB.Name), "_test") {
		fields = append(fields, "DB_NAME: test environment requires a database name ending with _test")
	}
	if c.CORS.AllowCredentials {
		for _, origin := range c.CORS.AllowedOrigins {
			if origin == "*" {
				fields = append(fields, "CORS_ALLOWED_ORIGINS: wildcard is not allowed when credentials are enabled")
				break
			}
		}
	}
	for _, origin := range c.CORS.AllowedOrigins {
		u, err := url.Parse(origin)
		if err != nil || u.Scheme == "" || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") {
			fields = append(fields, "CORS_ALLOWED_ORIGINS: each origin must be an absolute http(s) URL")
			break
		}
	}
	if len(fields) > 0 {
		return &Error{Fields: fields}
	}
	return nil
}

func validationMessage(tag string) string {
	switch tag {
	case "required":
		return "is required"
	case "gte":
		return "must be greater than or equal to the minimum"
	case "lte":
		return "must be less than or equal to the maximum"
	case "gt":
		return "must be greater than zero"
	case "url":
		return "must be a valid URL"
	default:
		return "is invalid"
	}
}

type parser struct {
	lookup func(string) (string, bool)
	errs   []string
}

func (p *parser) raw(key string) (string, bool) {
	value, ok := p.lookup(key)
	return strings.TrimSpace(value), ok
}

func (p *parser) str(key, fallback string, required bool) string {
	value, ok := p.raw(key)
	if !ok || value == "" {
		if required {
			p.errs = append(p.errs, key+": is required")
		}
		return fallback
	}
	return value
}

func (p *parser) integer(key string, fallback int) int {
	value, ok := p.raw(key)
	if !ok || value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		p.errs = append(p.errs, key+": must be an integer")
		return fallback
	}
	return parsed
}

func (p *parser) boolean(key string, fallback bool) bool {
	value, ok := p.raw(key)
	if !ok || value == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		p.errs = append(p.errs, key+": must be a boolean (true/false)")
		return fallback
	}
	return parsed
}

func (p *parser) duration(key string, fallback time.Duration) time.Duration {
	value, ok := p.raw(key)
	if !ok || value == "" {
		return fallback
	}
	parsed, err := time.ParseDuration(value)
	if err != nil {
		p.errs = append(p.errs, key+": must be a valid duration (example: 30m)")
		return fallback
	}
	return parsed
}

func (p *parser) csv(key string, fallback []string) []string {
	value, ok := p.raw(key)
	if !ok || value == "" {
		return fallback
	}
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}
