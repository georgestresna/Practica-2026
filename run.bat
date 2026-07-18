@echo off
docker compose down --remove-orphans
docker image prune -f
docker compose up --build
pause
