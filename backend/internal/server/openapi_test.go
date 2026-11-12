package server

import (
	"context"
	"testing"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	openapi "github.com/your-organization/todolist/docs/openapi"
)

func TestOpenAPISpec_IsValid(t *testing.T) {
	loader := openapi3.NewLoader()
	doc, err := loader.LoadFromData(openapi.Spec)
	require.NoError(t, err)
	require.NoError(t, doc.Validate(context.Background()))

	assert.Equal(t, "3.0.3", doc.OpenAPI)
	require.NotNil(t, doc.Info)
	assert.NotEmpty(t, doc.Info.Title)
	assert.NotEmpty(t, doc.Info.Version)

	for _, path := range []string{"/health", "/ready", "/docs", "/openapi.yaml"} {
		item := doc.Paths.Find(path)
		require.NotNilf(t, item, "path %s must be documented", path)
		require.NotNilf(t, item.Get, "path %s must document GET", path)

		op := item.Get
		assert.NotEmptyf(t, op.Summary, "%s summary", path)
		assert.NotEmptyf(t, op.Description, "%s description", path)
		assert.NotEmptyf(t, op.OperationID, "%s operationId", path)
		assert.NotEmptyf(t, op.Tags, "%s tags", path)
		assert.NotEmptyf(t, op.Responses, "%s responses", path)
	}
}

func TestOpenAPISpec_MatchesRegisteredRoutes(t *testing.T) {
	loader := openapi3.NewLoader()
	doc, err := loader.LoadFromData(openapi.Spec)
	require.NoError(t, err)

	router := newTestRouter(fakePinger{}, true)
	registered := make(map[string]struct{})
	for _, route := range router.Routes() {
		registered[route.Path] = struct{}{}
	}

	for path := range doc.Paths.Map() {
		_, ok := registered[path]
		assert.Truef(t, ok, "documented path %s is not registered", path)
	}
	for path := range registered {
		assert.NotNilf(t, doc.Paths.Find(path), "registered path %s is not documented", path)
	}
}
