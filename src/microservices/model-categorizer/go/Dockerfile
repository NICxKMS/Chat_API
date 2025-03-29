FROM golang:1.22-alpine AS builder

WORKDIR /app

# Install dependencies first (for better caching)
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o model-categorizer-service .

# Use a minimal alpine image for the final stage
FROM alpine:latest

# Add ca-certificates for HTTPS requests
RUN apk --no-cache add ca-certificates

WORKDIR /app

# Copy the binary from the builder stage
COPY --from=builder /app/model-categorizer-service .

# Expose the service port
EXPOSE 8080

# Run the service
CMD ["/app/model-categorizer-service"] 