package response

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	apperrors "github.com/your-organization/todolist/internal/shared/errors"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func perform(t *testing.T, handler gin.HandlerFunc) *httptest.ResponseRecorder {
	t.Helper()
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/test", nil)
	handler(ctx)
	return recorder
}

func decode(t *testing.T, recorder *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var body map[string]any
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body))
	return body
}

func TestSuccess(t *testing.T) {
	recorder := perform(t, func(c *gin.Context) {
		Success(c, "Request successful", gin.H{"id": "123"})
	})

	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Contains(t, recorder.Header().Get("Content-Type"), "application/json")

	body := decode(t, recorder)
	assert.Equal(t, true, body["success"])
	assert.Equal(t, "Request successful", body["message"])
	data := body["data"].(map[string]any)
	assert.Equal(t, "123", data["id"])
	assert.NotContains(t, body, "error")
}

func TestCreated(t *testing.T) {
	recorder := perform(t, func(c *gin.Context) {
		Created(c, "Created", nil)
	})

	assert.Equal(t, http.StatusCreated, recorder.Code)
	body := decode(t, recorder)
	assert.Equal(t, true, body["success"])
	assert.NotContains(t, body, "data")
}

func TestErrorAppError(t *testing.T) {
	recorder := perform(t, func(c *gin.Context) {
		err := apperrors.New(apperrors.CodeValidation).WithDetails("email is required")
		Error(c, err)
	})

	assert.Equal(t, http.StatusUnprocessableEntity, recorder.Code)
	body := decode(t, recorder)
	assert.Equal(t, false, body["success"])
	assert.Equal(t, "Validation failed", body["message"])

	errBody := body["error"].(map[string]any)
	assert.Equal(t, "VALIDATION_ERROR", errBody["code"])
	details := errBody["details"].([]any)
	assert.Equal(t, []any{"email is required"}, details)
}

func TestErrorUnknownDoesNotLeak(t *testing.T) {
	recorder := perform(t, func(c *gin.Context) {
		Error(c, errors.New("postgres password=secret"))
	})

	assert.Equal(t, http.StatusInternalServerError, recorder.Code)
	body := decode(t, recorder)
	assert.Equal(t, "Something went wrong", body["message"])
	assert.NotContains(t, recorder.Body.String(), "secret")
}

func TestErrorProducesEmptyDetailsArray(t *testing.T) {
	recorder := perform(t, func(c *gin.Context) {
		Error(c, apperrors.New(apperrors.CodeNotFound))
	})

	var body struct {
		Error struct {
			Details []string `json:"details"`
		} `json:"error"`
	}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body))
	assert.NotNil(t, body.Error.Details)
	assert.Empty(t, body.Error.Details)
}

func TestAbortWithErrorStopsChain(t *testing.T) {
	called := false
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/test", nil)

	AbortWithError(ctx, apperrors.New(apperrors.CodeNotFound))
	ctx.Next()
	if !ctx.IsAborted() {
		called = true
	}

	assert.False(t, called)
	assert.True(t, ctx.IsAborted())
	assert.Equal(t, http.StatusNotFound, recorder.Code)
}

func TestNoContent(t *testing.T) {
	recorder := perform(t, func(c *gin.Context) {
		NoContent(c)
	})

	assert.Equal(t, http.StatusNoContent, recorder.Code)
	assert.Empty(t, recorder.Body.String())
}
