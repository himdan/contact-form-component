.PHONY: up down build logs clean ps reset test

up:
	docker-compose up -d

down:
	docker-compose down

build:
	docker-compose build

logs:
	docker-compose logs -f

clean:
	docker-compose down -v
	docker system prune -f

ps:
	docker-compose ps

reset:
	docker-compose down -v
	docker-compose up --build -d

test:
	docker-compose exec backend npm test

backend-shell:
	docker-compose exec backend sh

db-shell:
	docker-compose exec postgres psql -U postgres -d contact_db

frontend-logs:
	docker-compose logs -f frontend

backend-logs:
	docker-compose logs -f backend

db-logs:
	docker-compose logs -f postgres

# Production commands
prod-build:
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

prod-up:
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

prod-down:
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml down