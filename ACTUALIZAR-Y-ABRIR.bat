@echo off
setlocal EnableExtensions
title Curriculo - Actualizar e iniciar
cd /d "%~dp0"

echo.
echo ==============================================
echo   CURRICULO - ACTUALIZAR E INICIAR
echo ==============================================
echo.

where git >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Git no esta instalado o no esta disponible.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js y npm no estan disponibles.
  pause
  exit /b 1
)

rem Evita que Git abra un editor para confirmar mensajes de combinacion.
set GIT_MERGE_AUTOEDIT=no
git config merge.autoEdit no >nul 2>&1

rem Completa automaticamente una combinacion anterior cuando no tiene conflictos.
git rev-parse -q --verify MERGE_HEAD >nul 2>&1
if not errorlevel 1 (
  git diff --name-only --diff-filter=U | findstr . >nul
  if not errorlevel 1 (
    echo [ERROR] La actualizacion anterior tiene conflictos pendientes.
    echo Revisa los archivos indicados a continuacion:
    git status --short
    echo.
    pause
    exit /b 1
  )

  echo [1/3] Finalizando actualizacion anterior...
  git -c core.editor=true commit --no-edit
  if errorlevel 1 goto :error_actualizacion
)

echo [1/3] Buscando actualizaciones...
git -c core.editor=true pull --rebase --autostash
if errorlevel 1 goto :error_actualizacion

echo [2/3] Cerrando una ventana anterior de Curriculo...
taskkill /IM electron.exe /F >nul 2>&1

echo [3/3] Iniciando Curriculo...
echo.
call npm start
exit /b %errorlevel%

:error_actualizacion
echo.
echo [ERROR] No se pudo completar la actualizacion.
echo Tus cambios locales no fueron borrados.
echo.
git status --short
echo.
pause
exit /b 1
