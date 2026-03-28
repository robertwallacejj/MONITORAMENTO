Set-Location (Join-Path $PSScriptRoot '..')
Write-Host "Iniciando servidor em http://localhost:8000"
python -m http.server 8000
