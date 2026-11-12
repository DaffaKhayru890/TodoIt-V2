package main

import (
	"context"
	"flag"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"
	_ "time/tzdata"

	"go.uber.org/zap"

	openapi "github.com/your-organization/todolist/docs/openapi"
	"github.com/your-organization/todolist/internal/config"
	"github.com/your-organization/todolist/internal/database"
	"github.com/your-organization/todolist/internal/server"
	"github.com/your-organization/todolist/internal/shared/logging"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "application failed: %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	healthcheck := flag.Bool("healthcheck", false, "check the local /health endpoint and exit")
	flag.Parse()

	if *healthcheck {
		return runHealthcheck()
	}

	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("configuration error: %w", err)
	}

	logger, err := logging.New(cfg.Log.Level, cfg.Log.Format, cfg.App.Name)
	if err != nil {
		return fmt.Errorf("initialize logger: %w", err)
	}
	defer func() { _ = logger.Sync() }()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	db, err := database.Open(ctx, database.Options{
		Host:               cfg.DB.Host,
		Port:               cfg.DB.Port,
		User:               cfg.DB.User,
		Password:           cfg.DB.Password,
		Name:               cfg.DB.Name,
		SSLMode:            cfg.DB.SSLMode,
		MaxIdleConnections: cfg.DB.MaxIdleConnections,
		MaxOpenConnections: cfg.DB.MaxOpenConnections,
		ConnMaxLifetime:    cfg.DB.ConnMaxLifetime,
		ConnMaxIdleTime:    cfg.DB.ConnMaxIdleTime,
		ConnectTimeout:     cfg.DB.ConnectTimeout,
	})
	if err != nil {
		logger.Error("database connection failed",
			zap.String("host", cfg.DB.Host),
			zap.String("database", cfg.DB.Name),
			zap.String("error", redact(err.Error(), cfg.DB.Password)),
		)
		return fmt.Errorf("connect database: %w", err)
	}
	defer func() {
		if closeErr := database.Close(db); closeErr != nil {
			logger.Error("close database failed", zap.Error(closeErr))
		}
	}()

	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("get sql database handle: %w", err)
	}

	router := server.NewRouter(*cfg, logger, server.Dependencies{
		Pinger:      sqlDB,
		OpenAPISpec: openapi.Spec,
	})
	srv := server.New(*cfg, logger, router)

	logger.Info("application starting",
		zap.String("env", cfg.App.Env),
		zap.String("version", "phase-1"),
	)
	return srv.Run(ctx)
}

func runHealthcheck() error {
	port := strings.TrimSpace(os.Getenv("APP_PORT"))
	if port == "" {
		port = "8080"
	}

	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get(fmt.Sprintf("http://127.0.0.1:%s/health", port))
	if err != nil {
		return fmt.Errorf("healthcheck request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("healthcheck returned status %d", resp.StatusCode)
	}
	return nil
}

func redact(message, secret string) string {
	if secret == "" {
		return message
	}
	return strings.ReplaceAll(message, secret, "[REDACTED]")
}
