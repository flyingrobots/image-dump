#!/bin/bash
# Setup script for development environment

echo "🔧 Setting up development environment..."

# Configure git to use our hooks directory
git config core.hooksPath .githooks

echo "✅ Git hooks configured"
echo ""
echo "📋 Development setup complete!"
echo ""
echo "Before pushing, the following checks will run automatically:"
echo "  - Tests with coverage"
echo "  - Console.log detection"
echo "  - Focused test detection"
echo "  - Docker build verification"
echo ""
echo "You can also run these checks manually with: make ci-local"