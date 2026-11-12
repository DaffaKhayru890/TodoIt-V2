package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"go.uber.org/zap/zaptest/observer"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func newObservedLogger() (*zap.Logger, *observer.ObservedLogs) {
	core, logs := observer.New(zapcore.DebugLevel)
	return zap.New(core), logs
}

func TestRequestID_GeneratesWhenMissing(t *testing.T) {
	router := gin.New()
	router.Use(RequestID())
	router.GET("/test", func(c *gin.Context) {
		c.String(http.StatusOK, GetRequestID(c))
	})

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/test", nil))

	require.Equal(t, http.StatusOK, recorder.Code)
	headerID := recorder.Header().Get(HeaderRequestID)
	assert.NotEmpty(t, headerID)
	assert.Equal(t, headerID, recorder.Body.String())
}

func TestRequestID_UsesValidIncomingHeader(t *testing.T) {
	router := gin.New()
	router.Use(RequestID())
	router.GET("/test", func(c *gin.Context) {
		c.String(http.StatusOK, GetRequestID(c))
	})

	request := httptest.NewRequest(http.MethodGet, "/test", nil)
	request.Header.Set(HeaderRequestID, "client-request-123")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	assert.Equal(t, "client-request-123", recorder.Header().Get(HeaderRequestID))
	assert.Equal(t, "client-request-123", recorder.Body.String())
}

func TestRequestID_ReplacesInvalidIncomingHeader(t *testing.T) {
	router := gin.New()
	router.Use(RequestID())
	router.GET("/test", func(c *gin.Context) {
		c.String(http.StatusOK, RequestIDFromContext(c.Request.Context()))
	})

	request := httptest.NewRequest(http.MethodGet, "/test", nil)
	request.Header.Set(HeaderRequestID, "invalid id with spaces")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	assert.NotEqual(t, "invalid id with spaces", recorder.Body.String())
	assert.Len(t, recorder.Body.String(), 36)
}

func TestLogger_LogsSafeFields(t *testing.T) {
	logger, logs := newObservedLogger()
	router := gin.New()
	router.Use(RequestID(), Logger(logger))
	router.GET("/test", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	request := httptest.NewRequest(http.MethodGet, "/test?token=secret", nil)
	request.Header.Set("Authorization", "Bearer super-secret")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusNoContent, recorder.Code)
	require.Equal(t, 1, logs.Len())

	entry := logs.All()[0]
	fields := entry.ContextMap()
	assert.Equal(t, "GET", fields["method"])
	assert.Equal(t, "/test", fields["path"])
	assert.Equal(t, int64(http.StatusNoContent), fields["status"])
	assert.NotEmpty(t, fields["request_id"])
	assert.Contains(t, fields, "latency_ms")
	assert.Contains(t, fields, "client_ip")
	assert.NotContains(t, fields, "authorization")
	assert.NotContains(t, fields, "token")
}

func TestRecovery_ReturnsGeneric500(t *testing.T) {
	logger, logs := newObservedLogger()
	router := gin.New()
	router.Use(RequestID(), Recovery(logger))
	router.GET("/panic", func(c *gin.Context) {
		panic("sensitive panic detail")
	})

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/panic", nil))

	require.Equal(t, http.StatusInternalServerError, recorder.Code)
	assert.Contains(t, recorder.Body.String(), "INTERNAL_SERVER_ERROR")
	assert.NotContains(t, recorder.Body.String(), "sensitive panic detail")
	require.Equal(t, 1, logs.Len())
	assert.Contains(t, logs.All()[0].Message, "panic recovered")
}

func TestCORS_AllowedOrigin(t *testing.T) {
	router := gin.New()
	router.Use(CORS([]string{"http://localhost:3000"}, false))
	router.GET("/test", func(c *gin.Context) { c.Status(http.StatusOK) })

	request := httptest.NewRequest(http.MethodGet, "/test", nil)
	request.Header.Set("Origin", "http://localhost:3000")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	assert.Equal(t, "http://localhost:3000", recorder.Header().Get("Access-Control-Allow-Origin"))
	assert.Contains(t, recorder.Header().Get("Vary"), "Origin")
	assert.Empty(t, recorder.Header().Get("Access-Control-Allow-Credentials"))
}

func TestCORS_Credentials(t *testing.T) {
	router := gin.New()
	router.Use(CORS([]string{"http://localhost:3000"}, true))
	router.GET("/test", func(c *gin.Context) { c.Status(http.StatusOK) })

	request := httptest.NewRequest(http.MethodGet, "/test", nil)
	request.Header.Set("Origin", "http://localhost:3000")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	assert.Equal(t, "http://localhost:3000", recorder.Header().Get("Access-Control-Allow-Origin"))
	assert.Equal(t, "true", recorder.Header().Get("Access-Control-Allow-Credentials"))
}

func TestCORS_Preflight(t *testing.T) {
	router := gin.New()
	router.Use(CORS([]string{"http://localhost:3000"}, true))
	router.POST("/test", func(c *gin.Context) { c.Status(http.StatusOK) })

	request := httptest.NewRequest(http.MethodOptions, "/test", nil)
	request.Header.Set("Origin", "http://localhost:3000")
	request.Header.Set("Access-Control-Request-Method", "POST")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	assert.Equal(t, http.StatusNoContent, recorder.Code)
	assert.Equal(t, "GET, POST, PUT, PATCH, DELETE, OPTIONS", recorder.Header().Get("Access-Control-Allow-Methods"))
	assert.Contains(t, recorder.Header().Get("Access-Control-Allow-Headers"), "Authorization")
	assert.Equal(t, "600", recorder.Header().Get("Access-Control-Max-Age"))
}

func TestCORS_DisallowedOrigin(t *testing.T) {
	router := gin.New()
	router.Use(CORS([]string{"http://localhost:3000"}, false))
	router.GET("/test", func(c *gin.Context) { c.Status(http.StatusOK) })

	request := httptest.NewRequest(http.MethodGet, "/test", nil)
	request.Header.Set("Origin", "http://evil.example.com")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	assert.Empty(t, recorder.Header().Get("Access-Control-Allow-Origin"))
}

func TestCORS_WildcardWithoutCredentials(t *testing.T) {
	router := gin.New()
	router.Use(CORS([]string{"*"}, false))
	router.GET("/test", func(c *gin.Context) { c.Status(http.StatusOK) })

	request := httptest.NewRequest(http.MethodGet, "/test", nil)
	request.Header.Set("Origin", "http://anything.example.com")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	assert.Equal(t, "*", recorder.Header().Get("Access-Control-Allow-Origin"))
}
