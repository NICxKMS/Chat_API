#!/bin/bash

# Exit on error
set -e

echo "Generating gRPC code for Go..."

# Path to the proto file
PROTO_DIR="./models/proto"
PROTO_FILE="$PROTO_DIR/models.proto"

# Check if protoc is installed
if ! command -v protoc &> /dev/null; then
    echo "Error: protoc is not installed. Please install Protocol Buffers compiler."
    exit 1
fi

# Check if required Go plugins are installed
if ! command -v protoc-gen-go &> /dev/null; then
    echo "Installing protoc-gen-go..."
    go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
fi

if ! command -v protoc-gen-go-grpc &> /dev/null; then
    echo "Installing protoc-gen-go-grpc..."
    go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
fi

# Clean previous generated files
rm -f $PROTO_DIR/*.pb.go

# Generate Go code
echo "Generating Go code from $PROTO_FILE..."
protoc \
    --go_out=. \
    --go_opt=paths=source_relative \
    --go-grpc_out=. \
    --go-grpc_opt=paths=source_relative \
    $PROTO_FILE

echo "Go gRPC code generation complete!" 