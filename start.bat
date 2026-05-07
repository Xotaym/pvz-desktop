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

if not exist "venv\Scripts\python.exe" (
    echo [1/3] Creating virtual environment...
    python -m venv venv
    venv\Scripts\python -m pip install --no-cache-dir --no-compile --disable-pip-version-check -r requirements.txt --quiet
    venv\Scripts\python -m pip uninstall -y pip setuptools wheel --quiet 2>nul
    if exist "venv\Lib\site-packages\pkg_resources" rmdir /s /q "venv\Lib\site-packages\pkg_resources" 2>nul
    for /d /r "venv\Lib\site-packages" %%d in (__pycache__) do @if exist "%%d" rmdir /s /q "%%d" 2>nul
)

echo [2/3] Dependencies ready.

echo [3/3] Starting game...
echo.
venv\Scripts\python server.py
