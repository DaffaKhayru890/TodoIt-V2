//go:build integration

package integration

import (
	"context"
	"net/url"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/your-organization/todolist/internal/database"
)

// TestPostgresConnection memverifikasi koneksi nyata ke database test.
// Test ini hanya jalan dengan build tag integration dan TEST_DATABASE_URL.
func TestPostgresConnection(t *testing.T) {
	rawURL := strings.TrimSpace(os.Getenv("TEST_DATABASE_URL"))
	if rawURL == "" {
		t.Skip("TEST_DATABASE_URL is not set")
	}

	parsed, err := url.Parse(rawURL)
	require.NoError(t, err)

	dbName := strings.TrimPrefix(parsed.Path, "/")
	require.NotEmpty(t, dbName)
	require.Truef(t, strings.HasSuffix(strings.ToLower(dbName), "_test"),
		"refusing to run integration test against non-test database %q", dbName)

	port := 5432
	if parsed.Port() != "" {
		port, err = strconv.Atoi(parsed.Port())
		require.NoError(t, err)
	}
	password, _ := parsed.User.Password()
	sslMode := parsed.Query().Get("sslmode")
	if sslMode == "" {
		sslMode = "disable"
	}

	opts := database.Options{
		Host:               parsed.Hostname(),
		Port:               port,
		User:               parsed.User.Username(),
		Password:           password,
		Name:               dbName,
		SSLMode:            sslMode,
		MaxIdleConnections: 2,
		MaxOpenConnections: 5,
		ConnMaxLifetime:    time.Minute,
		ConnMaxIdleTime:    time.Minute,
		ConnectTimeout:     5 * time.Second,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	db, err := database.Open(ctx, opts)
	require.NoError(t, err)
	t.Cleanup(func() {
		assert.NoError(t, database.Close(db))
	})

	sqlDB, err := db.DB()
	require.NoError(t, err)
	assert.NoError(t, sqlDB.PingContext(ctx))
	assert.Equal(t, 5, sqlDB.Stats().MaxOpenConnections)
}
