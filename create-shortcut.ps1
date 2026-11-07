# Cria atalho "Career-Ops + FCC" na Área de Trabalho e no Menu Iniciar

$scriptPath = "C:\Users\Pittaya Brand\Documents\0-pessoal\IA\career-ops\career-ops-fcc.ps1"
$iconPath   = "C:\Users\Pittaya Brand\Documents\0-pessoal\IA\career-ops\.fcc\app-icon.ico"
$name       = "Career-Ops + FCC"

$shell = New-Object -ComObject WScript.Shell

# Área de Trabalho
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcut = $shell.CreateShortcut("$desktop\$name.lnk")
$shortcut.TargetPath = "powershell.exe"
$shortcut.Arguments = "-NoExit -ExecutionPolicy Bypass -File `"$scriptPath`""
$shortcut.WorkingDirectory = "C:\Users\Pittaya Brand\Documents\0-pessoal\IA\career-ops"
$shortcut.IconLocation = $iconPath
$shortcut.Description = "Abre Career-Ops com FCC (Free Claude Code)"
$shortcut.Save()

# Menu Iniciar (Programs)
$startMenu = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs"
$shortcut2 = $shell.CreateShortcut("$startMenu\$name.lnk")
$shortcut2.TargetPath = "powershell.exe"
$shortcut2.Arguments = "-NoExit -ExecutionPolicy Bypass -File `"$scriptPath`""
$shortcut2.WorkingDirectory = "C:\Users\Pittaya Brand\Documents\0-pessoal\IA\career-ops"
$shortcut2.IconLocation = $iconPath
$shortcut2.Description = "Abre Career-Ops com FCC (Free Claude Code)"
$shortcut2.Save()

Write-Host "Atalhos criados:" -ForegroundColor Green
Write-Host "  Área de Trabalho: $desktop\$name.lnk"
Write-Host "  Menu Iniciar: $startMenu\$name.lnk"