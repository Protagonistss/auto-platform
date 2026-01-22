.PHONY: install install-backend install-frontend

# Default target: Install all dependencies
install: install-backend install-frontend

# Install backend dependencies (using uv)
install-backend:
	@echo "Installing backend dependencies with uv..."
	cd auto-backend && uv pip install -e ".[dev]"

# Install frontend dependencies (using pnpm)
install-frontend:
	@echo "Installing frontend dependencies with pnpm..."
	cd auto-chat && pnpm install
