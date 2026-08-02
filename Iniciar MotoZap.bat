@echo off
title MotoZap - Servidor WhatsApp
cd /d "C:\Users\gabri\OneDrive\Área de Trabalho\APP DE MOTOBOY"
echo.
echo ====================================
echo   MotoZap - Servidor WhatsApp
echo ====================================
echo.
echo Iniciando servidor...
echo Quando aparecer o QR Code, escaneie com WhatsApp
echo.
echo Para parar o servidor: feche esta janela
echo ====================================
echo.
node baileys-server.js
echo.
echo ====================================
echo Servidor parou.
echo ====================================
pause