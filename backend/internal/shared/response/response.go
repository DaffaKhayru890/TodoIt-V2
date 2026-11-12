// Package response menyediakan envelope HTTP yang konsisten.
package response

import (
	"net/http"

	"github.com/gin-gonic/gin"

	apperrors "github.com/your-organization/todolist/internal/shared/errors"
)

type envelope struct {
	Success bool       `json:"success"`
	Message string     `json:"message"`
	Data    any        `json:"data,omitempty"`
	Error   *errorBody `json:"error,omitempty"`
}

type errorBody struct {
	Code    string   `json:"code"`
	Details []string `json:"details"`
}

// Success mengirim response 200 dengan data opsional.
func Success(c *gin.Context, message string, data any) {
	write(c, http.StatusOK, envelope{Success: true, Message: message, Data: data})
}

// Created mengirim response 201 dengan data opsional.
func Created(c *gin.Context, message string, data any) {
	write(c, http.StatusCreated, envelope{Success: true, Message: message, Data: data})
}

// NoContent mengirim response 204 tanpa body.
func NoContent(c *gin.Context) {
	c.Status(http.StatusNoContent)
	c.Writer.WriteHeaderNow()
}

// Error mengirim response error tanpa menghentikan chain middleware.
func Error(c *gin.Context, err error) {
	writeError(c, err, false)
}

// AbortWithError mengirim response error lalu menghentikan chain middleware.
func AbortWithError(c *gin.Context, err error) {
	writeError(c, err, true)
}

func writeError(c *gin.Context, err error, abort bool) {
	appErr := apperrors.From(err)
	details := append([]string{}, appErr.Details...)
	status := appErr.HTTPStatus
	if status < 100 || status > 599 {
		status = http.StatusInternalServerError
	}

	if abort {
		c.AbortWithStatusJSON(status, envelope{
			Success: false,
			Message: appErr.Message,
			Error:   &errorBody{Code: string(appErr.Code), Details: details},
		})
		return
	}
	write(c, status, envelope{
		Success: false,
		Message: appErr.Message,
		Error:   &errorBody{Code: string(appErr.Code), Details: details},
	})
}

func write(c *gin.Context, status int, payload envelope) {
	c.JSON(status, payload)
}
