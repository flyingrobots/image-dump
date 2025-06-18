.PHONY: help build setup optimize optimize-force optimize-lfs test test-coverage test-watch clean rebuild lint-check lint-fix

# Default target
help:
	@echo "Available commands:"
	@echo "  make setup          - Set up the project (git hooks, directories, etc.)"
	@echo "  make test           - Run all tests and checks (same as CI)"
	@echo "  make build          - Build Docker images"
	@echo "  make rebuild        - Rebuild Docker images (no cache)"
	@echo "  make optimize       - Run image optimization"
	@echo "  make optimize-force - Force reprocess all images"
	@echo "  make optimize-lfs   - Optimize with Git LFS support"
	@echo "  make test-coverage  - Run tests with coverage only"
	@echo "  make test-watch     - Run tests in watch mode"
	@echo "  make lint-check     - Run ESLint checks in Docker"
	@echo "  make lint-fix       - Run ESLint with auto-fix in Docker"
	@echo "  make clean          - Clean up Docker containers and images"

# Initial project setup
setup:
	@echo "🚀 Setting up Image Dump project..."
	@echo ""
	@echo "1️⃣ Checking Docker installation..."
	@if ! command -v docker >/dev/null 2>&1; then \
		echo "❌ Docker is not installed!"; \
		echo "Please install Docker from https://www.docker.com/"; \
		exit 1; \
	else \
		echo "✅ Docker is installed"; \
	fi
	@if ! docker compose version >/dev/null 2>&1; then \
		echo "❌ Docker Compose is not available!"; \
		echo "Please ensure you have Docker Compose v2"; \
		exit 1; \
	else \
		echo "✅ Docker Compose is available"; \
	fi
	@echo ""
	@echo "2️⃣ Creating required directories..."
	@mkdir -p original optimized coverage
	@echo "✅ Directories created"
	@echo ""
	@echo "3️⃣ Configuring Git hooks..."
	@git config core.hooksPath .githooks
	@echo "✅ Git hooks configured"
	@echo ""
	@echo "4️⃣ Building Docker images..."
	@$(MAKE) build
	@echo ""
	@echo "5️⃣ Creating example configuration..."
	@if [ ! -f .imagerc ]; then \
		echo '{\n  "outputDir": "optimized",\n  "formats": ["webp", "avif"],\n  "quality": {\n    "webp": 85,\n    "avif": 80,\n    "jpg": 85\n  },\n  "generateThumbnails": true,\n  "thumbnailWidth": 300\n}' > .imagerc; \
		echo "✅ Created .imagerc with default settings"; \
	else \
		echo "✅ .imagerc already exists"; \
	fi
	@echo ""
	@echo "✨ Setup complete! You're ready to optimize images."
	@echo ""
	@echo "Next steps:"
	@echo "  1. Place images in the 'original' directory"
	@echo "  2. Run 'make optimize' to process them"
	@echo ""
	@echo "Git hooks installed:"
	@echo "  • pre-commit: Runs ESLint before each commit"
	@echo "  • pre-push: Runs full test suite before push"

# Build Docker images (with dependency checking)
build:
	@echo "🔨 Building Docker images..."
	@# Check if package.json has changed
	@if [ -f .docker-build-hash ]; then \
		CURRENT_HASH=$$(md5sum package.json 2>/dev/null || md5 -q package.json 2>/dev/null || echo "none"); \
		STORED_HASH=$$(cat .docker-build-hash 2>/dev/null || echo ""); \
		if [ "$$CURRENT_HASH" = "$$STORED_HASH" ]; then \
			echo "✅ package.json unchanged, using existing images"; \
		else \
			echo "📦 package.json changed, rebuilding images..."; \
			docker compose build && echo "$$CURRENT_HASH" > .docker-build-hash; \
		fi; \
	else \
		echo "🔨 First build, creating images..."; \
		CURRENT_HASH=$$(md5sum package.json 2>/dev/null || md5 -q package.json 2>/dev/null || echo "none"); \
		docker compose build && echo "$$CURRENT_HASH" > .docker-build-hash; \
	fi

# Run optimization
optimize: build
	docker compose run --rm optimize

# Force reprocess all images
optimize-force: build
	docker compose run --rm optimize-force

# Run with Git LFS support
optimize-lfs: build
	docker compose run --rm optimize-lfs

# Run tests (exactly as CI does)
test:
	@echo "🔍 Running CI checks..."
	@echo ""
	@echo "1️⃣ Running ESLint..."
	@OPTIMIZE_FLAGS="" docker compose run --rm -T lint || (echo "❌ Lint failed!" && exit 1)
	@echo ""
	@# Build only if needed (when called from pre-push hook)
	@if [ "$$DOCKER_BUILD_NEEDED" = "1" ]; then \
		echo "🔨 Source files changed, rebuilding Docker images..."; \
		docker compose build test-coverage; \
		if [ $$? -eq 0 ] && [ -n "$$DOCKER_BUILD_CHECKSUM_FILE" ]; then \
			echo "$$DOCKER_BUILD_CHECKSUM" > "$$DOCKER_BUILD_CHECKSUM_FILE"; \
		fi; \
	elif [ -z "$$DOCKER_BUILD_NEEDED" ]; then \
		echo "🔨 Building Docker images (manual run)..."; \
		docker compose build test-coverage; \
	else \
		echo "✅ Using cached Docker images (no source changes detected)"; \
	fi
	@echo ""
	@echo "2️⃣ Running tests with coverage..."
	@docker compose run --rm test-coverage
	@echo ""
	@echo "3️⃣ Building all Docker services..."
	@docker compose build
	@echo ""
	@echo "✅ All checks passed!"

# Run tests with coverage
test-coverage: build
	docker compose run --rm test-coverage

# Run tests in watch mode
test-watch: build
	docker compose run --rm test-watch

# Clean up
clean:
	docker compose down -v
	docker system prune -f

# Rebuild Docker images (no cache)
rebuild:
	docker compose build --no-cache


# Run lint checks in Docker
lint-check:
	@echo "🔍 Running ESLint checks in Docker..."
	@OPTIMIZE_FLAGS="" docker compose run --rm -T lint

# Run lint with auto-fix in Docker
lint-fix:
	@echo "🔧 Running ESLint with auto-fix in Docker..."
	@OPTIMIZE_FLAGS="" docker compose run --rm -T -e LINT_COMMAND=lint:fix lint