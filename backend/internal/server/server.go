package server

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"go.uber.org/zap"

	"github.com/your-organization/todolist/internal/config"
)

// Server membungkus lifecycle net/http.Server.
type Server struct {
	httpServer      *http.Server
	logger          *zap.Logger
	shutdownTimeout time.Duration
}

// New membuat HTTP server dengan timeout dan handler yang sudah dirakit.
func New(cfg config.Config, logger *zap.Logger, handler http.Handler) *Server {
	return &Server{
		httpServer: &http.Server{
			Addr:              Addr(cfg.App.Port),
			Handler:           handler,
			ReadTimeout:       cfg.HTTP.ReadTimeout,
			ReadHeaderTimeout: cfg.HTTP.ReadHeaderTimeout,
			WriteTimeout:      cfg.HTTP.WriteTimeout,
			IdleTimeout:       cfg.HTTP.IdleTimeout,
		},
		logger:          logger,
		shutdownTimeout: cfg.HTTP.ShutdownTimeout,
	}
}

// Run menjalankan server sampai context dibatalkan, lalu graceful shutdown.
// Server tidak menerima request baru setelah Shutdown dipanggil.
func (s *Server) Run(ctx context.Context) error {
	errCh := make(chan error, 1)
	go func() {
		errCh <- s.httpServer.ListenAndServe()
	}()

	s.logger.Info("http server started", zap.String("addr", s.httpServer.Addr))

	select {
	case err := <-errCh:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			return fmt.Errorf("http server: %w", err)
		}
		return nil
	case <-ctx.Done():
		s.logger.Info("shutdown signal received")
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), s.shutdownTimeout)
	defer cancel()

	if err := s.httpServer.Shutdown(shutdownCtx); err != nil {
		_ = s.httpServer.Close()
		return fmt.Errorf("graceful shutdown: %w", err)
	}

	if err := <-errCh; err != nil && !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("http server: %w", err)
	}
	s.logger.Info("http server stopped")
	return nil
}
