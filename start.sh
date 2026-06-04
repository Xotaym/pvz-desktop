#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "============================================"
echo "  Plants VS Zombies Desktop"
echo "============================================"

PY=python3
if ! command -v $PY >/dev/null 2>&1; then
    PY=python
fi
if ! command -v $PY >/dev/null 2>&1; then
    echo "[ERROR] Python not found! Install Python 3.10+"
    exit 1
fi

if [ "$(uname)" = "Darwin" ]; then
    USER_DATA="$HOME/Library/Application Support/pvz-desktop"
else
    USER_DATA="${XDG_DATA_HOME:-$HOME/.local/share}/pvz-desktop"
fi

echo "[paths] Working dir : $(pwd)"
echo "[paths] python      : $(command -v $PY)"
echo "[paths] venv        : $(pwd)/venv"
echo "[paths] requirements: $(pwd)/requirements.txt"
echo "[paths] server      : $(pwd)/server.py"
echo "[paths] user data   : $USER_DATA"
echo ""

if [ ! -x "venv/bin/python" ]; then
    echo "[1/3] Creating virtual environment..."
    $PY -m venv venv
fi

echo "[2/3] Installing dependencies..."
venv/bin/python -m pip install --upgrade pip --quiet
venv/bin/python -m pip install -r requirements.txt --quiet

echo "[3/3] Starting game..."
venv/bin/python server.py
