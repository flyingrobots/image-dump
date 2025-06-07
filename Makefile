.PHONY: help build optimize optimize-force optimize-lfs test test-coverage test-watch clean rebuild lint-check

# Default target
help:
	@echo "Available commands:"
	@echo "  make test           - Run all tests and checks (same as CI)"
	@echo "  make build          - Build Docker images"
	@echo "  make rebuild        - Rebuild Docker images (no cache)"
	@echo "  make optimize       - Run image optimization"
	@echo "  make optimize-force - Force reprocess all images"
	@echo "  make optimize-lfs   - Optimize with Git LFS support"
	@echo "  make test-coverage  - Run tests with coverage only"
	@echo "  make test-watch     - Run tests in watch mode"
	@echo "  make lint-check     - Run lint checks only"
	@echo "  make clean          - Clean up Docker containers and images"

# Build Docker images
build:
	docker compose build

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
test: build
	@echo "🔍 Running CI checks..."
	@echo ""
	@echo "1️⃣ Running tests with coverage..."
	@docker compose run --rm test-coverage
	@echo ""
	@echo "2️⃣ Checking for console.log statements in src/..."
	@if grep -r "console\.log" src/ --exclude="*.test.js" --exclude-dir=node_modules; then \
		echo "❌ ERROR: Found console.log statements in production code"; \
		exit 1; \
	else \
		echo "✅ No console.log statements found"; \
	fi
	@echo ""
	@echo "3️⃣ Checking for focused tests (.only or .skip)..."
	@if grep -r "\.only\|\.skip" tests/; then \
		echo "❌ ERROR: Found .only or .skip in tests"; \
		exit 1; \
	else \
		echo "✅ No focused tests found"; \
	fi
	@echo ""
	@echo "4️⃣ Building all Docker services..."
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


# Run lint checks only
lint-check:
	@echo "🔍 Running lint checks..."
	@if grep -r "console\.log" src/ --exclude="*.test.js" --exclude-dir=node_modules; then \
		echo "❌ ERROR: Found console.log statements in production code"; \
		exit 1; \
	else \
		echo "✅ No console.log statements found"; \
	fi
	@if grep -r "\.only\|\.skip" tests/; then \
		echo "❌ ERROR: Found .only or .skip in tests"; \
		exit 1; \
	else \
		echo "✅ No focused tests found"; \
	fi