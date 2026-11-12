package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// CORS memakai allowlist origin eksplisit. Wildcard hanya diizinkan jika
// credentials dimatikan; kombinasi wildcard + credentials ditolak config.
func CORS(allowedOrigins []string, allowCredentials bool) gin.HandlerFunc {
	allowed := make(map[string]struct{}, len(allowedOrigins))
	wildcard := false
	for _, origin := range allowedOrigins {
		trimmed := strings.TrimSpace(origin)
		if trimmed == "*" {
			wildcard = true
			continue
		}
		if trimmed != "" {
			allowed[trimmed] = struct{}{}
		}
	}

	return func(c *gin.Context) {
		origin := strings.TrimSpace(c.GetHeader("Origin"))
		header := c.Writer.Header()
		header.Add("Vary", "Origin")

		if origin != "" {
			switch {
			case wildcard && !allowCredentials:
				header.Set("Access-Control-Allow-Origin", "*")
			case isAllowedOrigin(origin, allowed):
				header.Set("Access-Control-Allow-Origin", origin)
			}

			if header.Get("Access-Control-Allow-Origin") != "" && allowCredentials {
				header.Set("Access-Control-Allow-Credentials", "true")
			}
		}

		if c.Request.Method == http.MethodOptions && c.GetHeader("Access-Control-Request-Method") != "" {
			header.Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			header.Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Request-ID")
			header.Set("Access-Control-Expose-Headers", HeaderRequestID)
			header.Set("Access-Control-Max-Age", "600")
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

func isAllowedOrigin(origin string, allowed map[string]struct{}) bool {
	_, ok := allowed[origin]
	return ok
}
