// Package openapi menyediakan spesifikasi OpenAPI yang di-embed ke binary
// agar endpoint /openapi.yaml tetap bekerja tanpa membawa folder docs.
package openapi

import _ "embed"

// Spec adalah isi docs/openapi/openapi.yaml.
//
//go:embed openapi.yaml
var Spec []byte
