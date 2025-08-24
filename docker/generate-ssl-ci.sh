#!/bin/bash
# Generate self-signed SSL certificates for CI environment

set -e

echo "🔑 Generating self-signed SSL certificates for CI..."

# Create ssl directory if it doesn't exist
mkdir -p docker/ssl

# Generate private key
openssl genrsa -out docker/ssl/localhost.key 2048

# Generate certificate
openssl req -new -x509 -key docker/ssl/localhost.key -out docker/ssl/localhost.crt -days 365 -subj "/C=US/ST=CA/L=San Francisco/O=Motion Detector/OU=CI/CN=localhost"

echo "✅ SSL certificates generated successfully for CI environment"
echo "Certificate: docker/ssl/localhost.crt"
echo "Private Key: docker/ssl/localhost.key"