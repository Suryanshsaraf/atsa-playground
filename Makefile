.PHONY: help install dev test test-backend build clean docker-up docker-down

help:
	@echo "ATSA Playground - Developer Commands"
	@echo "  make install      Install backend and frontend dependencies"
	@echo "  make dev          Start backend and frontend development servers"
	@echo "  make test         Run all unit and integration tests"
	@echo "  make build        Build production frontend bundle"
	@echo "  make docker-up    Spin up Docker Compose environment"
	@echo "  make docker-down  Tear down Docker Compose containers"
	@echo "  make clean        Remove cache files and build artifacts"

install:
	@echo "==> Setting up backend virtualenv..."
	python3 -m venv backend/venv
	./backend/venv/bin/pip install --upgrade pip
	./backend/venv/bin/pip install -r backend/requirements.txt pytest
	@echo "==> Installing frontend dependencies..."
	cd frontend && npm install

dev:
	@echo "==> Starting backend and frontend dev servers..."
	./backend/venv/bin/python backend/main.py &
	cd frontend && npm run dev

test: test-backend

test-backend:
	@echo "==> Running backend test suite with pytest..."
	./backend/venv/bin/pytest backend/

build:
	@echo "==> Building frontend production distribution..."
	cd frontend && npm run build

docker-up:
	docker-compose up --build -d

docker-down:
	docker-compose down

clean:
	@echo "==> Cleaning cache and build files..."
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
	rm -rf frontend/dist
