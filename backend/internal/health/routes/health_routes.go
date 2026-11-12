// Package routes mendaftarkan endpoint module health.
package routes

import (
	"github.com/gin-gonic/gin"

	"github.com/your-organization/todolist/internal/health/controllers"
)

// Register memasang endpoint health di luar prefix /api/v1 agar dapat
// dipakai probe infrastruktur tanpa autentikasi.
func Register(router *gin.Engine, controller *controllers.HealthController) {
	router.GET("/health", controller.Health)
	router.GET("/ready", controller.Ready)
}
