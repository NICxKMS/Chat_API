package main

import (
	"fmt"
	"log"
	"net"
	"os"

	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"

	"github.com/chat-api/model-categorizer/handlers"
	"github.com/chat-api/model-categorizer/models/proto"
)

const (
	defaultPort = "8080"
)

func main() {
	// Get port from environment or use default
	port := os.Getenv("PORT")
	if port == "" {
		port = defaultPort
	}

	// Create listener
	lis, err := net.Listen("tcp", fmt.Sprintf(":%s", port))
	if err != nil {
		log.Fatalf("Failed to listen: %v", err)
	}

	// Create a new gRPC server
	grpcServer := grpc.NewServer()

	// Register our service handler
	handler := handlers.NewModelClassificationHandler()

	// Register the service with gRPC server
	proto.RegisterModelClassificationServiceServer(grpcServer, handler)

	// Enable reflection for easier client development and debugging
	reflection.Register(grpcServer)

	// For this implementation, we'll use a manual setup approach
	fmt.Printf("Model Classification Service starting on port %s...\n", port)
	log.Printf("The service will classify models according to: provider, family, type, capabilities")

	// Start serving
	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("Failed to serve: %v", err)
	}
}

// This is a simplified example for demonstration purposes.
// In a production environment, you would:
// 1. Use proper proto file generation with protoc
// 2. Add proper error handling and logging
// 3. Add configuration for TLS/SSL
// 4. Add metrics collection
// 5. Add health checks
// 6. Add graceful shutdown
