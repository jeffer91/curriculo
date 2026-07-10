@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul

title SUBIR CURRICULO A GITHUB MAIN

REM =========================================================
REM Nombre completo: subir_github_total.bat
REM Ruta o ubicación: /CURRICULO/subir_github_total.bat
REM Función o funciones:
REM - Subir todo el proyecto local al repositorio GitHub.
REM - Subir directamente a la rama main.
REM - Reemplazar el contenido anterior de GitHub.
REM - Incluir también este archivo .bat en el repositorio.
REM - Verificar que el commit local y remoto coincidan.
REM =========================================================

REM ===== CONFIGURACIÓN =====
set "BRANCH=main"
set "REPO_URL=https://github.com/jeffer91/curriculo.git"
set "SCRIPT_NAME=%~nx0"

REM Recomendado dejar en NO.
REM node_modules no debe subirse porque vuelve pesado el repositorio.
set "SUBIR_NODE_MODULES=NO"

REM SI = borra/reemplaza lo anterior en GitHub rama main.
set "REEMPLAZAR_REMOTO=SI"

cd /d "%~dp0"

echo.
echo ========================================================
echo   SUBIDA TOTAL A GITHUB - RAMA MAIN
echo ========================================================
echo.
echo Carpeta del proyecto:
echo %CD%
echo.
echo Repositorio:
echo %REPO_URL%
echo.
echo Rama destino:
echo %BRANCH%
echo.
echo Archivo BAT que tambien se subira:
echo %SCRIPT_NAME%
echo.
echo ADVERTENCIA:
echo Esto reemplazara el contenido anterior del repositorio
echo en la rama main con lo que tienes actualmente en esta carpeta.
echo.
echo Tus archivos locales NO se borraran.
echo.

set /p CONFIRMAR=Escribe SI para continuar: 

if /I not "%CONFIRMAR%"=="SI" (
    echo.
    echo Operacion cancelada.
    pause
    exit /b 0
)

echo.
echo ========================================================
echo   1. VERIFICANDO GIT
echo ========================================================
echo.

where git >nul 2>&1
if errorlevel 1 (
    echo ERROR: Git no esta instalado o no esta agregado al PATH.
    echo Instala Git para Windows y vuelve a intentar.
    pause
    exit /b 1
)

git --version
if errorlevel 1 goto ERROR_GENERAL

echo.
echo ========================================================
echo   2. INICIALIZANDO O VALIDANDO REPOSITORIO LOCAL
echo ========================================================
echo.

if not exist ".git" (
    echo No existe .git. Inicializando repositorio...
    git init
    if errorlevel 1 goto ERROR_GENERAL
) else (
    echo Repositorio local detectado correctamente.
)

git config core.longpaths true
git config core.autocrlf true

for /f "delims=" %%A in ('git config user.name 2^>nul') do set "GIT_NAME=%%A"
for /f "delims=" %%A in ('git config user.email 2^>nul') do set "GIT_EMAIL=%%A"

if not defined GIT_NAME (
    git config user.name "%USERNAME%"
)

if not defined GIT_EMAIL (
    echo.
    set /p EMAIL_INPUT=Escribe tu correo de GitHub: 
    if not defined EMAIL_INPUT (
        echo ERROR: Debes escribir un correo para crear el commit.
        pause
        exit /b 1
    )
    git config user.email "!EMAIL_INPUT!"
)

echo.
echo ========================================================
echo   3. CONFIGURANDO REMOTO GITHUB
echo ========================================================
echo.

git remote get-url origin >nul 2>&1
if errorlevel 1 (
    git remote add origin "%REPO_URL%"
    if errorlevel 1 goto ERROR_GENERAL
) else (
    git remote set-url origin "%REPO_URL%"
    if errorlevel 1 goto ERROR_GENERAL
)

git remote -v

echo.
echo ========================================================
echo   4. PREPARANDO .GITIGNORE
echo ========================================================
echo.

if /I "%SUBIR_NODE_MODULES%"=="NO" (
    call :AGREGAR_GITIGNORE "node_modules/"
    call :AGREGAR_GITIGNORE ".env"
    call :AGREGAR_GITIGNORE ".env.local"
    call :AGREGAR_GITIGNORE "*.log"
    call :AGREGAR_GITIGNORE "npm-debug.log*"
    call :AGREGAR_GITIGNORE ".DS_Store"
    echo Se ignorara node_modules y archivos sensibles/pesados.
) else (
    echo ATENCION: node_modules tambien se intentara subir.
    echo Esto puede hacer fallar o volver muy pesada la subida.
)

echo.
echo ========================================================
echo   5. VERIFICANDO ARCHIVOS GRANDES
echo ========================================================
echo.

set "TMP_LARGE=%TEMP%\github_large_files_%RANDOM%.txt"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
"$subirNode = '%SUBIR_NODE_MODULES%' -eq 'SI';" ^
"Get-ChildItem -LiteralPath . -Recurse -Force -File |" ^
"Where-Object {" ^
"  $_.FullName -notmatch '\\.git\\' -and" ^
"  ($subirNode -or $_.FullName -notmatch '\\node_modules\\') -and" ^
"  $_.Length -gt 95MB" ^
"} | ForEach-Object {" ^
"  '{0:N2} MB    {1}' -f ($_.Length / 1MB), $_.FullName" ^
"}" > "%TMP_LARGE%"

for %%A in ("%TMP_LARGE%") do set "SIZE_LARGE=%%~zA"

