package controllers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

func init() {
	gin.SetMode(gin.TestMode)
}

type fakePinger struct {
	err error
}

func (f fakePinger) PingContext(context.Context) error {
	return f.err
}

func newTestContext(t *testing.T) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/", nil)
	return ctx, recorder
}

func TestHealth(t *testing.T) {
	controller := NewHealthController(fakePinger{}, zap.NewNop())
	ctx, recorder := newTestContext(t)

	controller.Health(ctx)

	assert.Equal(t, http.StatusOK, recorder.Code)
	var body struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
		Data    struct {
			Status string `json:"status"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body))
	assert.True(t, body.Success)
	assert.Equal(t, "Application is healthy", body.Message)
	assert.Equal(t, "ok", body.Data.Status)
}

func TestReady_Healthy(t *testing.T) {
	controller := NewHealthController(fakePinger{}, zap.NewNop())
	ctx, recorder := newTestContext(t)

	controller.Ready(ctx)

	assert.Equal(t, http.StatusOK, recorder.Code)
	var body struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
		Data    struct {
			Status   string `json:"status"`
			Database string `json:"database"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body))
	assert.True(t, body.Success)
	assert.Equal(t, "Application is ready", body.Message)
	assert.Equal(t, "ok", body.Data.Status)
	assert.Equal(t, "up", body.Data.Database)
}

func TestReady_DatabaseUnavailable(t *testing.T) {
	controller := NewHealthController(fakePinger{err: errors.New("dial tcp secret-host: connection refused")}, zap.NewNop())
	ctx, recorder := newTestContext(t)

	controller.Ready(ctx)

	assert.Equal(t, http.StatusServiceUnavailable, recorder.Code)
	assert.Contains(t, recorder.Body.String(), "SERVICE_UNAVAILABLE")
	assert.NotContains(t, recorder.Body.String(), "secret-host")
	assert.NotContains(t, recorder.Body.String(), "connection refused")
}

func TestReady_NilDatabase(t *testing.T) {
	controller := NewHealthController(nil, zap.NewNop())
	ctx, recorder := newTestContext(t)

	controller.Ready(ctx)

	assert.Equal(t, http.StatusServiceUnavailable, recorder.Code)
	assert.Contains(t, recorder.Body.String(), "SERVICE_UNAVAILABLE")
}
