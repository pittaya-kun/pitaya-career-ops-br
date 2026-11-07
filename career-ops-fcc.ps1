# Career-Ops + FCC Launcher
# Coloque um atalho disto na Área de Trabalho / Iniciar

$careerOpsPath = "C:\Users\Pittaya Brand\Documents\0-pessoal\IA\career-ops"

Write-Host "=== Career-Ops + FCC ===" -ForegroundColor Cyan
Write-Host "Pasta: $careerOpsPath" -ForegroundColor Gray

Set-Location $careerOpsPath

Write-Host "`nIniciando FCC (serviço em background)..." -ForegroundColor Yellow
npx free-claude-code start

Write-Host "`nFCC rodando. Abrindo terminal conectado..." -ForegroundColor Green
Write-Host "Cole a URL da vaga quando aparecer o prompt.`n" -ForegroundColor Gray

# Mantém o terminal aberto e conectado ao FCC
npx free-claude-code