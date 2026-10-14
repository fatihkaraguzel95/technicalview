@echo off
title Claude Usage Monitor
cd /d "%~dp0"
node server.js
echo.
echo Sunucu durdu. Kapatmak icin bir tusa bas...
pause >nul
