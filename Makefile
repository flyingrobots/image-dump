.PHONY: help build optimize optimize-force optimize-lfs test test-coverage test-watch clean

# Default target
help:
	@echo "Available commands:"
	@echo "  make build          - Build Docker images"
	@echo "  make optimize       - Run image optimization"
	@echo "  make optimize-force - Force reprocess all images"
	@echo "  make optimize-lfs   - Optimize with Git LFS support"
	@echo "  make test           - Run tests"
	@echo "  make test-coverage  - Run tests with coverage"
	@echo "  make test-watch     - Run tests in watch mode"
	@echo "  make clean          - Clean up Docker containers and images"

# Build Docker images
build:
	docker-compose build

# Run optimization
optimize: build
	docker-compose run --rm optimize

# Force reprocess all images
optimize-force: build
	docker-compose run --rm optimize-force

# Run with Git LFS support
optimize-lfs: build
	docker-compose run --rm optimize-lfs

# Run tests
test: build
	docker-compose run --rm test

# Run tests with coverage
test-coverage: build
	docker-compose run --rm test-coverage

# Run tests in watch mode
test-watch: build
	docker-compose run --rm test-watch

# Clean up
clean:
	docker-compose down -v
	docker system prune -f