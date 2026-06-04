@echo off
chcp 65001 >nul 2>&1
title Plants VS Zombies Desktop
cd /d "%~dp0"

echo ============================================
echo   Plants VS Zombies Desktop
echo ============================================
echo.

echo [paths] Working dir : %CD%
echo [paths] Script dir  : %~dp0
echo [paths] venv        : %CD%\venv
echo [paths] requirements: %CD%\requirements.txt
echo [paths] server      : %CD%\server.py
if defined LOCALAPPDATA (
    echo [paths] user data   : %LOCALAPPDATA%\pvz-desktop
) else (
    echo [paths] user data   : %USERPROFILE%\AppData\Local\pvz-desktop
)
echo.

python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found! Install Python 3.10+ from python.org
    echo Or build .exe: run build.bat
    pause
    exit /b 1
)
for /f "delims=" %%p in ('where python 2^>nul') do (
    echo [paths] python      : %%p
    goto :py_found
)
:py_found
echo.

if not exist "venv\Scripts\python.exe" (
    echo [1/3] Creating virtual environment...
    python -m venv venv
)

echo [2/3] Installing dependencies...
venv\Scripts\python -m pip install --disable-pip-version-check -r requirements.txt --quiet

echo [3/3] Starting game...
echo.
venv\Scripts\python server.py
