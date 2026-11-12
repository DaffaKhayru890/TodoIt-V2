// Package database bertanggung jawab hanya pada koneksi PostgreSQL,
// connection pool, ping, dan lifecycle koneksi.
package database

import (
	"context"
	"fmt"
	"net"
	"net/url"
	"strconv"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

// Options adalah konfigurasi minimum untuk membuka koneksi PostgreSQL.
type Options struct {
	Host               string
	Port               int
	User               string
	Password           string
	Name               string
	SSLMode            string
	MaxIdleConnections int
	MaxOpenConnections int
	ConnMaxLifetime    time.Duration
	ConnMaxIdleTime    time.Duration
	ConnectTimeout     time.Duration
}

// DSN membentuk connection string PostgreSQL dengan password ter-encode.
// connect_timeout memastikan koneksi gagal cepat, bukan menggantung.
func DSN(opts Options) string {
	u := &url.URL{
		Scheme: "postgres",
		User:   url.UserPassword(opts.User, opts.Password),
		Host:   net.JoinHostPort(opts.Host, strconv.Itoa(opts.Port)),
		Path:   "/" + opts.Name,
	}
	query := u.Query()
	query.Set("sslmode", opts.SSLMode)
	if opts.ConnectTimeout > 0 {
		query.Set("connect_timeout", strconv.Itoa(int(opts.ConnectTimeout.Seconds())))
	}
	u.RawQuery = query.Encode()
	return u.String()
}

// Open membuka koneksi GORM, mengatur pool, lalu memastikan database hidup.
// AutoMigrate tidak pernah dipanggil di sini; schema dikelola Goose.
func Open(ctx context.Context, opts Options) (*gorm.DB, error) {
	if opts.ConnectTimeout <= 0 {
		opts.ConnectTimeout = 10 * time.Second
	}
	if opts.SSLMode == "" {
		opts.SSLMode = "disable"
	}

	db, err := gorm.Open(postgres.Open(DSN(opts)), &gorm.Config{
		DisableAutomaticPing: true,
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
		Logger: gormlogger.Default.LogMode(gormlogger.Warn),
	})
	if err != nil {
		return nil, fmt.Errorf("open postgres connection: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("get sql database handle: %w", err)
	}
	sqlDB.SetMaxIdleConns(opts.MaxIdleConnections)
	sqlDB.SetMaxOpenConns(opts.MaxOpenConnections)
	sqlDB.SetConnMaxLifetime(opts.ConnMaxLifetime)
	sqlDB.SetConnMaxIdleTime(opts.ConnMaxIdleTime)

	pingCtx, cancel := context.WithTimeout(ctx, opts.ConnectTimeout)
	defer cancel()
	if err := sqlDB.PingContext(pingCtx); err != nil {
		_ = sqlDB.Close()
		return nil, fmt.Errorf("ping postgres: %w", err)
	}

	return db, nil
}

// Ping memeriksa koneksi database dengan context yang diberikan.
func Ping(ctx context.Context, db *gorm.DB) error {
	if db == nil {
		return fmt.Errorf("database is not initialized")
	}
	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("get sql database handle: %w", err)
	}
	return sqlDB.PingContext(ctx)
}

// Close menutup pool koneksi secara idempoten.
func Close(db *gorm.DB) error {
	if db == nil {
		return nil
	}
	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("get sql database handle: %w", err)
	}
	if err := sqlDB.Close(); err != nil {
		return fmt.Errorf("close postgres connection: %w", err)
	}
	return nil
}
