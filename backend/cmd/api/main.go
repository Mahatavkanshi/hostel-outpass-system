package main

import (
	"log"

	"hostel-outpass-system/backend/internal/config"
	"hostel-outpass-system/backend/internal/database"
	"hostel-outpass-system/backend/internal/handlers"
	"hostel-outpass-system/backend/internal/routes"
)

func main() {
	cfg := config.Load()
	db, err := database.Init(cfg)
	if err != nil {
		log.Fatal(err)
	}
	if err := database.CreateDefaultAdmin(db, cfg); err != nil {
		log.Fatal(err)
	}
	h := handlers.NewHandler(cfg, db)
	h.StartLateSweep()
	router := routes.SetupRouter(cfg, db, h)
	if err := router.Run(":" + cfg.Port); err != nil {
		log.Fatal(err)
	}
}
