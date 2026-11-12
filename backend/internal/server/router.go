package server

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"github.com/your-organization/todolist/internal/config"
	healthcontrollers "github.com/your-organization/todolist/internal/health/controllers"
	healthroutes "github.com/your-organization/todolist/internal/health/routes"
	"github.com/your-organization/todolist/internal/middleware"
	apperrors "github.com/your-organization/todolist/internal/shared/errors"
	"github.com/your-organization/todolist/internal/shared/response"
)

// Dependencies berisi komponen yang dirakit di composition root.
type Dependencies struct {
	Pinger      healthcontrollers.Pinger
	OpenAPISpec []byte
}

// NewRouter membuat engine Gin, middleware, dan seluruh route foundation.
func NewRouter(cfg config.Config, logger *zap.Logger, deps Dependencies) *gin.Engine {
	if cfg.App.Env == config.EnvDevelopment || cfg.App.Env == config.EnvTest {
		gin.SetMode(gin.DebugMode)
	} else {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()
	router.HandleMethodNotAllowed = true

	// Urutan: RequestID -> Logger -> Recovery -> CORS.
	// RequestID paling awal agar semua log punya korelasi; Logger sebelum
	// Recovery agar status 500 hasil recovery tetap tercatat.
	router.Use(
		middleware.RequestID(),
		middleware.Logger(logger),
		middleware.Recovery(logger),
		middleware.CORS(cfg.CORS.AllowedOrigins, cfg.CORS.AllowCredentials),
	)

	healthController := healthcontrollers.NewHealthController(deps.Pinger, logger)
	healthroutes.Register(router, healthController)

	registerDocumentation(router, cfg, deps.OpenAPISpec)

	router.NoRoute(func(c *gin.Context) {
		response.AbortWithError(c, apperrors.NewWithMessage(apperrors.CodeNotFound, "Route not found"))
	})
	router.NoMethod(func(c *gin.Context) {
		response.AbortWithError(c, apperrors.New(apperrors.CodeMethodNotAllowed))
	})

	return router
}

func registerDocumentation(router *gin.Engine, cfg config.Config, spec []byte) {
	router.GET("/openapi.yaml", func(c *gin.Context) {
		c.Data(200, "application/yaml; charset=utf-8", spec)
	})

	if !cfg.App.SwaggerEnabled {
		return
	}

	router.GET("/docs", func(c *gin.Context) {
		c.Data(200, "text/html; charset=utf-8", []byte(swaggerHTML))
	})
}

// Addr membentuk alamat listen dari port aplikasi.
func Addr(port int) string {
	return ":" + strconv.Itoa(port)
}
