@echo off
cd /d "%~dp0"
echo Starting local dev server (npm run dev)...
echo Yooba Land site: http://localhost:8088
echo Game page:       http://localhost:8088/Game/
start "" "http://localhost:8088/"
call npm run dev -- --host 0.0.0.0 --port 8088
