package middleware

import (
	"runtime/debug"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	apperrors "github.com/your-organization/todolist/internal/shared/errors"
	"github.com/your-organization/todolist/internal/shared/response"
)

// Recovery menangkap panic agar satu request gagal tidak mematikan proses.
// Detail panic dan stack hanya masuk log, bukan response client.
func Recovery(logger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if recovered := recover(); recovered != nil {
				logger.Error("panic recovered",
					zap.String("request_id", GetRequestID(c)),
					zap.Any("panic", recovered),
					zap.ByteString("stack", debug.Stack()),
				)

				if c.Writer.Written() {
					c.Abort()
					return
				}
				response.AbortWithError(c, apperrors.New(apperrors.CodeInternal))
			}
		}()
		c.Next()
	}
}
