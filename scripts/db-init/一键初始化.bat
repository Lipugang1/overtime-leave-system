@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================
echo   调休管理系统 - 数据库初始化
echo ========================================
echo.
echo [1/2] 正在安装依赖...

REM 优先使用项目里的 npm，若找不到则用全局
if exist "..\..\node_modules\npm\bin\npm.cmd" (
  call "..\..\node_modules\npm\bin\npm.cmd" install --no-fund --no-audit 2>&1
) else (
  call npm install --no-fund --no-audit 2>&1
)

echo.
echo [2/2] 正在初始化数据库...
node init.js
echo.
pause
