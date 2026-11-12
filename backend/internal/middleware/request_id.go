package middleware

import (
	"context"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// HeaderRequestID adalah header untuk korelasi request.
const HeaderRequestID = "X-Request-ID"

type requestIDContextKey struct{}

var validRequestID = regexp.MustCompile(`^[A-Za-z0-9._:-]{1,128}$`)

// RequestID memakai request ID dari client bila valid, atau membuat UUID baru.
// Nilai disimpan di context Gin dan context request agar bisa dipakai logger
// dan package lain tanpa global state.
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := strings.TrimSpace(c.GetHeader(HeaderRequestID))
		if !validRequestID.MatchString(id) {
			id = uuid.NewString()
		}

		c.Set("request_id", id)
		ctx := context.WithValue(c.Request.Context(), requestIDContextKey{}, id)
		c.Request = c.Request.WithContext(ctx)
		c.Header(HeaderRequestID, id)
		c.Next()
	}
}

// RequestIDFromContext mengambil request ID dari context request.
func RequestIDFromContext(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	id, _ := ctx.Value(requestIDContextKey{}).(string)
	return id
}

// GetRequestID mengambil request ID dari context Gin.
func GetRequestID(c *gin.Context) string {
	if c == nil {
		return ""
	}
	id, _ := c.Get("request_id")
	value, _ := id.(string)
	return value
}
