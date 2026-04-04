@echo off
chcp 65001 >nul 2>&1
title PvZ Desktop Build
cd /d "%~dp0"

echo ============================================
echo   PvZ Desktop - Build .exe
echo ============================================
echo.

python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found! Install Python 3.10+ from python.org
    pause
    exit /b 1
)

echo [1/3] Installing dependencies...
pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b 1
)

echo [2/3] Cleaning previous build...
if exist "dist" rmdir /s /q "dist"
if exist "build" rmdir /s /q "build"

echo [3/3] Building .exe (1-3 minutes)...
echo.

pyinstaller --noconfirm --onedir --windowed --name "PvZ Desktop" --add-data "index.html;." --add-data "manifest.json;." --add-data "static;static" --hidden-import webview --hidden-import PIL --hidden-import win32gui --hidden-import win32con --hidden-import win32api --hidden-import clr server.py

if errorlevel 1 (
    echo.
    echo [ERROR] Build failed! Check errors above.
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Done!
echo   Output: dist\PvZ Desktop\
echo   Run:    dist\PvZ Desktop\PvZ Desktop.exe
echo ============================================
echo.
pause
