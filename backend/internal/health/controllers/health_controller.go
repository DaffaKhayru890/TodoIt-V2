// Package controllers berisi HTTP handler untuk module health.
package controllers

import (
	"context"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	apperrors "github.com/your-organization/todolist/internal/shared/errors"
	"github.com/your-organization/todolist/internal/shared/response"
)

// Pinger adalah dependency minimum readiness check.
type Pinger interface {
	PingContext(ctx context.Context) error
}

// HealthController menangani liveness dan readiness.
type HealthController struct {
	db      Pinger
	logger  *zap.Logger
	timeout time.Duration
}

// NewHealthController membuat controller dengan dependency yang sudah dirakit.
func NewHealthController(db Pinger, logger *zap.Logger) *HealthController {
	return &HealthController{
		db:      db,
		logger:  logger,
		timeout: 2 * time.Second,
	}
}

// Health adalah liveness check; tidak menyentuh database.
func (h *HealthController) Health(c *gin.Context) {
	response.Success(c, "Application is healthy", gin.H{"status": "ok"})
}

// Ready memeriksa PostgreSQL. Detail error hanya masuk log, bukan response.
func (h *HealthController) Ready(c *gin.Context) {
	if h.db == nil {
		h.logger.Error("readiness check failed", zap.String("reason", "database is not initialized"))
		response.AbortWithError(c, apperrors.New(apperrors.CodeServiceUnavailable))
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), h.timeout)
	defer cancel()

	if err := h.db.PingContext(ctx); err != nil {
		h.logger.Warn("readiness check failed", zap.Error(err))
		response.AbortWithError(c, apperrors.New(apperrors.CodeServiceUnavailable))
		return
	}

	response.Success(c, "Application is ready", gin.H{
		"status":   "ok",
		"database": "up",
	})
}