if defined SIZE_LARGE (
    if %SIZE_LARGE% GTR 0 (
        echo.
        echo ERROR: Se encontraron archivos mayores a 95 MB.
        echo GitHub puede rechazar archivos de 100 MB o mas.
        echo.
        type "%TMP_LARGE%"
        echo.
        del "%TMP_LARGE%" >nul 2>&1
        pause
        exit /b 1
    )
)

del "%TMP_LARGE%" >nul 2>&1

echo No se encontraron archivos demasiado grandes.

echo.
echo ========================================================
echo   6. CREANDO COMMIT LIMPIO PARA MAIN
echo ========================================================
echo.

set "TEMP_BRANCH=subida_total_%RANDOM%_%RANDOM%"

if /I "%REEMPLAZAR_REMOTO%"=="SI" (
    echo Creando rama temporal limpia...
    git checkout --orphan "%TEMP_BRANCH%"
    if errorlevel 1 goto ERROR_GENERAL

    git rm -r --cached . >nul 2>&1

    echo.
    echo Agregando archivos del proyecto...
    git add -A
    if errorlevel 1 goto ERROR_GENERAL

    echo.
    echo Forzando inclusion de este BAT:
    echo %SCRIPT_NAME%

    git add -f "%SCRIPT_NAME%"
    if errorlevel 1 goto ERROR_GENERAL

    echo.
    echo Archivos preparados:
    git status --short

    echo.
    echo Creando commit...
    git commit -m "Subida total del proyecto a main"
    if errorlevel 1 goto ERROR_GENERAL

    echo.
    echo Renombrando rama a main...
    git branch -M "%BRANCH%"
    if errorlevel 1 goto ERROR_GENERAL
) else (
    echo Usando rama main normal...
    git checkout -B "%BRANCH%"
    if errorlevel 1 goto ERROR_GENERAL

    git add -A
    if errorlevel 1 goto ERROR_GENERAL

    git add -f "%SCRIPT_NAME%"
    if errorlevel 1 goto ERROR_GENERAL

    git commit -m "Actualizacion completa del proyecto"
    if errorlevel 1 (
        echo No hubo cambios nuevos para confirmar.
    )
)

echo.
echo ========================================================
echo   7. SUBIENDO A GITHUB EN RAMA MAIN
echo ========================================================
echo.

if /I "%REEMPLAZAR_REMOTO%"=="SI" (
    git push -u origin "%BRANCH%" --force
    if errorlevel 1 goto ERROR_PUSH
) else (
    git push -u origin "%BRANCH%"
    if errorlevel 1 goto ERROR_PUSH
)

echo.
echo ========================================================
echo   8. VERIFICANDO COMMIT LOCAL VS REMOTO
echo ========================================================
echo.

set "LOCAL_HASH="
set "REMOTE_HASH="

for /f "delims=" %%A in ('git rev-parse HEAD') do set "LOCAL_HASH=%%A"
for /f "tokens=1" %%A in ('git ls-remote origin refs/heads/%BRANCH%') do set "REMOTE_HASH=%%A"

echo Commit local:
echo %LOCAL_HASH%
echo.
echo Commit remoto:
echo %REMOTE_HASH%
echo.

if /I not "%LOCAL_HASH%"=="%REMOTE_HASH%" (
    echo ERROR: El commit local y remoto NO coinciden.
    echo La subida no se puede considerar correcta.
    pause
    exit /b 1
)

echo.
echo ========================================================
echo   9. VERIFICANDO QUE EL BAT FUE INCLUIDO
echo ========================================================
echo.

git ls-files | findstr /I /X "%SCRIPT_NAME%" >nul 2>&1
if errorlevel 1 (
    echo ERROR: El archivo BAT no quedo versionado.
    echo Revisa si el nombre del archivo cambio.
    pause
    exit /b 1
)

for /f %%A in ('git ls-files ^| find /c /v ""') do set "TOTAL_ARCHIVOS=%%A"

echo.
echo ========================================================
echo   SUBIDA COMPLETADA CORRECTAMENTE
echo ========================================================
echo.
echo Repositorio:
echo %REPO_URL%
echo.
echo Rama:
echo %BRANCH%
echo.
echo Archivo BAT incluido:
echo %SCRIPT_NAME%
echo.
echo Total de archivos versionados:
echo %TOTAL_ARCHIVOS%
echo.
echo Verificacion correcta:
echo El commit local coincide con el commit remoto.
echo.

pause
exit /b 0


:AGREGAR_GITIGNORE
set "LINEA=%~1"

if not exist ".gitignore" (
    type nul > ".gitignore"
)

findstr /x /c:"%LINEA%" ".gitignore" >nul 2>&1
if errorlevel 1 (
    echo %LINEA%>>".gitignore"
)

exit /b 0


:ERROR_PUSH
echo.
echo ========================================================
echo   ERROR AL SUBIR A GITHUB
echo ========================================================
echo.
echo Posibles causas:
echo - No iniciaste sesion en GitHub desde Git.
echo - No tienes permisos para subir al repositorio.
echo - El repositorio remoto no existe.
echo - La rama main esta protegida contra force push.
echo - Hay archivos demasiado grandes.
echo.
pause
exit /b 1


:ERROR_GENERAL
echo.
echo ========================================================
echo   ERROR EN EL PROCESO
echo ========================================================
echo.
echo La subida se detuvo para evitar dejar el repositorio mal.
echo Revisa el mensaje de error que aparece arriba.
echo.
pause
exit /b 1