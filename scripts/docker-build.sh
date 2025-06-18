#!/bin/bash
set -e

echo "🔨 Building Docker images..."

# Check if package.json has changed
if [ -f .docker-build-hash ]; then
    CURRENT_HASH=$(md5sum package.json 2>/dev/null || md5 -q package.json 2>/dev/null || echo "none")
    STORED_HASH=$(cat .docker-build-hash 2>/dev/null || echo "")
    
    if [ "$CURRENT_HASH" = "$STORED_HASH" ]; then
        echo "✅ package.json unchanged, using existing images"
        exit 0
    else
        echo "📦 package.json changed, rebuilding images..."
        docker compose build && echo "$CURRENT_HASH" > .docker-build-hash
    fi
else
    echo "🔨 First build, creating images..."
    CURRENT_HASH=$(md5sum package.json 2>/dev/null || md5 -q package.json 2>/dev/null || echo "none")
    docker compose build && echo "$CURRENT_HASH" > .docker-build-hash
fi