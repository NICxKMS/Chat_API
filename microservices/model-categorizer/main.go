package main

import (
	"flag"
	"fmt"
	"log"
	"net"
	"os"
	"os/signal"
	"syscall"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/health"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/reflection"

	"github.com/chat-api/model-categorizer/handlers"
	"github.com/chat-api/model-categorizer/models/proto"
)

const (
	defaultPort = "8080"
)

func main() {
	// Parse command line flags
	enableLogging := flag.Bool("log", false, "Enable detailed request/response logging")
	port := flag.String("port", defaultPort, "Port to listen on")
	flag.Parse()

	// Get port from environment or use default
	envPort := os.Getenv("PORT")
	if envPort != "" {
		*port = envPort
	}

	// Create listener
	lis, err := net.Listen("tcp", fmt.Sprintf(":%s", *port))
	if err != nil {
		log.Fatalf("Failed to listen: %v", err)
	}

	// Create server options
	opts := []grpc.ServerOption{
		grpc.MaxRecvMsgSize(50 * 1024 * 1024), // 50MB
		grpc.MaxSendMsgSize(50 * 1024 * 1024), // 50MB
		grpc.Creds(insecure.NewCredentials()),
	}

	// Create a new gRPC server
	grpcServer := grpc.NewServer(opts...)

	// Create health check service
	healthServer := health.NewServer()
	healthpb.RegisterHealthServer(grpcServer, healthServer)
	healthServer.SetServingStatus("modelservice.ModelClassificationService", healthpb.HealthCheckResponse_SERVING)

	// Register our service handler
	handler := handlers.NewModelClassificationHandler(*enableLogging)

	// Register the service with gRPC server
	proto.RegisterModelClassificationServiceServer(grpcServer, handler)

	// Enable reflection for easier client development and debugging
	reflection.Register(grpcServer)

	// Log service startup
	fmt.Printf("Model Classification Service starting on port %s...\n", *port)
	if *enableLogging {
		log.Printf("Detailed request/response logging is enabled")
	}
	log.Printf("The service will classify models according to: provider, family, type, capabilities")
	log.Printf("Models are organized hierarchically by provider > type > version by default. Set hierarchical=false to use flat classification.")

	// Handle graceful shutdown
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh
		log.Println("Shutting down gRPC server...")
		grpcServer.GracefulStop()
	}()

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
