FROM golang:1.21-alpine AS builder

WORKDIR /app

# Copy go.mod and go.sum
COPY go.mod ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the binary
RUN CGO_ENABLED=0 GOOS=linux go build -o /model-categorizer

# Create a minimal production image
FROM alpine:latest

WORKDIR /

# Copy the binary from the builder stage
COPY --from=builder /model-categorizer /model-categorizer

# Expose port
EXPOSE 8080

# Run the binary
CMD ["/model-categorizer"] 