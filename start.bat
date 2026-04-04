@echo off
chcp 65001 >nul 2>&1
title Plants VS Zombies Desktop
cd /d "%~dp0"

echo ============================================
echo   Plants VS Zombies Desktop
echo ============================================
echo.

python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found! Install Python 3.10+ from python.org
    echo Or build .exe: run build.bat
    pause
    exit /b 1
)

echo [1/2] Installing dependencies...
pip install -r requirements.txt --quiet 2>nul

echo [2/2] Starting game...
echo.
python server.py

pause
