@echo off
cd /d "%~dp0"
docker compose -f docker-compose.dev.yml up -d --build
echo.
echo Yooba Land site: http://localhost:8088
echo Game page:       http://localhost:8088/Game/
echo.
