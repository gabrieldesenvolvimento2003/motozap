@echo off
REM ============================================================
REM MotoZap build script
REM
REM Workaround: Flutter snapshot generator fails on paths with
REM non-ASCII chars (e.g. "Área de Trabalho"). So we keep a
REM mirrored copy at C:\motozap_build_temp (ASCII-only) and
REM use this script to keep them in sync.
REM
REM Uso: build_release.bat
REM ============================================================

setlocal

set SRC=C:\Users\gabri\OneDrive\Área de Trabalho\APP DE MOTOBOY\motozap
set DEST=C:\motozap_build_temp

echo [1/3] Syncing lib/ from %SRC% to %DEST%...
robocopy "%SRC%\lib" "%DEST%\lib" /MIR /NJH /NJS /NDL /NFL >nul
if %ERRORLEVEL% GEQ 8 (
    echo ERROR: robocopy failed
    exit /b 1
)

echo [2/3] Syncing pubspec.yaml...
copy /Y "%SRC%\pubspec.yaml" "%DEST%\pubspec.yaml" >nul

echo [3/3] Building release APK...
cd /d "%DEST%"
call flutter build apk --release
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: flutter build failed
    exit /b 1
)

for %%I in ("%DEST%\build\app\outputs\flutter-apk\app-release.apk") do (
    echo.
    echo ============================================================
    echo APK gerado: %%~fI
    echo Tamanho:    %%~zI bytes
    echo SHA256:     powershell -Command "(Get-FileHash '%%~fI' -Algorithm SHA256).Hash"
    echo ============================================================
)

echo.
echo Proximo passo: adb install -r "%DEST%\build\app\outputs\flutter-apk\app-release.apk"
endlocal
