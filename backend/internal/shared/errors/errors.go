// Package errors menyediakan application error sederhana yang dapat
// diterjemahkan menjadi HTTP response konsisten.
package errors

import (
	stderrors "errors"
	"fmt"
	"net/http"
)

// Code adalah kode error yang stabil dan aman ditampilkan ke client.
type Code string

// Kode error yang dipakai lintas module.
const (
	CodeValidation         Code = "VALIDATION_ERROR"
	CodeBadRequest         Code = "BAD_REQUEST"
	CodeNotFound           Code = "NOT_FOUND"
	CodeUnauthorized       Code = "UNAUTHORIZED"
	CodeForbidden          Code = "FORBIDDEN"
	CodeConflict           Code = "CONFLICT"
	CodeMethodNotAllowed   Code = "METHOD_NOT_ALLOWED"
	CodeInternal           Code = "INTERNAL_SERVER_ERROR"
	CodeServiceUnavailable Code = "SERVICE_UNAVAILABLE"
)

// AppError membawa kode, pesan aman, status HTTP, dan optional cause.
type AppError struct {
	Code       Code
	Message    string
	HTTPStatus int
	Details    []string
	Err        error
}

// Error mengembalikan representasi untuk log. Pesan ini tidak boleh
// dikirim langsung ke client karena bisa memuat detail internal.
func (e *AppError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %s: %v", e.Code, e.Message, e.Err)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// Unwrap mempertahankan rantai error untuk errors.Is/errors.As.
func (e *AppError) Unwrap() error {
	return e.Err
}

// New membuat AppError dengan pesan dan status default untuk kode tersebut.
func New(code Code) *AppError {
	return &AppError{
		Code:       code,
		Message:    defaultMessage(code),
		HTTPStatus: defaultStatus(code),
		Details:    []string{},
	}
}

// NewWithMessage membuat AppError dengan pesan yang aman untuk client.
func NewWithMessage(code Code, message string) *AppError {
	err := New(code)
	if message != "" {
		err.Message = message
	}
	return err
}

// Wrap membungkus error internal dengan kode aplikasi.
func Wrap(err error, code Code) *AppError {
	if err == nil {
		return nil
	}
	appErr := New(code)
	appErr.Err = err
	return appErr
}

// WithDetails menambahkan detail validasi yang aman ditampilkan.
func (e *AppError) WithDetails(details ...string) *AppError {
	if len(details) == 0 {
		e.Details = []string{}
		return e
	}
	e.Details = append([]string{}, details...)
	return e
}

// From memetakan error apa pun menjadi AppError. Error yang tidak dikenal
// selalu menjadi INTERNAL_SERVER_ERROR agar detail internal tidak bocor.
func From(err error) *AppError {
	if err == nil {
		return New(CodeInternal)
	}

	var appErr *AppError
	if stderrors.As(err, &appErr) {
		return appErr
	}
	return Wrap(err, CodeInternal)
}

func defaultStatus(code Code) int {
	switch code {
	case CodeValidation:
		return http.StatusUnprocessableEntity
	case CodeBadRequest:
		return http.StatusBadRequest
	case CodeNotFound:
		return http.StatusNotFound
	case CodeUnauthorized:
		return http.StatusUnauthorized
	case CodeForbidden:
		return http.StatusForbidden
	case CodeConflict:
		return http.StatusConflict
	case CodeMethodNotAllowed:
		return http.StatusMethodNotAllowed
	case CodeServiceUnavailable:
		return http.StatusServiceUnavailable
	default:
		return http.StatusInternalServerError
	}
}

func defaultMessage(code Code) string {
	switch code {
	case CodeValidation:
		return "Validation failed"
	case CodeBadRequest:
		return "Bad request"
	case CodeNotFound:
		return "Resource not found"
	case CodeUnauthorized:
		return "Unauthorized"
	case CodeForbidden:
		return "Forbidden"
	case CodeConflict:
		return "Conflict"
	case CodeMethodNotAllowed:
		return "Method not allowed"
	case CodeServiceUnavailable:
		return "Service unavailable"
	default:
		return "Something went wrong"
	}
}
