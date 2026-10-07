@echo off
echo [1/2] Starting WhisperFlow Backend...
start "WhisperFlow Backend" cmd /k "cd /d "%~dp0backend" && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
timeout /t 3 /nobreak > nul
echo [2/2] Starting WhisperFlow Frontend...
start "WhisperFlow Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"
timeout /t 4 /nobreak > nul
echo.
echo WhisperFlow is starting!
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:8000
echo.
start http://localhost:3000
