@echo off
title Servidor Node.js - Cadastro Senior
color 0A

:: Mudar para o diretório do script
cd /d %~dp0

:: Verificar se o Node.js está instalado
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [ERRO] Node.js nao encontrado!
    echo Por favor, instale o Node.js antes de executar este script.
    echo.
    pause
    exit /b 1
)

:: Verificar se as dependências estão instaladas
if not exist "node_modules" (
    echo.
    echo [INFO] Instalando dependencias...
    npm install
    if %errorlevel% neq 0 (
        echo.
        echo [ERRO] Falha ao instalar dependencias!
        echo.
        pause
        exit /b 1
    )
)

:: Limpar a tela
cls

echo.
echo =======================================
echo    Servidor de Cadastro Senior
echo =======================================
echo.
echo [INFO] Verificacoes concluidas
echo [INFO] Iniciando o servidor...
echo.

:: Iniciar o servidor
node server.js

:: Se o servidor parar, aguardar input antes de fechar
echo.
echo [INFO] Servidor finalizado
echo.
pause