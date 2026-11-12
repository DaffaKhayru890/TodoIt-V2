package database

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDSN_EncodesPassword(t *testing.T) {
	dsn := DSN(Options{
		Host:           "postgres",
		Port:           5432,
		User:           "root",
		Password:       "dev@123",
		Name:           "todolist",
		SSLMode:        "disable",
		ConnectTimeout: 10 * time.Second,
	})

	assert.Contains(t, dsn, "dev%40123")
	assert.NotContains(t, dsn, "dev@123")
	assert.Contains(t, dsn, "postgres://root:")
	assert.Contains(t, dsn, "@postgres:5432/todolist")
	assert.Contains(t, dsn, "sslmode=disable")
	assert.Contains(t, dsn, "connect_timeout=10")
}

func TestDSN_DefaultSSLModes(t *testing.T) {
	dsn := DSN(Options{
		Host: "localhost",
		Port: 5432,
		User: "user",
		Name: "todolist",
	})
	assert.Contains(t, dsn, "sslmode=")
}

func TestOpen_ConnectionFailure(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	db, err := Open(ctx, Options{
		Host:               "127.0.0.1",
		Port:               1,
		User:               "nobody",
		Password:           "secret",
		Name:               "todolist",
		SSLMode:            "disable",
		MaxIdleConnections: 1,
		MaxOpenConnections: 1,
		ConnMaxLifetime:    time.Minute,
		ConnMaxIdleTime:    time.Minute,
		ConnectTimeout:     time.Second,
	})

	require.Error(t, err)
	assert.Nil(t, db)
	assert.NotContains(t, err.Error(), "secret")
}

func TestPing_NilDatabase(t *testing.T) {
	err := Ping(context.Background(), nil)
	require.Error(t, err)
	assert.True(t, strings.Contains(err.Error(), "not initialized"))
}

func TestClose_NilDatabase(t *testing.T) {
	assert.NoError(t, Close(nil))
}
