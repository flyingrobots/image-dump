#!/bin/bash
set -e

echo "🔍 Running CI checks..."
echo ""

echo "1️⃣ Running ESLint..."
docker compose run --rm -T lint || (echo "❌ Lint failed!" && exit 1)
echo ""

# Build only if needed (when called from pre-push hook)
if [ "$DOCKER_BUILD_NEEDED" = "1" ]; then
    echo "🔨 Source files changed, rebuilding Docker images..."
    docker compose build test-coverage
    if [ $? -eq 0 ] && [ -n "$DOCKER_BUILD_CHECKSUM_FILE" ]; then
        echo "$DOCKER_BUILD_CHECKSUM" > "$DOCKER_BUILD_CHECKSUM_FILE"
    fi
elif [ -z "$DOCKER_BUILD_NEEDED" ]; then
    echo "🔨 Building Docker images (manual run)..."
    docker compose build test-coverage
else
    echo "✅ Using cached Docker images (no source changes detected)"
fi

echo ""
echo "2️⃣ Running tests with coverage..."
docker compose run --rm -T test-coverage

echo ""
if [ "${SKIP_DOCKER_BUILD:-0}" = "1" ]; then
    echo "⏭️  Skipping Docker build (SKIP_DOCKER_BUILD=1)."
elif [ "${DOCKER_BUILD_NEEDED:-0}" = "1" ]; then
    echo "3️⃣ Building all Docker services..."
    docker compose build
else
    echo "✅ Using cached Docker images (no source changes detected)"
fi

echo ""
echo "✅ All checks passed!"
