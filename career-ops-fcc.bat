@echo off
title Career-Ops + FCC
cd /d "C:\Users\Pittaya Brand\Documents\0-pessoal\IA\career-ops"

echo Iniciando FCC (serviço em background)...
npx free-claude-code start

echo.
echo FCC iniciado. Abrindo terminal conectado ao serviço...
echo Cole a URL da vaga quando aparecer o prompt.
echo.

cmd /k "npx free-claude-code"