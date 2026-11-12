package errors

import (
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNew_Defaults(t *testing.T) {
	tests := []struct {
		code   Code
		status int
	}{
		{CodeValidation, http.StatusUnprocessableEntity},
		{CodeBadRequest, http.StatusBadRequest},
		{CodeNotFound, http.StatusNotFound},
		{CodeUnauthorized, http.StatusUnauthorized},
		{CodeForbidden, http.StatusForbidden},
		{CodeConflict, http.StatusConflict},
		{CodeMethodNotAllowed, http.StatusMethodNotAllowed},
		{CodeServiceUnavailable, http.StatusServiceUnavailable},
		{CodeInternal, http.StatusInternalServerError},
	}

	for _, tt := range tests {
		t.Run(string(tt.code), func(t *testing.T) {
			err := New(tt.code)
			assert.Equal(t, tt.code, err.Code)
			assert.Equal(t, tt.status, err.HTTPStatus)
			assert.NotEmpty(t, err.Message)
			assert.NotNil(t, err.Details)
		})
	}
}

func TestWrap_PreservesCause(t *testing.T) {
	cause := errors.New("database is down")
	err := Wrap(cause, CodeServiceUnavailable)

	assert.ErrorIs(t, err, cause)
	assert.Equal(t, cause, errors.Unwrap(err))
	assert.Contains(t, err.Error(), "database is down")
}

func TestFrom_MapsUnknownErrorToInternal(t *testing.T) {
	source := errors.New("password=hunter2 connection refused")
	appErr := From(source)

	assert.Equal(t, CodeInternal, appErr.Code)
	assert.Equal(t, http.StatusInternalServerError, appErr.HTTPStatus)
	assert.Equal(t, "Something went wrong", appErr.Message)
	assert.NotContains(t, appErr.Message, "hunter2")
	assert.ErrorIs(t, appErr, source)
}

func TestFrom_PreservesKnownAppError(t *testing.T) {
	source := NewWithMessage(CodeNotFound, "Task not found").WithDetails("id")
	appErr := From(fmt.Errorf("service: %w", source))

	assert.Equal(t, CodeNotFound, appErr.Code)
	assert.Equal(t, "Task not found", appErr.Message)
	assert.Equal(t, []string{"id"}, appErr.Details)
}

func TestWithDetails_CopiesSlice(t *testing.T) {
	input := []string{"a", "b"}
	err := New(CodeValidation).WithDetails(input...)
	input[0] = "changed"

	assert.Equal(t, []string{"a", "b"}, err.Details)
}

func TestWithDetails_EmptyUsesNonNullSlice(t *testing.T) {
	err := New(CodeValidation).WithDetails()
	assert.NotNil(t, err.Details)
	assert.Empty(t, err.Details)
}
