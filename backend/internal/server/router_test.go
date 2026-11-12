package server

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"

	openapi "github.com/your-organization/todolist/docs/openapi"
	"github.com/your-organization/todolist/internal/config"
)

type fakePinger struct {
	err error
}

func (f fakePinger) PingContext(context.Context) error { return f.err }

func init() {
	gin.SetMode(gin.TestMode)
}

func testConfig(swagger bool) config.Config {
	return config.Config{
		App: config.AppConfig{
			Name:            "todolist",
			Env:             config.EnvDevelopment,
			Port:            8080,
			DefaultTimezone: "UTC",
			SwaggerEnabled:  swagger,
		},
		CORS: config.CORSConfig{AllowedOrigins: []string{"http://localhost:3000"}},
	}
}

func newTestRouter(pinger fakePinger, swagger bool) *gin.Engine {
	return NewRouter(testConfig(swagger), zap.NewNop(), Dependencies{
		Pinger:      pinger,
		OpenAPISpec: openapi.Spec,
	})
}

func TestRouter_Health(t *testing.T) {
	router := newTestRouter(fakePinger{}, true)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/health", nil))

	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Contains(t, recorder.Body.String(), `"status":"ok"`)
	assert.NotEmpty(t, recorder.Header().Get("X-Request-ID"))
}

func TestRouter_ReadyHealthy(t *testing.T) {
	router := newTestRouter(fakePinger{}, true)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/ready", nil))

	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Contains(t, recorder.Body.String(), `"database":"up"`)
}

func TestRouter_ReadyUnhealthy(t *testing.T) {
	router := newTestRouter(fakePinger{err: errors.New("connection refused")}, true)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/ready", nil))

	assert.Equal(t, http.StatusServiceUnavailable, recorder.Code)
	assert.Contains(t, recorder.Body.String(), "SERVICE_UNAVAILABLE")
	assert.NotContains(t, recorder.Body.String(), "connection refused")
}

func TestRouter_Docs(t *testing.T) {
	router := newTestRouter(fakePinger{}, true)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/docs", nil))

	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Contains(t, recorder.Header().Get("Content-Type"), "text/html")
	assert.Contains(t, recorder.Body.String(), "SwaggerUIBundle")
	assert.Contains(t, recorder.Body.String(), "/openapi.yaml")
}

func TestRouter_DocsDisabled(t *testing.T) {
	router := newTestRouter(fakePinger{}, false)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/docs", nil))

	assert.Equal(t, http.StatusNotFound, recorder.Code)
	assert.Contains(t, recorder.Body.String(), "NOT_FOUND")
}

func TestRouter_OpenAPISpec(t *testing.T) {
	router := newTestRouter(fakePinger{}, true)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/openapi.yaml", nil))

	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Contains(t, recorder.Header().Get("Content-Type"), "application/yaml")
	assert.Contains(t, recorder.Body.String(), "openapi: 3.0.3")
}

func TestRouter_NotFoundJSON(t *testing.T) {
	router := newTestRouter(fakePinger{}, true)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/missing", nil))

	assert.Equal(t, http.StatusNotFound, recorder.Code)
	assert.Contains(t, recorder.Body.String(), "NOT_FOUND")
}

func TestRouter_MethodNotAllowedJSON(t *testing.T) {
	router := newTestRouter(fakePinger{}, true)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/health", nil))

	assert.Equal(t, http.StatusMethodNotAllowed, recorder.Code)
	assert.Contains(t, recorder.Body.String(), "METHOD_NOT_ALLOWED")
}

func TestRouter_RoutesAreRegistered(t *testing.T) {
	router := newTestRouter(fakePinger{}, true)
	routes := make(map[string]struct{})
	for _, route := range router.Routes() {
		routes[route.Path] = struct{}{}
	}

	for _, path := range []string{"/health", "/ready", "/docs", "/openapi.yaml"} {
		_, ok := routes[path]
		require.Truef(t, ok, "route %s must be registered", path)
	}
}
